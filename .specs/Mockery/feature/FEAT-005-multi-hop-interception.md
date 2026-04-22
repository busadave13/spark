<!-- SPARK -->

# FEAT-005: Multi-Hop Interception

> **Version**: 2.4<br>
> **Created**: 2026-04-14<br>
> **Last Updated**: 2026-04-21<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved

## Goal

Enable request-scoped mock policy to propagate across downstream HTTP calls within the same request pipeline, with propagation depth controlled by the `maxHops` field in the `X-Mockery-Mock` header's JSON value. This allows a single inbound request's mock policy to cascade through every downstream hop so developers can exercise multi-hop flows without starting every dependent service.

## Motivation

This feature directly satisfies **PRD Goal 1** (reduce dependency startup time for service developers) and **PRD Goal 4** (support hybrid debugging with per-request mock control) by allowing a single inbound request's mock policy to cascade through every downstream hop.

It implements **FR-009**: *"The system shall apply the current request's mock policy to downstream outbound HTTP calls in the same request pipeline when multi-hop interception is active for that request."*

The design follows **ADR-0004 (Propagated Request-Scoped Mock Policy)**, **ADR-0006 (Single Mock Header)**, and **ADR-0008 (Controlled Propagation Depth via MaxHops)**, which mandate that policy travels as an immutable context object via the `X-Mockery-Mock` header's JSON value with propagation depth governed by the `maxHops` field within that JSON—never through mutable static state, process-wide toggles, or separate headers.

## User Stories

- As a **Service Developer**, I want mock policy to follow downstream outbound calls within the same request pipeline so that I can exercise multi-hop flows without starting every dependent service.
- As a **Service Developer**, I want host exclusions to remain consistent across all hops so that I can debug with real upstream traffic on selected dependencies while the rest of the chain stays mocked.
- As a **Platform / Developer Experience Team** member, I want downstream policy propagation to work transparently through the existing `DelegatingHandler` pipeline so that shared development workflows require no per-service configuration changes.

## Acceptance Criteria

- [x] When a proxied request has the `X-Mockery-Mock` header with a JSON value whose `maxHops` field is greater than `0`, the `MockPolicyPropagationHandler` rewrites the outbound request URL to target the current Mockery proxy, sets `X-Forwarded-Host` to the original upstream hostname, and forwards the current `X-Mockery-Mock` value unchanged for the current hop.
- [x] When the current Mockery proxy forwards to a downstream dependency and `maxHops = N` (`N > 0`), the proxy outbound forwarding adapter re-serializes the JSON with `maxHops: N-1` and sets that value as `X-Mockery-Mock` on the next-hop outbound request.
- [x] When `maxHops` is absent or `0` in the `X-Mockery-Mock` JSON value, the current service still uses mocking normally, but the Mockery proxy does NOT forward `X-Mockery-Mock` to downstream calls.
- [x] `maxHops` does not affect whether the current service uses mocking — it only controls downstream propagation.
- [x] Downstream Mockery instances parse the propagated `X-Mockery-Mock` JSON value identically to the originating request.
- [x] W3C `traceparent` and `tracestate` context is preserved across hops so all calls in the pipeline share the same trace ID.
- [x] A `DelegatingHandler` registered on the typed `HttpClient` automatically rewrites the outbound request URL to target the current Mockery proxy, sets `X-Forwarded-Host` to the original upstream hostname, and injects the active `X-Mockery-Mock` header value without caller intervention.
- [x] The `excludeHosts` array in the `X-Mockery-Mock` JSON value is forwarded verbatim across all downstream hops, subject to `maxHops` allowing propagation.
- [x] The propagation handler honours `CancellationToken` on all async boundaries and does not swallow cancellation.
- [x] If the inbound request carries no `X-Mockery-Mock` header, the propagation handler still rewrites the URL to the Mockery proxy and sets `X-Forwarded-Host`, but does not inject `X-Mockery-Mock` (no mock evaluation at the proxy — full passthrough).
- [x] When a propagated `X-Mockery-Mock` header contains invalid JSON, the receiving Mockery transport boundary returns `400 ProblemDetails` with error code `MOCKERY_POLICY_INVALID_JSON` and does not forward the request.

