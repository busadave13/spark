<!-- SPARK -->

# FEAT-002: Correct Replay Matching

> **Version**: 2.1<br>
> **Created**: 2026-04-14<br>
> **Last Updated**: 2026-04-20<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Implemented

## Goal

Implement deterministic request fingerprinting so Mockery replays a stored mock only when the incoming request's target and materially relevant shape exactly match the original recorded request. The fingerprint algorithm must live in the Core layer, remain HTTP-agnostic, and produce consistent keys from method, scheme+authority, path, query, configured relevant headers, and normalized body content.

## Motivation

PRD Goal 3 ("Preserve replay correctness for recorded upstream interactions") and FR-003/FR-004 require that a stored response is replayed only when the request target and request shape align, and that any change in method, destination, path, query, or materially relevant input shape produces a non-match. Architecture Principle 2 ("Correctness beats hit rate") reinforces that stricter matching is preferred even when it produces more misses and more recording. Without a precise fingerprinting implementation, Mockery cannot guarantee that replayed responses correspond to the actual upstream behavior the developer expects, undermining developer trust and debugging accuracy.

## User Stories

- As a **Service Developer**, I want outbound requests to replay the correct stored response based on the full request shape so that my local tests produce the same results as real upstream calls.
- As a **Service Developer**, I want a request with a different query string or body to bypass a stored mock and hit the real upstream so that I don't receive stale or incorrect data during debugging.
- As a **Platform / Developer Experience Team** member, I want fingerprint computation to be deterministic and well-defined so that I can reason about which mocks will match without inspecting internal state.
- As a **Security / Compliance Reviewer**, I want the fingerprint to include all materially relevant request components so that distinct upstream interactions are never conflated in the mock store.

## Acceptance Criteria

- [x] A request fingerprint is computed deterministically from method, scheme+authority, path, query, configured relevant headers, and normalized body content — identical inputs always produce the same fingerprint string.
- [x] A stored mock is replayed only when the incoming request fingerprint exactly matches a stored fingerprint; no partial or fuzzy matching is applied.
- [x] A change in method, destination (scheme+authority), path, query, any configured relevant header value, or body content produces a different fingerprint (non-match), causing a store miss.
- [x] Body content beyond `Mockery:Matching:MaxBodyBytes` (default 262144) is truncated before fingerprinting; only the first `MaxBodyBytes` bytes are considered.
- [x] Fingerprint computation resides in the Core layer (the Mockery Core namespace) and does not reference `HttpContext`, `HttpRequest`, or any ASP.NET Core transport type.
- [x] The fingerprinting service is registered via .NET dependency injection and can be resolved by consuming Core services without modifying existing DI registrations.
- [x] When relevant headers are absent from a request, the fingerprint treats them as absent (empty string value) rather than omitting them, ensuring two requests — one with and one without a relevant header — produce different fingerprints.
- [x] If a `RequestDescriptor` is constructed with a null or empty `Method` or `SchemeAndAuthority`, the fingerprint computer still produces a deterministic hash without throwing — callers are responsible for providing valid input, and the Core layer does not impose transport-level validation.

## API / Interface Definition

External HTTP surface: N/A — this feature introduces only internal Core interfaces in `Mockery.Core.Matching`; it does not add or change any HTTP endpoint, HTTP status code, or HTTP error response shape. Transport-boundary validation and HTTP error shaping remain the responsibility of the proxy transport and other HTTP-facing features.

This feature introduces internal Core interfaces; no new HTTP endpoints are added.

### `IRequestFingerprintComputer`

Computes a deterministic fingerprint from a normalized request descriptor.

```csharp
namespace Mockery.Core.Matching;

public interface IRequestFingerprintComputer
{
    /// <summary>
    /// Computes a deterministic fingerprint string from the given request descriptor.
    /// </summary>
    /// <param name="request">The normalized request descriptor to fingerprint.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A stable, deterministic fingerprint string.</returns>
    string ComputeFingerprint(RequestDescriptor request, CancellationToken cancellationToken = default);
}
```

### `RequestDescriptor` (immutable record)

Transport-agnostic representation of the materially relevant parts of an HTTP request, constructed by the Transport/Handler layer before passing into Core.

