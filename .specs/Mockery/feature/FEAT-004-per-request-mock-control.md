<!-- SPARK -->

# FEAT-004: Per-Request Mock Control

> **Version**: 2.1<br>
> **Created**: 2026-04-14<br>
> **Last Updated**: 2026-04-21<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved

## Goal

Enable developers and automation to activate mocking on a per-request basis using a single HTTP header (`X-Mockery-Mock`) whose value is a raw JSON object, and to selectively exclude specific outbound destinations from mocking so they reach real upstreams. The mock policy is carried as an immutable, request-scoped context object that propagates across downstream HTTP hops — with propagation depth controlled by the `maxHops` field in the JSON value — supporting mixed replay-and-passthrough flows within a single request trace.

## Motivation

This feature implements **PRD Goal 4** — support hybrid debugging with per-request mock control.

It satisfies the following functional requirements:

- **FR-007**: The system shall record outbound requests and replay stored responses when mocking has been explicitly enabled for that request.
- **FR-008**: The system shall allow selected outbound destinations to bypass replay and reach the real upstream when a request's mock policy marks those destinations for passthrough.
- **FR-010**: The system shall allow the same request pipeline to contain both replayed calls and real upstream calls when selective passthrough is used for part of that request.

The feature is grounded in **ADR-0004** (Propagated Request-Scoped Mock Policy), **ADR-0006** (Single Mock Header), and **ADR-0008** (Controlled Propagation Depth via maxHops in X-Mockery-Mock JSON value), which mandate that mock policy be propagated via a single request header carrying a JSON value — not via mutable static state or process-wide toggles — with explicit depth control.

## User Stories

- As a **Service Developer**, I want to activate mocking per request and optionally exclude selected outbound destinations so that I can debug mixed real-and-mocked request flows without restarting services.
- As a **Service Developer**, I want requests without the mock header to pass through untouched so that existing traffic is unaffected by Mockery's presence.
- As a **Platform / Developer Experience Team member**, I want mock policy to be request-scoped and header-driven so that shared development workflows can toggle mocking without environment-level configuration changes.

## Acceptance Criteria

- [x] When the `X-Mockery-Mock` header is present with a valid JSON value (e.g. `{"maxHops": 0, "excludeHosts": []}`), mocking is activated for all outbound destinations not listed in `excludeHosts` (replay from store, record on miss).
- [x] When the `excludeHosts` array in the JSON value contains hostnames, those hosts passthrough to real upstreams while all other destinations are mocked.
- [x] When the `excludeHosts` array is empty or omitted, all outbound destinations are mocked (equivalent to the previous `All` behavior).
- [x] When no `X-Mockery-Mock` header is present, no mock evaluation occurs — full passthrough to real upstreams.
- [x] Hosts listed in the `Mockery:Capture:ExcludedHosts` configuration always passthrough to real upstreams regardless of the header value.
- [x] Malformed JSON in the `X-Mockery-Mock` header value returns HTTP 400 with a `ProblemDetails` response containing error code `MOCKERY_POLICY_INVALID_JSON`.
- [x] When the JSON value omits `maxHops`, it defaults to `0`. When the JSON value omits `excludeHosts`, it defaults to `[]`. An empty JSON object `{}` is valid and means mock everything, don't propagate.
- [x] Mock policy is represented as an immutable request-scoped context object and is never stored in mutable static state.
- [x] Mock policy propagates to downstream HTTP hops via the `X-Mockery-Mock` header so that a single trace can mix replayed and real upstream calls (per FR-010). Propagation is conditional on `maxHops` — when `0` (or defaulted), the mock header is not forwarded downstream; when `N > 0`, it is forwarded with `maxHops` decremented by 1. Full propagation behavior is specified in FEAT-005.
- [x] The `maxHops` field in the JSON value is parsed as a non-negative integer and captured in `MockPolicy.MaxHops` for downstream propagation control.

## API / Interface Definition

Authentication: None — Mockery is a development-time proxy accessible only within the local workstation or cloud-dev sandbox trust boundary.