## API / Interface Definition

### MockPolicyPropagationHandler

```csharp
/// <summary>
/// DelegatingHandler that intercepts outbound HTTP calls, rewrites the request
/// URL to target the Mockery proxy, sets the X-Forwarded-Host header to the
/// original upstream hostname, and forwards the current X-Mockery-Mock value
/// unchanged to the current Mockery proxy when mock policy is active.
/// Downstream maxHops decrement / suppression is owned by the Mockery proxy's
/// outbound forwarding adapter, not this shared-library handler.
/// </summary>
public sealed class MockPolicyPropagationHandler(
    IMockPolicyAccessor policyAccessor,
    IOptions<MockeryPolicyOptions> policyOptions,
    IOptions<MockeryProxyOptions> proxyOptions) : DelegatingHandler
{
    /// <summary>
    /// HttpRequestOptions key used to attach a MockPolicy to an outbound request
    /// when no ambient IMockPolicyAccessor policy is available (e.g. background tasks).
    /// </summary>
    public static readonly HttpRequestOptionsKey<MockPolicy?> MockPolicyKey = new("Mockery.MockPolicy");

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken);
}
```

### IMockPolicyAccessor

```csharp
/// <summary>
/// Provides access to the request-scoped mock policy for the current execution context.
/// </summary>
public interface IMockPolicyAccessor
{
    /// <summary>
    /// Returns the current <see cref="MockPolicy"/> or <c>null</c> when no policy is active
    /// (i.e. X-Mockery-Mock header is absent).
    /// </summary>
    MockPolicy? CurrentPolicy { get; }
}
```

### Header Propagation Contract

| Header | Direction | Semantics |
|---|---|---|
| `X-Forwarded-Host` | Outbound | Standard HTTP header set by the handler to carry the original upstream hostname when the request URL is rewritten to target the current Mockery proxy. The proxy reads this to resolve the real upstream target for forwarding and fingerprinting. Always set when the handler rewrites the request. |
| `X-Mockery-Mock` | Inbound → current Mockery proxy | Mock activation and propagation header. Value is a raw JSON object: `{"maxHops": N, "excludeHosts": [...]}`. The handler forwards the current request-scoped value unchanged to the current Mockery proxy when mocking is active. When that proxy makes downstream calls, its outbound forwarding adapter decrements `maxHops` (or suppresses propagation when `maxHops` is absent or `0`). |
| `traceparent` | Inbound → Outbound | W3C trace context; preserved by the standard `HttpClient` tracing pipeline. |
| `tracestate` | Inbound → Outbound | W3C trace state; preserved alongside `traceparent`. |

### Registration

```csharp
// In service registration (Startup / Host builder)
services.AddHttpClient<IUpstreamForwarder, UpstreamForwarder>()
    .AddHttpMessageHandler<MockPolicyPropagationHandler>();
```

The handler is appended to the existing `DelegatingHandler` chain; no existing handlers are removed or reordered.

### Error Handling

`MockPolicyPropagationHandler` does not produce HTTP error responses directly. Transport exceptions (timeout, DNS failure, connection refused) from `base.SendAsync` propagate unchanged through the `HttpClient` pipeline. When a propagated `X-Mockery-Mock` header contains invalid JSON, the receiving Mockery transport boundary returns `400 ProblemDetails` with error code `MOCKERY_POLICY_INVALID_JSON`. See Edge Cases & Error Handling for the full error matrix.

## Data Model

### MockPolicy (immutable value object)