```csharp
namespace Mockery.Core.Matching;

/// <summary>
/// Transport-agnostic normalized request representation used for fingerprinting.
/// Constructed by the handler/transport layer; consumed by Core services.
/// </summary>
/// <param name="Method">HTTP method, upper-cased (e.g., "GET", "POST"). Required.</param>
/// <param name="SchemeAndAuthority">Scheme + authority of the destination (e.g., "https://api.example.com"). Required.</param>
/// <param name="Path">Request path including leading slash (e.g., "/v2/forecast"). Required; empty path uses "/".</param>
/// <param name="Query">Query string without leading "?" with parameters sorted by key (e.g., "city=seattle&units=metric"). Required; empty if no query.</param>
/// <param name="RelevantHeaders">Relevant header values keyed by lower-cased header name, ordered alphabetically by key. Required; empty dictionary if none configured.</param>
/// <param name="BodyContent">Normalized body bytes, truncated to MaxBodyBytes before construction. Required; empty if no body or body not relevant.</param>
/// <param name="BodyHashOverride">Optional pre-computed body hash. When non-null, the fingerprint computer uses this value instead of hashing BodyContent. Used by the manual mock flow to supply a stored body hash without requiring the original body bytes.</param>
public sealed record RequestDescriptor(
    string Method,
    string SchemeAndAuthority,
    string Path,
    string Query,
    IReadOnlyDictionary<string, string> RelevantHeaders,
    ReadOnlyMemory<byte> BodyContent,
    string? BodyHashOverride = null
);
```

### `MatchingOptions` (options record)

Bound from `Mockery:Matching:*` configuration keys via the .NET Options pattern.

```csharp
namespace Mockery.Core.Matching;

public sealed class MatchingOptions
{
    public const string SectionName = "Mockery:Matching";

    /// <summary>
    /// Comma-separated header names included in fingerprinting beyond method, authority, path, query, and body.
    /// Default: "Content-Type,Accept".
    /// </summary>
    public string RelevantHeaders { get; set; } = "Content-Type,Accept";

    /// <summary>
    /// Maximum body bytes considered for fingerprinting. Bodies longer than this are truncated.
    /// Default: 262144 (256 KB).
    /// </summary>
    public int MaxBodyBytes { get; set; } = 262_144;
}
```

### DI Registration

A single extension method registers the fingerprinting service additively — no existing registrations are modified.

```csharp
namespace Mockery.Core.Matching;

public static class MatchingServiceCollectionExtensions
{
    public static IServiceCollection AddMockeryMatching(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<MatchingOptions>(configuration.GetSection(MatchingOptions.SectionName));
        services.AddSingleton<IRequestFingerprintComputer, RequestFingerprintComputer>();
        return services;
    }
}
```

### Fingerprint Algorithm Contract

The `RequestFingerprintComputer` implementation must:

1. Concatenate fields in this fixed order, separated by `\n`:
   - `Method` (upper-cased)
   - `SchemeAndAuthority` (lower-cased)
   - `Path` (as-is, preserving case)
   - `Query` (parameters sorted by key, lower-cased keys, values as-is)
   - For each entry in `RelevantHeaders` (sorted by key): `key:value` (key lower-cased, value trimmed)
   - If `BodyHashOverride` is non-null, use it directly; otherwise compute SHA-256 hex digest of `BodyContent` bytes (empty body → SHA-256 of empty byte array)
2. Compute SHA-256 over the UTF-8 encoding of the concatenated string.
3. Return the result as a lowercase hexadecimal string (64 characters).

### Error Handling

`ComputeFingerprint` is a synchronous, pure computation. For this feature's interface contract, HTTP status codes and HTTP error response bodies do not apply because FEAT-002 has no HTTP endpoint surface. `ComputeFingerprint` does not throw for null or empty descriptor-field inputs; it produces a deterministic fingerprint instead. Boundary validation, request rejection, and any HTTP error shaping occur in the transport layer or in other HTTP-facing features before or after these Core interfaces are used. See Edge Cases & Error Handling for the full interface-level behaviour matrix.

## Data Model

### `RequestDescriptor`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Method` | `string` | Yes | HTTP method, upper-cased (e.g., `"GET"`, `"POST"`). |
| `SchemeAndAuthority` | `string` | Yes | Destination scheme and authority (e.g., `"https://api.example.com"`). |
| `Path` | `string` | Yes | Request path with leading slash. Defaults to `"/"` if empty. |
| `Query` | `string` | Yes | Sorted query string without leading `?`. Empty string if no query parameters. |
| `RelevantHeaders` | `IReadOnlyDictionary<string, string>` | Yes | Header values keyed by lower-cased name, sorted alphabetically. Empty dictionary if none configured. |
| `BodyContent` | `ReadOnlyMemory<byte>` | Yes | Normalized body bytes, pre-truncated to `MaxBodyBytes`. Empty if no body. |
| `BodyHashOverride` | `string?` | No | Optional pre-computed body hash. When non-null, the fingerprint computer uses this value instead of hashing `BodyContent`. Defaults to `null`. Used by the manual mock flow to supply a stored body hash. |

