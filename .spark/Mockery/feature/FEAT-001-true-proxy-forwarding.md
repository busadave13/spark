<!-- SPARK -->

# FEAT-001: True-Proxy Forwarding

> **Version**: 1.25<br>
> **Created**: 2026-04-14<br>
> **Last Updated**: 2026-04-22<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved<br>
> **Type**: FEATURE

## Goal

True-Proxy Forwarding enables Mockery to accept any outbound HTTP request routed through it and forward it transparently to the real upstream destination without requiring per-upstream registration or configuration. This keeps new and changing HTTP dependencies usable immediately in standard development flows while preserving Mockery as the common interception point for later replay behavior. When recording is active, responses are captured as human-readable mock artifacts for later replay, directly supporting PRD Goal 1 (reduce dependency startup time) and Architecture Principle 1 (transparent interception over curated onboarding).

## Motivation

Service developers lose significant time configuring and maintaining stubs for each upstream dependency (PRD §1 Problem Statement). The PRD explicitly requires that "a developer shall route a new standard HTTP dependency through Mockery without adding a dedicated per-upstream proxy configuration entry" (FR-005). True-Proxy Forwarding is the mechanism that satisfies FR-005 and also underpins FR-001 (forward to real upstream when no mock matches) and FR-002 (store the response as a human-readable mock when recording is active). Without this feature, every other Mockery capability — replay matching, manual mocks, multi-hop interception — has no traffic to operate on.

## User Stories

- As a **Service Developer**, I want outbound HTTP requests from my service to flow through Mockery transparently so that I can develop against real upstream responses without manually configuring each dependency.
- As a **Service Developer**, I want new upstream dependencies to work through the proxy immediately so that onboarding a new dependency does not require configuration changes or coordination with other teams.
- As a **Service Developer**, I want real upstream responses to be automatically captured as human-readable mock artifacts when recording is active so that subsequent runs replay stored responses without hitting live upstreams.
- As a **Platform / Developer Experience Team** member, I want the proxy to handle arbitrary HTTP destinations without per-upstream setup so that shared development templates can include Mockery without per-service customization.

## Acceptance Criteria

Each criterion must be independently testable. If you can't write a test for it, rewrite it.

- [x] Mockery accepts an HTTP request whose URL has been rewritten by the Mockery.Shared `MockPolicyPropagationHandler` to target the Mockery proxy, with the original upstream hostname carried in the `X-Forwarded-Host` header, and forwards it to the real upstream destination without requiring any prior registration of that upstream host.
- [x] When no stored mock matches the incoming request fingerprint, Mockery forwards the request to the real upstream and returns the upstream's response (status code, headers, body) unmodified to the caller.
- [x] When a forwarded upstream call returns a successful response (2xx) and the request includes a valid `X-Mockery-Mock` header (mocking active; record on replay miss), Mockery persists the response as a human-readable JSON mock artifact in the configured storage location before returning the response to the caller.
- [x] A newly added HTTP dependency (a host Mockery has never seen) works through the proxy on the first request, and a single running Mockery instance can forward requests to two different previously unseen upstream hosts sequentially without any configuration change, restart, or redeployment of Mockery.
- [x] If the real upstream is unreachable (connection refused, DNS resolution failure, or TCP timeout), Mockery returns HTTP 502 Bad Gateway with `ProblemDetails` and does not hang or return a misleading success.
- [x] If the upstream returns a non-2xx response and the request includes a valid `X-Mockery-Mock` header (mocking active; record on replay miss), Mockery returns the upstream response to the caller but does not persist a mock artifact for that interaction.
- [x] Requests to hosts listed in `Mockery:Capture:ExcludedHosts` are forwarded to the upstream but never recorded, regardless of whether a valid `X-Mockery-Mock` header is present.
- [x] The existing OpenAPI mapping in `Program.cs` continues to function unchanged after proxy transport is added, verified by `WebApplicationFactory<Program>` bootstrapping the app successfully and `GET /openapi/v1.json` returning `200 OK` in the Development environment.

## API / Interface Definition

Mockery's HTTP transport boundary accepts every reverse-proxied request routed to the Mockery proxy. The service under test's Mockery.Shared `MockPolicyPropagationHandler` rewrites the outbound URL to Mockery and preserves the original upstream target in `X-Forwarded-Host`. `X-Mockery-Mock` is optional: when absent, the request remains full passthrough; when present with a valid JSON value, Mockery evaluates replay/recording policy and may propagate that policy downstream per ADR-0004, ADR-0006, and ADR-0008.