```csharp
/// <summary>
/// Immutable, request-scoped policy describing mock behaviour for the current pipeline.
/// Constructed by parsing the X-Mockery-Mock header's JSON value.
/// Defined in Mockery.Shared (see FEAT-004 for the canonical type definition).
/// </summary>
public sealed record MockPolicy
{
    /// <summary>Pre-built inactive policy instance (header absent).</summary>
    public static MockPolicy Inactive { get; }

    /// <summary>Whether mock policy is active (X-Mockery-Mock header was present).</summary>
    public bool IsActive { get; init; }

    /// <summary>
    /// Hosts excluded from mocking: the excludeHosts array from the JSON value
    /// merged with any config-level excluded hosts. Empty means mock all hosts.
    /// Supports leading-wildcard patterns (e.g. <c>*.example.com</c>).
    /// </summary>
    public ImmutableHashSet<string> ExcludedHosts { get; init; } = ImmutableHashSet<string>.Empty;

    /// <summary>
    /// The full raw JSON string from the X-Mockery-Mock header for re-serialization
    /// during propagation to downstream hops.
    /// </summary>
    public string HeaderValue { get; init; } = string.Empty;

    /// <summary>
    /// Remaining downstream propagation depth from the maxHops field in the
    /// X-Mockery-Mock JSON value. 0 or absent means do not forward mock policy
    /// downstream. N > 0 means re-serialize JSON with maxHops: N-1 and set it
    /// as the X-Mockery-Mock header on the outbound request.
    /// Does not affect whether the current service uses mocking.
    /// </summary>
    public int MaxHops { get; init; }

    /// <summary>
    /// Computed property: true when IsActive and MaxHops > 0, indicating the
    /// mock header should be forwarded downstream.
    /// </summary>
    public bool ShouldPropagate => IsActive && MaxHops > 0;

    /// <summary>Returns true if the given host is in <see cref="ExcludedHosts"/>.</summary>
    public bool ShouldPassthrough(string host);

    /// <summary>
    /// Returns a copy with MaxHops decremented by 1 (minimum 0) and HeaderValue
    /// cleared for re-serialization. Returns Inactive if the policy is not active.
    /// </summary>
    public MockPolicy DecrementMaxHops();
}
```

### Host-Specific `IMockPolicyAccessor` Implementations

Mockery.Shared depends only on the `IMockPolicyAccessor` abstraction. ASP.NET Core hosts may provide an `IHttpContextAccessor`-backed implementation inside their own transport layer, but that implementation does not live in Mockery.Shared.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|---|---|
| Inbound request has no `X-Mockery-Mock` header | The handler rewrites the URL to the current Mockery proxy and sets `X-Forwarded-Host`, but does not inject `X-Mockery-Mock`; Mockery performs full passthrough (no mock evaluation). |
| `X-Mockery-Mock` header value is empty or whitespace | The receiving Mockery transport boundary rejects the request with `400 ProblemDetails` and `errorCode = MOCKERY_POLICY_INVALID_JSON`; the propagation handler does not reinterpret invalid policy as a passthrough request. |
| `X-Mockery-Mock` JSON value has no `maxHops` field | `maxHops` defaults to `0`; mock policy is active for the current service but `X-Mockery-Mock` is NOT forwarded to downstream calls. |
| `maxHops` is `0` in the JSON value | `X-Mockery-Mock` is NOT forwarded to downstream calls. The current service still uses mocking normally. |
| `maxHops` is `1` in the JSON value | `X-Mockery-Mock` is forwarded to the immediate downstream call with re-serialized JSON containing `maxHops: 0`. That downstream service will mock its own calls but will not propagate further. |
| `maxHops` is `N` (`N > 1`) in the JSON value | `X-Mockery-Mock` is forwarded with re-serialized JSON containing `maxHops: N-1`, allowing propagation for `N` downstream hops. |
| `X-Mockery-Mock` contains `{}` (empty JSON object) | `maxHops` defaults to `0`, `excludeHosts` defaults to `[]`; mocking is active for the current service, no downstream propagation. |
| Re-serialized JSON produces different field ordering | Acceptable; downstream parsers must tolerate any valid JSON field order. |
| `X-Mockery-Mock` contains invalid JSON | The receiving Mockery transport boundary returns `400 ProblemDetails` with `errorCode = MOCKERY_POLICY_INVALID_JSON`. Invalid policy is not downgraded to a warning-only passthrough flow. |
| Downstream call fails (timeout, DNS, connection refused) | The propagation handler does not catch or wrap transport exceptions; errors bubble up through the existing `HttpClient` pipeline unchanged. No retry or circuit-breaker logic is applied (out of scope). |
| `CancellationToken` is cancelled during `SendAsync` | Handler awaits `base.SendAsync` which will throw `OperationCanceledException`; the exception propagates without suppression. |
| Circular call chain (Service A → Mockery → Service A) | `X-Mockery-Mock` header is propagated with re-serialized JSON containing decremented `maxHops`; propagation naturally terminates when `maxHops` reaches `0`. Existing request-timeout and tracing safeguards also apply. |
| Multiple `X-Mockery-Mock` values in inbound headers | Only the first value is used; additional values are ignored. A warning diagnostic is emitted via the configured `ILogger<MockPolicyPropagationHandler>`. |
| `HttpContext` is unavailable (e.g. background task using the `HttpClient`) | `IMockPolicyAccessor.CurrentPolicy` returns `null`; handler falls back to checking `HttpRequestMessage.Options` for a `MockPolicy` set via `MockPolicyPropagationHandler.MockPolicyKey`. If neither source provides a policy, handler still rewrites URL and sets `X-Forwarded-Host` but does not inject `X-Mockery-Mock`. |
| `maxHops` contains a non-integer or negative value in the JSON | The receiving Mockery transport boundary returns `400 ProblemDetails` with `errorCode = MOCKERY_POLICY_INVALID_JSON`. |