### `MatchingOptions`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `RelevantHeaders` | `string` | `"Content-Type,Accept"` | Comma-separated header names to include in fingerprinting. |
| `MaxBodyBytes` | `int` | `262144` | Maximum body bytes considered for fingerprinting; excess is truncated. |

### Fingerprint Output

| Property | Type | Description |
|----------|------|-------------|
| Fingerprint value | `string` | 64-character lowercase hexadecimal SHA-256 digest of the canonicalized request representation. |

## Edge Cases & Error Handling

| Scenario | Expected behaviour |
|----------|--------------------|
| Caller expects an HTTP status code or HTTP error response shape from this feature | Not applicable. FEAT-002 exposes only Core interfaces in `Mockery.Core.Matching`; HTTP validation failures and response shaping are defined by the transport layer and other HTTP-facing features. |
| Body exceeds `MaxBodyBytes` | Body is truncated to `MaxBodyBytes` before fingerprinting. The truncated body is hashed; no error is raised. Two requests with identical bodies up to `MaxBodyBytes` but differing beyond that limit produce the same fingerprint. |
| Body is empty or null | `BodyContent` is set to an empty `ReadOnlyMemory<byte>`. The SHA-256 of zero bytes (`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`) is used in the concatenated string. |
| A configured relevant header is absent from the request | The header is included in the fingerprint with an empty string value (`headername:`). This ensures a request missing the header produces a different fingerprint than one supplying it. |
| `Query` contains parameters in varying order | Query parameters are sorted by key before inclusion in the fingerprint. `?b=2&a=1` and `?a=1&b=2` produce the same fingerprint. |
| `Query` contains duplicate keys | Duplicate keys are preserved after sorting; `?a=1&a=2` is kept as `a=1&a=2`. Order among same-key entries is preserved from the original query string. |
| `Method` varies in casing | `Method` is upper-cased before fingerprinting. `"get"` and `"GET"` produce the same fingerprint. |
| `SchemeAndAuthority` varies in casing | `SchemeAndAuthority` is lower-cased before fingerprinting. `"HTTPS://API.Example.COM"` and `"https://api.example.com"` produce the same fingerprint. |
| `MaxBodyBytes` is configured to `0` | All body content is ignored for fingerprinting. The body hash is the SHA-256 of an empty byte array. |
| `RelevantHeaders` is configured to empty string | No headers are included in fingerprinting beyond method, authority, path, query, and body. The relevant-headers block of the canonical form is empty. |
| `CancellationToken` is cancelled before completion | `ComputeFingerprint` is synchronous and CPU-bound; it does not observe the token during hashing. The token parameter exists for interface-contract forward-compatibility. |

## Preservation Constraints

- **Existing service interface boundaries** (e.g., `IMockStore`) must not be modified.
- **Existing DI registrations** in `Program.cs` must remain unchanged.
- **`Program.cs` structure** — the `public partial class Program { }` declaration must not be removed.
- New fingerprinting types are registered additively via a new `AddMockeryMatching` extension method call appended to `Program.cs` service configuration, not by modifying any existing `Add*` or `Map*` call.

## Out of Scope

- Custom per-upstream normalization rules or fuzzy matching strategies.
- Fingerprint versioning or migration between fingerprint algorithm versions.
- Cache invalidation or expiration of stored mocks.
- Mock store lookup or persistence implementation (covered by separate features; this feature only produces the fingerprint key).
- Transport-layer body reading, buffering, or `HttpContext` extraction (responsibility of Handler/Transport layer, not this Core feature).

## Dependencies

- ADR-0003: Request target and shape matching — defines the architectural requirement that replays match on request target plus materially relevant request shape, which this feature implements as deterministic fingerprinting.
- ADR-0009: Core-owned request fingerprint canonicalization — mandates that all normalization rules (method, destination, path, query, relevant headers, body hashing) live in one Core-owned boundary so replay, recording, and manual-mock authoring stay consistent.

## Dependencies

- Implements **ADR-0003**: Request Target and Shape Matching — this feature is the concrete implementation of Mockery's correctness-first replay decision.
- Requires: Mockery Core namespace (within the proxy project) to host the new types.
- Requires: .NET 10 SDK with `System.Security.Cryptography` for SHA-256 (in-box, no additional NuGet package).
- Requires: `Microsoft.Extensions.Options` for `IOptions<MatchingOptions>` binding (already available via ASP.NET Core framework reference).