**Authentication**: None — Mockery is a development-time proxy accessible only within the local workstation or cloud-dev sandbox trust boundary (see Security & Trust Boundary in ARCHITECTURE.md).

### Proxy Request (inbound to Mockery)

| Field / Header | Type | Required | Description |
|---|---|---|---|
| HTTP method, path, query | `string` | Yes | Rewritten request line sent to Mockery for any reverse-proxied HTTP call. |
| `Host` | `string` | Yes | Mockery proxy host and port. |
| `X-Forwarded-Host` | `string` | Yes | Original upstream scheme, host, and optional port. Mockery uses this to reconstruct the real upstream target; missing or invalid values return `400 ProblemDetails`. |
| `X-Mockery-Mock` | `string` (raw JSON object) | No | Request-scoped mock policy. When present and valid, Mockery evaluates replay/recording policy and may propagate the policy downstream. When absent, the request is passthrough only. |
| `Content-Type` | `string` | No | Forwarded upstream as-is. |
| Other headers | `IHeaderDictionary` | No | Forwarded upstream as-is unless filtered by ASP.NET Core or `HttpClient` transport rules. |
| Body | `byte[]` | No | Forwarded upstream as-is up to server and matching limits. |

### Proxy Response (returned to caller)

| Condition | Response |
|---|---|
| Upstream reachable and forwarding succeeds | Return the upstream status, headers, and body unmodified. No Mockery-specific headers are added to the success response. |
| `X-Mockery-Mock` absent | Full passthrough — no replay evaluation occurs. |
| `X-Mockery-Mock` valid, replay miss, upstream returns `2xx`, and mocking is active for the request | Persist the human-readable artifact before completing the upstream response. |
| Destination listed in `Mockery:Capture:ExcludedHosts` | Forward upstream normally and never record the interaction. |

### Error Contract

All boundary failures return ASP.NET Core `ProblemDetails`. Error responses must use ASP.NET Core's built-in ProblemDetails infrastructure (`Results.Problem()` or `IProblemDetailsService`) rather than manual JSON serialization so the framework owns `application/problem+json` content negotiation and serialization behavior.

| Status | `errorCode` | Condition |
|---|---|---|
| `400 Bad Request` | `MISSING_FORWARDED_HOST` | `X-Forwarded-Host` is missing. |
| `400 Bad Request` | `INVALID_PROXY_REQUEST` | `X-Forwarded-Host` cannot be parsed into a valid upstream target. |
| `400 Bad Request` | `MOCKERY_POLICY_INVALID_JSON` | `X-Mockery-Mock` is present but contains invalid JSON or invalid field values. |
| `413 Content Too Large` | `BODY_TOO_LARGE` | Request body exceeds `Mockery:Matching:MaxBodyBytes` when fingerprinting is required. |
| `409 Conflict` | `MOCKERY_STORE_READONLY` | A mock-enabled request triggered recording but `Mockery:Storage:ReadOnly` is `true`. |
| `502 Bad Gateway` | `UPSTREAM_UNREACHABLE` | DNS, connection, or timeout failure while contacting the upstream service. |
| `503 Service Unavailable` | `MOCKERY_STORE_UNAVAILABLE` | A mock-enabled request requires storage lookup or write, and the storage dependency cannot complete the operation. |

### Existing Endpoints (unchanged)

```
GET /openapi/v1.json  — OpenAPI document (existing, development-only)
```

## Data Model

### StoredMockArtifact

The persisted mock artifact written to storage when a valid `X-Mockery-Mock` header is present, replay lookup misses, and the upstream returns a 2xx response. Stored as a single JSON blob per interaction in the Azure Blob Storage container defined by `Mockery:Storage:ContainerName` (default: `"mocks"`). Connection is resolved through Azure Blob Storage configuration (Azurite locally, Azure Storage account in cloud).