## Preservation Constraints

- Existing `HttpClient` registrations and their `DelegatingHandler` pipelines must remain intact. `MockPolicyPropagationHandler` is **appended** to the handler chain via `AddHttpMessageHandler<T>()`.
- No existing handlers may be removed, replaced, or reordered.
- The `MockPolicy` record is immutable; it must not be mutated after construction.
- All async methods must accept and propagate `CancellationToken`.

## Out of Scope

- Non-HTTP downstream propagation (gRPC, message queues, etc.).
- Automatic discovery of downstream Mockery instances.
- Circuit breaker or retry logic for downstream calls.

## Dependencies

| Dependency | Purpose |
|---|---|
| `IMockPolicyAccessor` | Host-provided abstraction that supplies the current request-scoped policy to Mockery.Shared without forcing ASP.NET Core-specific implementations into the shared library. |
| `MockeryPolicyOptions` | Configuration POCO providing the configurable mock header name (`MockHeader`) and forwarded host header name (`ForwardedHostHeader`). |
| `MockeryProxyOptions` | Configuration POCO providing the Mockery proxy base URI (`BaseUri`) for URL rewriting. |
| Typed `HttpClient` / `IHttpClientFactory` | Hosts the `DelegatingHandler` pipeline where `MockPolicyPropagationHandler` is registered. |
| Mockery proxy outbound forwarding adapter | Owns `maxHops` decrement / suppression when the current Mockery proxy forwards to the next downstream dependency. |
| W3C Trace Context (OpenTelemetry) | Ensures `traceparent`/`tracestate` headers are preserved across hops (configured via `Mockery:Tracing:EnableOpenTelemetry`). |
| `Mockery:Policy:MockHeader` config | Determines the header name used for mock policy activation; value is a JSON object containing `maxHops` and `excludeHosts` fields (default header name `X-Mockery-Mock`). |
| `Mockery:Policy:ForwardedHostHeader` config | Determines the header name used to carry the original upstream hostname (default `X-Forwarded-Host`). Set by the handler on every outbound request. |
| ADR-0004 | Defines request-scoped mock policy propagation as the architectural model. |
| ADR-0006 | Defines the single `X-Mockery-Mock` header contract used for propagation. |
| ADR-0008 | Defines the controlled propagation depth model via the `maxHops` field in the `X-Mockery-Mock` JSON value. |