This contract applies to every reverse-proxied request accepted by Mockery's HTTP transport boundary. `X-Forwarded-Host` remains required on the surrounding proxy request so the boundary can resolve the current upstream target while this feature parses the optional `X-Mockery-Mock` header.

### Inbound Headers

| Header | Type | Required | Description |
|---|---|---|---|
| `X-Mockery-Mock` | `string` (raw JSON object) | No | Activates mock evaluation. Value is a raw JSON object with optional fields `maxHops` (non-negative integer, default `0`) and `excludeHosts` (string array, default `[]`). Presence of the header activates mocking; absence means full passthrough — no mock evaluation occurs. Example: `{"maxHops": 2, "excludeHosts": ["example.com"]}`. An empty JSON object `{}` is valid and means mock everything, don't propagate. |

The header name is configurable via:

| Configuration Key | Default Value |
|---|---|
| `Mockery:Policy:MockHeader` | `X-Mockery-Mock` |

### Request Processing Outcomes

| Input | Boundary Behaviour |
|---|---|
| `X-Mockery-Mock` absent | The request continues in full passthrough mode. No policy-parse error is returned, and downstream matching / forwarding components behave as if mocking is inactive for the current request. |
| `X-Mockery-Mock` present with valid JSON | The transport boundary parses a host-neutral `MockPolicy` contract, attaches it to the current request as `IMockPolicyFeature`, and downstream handlers use that policy for replay / passthrough / record decisions. |

### Policy Context Object

```csharp
/// <summary>
/// Immutable, request-scoped mock policy resolved from the inbound header JSON value and configuration.
/// This is a host-neutral contract that belongs in Mockery.Shared.
/// </summary>
public sealed record MockPolicy
{
    /// <summary>Pre-built inactive policy instance (header absent).</summary>
    public static MockPolicy Inactive { get; }

    /// <summary>Whether mocking is activated for this request (header present with valid JSON).</summary>
    public bool IsActive { get; init; }

    /// <summary>
    /// Hosts that bypass mocking and reach real upstreams. Combines hosts from the JSON
    /// <c>excludeHosts</c> array and hosts from <c>Mockery:Capture:ExcludedHosts</c> configuration.
    /// An empty set means all destinations are mocked.
    /// Supports leading-wildcard patterns (e.g. <c>*.example.com</c>).
    /// </summary>
    public ImmutableHashSet<string> ExcludedHosts { get; init; } = ImmutableHashSet<string>.Empty;

    /// <summary>
    /// Raw JSON string from the <c>X-Mockery-Mock</c> header for re-serialization
    /// during propagation to downstream hops.
    /// </summary>
    public string HeaderValue { get; init; } = string.Empty;

    /// <summary>
    /// Remaining downstream propagation depth from the <c>maxHops</c> field in the
    /// <c>X-Mockery-Mock</c> JSON value. <c>0</c> (default) means the mock header is not
    /// forwarded to downstream services. <c>N &gt; 0</c> means the mock header is forwarded
    /// with <c>maxHops</c> decremented by 1 on each outbound hop.
    /// </summary>
    public int MaxHops { get; init; }

    /// <summary>
    /// Computed property: <c>true</c> when mock policy is active and <c>MaxHops &gt; 0</c>,
    /// indicating the mock header should be forwarded downstream.
    /// </summary>
    public bool ShouldPropagate => IsActive && MaxHops > 0;

    /// <summary>
    /// Determines whether the given <paramref name="host"/> should bypass mocking and
    /// passthrough to the real upstream. Supports leading-wildcard patterns.
    /// </summary>
    public bool ShouldPassthrough(string host);

    /// <summary>
    /// Returns a copy with <c>MaxHops</c> decremented by 1 (minimum 0) and
    /// <c>HeaderValue</c> cleared for re-serialization by the propagation layer.
    /// Returns <see cref="Inactive"/> if the current policy is not active.
    /// </summary>
    public MockPolicy DecrementMaxHops();
}
```

### Error Response

When the header value is invalid, the transport boundary returns HTTP 400 with a `ProblemDetails` body:

```json
{
  "type": "https://mockery.dev/errors/invalid-mock-policy",
  "title": "Invalid Mock Policy",
  "status": 400,
  "detail": "<specific description of the validation failure>",
  "extensions": {
    "errorCode": "<MOCKERY_POLICY_*>"
  }
}
```

Error codes:

| Error Code | Condition |
|---|---|
| `MOCKERY_POLICY_INVALID_HEADER_VALUE` | `X-Mockery-Mock` header is present but contains an empty value or whitespace-only value. |
| `MOCKERY_POLICY_INVALID_JSON` | `X-Mockery-Mock` header value is not valid JSON, or contains fields with invalid types (e.g. `maxHops` is negative, non-integer, or non-numeric; `excludeHosts` is not an array or contains non-string elements). |

## Data Model

### `MockPolicy` (immutable record)

| Property | Type | Description |
|---|---|---|
| `IsActive` | `bool` | `true` when the `X-Mockery-Mock` header is present with a valid JSON value; `false` otherwise. |
| `ExcludedHosts` | `ImmutableHashSet<string>` | Immutable union of hosts from the JSON `excludeHosts` array and `Mockery:Capture:ExcludedHosts` configuration. Empty set means all destinations are mocked. Supports leading-wildcard patterns (e.g. `*.example.com`). |
| `HeaderValue` | `string` | Raw JSON string from the `X-Mockery-Mock` header, preserved for re-serialization during propagation to downstream hops. Empty when the policy is inactive or when the value has been consumed after decrement. |
| `MaxHops` | `int` | Remaining downstream propagation depth from the `maxHops` field in the `X-Mockery-Mock` JSON value. `0` (default, or when the field is omitted) means the mock header is not forwarded downstream. `N > 0` means forward and decrement. |
| `ShouldPropagate` | `bool` (computed) | `true` when `IsActive && MaxHops > 0`; indicates the mock header should be forwarded to downstream calls. |

### `MockeryPolicyOptions` (configuration POCO)

| Property | Type | Default | Maps to |
|---|---|---|---|
| `MockHeader` | `string` | `"X-Mockery-Mock"` | `Mockery:Policy:MockHeader` |
| `ForwardedHostHeader` | `string` | `"X-Forwarded-Host"` | `Mockery:Policy:ForwardedHostHeader` |

### Request-Scoped Storage

`MockPolicy` is the host-neutral contract shared through Mockery.Shared. The ASP.NET-specific `IMockPolicyFeature` wrapper and `HttpContext.Features` storage remain inside Mockery's transport boundary only; Mockery.Shared does not depend on `HttpContext`. The policy must not be stored in `AsyncLocal<T>`, static fields, or any other process-wide mutable state.