```csharp
// Persisted as JSON — blob path: {ContainerName}/{normalized-host}/{http-method}/{fingerprint-hash}.json
public sealed record StoredMockArtifact
{
    public const int CurrentSchemaVersion = 1;

    public int SchemaVersion { get; init; } = CurrentSchemaVersion;    // int — schema version for forward-compatibility of persisted blobs
    public required string FingerprintHash     { get; init; }  // string (hex-encoded hash) — deterministic hash of method + destination + path + query + relevant headers + body content
    public required string HttpMethod          { get; init; }  // string — HTTP method (GET, POST, etc.)
    public required string RequestUri          { get; init; }  // string — fully qualified upstream request URI (e.g., "https://api.example.com/api/data")
    public required Dictionary<string, string[]> RequestHeaders  { get; init; }  // dict — fingerprint-relevant request headers only
    public required string? RequestBodyNormalized { get; init; } // string? — normalized request body content, null if no body
    public required int ResponseStatusCode     { get; init; }  // int — upstream response HTTP status code
    public required Dictionary<string, string[]> ResponseHeaders { get; init; }  // dict — all upstream response headers
    public required string? ResponseBody       { get; init; }  // string? — upstream response body as UTF-8 string, null if empty
    public required string Source              { get; init; }  // string — origin of the artifact ("Recorded" or "Manual")
    public required DateTimeOffset CapturedAtUtc { get; init; } // datetimeoffset — UTC timestamp when the artifact was recorded
    public string? Description                 { get; init; }  // string? — optional human-readable note
}
```

### Blob naming convention

Blob names are relative within the Azure Blob Storage container configured by `Mockery:Storage:ContainerName` (default: `"mocks"`).

```
{normalized-host}/               — e.g., "api.example.com_80"
  {http-method}/                 — e.g., "GET", "POST"
    {fingerprint-hash}.json      — hex-encoded fingerprint hash, lowercase
```

### MockPolicy (in-memory, per-request)

Derived from the `X-Mockery-Mock` header value (configured via `Mockery:Policy:MockHeader`, default: `X-Mockery-Mock`). The `X-Forwarded-Host` header (configured via `Mockery:Policy:ForwardedHostHeader`, default: `X-Forwarded-Host`) identifies the original upstream target. The `X-Mockery-Mock` header value is a raw JSON object. `MockPolicy` is defined in Mockery.Shared (see FEAT-004 for the canonical type definition).

```csharp
public sealed record MockPolicy
{
    public static MockPolicy Inactive { get; }                         // static — pre-built inactive policy instance

    public bool IsActive { get; init; }                                // bool — true when X-Mockery-Mock header is present with valid JSON
    public ImmutableHashSet<string> ExcludedHosts { get; init; }       // set<string> — hosts excluded from mocking; parsed from "excludeHosts" JSON array, merged with config-level excluded hosts
    public string HeaderValue { get; init; }                           // string — raw JSON string from the X-Mockery-Mock header for re-serialization during propagation
    public int MaxHops { get; init; }                                  // int — propagation depth; parsed from "maxHops" JSON field (default 0)
    public bool ShouldPropagate => IsActive && MaxHops > 0;            // computed — true when mock policy should be forwarded downstream

    public bool ShouldPassthrough(string host);                        // returns true if host matches any ExcludedHosts pattern (supports leading-wildcard globs)
    public MockPolicy DecrementMaxHops();                              // returns a copy with MaxHops decremented by 1 (min 0) and HeaderValue cleared for re-serialization
}
```

**Header-to-policy mapping:**

| `X-Mockery-Mock` value | `IsActive` | `ExcludedHosts` | `MaxHops` |
|------------------------|-------------------|-----------------|-----------|
| Absent                 | `false`           | empty           | `0`       |
| `{}`                   | `true`            | empty           | `0`       |
| `{"maxHops": 2, "excludeHosts": ["host1.com"]}` | `true` | `{host1.com}` | `2` |
| `{"excludeHosts": ["host1.com", "host2.com"]}` | `true` | `{host1.com, host2.com}` | `0` |

`ShouldPassthrough` supports leading-wildcard patterns (e.g. `*.example.com`) for host matching, consistent with `Mockery:Capture:ExcludedHosts` configuration.

## Edge Cases & Error Handling

| Scenario | Expected behaviour |
|----------|--------------------|
| Upstream host is unreachable (connection refused) | Return `502 ProblemDetails` with `errorCode = UPSTREAM_UNREACHABLE`. Do not persist any artifact. |
| Upstream DNS resolution fails | Return `502 ProblemDetails` with `errorCode = UPSTREAM_UNREACHABLE`. Do not persist any artifact. |
| Upstream responds but connection is reset mid-transfer | Return `502 ProblemDetails` with `errorCode = UPSTREAM_UNREACHABLE`. Do not persist any artifact. |
| Upstream returns non-2xx status (e.g., 404, 500) | Forward the upstream response to the caller as-is (status code, headers, body). Do not persist a mock artifact even if a valid `X-Mockery-Mock` header is present. |
| Request body exceeds `Mockery:Matching:MaxBodyBytes` and fingerprinting is required | Return `413 ProblemDetails` with `errorCode = BODY_TOO_LARGE`. Do not forward the request. |
| `X-Forwarded-Host` header is missing | Return `400 ProblemDetails` with `errorCode = MISSING_FORWARDED_HOST`. Do not forward the request. |
| `X-Forwarded-Host` value is not a valid hostname | Return `400 ProblemDetails` with `errorCode = INVALID_PROXY_REQUEST`. |
| Request destination is in `Mockery:Capture:ExcludedHosts` | Forward to the original upstream (from `X-Forwarded-Host`) normally. Return the real response. Never persist a mock artifact regardless of whether a valid `X-Mockery-Mock` header is present. |
| `X-Mockery-Mock` header contains invalid JSON (e.g., empty string, malformed JSON) | Return `400 ProblemDetails` with `errorCode = MOCKERY_POLICY_INVALID_JSON`. |
| `Mockery:Storage:ReadOnly` is `true` and recording would be triggered | Return `409 ProblemDetails` with `errorCode = MOCKERY_STORE_READONLY`. Do not return a success that implies recording completed. |
| Storage write fails during artifact persistence (disk full, permission error) | Return `503 ProblemDetails` with `errorCode = MOCKERY_STORE_UNAVAILABLE`. Log the storage failure and do not complete the request as a successful recording flow. |
| Concurrent requests produce the same fingerprint | Last-write-wins semantics — both requests forward to upstream, both attempt to persist, the final write to the fingerprint file is the one retained. No locking required. |

### Observability

The mock store emits custom OTel counters during the recording and replay flow:

- `mockery.mock.hit_count` — incremented when a request fingerprint matches a stored mock and a replay is served.
- `mockery.mock.miss_count` — incremented when no stored mock matches the request fingerprint, triggering a forward-and-record path.

## Preservation Constraints

- The existing `builder.Services.AddOpenApi()` and `app.MapOpenApi()` registrations must remain functional.
- The `public partial class Program { }` declaration at the end of `Program.cs` (used by `WebApplicationFactory` in tests) must not be removed.

## Out of Scope

- Non-HTTP protocol support (gRPC, WebSocket, TCP tunneling via CONNECT) — Mockery intercepts only standard HTTP request/response traffic.
- Per-upstream routing rules or custom forwarding policies — all upstreams are forwarded identically; destination-specific behavior is not part of this feature.
- Load balancing or retry logic for upstream calls — Mockery forwards each request to the upstream exactly once; resilience is the caller's responsibility.
- HTTPS interception or TLS termination — Mockery handles HTTP reverse-proxy requests where the Mockery.Shared handler has already rewritten the URL; HTTPS CONNECT tunneling is out of scope.
- Mock replay matching logic — this feature covers forwarding and recording only; matching stored mocks to incoming requests is covered by a separate feature (Correct Replay Matching).

## Dependencies

- ADR-0002: True-proxy forwarding as the default integration model — this feature is the implementation of that decision.
- ADR-0004: Propagated request-scoped mock policy — the proxy must honor request-scoped replay/record behavior consistently when mock policy is active.
- ADR-0005: Persist mocks behind a human-readable storage abstraction — the recording path depends on the storage interface defined by this ADR. Storage uses Azure Blob Storage (ADR-0007).
- ADR-0006: Single mock header — mock-enabled requests rely on the single `X-Mockery-Mock` JSON contract instead of older multi-header formats.
- ADR-0007: Azure Blob Storage persistence backend — successful `2xx` recordings are written through the blob-backed storage adapter.
- ADR-0008: Controlled propagation depth via `maxHops` in the `X-Mockery-Mock` JSON value — the proxy reads this field; propagation behavior is covered by FEAT-005.
- Mockery.Shared provides the host-neutral mock-policy contract and propagation helper used by calling services, while proxy-specific transport, matching, and storage contracts remain in the Mockery proxy service.