```csharp
public interface IMockPolicyFeature
{
    MockPolicy Policy { get; }
}
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|---|---|
| `X-Mockery-Mock` header is absent | Full passthrough — no mock evaluation occurs. `MockPolicy.IsActive` is `false`. |
| `X-Mockery-Mock: {}` | Mock everything, don't propagate. `MockPolicy.IsActive` is `true`, `MockPolicy.ExcludedHosts` is empty, `MockPolicy.MaxHops` is `0`. |
| `X-Mockery-Mock: {"maxHops": 0, "excludeHosts": []}` | Mock everything, don't propagate. Equivalent to `{}`. |
| `X-Mockery-Mock: {"maxHops": 2, "excludeHosts": ["host1.com","host2.com"]}` | Mock everything except listed hosts — listed hosts passthrough to real upstreams. `MockPolicy.IsActive` is `true`, `MockPolicy.ExcludedHosts` contains the listed hosts, `MockPolicy.MaxHops` is `2`. |
| `X-Mockery-Mock: {"excludeHosts": ["host1.com"]}` | `maxHops` defaults to `0`. Mock everything except `host1.com`; mock header is not forwarded downstream. |
| `X-Mockery-Mock: {"maxHops": 3}` | `excludeHosts` defaults to `[]`. Mock all destinations; forward mock header downstream with `maxHops` decremented to `2`. |
| `X-Mockery-Mock` header value is not valid JSON (e.g. `"All"`, `"host1,host2"`, `"{bad"`) | Return 400 `ProblemDetails` with error code `MOCKERY_POLICY_INVALID_JSON`. |
| `X-Mockery-Mock` header value is empty string or whitespace-only | Return 400 `ProblemDetails` with error code `MOCKERY_POLICY_INVALID_HEADER_VALUE`. |
| `X-Mockery-Mock` header appears multiple times in the request | Use the first value; ignore subsequent values. |
| `X-Mockery-Mock` value has leading/trailing whitespace (e.g. `" {} "`) | Trim and parse; accept if the trimmed value is valid JSON. |
| JSON value contains `null` for `maxHops` or `excludeHosts` | Treat as omitted — use defaults (`maxHops: 0`, `excludeHosts: []`). |
| JSON value contains extra/unknown fields (e.g. `{"maxHops": 1, "debug": true}`) | Ignore unknown fields; parse only `maxHops` and `excludeHosts`. |
| `maxHops` is a negative number (e.g. `{"maxHops": -1}`) | Return 400 `ProblemDetails` with error code `MOCKERY_POLICY_INVALID_JSON`. |
| `maxHops` is a non-integer value (e.g. `{"maxHops": "abc"}`, `{"maxHops": 1.5}`) | Return 400 `ProblemDetails` with error code `MOCKERY_POLICY_INVALID_JSON`. |
| `excludeHosts` contains non-string elements (e.g. `{"excludeHosts": [123]}`) | Return 400 `ProblemDetails` with error code `MOCKERY_POLICY_INVALID_JSON`. |
| Host in the `excludeHosts` JSON array also appears in `Mockery:Capture:ExcludedHosts` | No conflict — both sources agree the host should passthrough. Deduplicate into a single entry in `ExcludedHosts`. |
| `Mockery:Capture:ExcludedHosts` matches a destination while `excludeHosts` is `[]` | The config-excluded host always passes through; it is never mocked regardless of the header value. |
| `maxHops` is `0` | `MockPolicy.MaxHops` is `0`. Mock header is not forwarded downstream. Mocking still applies to the current service's own outbound calls. |
| `maxHops` is `3` | `MockPolicy.MaxHops` is `3`. Mock header is forwarded downstream with `maxHops` decremented to `2`. |

## Preservation Constraints

- Existing middleware pipeline registration order in `Program.cs` must not be disrupted. The new policy-resolution middleware must be registered additively — it must not replace, reorder, or remove any existing middleware.
- The `MockPolicy` object is immutable by design (sealed record with `init`-only properties). This preserves the architectural constraint from ADR-0004 that request-scoped policy must not rely on mutable static state.

## Out of Scope

- Persistent per-service or per-environment mock policies — this feature covers only per-request activation via headers.
- Authentication or authorization for mock control headers.
- UI or dashboard for managing mock policies.
- Policy persistence across requests or service restarts — always request-scoped, re-parsed per request.

## Dependencies

- **ADR-0004**: Propagated Request-Scoped Mock Policy — defines the architectural decision that this feature implements.
- **ADR-0006**: Single Mock Header — defines the single-header JSON value design replacing the previous multi-header scheme.
- **ADR-0008**: Controlled Propagation Depth via maxHops in X-Mockery-Mock JSON value — defines the `maxHops` field for controlling downstream propagation depth within the single mock header.
- **Mockery.Shared host-neutral contracts**: Own the `MockPolicy` model plus header-serialization helpers that can be reused across services and the proxy.
- **Mockery HTTP transport boundary component**: Accepts reverse-proxied outbound requests, reads the `X-Forwarded-Host` header to resolve the original upstream target, and parses the `X-Mockery-Mock` header's JSON value into a `MockPolicy`.
- **Mockery transport boundary state**: Owns `IMockPolicyFeature` and `HttpContext.Features` storage for the current request only.
- **Policy resolution and matching core component**: Computes request fingerprints, applies the `MockPolicy`, and chooses replay vs passthrough vs record.
- **`Mockery:Capture:ExcludedHosts` configuration**: Must already be loaded and available to the policy-resolution layer.
