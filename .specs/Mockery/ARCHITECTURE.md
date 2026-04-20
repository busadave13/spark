<!-- SPARK -->

# Architecture — Mockery

> **Version**: 2.2<br>
> **Created**: 2026-04-13<br>
> **Last Updated**: 2026-04-20<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Draft

---

> Mockery is a development-time HTTP reverse proxy for service teams working on local workstations and cloud-hosted development sandboxes. It intercepts outbound HTTP calls, replays stored responses when request fingerprints match, and forwards or records real upstream traffic when mocking is enabled for the current request. A companion shared library (Mockery.Shared) packages host-neutral contracts, immutable policy and model types, and reusable propagation components that consuming services reference to participate in the mocking system and that the Mockery proxy may also reference when sharing removes duplicated client and service logic without collapsing service boundaries. The architecture builds on a lightweight API host, dependency-injected service boundaries, and a composition-oriented test and app-host foundation.

---

## Architecture Principles

1. **Transparent interception over curated onboarding** — Mockery must behave like a true proxy for standard HTTP dependencies so new upstreams work without per-destination registration in the common case.
2. **Correctness beats hit rate** — replay is only valid when request target and materially relevant request shape align, even when stricter matching produces more misses and more recording.
3. **Environment-scoped, inspectable state** — persisted mocks are stored as human-readable artifacts in environment-appropriate persistent storage and isolated per environment so developers can review, edit, and govern recorded data without hidden storage behavior.
4. **Template-aligned boundaries** — transport stays in Minimal API endpoints and middleware, core rules stay HTTP-agnostic services, and infrastructure owns network and storage adapters so the target system fits the repository's service template.

---

## System Overview

Mockery comprises two closely related .NET projects: the **Mockery proxy service** (an ASP.NET Core application) and the **Mockery.Shared** class library. The proxy service acts as a reverse proxy that sits between a service under test and real upstream HTTP dependencies, while Mockery.Shared packages the host-neutral contracts, immutable policy types, header and serialization helpers, and reusable propagation components that services under test use to participate in the mocking system and that the proxy may also reuse to avoid duplicating shared logic. The proxy continues to own transport, orchestration, matching, persistence, and other operational behavior. Beyond the catch-all proxy route, the service exposes a dedicated `/_mockery/mocks` REST surface for creating, reading, updating, and deleting manual mock artifacts. Persistent storage keeps manual and recorded mocks available across local and sandbox sessions, a startup seed service can pre-populate the store from on-disk JSON files, and observability components track replay hits, misses, passthrough, and capture failures via custom OpenTelemetry metrics.

### Component Map

```mermaid
graph LR
    Caller["Service Under Test / Developer Workflow"]
    Shared["Mockery.Shared Library"]
    Transport["Mockery HTTP Transport"]
    MockMgmt["Manual Mock Management"]
    Policy["Policy & Matching Core"]
    Store["Persistent Mock Store"]
    Seed["Storage Seed Service"]
    Upstream["/Real Upstream HTTP Services/"]
    Telemetry["/Observability Backend/"]

    Caller --> Shared
    Shared --> Transport
    Transport --> Policy
    Transport --> MockMgmt
    MockMgmt --> Store
    Policy --> Store
    Policy --> Upstream
    Policy -.-> Telemetry
    Shared -.-> Telemetry
    Seed --> Store
```

| Component | Responsibility | Technology |
|---|---|---|
| Mockery HTTP transport boundary | Accepts reverse-proxied outbound requests, reads the `X-Forwarded-Host` header to resolve the original upstream hostname, extracts the `X-Mockery-Mock` header and parses its JSON value to determine mock scope, host exclusions, and propagation depth (`maxHops`), validates boundary data, and maps failures to HTTP responses | C#, ASP.NET Core 10 Minimal APIs, ASP.NET Core middleware |
| Policy resolution and matching core (`PolicyResolutionService`, `ProxyRequestService`, `RequestFingerprintComputer`, `RequestFingerprintCanonicalizer`) | Resolves the `X-Mockery-Mock` header into a `MockPolicy` and merges config-level excluded hosts (`PolicyResolutionService`); orchestrates the replay-or-forward decision for each proxied request (`ProxyRequestService` via `IProxyRequestService`); canonicalizes request method, host, path, query, relevant headers, and body hash into a deterministic fingerprint string, then computes a SHA-256 digest (`RequestFingerprintCanonicalizer` + `RequestFingerprintComputer`) | C#, .NET 10 dependency injection, immutable `record` types, SHA-256 |
| Outbound forwarding adapter | Sends real HTTP calls to the upstream service identified by `X-Forwarded-Host`, propagates policy and tracing context by re-serializing the `X-Mockery-Mock` JSON value with a decremented `maxHops` field, and streams responses back to the core | Typed `HttpClient`, `DelegatingHandler`, HTTP/1.1 and HTTP/2 |
| Persistent mock store (`BlobMockStore`, `AzureBlobMockContainerClient`) | Reads and writes human-readable manual and recorded mock artifacts as JSON blobs in Azure Blob Storage behind an `IMockStore` / `IManualMockStore` interface; emits `mockery.mock.hit_count` and `mockery.mock.miss_count` OTel counters from the proxy perspective. Manual mocks are dual-written: a `StoredMockArtifact` at `{host}_{port}/{METHOD}/{hash}.json` for replay lookup and a `ManualMockArtifact` at `manual-index/{id}.json` for CRUD by ID. Replay lookups include a legacy fallback that checks `recorded/{hash}.json` and then scans `manual/{id}.json` blobs when the current-path lookup misses. Persisted blobs carry a `schemaVersion` field (`StoredMockArtifact.CurrentSchemaVersion = 1`); deserialization rejects blobs with unsupported versions | Azure Blob Storage (Azurite emulator locally, Azure Storage in cloud), JSON serialization, OpenTelemetry Metrics API |
| Manual mock management (`ManualMockHandler`, `MockValidator`, `MockArtifactDocumentReader`) | Exposes `/_mockery/mocks` REST endpoints (GET list, GET by ID, POST create, PUT update, DELETE) for CRUD operations on manual mock artifacts; validates mock shape, computes fingerprints on create/update, and detects fingerprint-change conflicts | C#, ASP.NET Core 10 Minimal APIs, `IManualMockStore` |
| Mock storage seed service (`MockStorageSeedHostedService`) | On startup, reads mock artifact JSON files from a configured seed directory, clears the blob container, and pre-populates it so integration tests and development sessions begin with a known mock baseline | `IHostedService`, JSON file I/O, `IManualMockStore` |
| Mockery.Shared shared contracts and propagation library | Packages host-neutral contracts, immutable policy models, header and serialization helpers, and reusable propagation components that consuming services use directly and that the proxy may reuse selectively when sharing avoids duplicated client or service logic | .NET 10 class library |
| Verification harness | Exercises matching, persistence, and end-to-end proxy flows in process and under Aspire-hosted development topology | xUnit, `WebApplicationFactory`, Aspire.Hosting.Testing |

---

## Layers & Boundaries

The system is organized into a proxy service plus an adjacent shared library with distinct layering:

**Mockery proxy service** follows the repository's layered Minimal API service template, expanded into explicit proxy transport, handler orchestration, core policy and matching, and infrastructure adapters.

```mermaid
graph TB
    T["Transport<br/><small>HTTP proxy ingress, middleware, trust checks</small>"]
    H["Request Handlers<br/><small>Endpoint mapping, request normalization, ProblemDetails shaping</small>"]
    D["Domain / Core<br/><small>Policy resolution, fingerprinting, replay and record decisions</small>"]
    I["Infrastructure<br/><small>HttpClient forwarding, storage adapters, telemetry exporters</small>"]

    T --> H --> D --> I
```

**Mockery.Shared** is a standalone .NET class library with no dependency on the proxy service. It provides host-neutral shared types that consuming services reference, and that the proxy may also reference when the types represent reusable contracts or propagation behavior rather than proxy-only implementation details:

```mermaid
graph TB
    SH["Shared Propagation Layer<br/><small>Reusable outbound propagation helpers and header serialization</small>"]
    SP["Shared Contracts & Policy Layer<br/><small>Immutable policy models, accessor contracts, and shared wire formats</small>"]
    SM["Shared Metrics<br/><small>Shared telemetry names and counters</small>"]

    SH --> SP
    SH --> SM
```

**Dependency rules — these are hard constraints, not guidelines:**

- Dependencies flow downward only: Transport → Handlers → Core → Infrastructure.
- Core must not reference Infrastructure directly — it defines interfaces for mock storage, outbound forwarding, hashing, and clocks that Infrastructure implements.
- Endpoint modules and middleware must not contain matching, persistence, or replay business rules — they only normalize HTTP input, create policy context, and map service results to HTTP responses.
- Infrastructure implementations must not import from Transport or Handlers — no `HttpContext`, `IResult`, or route types outside the boundary layer.
- **The Mockery proxy service may depend on Mockery.Shared only for host-neutral shared contracts, immutable models, header or serialization helpers, and reusable outbound propagation components that remove duplicated client or service logic.**
- **Mockery.Shared must not depend on the proxy service, ASP.NET Core hosting or middleware, proxy orchestration, proxy-only matching or persistence policies, or provider-specific storage or network adapters — it remains a host-neutral shared library.**
- **Proxy-only transport, orchestration, matching, persistence, and operational types belong in Mockery, not Mockery.Shared.**
- Request-scoped mock policy must be carried as an immutable context object and propagated via trace or header metadata across outbound calls; it must not rely on mutable static state or process-wide toggles.
- All async boundaries must accept and propagate `CancellationToken`; long-running proxy, storage, and outbound calls must honor cancellation rather than swallow it.

---

## Key Architectural Decisions

- **Keep Mockery as a single ASP.NET Core Minimal API service** — this preserves the repository's service template and keeps local and sandbox hosting simple, while ruling out a separate control-plane or sidecar fleet for v1. → [ADR-0001](./adr/ADR-0001-single-minimal-api-proxy-service.md)
- **Use true-proxy forwarding as the default integration model** — this removes per-upstream onboarding work and rules out a curated stub catalog as the primary developer path. → [ADR-0002](./adr/ADR-0002-true-proxy-forwarding-default.md)
- **Match replays using request target plus materially relevant request shape** — this favors replay correctness over broad reuse and rules out loose host-or-path-only matching by default. → [ADR-0003](./adr/ADR-0003-request-target-and-shape-matching.md)
- **Propagate request-scoped mock policy across downstream HTTP hops** — this enables mixed replay and passthrough behavior inside one trace and rules out isolated per-process toggles; propagation depth is controlled by the `maxHops` field in the `X-Mockery-Mock` JSON value. → [ADR-0004](./adr/ADR-0004-propagated-request-scoped-mock-policy.md)
- **Simplify per-request mock control to a single `X-Mockery-Mock` header with a JSON value** — this replaces the original multi-header scheme with one header whose JSON value carries mock activation, host exclusions (`excludeHosts`), and propagation depth (`maxHops`), reducing client complexity and eliminating the need for a separate propagation header. → [ADR-0006](./adr/ADR-0006-single-mock-header.md)
- **Control multi-hop propagation depth via `maxHops` in the `X-Mockery-Mock` JSON value** — this replaces the implicit always-propagate model with explicit depth control embedded in the single mock header, letting callers limit how far downstream mock policy travels without a separate header. → [ADR-0008](./adr/ADR-0008-controlled-propagation-depth-via-max-hops.md)
- **Persist mocks behind a human-readable storage abstraction** — this keeps artifacts inspectable across workstation and sandbox environments while ruling out opaque, environment-coupled persistence. → [ADR-0005](./adr/ADR-0005-human-readable-storage-abstraction.md)
- **Use Azure Blob Storage as the persistence backend for mock artifacts** — this provides a consistent storage API across local (Azurite) and cloud (Azure Storage) environments, replacing direct filesystem storage while keeping blobs human-readable. → [ADR-0007](./adr/ADR-0007-azure-blob-storage-persistence-backend.md)
- **Keep request fingerprint canonicalization in Mockery.Core.Matching** — this centralizes all normalization rules (method, destination, path, query, relevant headers, body hashing) in one Core-owned boundary so replay, recording, and manual-mock authoring stay consistent and proxy-only matching logic does not leak into Mockery.Shared. → [ADR-0009](./adr/ADR-0009-use-core-owned-request-fingerprint-canonicalization.md)
- **Keep outbound forwarding behind `IUpstreamForwarder`** — this preserves fast, deterministic orchestration tests and clean Core-to-Infrastructure boundaries, while ruling out embedding raw `HttpClient` transport logic directly in `ProxyRequestService`. → [ADR-0010](./adr/ADR-0010-upstream-forwarder-implementation-boundary.md)

---

## Primary Data Flow

The dominant flow is a mock-enabled outbound HTTP call that misses the store, records the real upstream interaction, and makes that interaction replayable for later matching.

**Happy path: mock-enabled outbound call with record-on-miss**

1. A service under test makes an outbound HTTP call. The Mockery.Shared `MockPolicyPropagationHandler` intercepts the request, rewrites the URL to target the Mockery proxy's address, sets the `X-Forwarded-Host` header to the original upstream hostname (e.g., `api.example.com`), and attaches the `X-Mockery-Mock` header with the current mock policy.
2. The Mockery HTTP transport boundary accepts the request, reads `X-Forwarded-Host` to resolve the original upstream target, extracts the `X-Mockery-Mock` header, parses its JSON value to determine mock scope (`excludeHosts`), propagation depth (`maxHops`), and creates a request-scoped policy context.
3. Core policy services normalize method, the original destination from `X-Forwarded-Host`, path, query, selected headers, and relevant body content into a deterministic request fingerprint.
4. The mock storage adapter looks for a manual or recorded mock matching the fingerprint within the active environment store.
5. If a matching mock exists and the destination is not marked for passthrough, the core returns the stored response and the transport boundary writes it back to the caller as a replay hit.
6. If no eligible mock exists, the outbound forwarding adapter reconstructs the request URL using the original host from `X-Forwarded-Host` and sends the real request to the upstream service while propagating the same policy and tracing context for downstream hops.
7. When the upstream returns successfully and recording is active, the core normalizes the interaction into a human-readable artifact and persists it through the storage abstraction before completing the response.
8. The transport boundary returns the upstream response to the caller and emits hit, miss, passthrough, and recording telemetry so later flows can replay or diagnose the interaction.

```mermaid
sequenceDiagram
    participant A as Service Under Test
    participant B as Mockery Transport
    participant C as Policy & Matching Core
    participant D as Mock Store
    participant E as Upstream Service

    A->>B: Rewritten request (URL targets Mockery) + X-Forwarded-Host: original-host + X-Mockery-Mock (JSON)
    B->>C: Normalized request (original host from X-Forwarded-Host) + parsed mock policy
    C->>D: Lookup manual or recorded mock by fingerprint
    D-->>C: No match (miss_count incremented)
    C->>E: Forward to original host (from X-Forwarded-Host) + propagated X-Mockery-Mock (maxHops decremented)
    E-->>C: Real upstream response
    C->>D: Persist normalized mock artifact
    D-->>C: Write acknowledged
    C-->>B: Response outcome + telemetry attributes
    B-->>A: Real upstream response
```

**Key error paths:**

- **Missing `X-Forwarded-Host` header**: the transport boundary cannot determine the original upstream target, returns `400 ProblemDetails` with error code `MISSING_FORWARDED_HOST`, and logs the rejection.
- **Invalid or contradictory mock policy metadata**: the transport boundary rejects the request before forwarding, returns `400 ProblemDetails`, and logs which policy field failed validation.
- **Replay miss plus upstream timeout or unreachable host**: the outbound forwarding adapter surfaces the network failure, the boundary returns `502` or `504` without persisting a mock, and telemetry records a miss with upstream failure.
- **Mock store unavailable while mocking is active**: the storage adapter fails fast, the core refuses to silently bypass deterministic replay and record behavior, and the boundary returns `503 ProblemDetails` until storage recovers.
- **Request body exceeds `MaxBodyBytes`**: the transport boundary rejects the request with `413 ProblemDetails` before fingerprinting or forwarding.
- **Recording attempted while store is read-only**: the core forwards to the upstream and returns the response but skips persisting the artifact and returns `409 ProblemDetails` to signal the write was suppressed.

**Secondary flow: manual mock CRUD via `/_mockery/mocks`**

Developers or automation interact with the manual mock management endpoints to create, inspect, update, or delete mock artifacts independently of the proxy flow.

1. A client sends a REST request to one of the `/_mockery/mocks` endpoints (e.g., `POST /_mockery/mocks` with a `ManualMockArtifact` JSON body).
2. `ManualMockEndpoints` delegates to `IManualMockHandler` (`ManualMockHandler`), which validates the artifact via `MockValidator`.
3. On create or update, the handler computes a request fingerprint from the mock's request shape using `IRequestFingerprintComputer` and persists the artifact through `IManualMockStore` (`BlobMockStore`). On update, a fingerprint-change conflict returns `409` so the caller can confirm the change.
4. The endpoint returns the created or updated artifact (or a list / deletion confirmation) as a JSON response.

---

## External Dependencies

| Dependency | Purpose | Required? | Failure behavior |
|---|---|---|---|
| Upstream HTTP services | Source of real responses for replay misses and explicit passthrough destinations | Optional | Replay hits continue from stored mocks; replay misses or passthrough calls return `502` or `504` when the upstream is unreachable and no new recording is written |
| Azure Blob Storage (Azurite locally, Azure Storage in cloud) | Loads manual and recorded mocks and persists new artifacts as JSON blobs between sessions; Azurite is provisioned automatically via Aspire AppHost for local development | Yes | Mock-enabled requests fail with `503` when lookup or write operations cannot complete because deterministic replay and record behavior cannot be guaranteed |
| Development routing or orchestrator | Mockery.Shared `MockPolicyPropagationHandler` rewrites outbound HTTP request URLs to target the Mockery proxy and sets `X-Forwarded-Host` with the original upstream hostname; alternatively, environment-level proxy configuration can direct traffic to Mockery | Optional | If routing is not configured, calls bypass Mockery entirely and no record-and-replay behavior occurs for those requests |
| OpenTelemetry collector or metrics sink | Exports logs, metrics, and traces from proxy flows to local or sandbox diagnostics tooling | Optional | Proxy execution continues with local logging only; telemetry export failures are logged but do not block requests |

---

## Configuration Reference

These keys describe the target-state runtime surface; the current scaffold exposes only standard ASP.NET Core settings until Mockery behavior is implemented.

| Key | Default | Purpose |
|---|---|---|
| `ASPNETCORE_URLS` | `http://0.0.0.0:5226` | HTTP listen address for proxy ingress in local and containerized runs |
| `Mockery:Storage:ContainerName` | `mocks` | Azure Blob Storage container name where human-readable mock artifacts are stored |
| `Mockery:Storage:ReadOnly` | `false` | Allows replay from existing mocks while preventing new recordings from being written |
| `Mockery:Policy:MockHeader` | `X-Mockery-Mock` | Header that controls mock activation; value is a JSON object `{"maxHops": N, "excludeHosts": [...]}` — presence activates mocking, `maxHops` controls propagation depth (default `0`), `excludeHosts` lists hosts excluded from mocking (default `[]`), absent header means full passthrough |
| `Mockery:Policy:ForwardedHostHeader` | `X-Forwarded-Host` | Standard header set by the Mockery.Shared handler to carry the original upstream hostname; the proxy reads this to resolve the real upstream target for forwarding and to include the original host in request fingerprints — requests missing this header are rejected with `400` |
| `Mockery:Capture:ExcludedHosts` | empty | Comma-separated host patterns that must never be captured and must always passthrough; supports leading-wildcard patterns (e.g., `*.example.com`) |
| `Mockery:Matching:RelevantHeaders` | `Content-Type,Accept` | Additional headers included in request-shape fingerprinting beyond method, authority, path, query, and normalized body |
| `Mockery:Matching:MaxBodyBytes` | `262144` | Maximum body size considered for fingerprinting and persisted mock normalization |
| `Mockery:Tracing:EnableOpenTelemetry` | `true` | Enables OTLP metrics and traces plus downstream request-context propagation |
| `Mockery:Seed:Path` | empty | Absolute path to a directory of mock artifact JSON files; when set, the `MockStorageSeedHostedService` clears the blob container at startup and loads every `*.json` file from this directory to pre-populate the store — typically injected by the Aspire AppHost via the `Mockery__Seed__Path` environment variable |

> **Note:** The Azure Blob Storage connection string is not configured via an application setting. It is resolved automatically through Aspire service discovery and .NET dependency injection (locally via the `mockstorage` Aspire resource, in cloud via the provisioned Azure Storage account).

Config is loaded in this order (later entries win):
1. `appsettings.json` — committed defaults
2. `appsettings.Development.json` and other environment-specific override files — environment overrides
3. Environment variables — runtime overrides

---

## Security & Trust Boundary

- **Caller trust model**: Only service processes, tests, and developer tooling inside a local workstation or cloud-dev sandbox should reach Mockery; exposure is limited to local or internal sandbox routing rather than public internet ingress.
- **Write / destructive operations**: Recording a real interaction creates or overwrites the specific mock artifact for that fingerprint, and manual mock maintenance happens through explicit file edits or dedicated maintenance endpoints inside the same dev boundary; ordinary replay requests never delete stored mocks automatically.
- **Sensitive data handled**: Request and response headers, bodies, cookies, and bearer tokens can transit the proxy; HTTPS to upstreams is preserved, sensitive hosts can be excluded from capture, and persisted artifacts remain environment-scoped and human-readable for review.
- **Protected resources**: Mock store contents, passthrough exclusions, and upstream credentials forwarded by the service under test must not be modified by unrelated requests or by any public caller.
- **Audit trail**: Structured logs and traces record activation mode, fingerprint outcome (hit, miss, passthrough), destination host, storage write attempts, and failure reasons using request and trace identifiers.

---

## Observability

- **Logging**: Structured JSON via `ILogger` and OpenTelemetry console or OTLP exporters. `Information` covers hit, miss, passthrough, recording decisions, maxHops propagation, and `X-Forwarded-Host` resolution; `Warning` covers malformed mocks, excluded-capture attempts, missing `X-Forwarded-Host`, and invalid `X-Mockery-Mock` JSON values; `Error` covers upstream and storage failures.
- **Metrics**: Custom OpenTelemetry counters emitted from the Mockery proxy service's `BlobMockStore` (meter name: `Mockery.Storage`):
  - `mockery.mock.hit_count` — incremented when a request fingerprint matches a stored mock and a replay is served
  - `mockery.mock.miss_count` — incremented when a request fingerprint does not match any stored mock
  - Additional counters for passthroughs, recordings, and store read/write failures, plus histograms for upstream and storage latency, are planned for local or sandbox collectors. Mockery.Shared does not currently emit its own metrics.
- **Tracing**: W3C trace context plus baggage or dedicated propagation headers carry mock policy across downstream `HttpClient` calls so multi-hop flows share one diagnostic trace. The `maxHops` field in the `X-Mockery-Mock` JSON value is read and decremented as part of propagation context management.
- **Health endpoint**: `GET /healthz` reports process liveness and configured storage adapter readiness; sandbox hosts may also probe `GET /readyz` before routing traffic.

---

## Infrastructure & Deployment

### Environments

| Environment | Purpose | URL / Access |
|---|---|---|
| Local workstation | Developer runs Mockery beside the service under test for local debugging, capture, and replay | Loopback endpoint such as `http://localhost:5226` or an Aspire-provided internal URL |
| Cloud-hosted development sandbox | Remote development environment used for integration debugging without production exposure | Internal sandbox URL or forwarded dev port restricted to the sandbox session |

### Deployment Topology

Mockery runs as a single service or container alongside the service under test. The Mockery.Shared handler in the service under test rewrites outbound HTTP request URLs to target the Mockery proxy and sets the `X-Forwarded-Host` header with the original upstream hostname. Mockery reads `X-Forwarded-Host` to identify the real upstream, reads and writes mock artifacts in Azure Blob Storage, and forwards misses to real upstreams using the original host. Locally, the Aspire AppHost provisions an Azurite emulator (resource name: `mockstorage`) so blob storage is available without an Azure subscription. In cloud and sandbox environments, a real Azure Storage account is used. This keeps capture and replay close to the caller and avoids a shared central control plane in v1.

```mermaid
graph LR
    Dev["Developer / Test Runner"]
    SUT["Service Under Test"]
    Mockery["Mockery Service"]
    Store["[(Azure Blob Storage)]"]
    Upstream["/Real Upstream HTTP Services/"]
    Telemetry["/OTel Collector or Local Logs/"]

    Dev --> SUT
    SUT --> Mockery
    Mockery --> Store
    Mockery --> Upstream
    Mockery -.-> Telemetry
```

### CI/CD Pipeline

- **Build**: Repo-level GitHub Actions pull-request automation restores and builds the .NET 10 proxy service, the Mockery.Shared class library, and test projects; container metadata in `Mockery.csproj` supports SDK-based image publishing for dev environments.
- **Test**: xUnit unit tests validate matching and core services in process, while integration tests use `WebApplicationFactory` and Aspire.Hosting.Testing against `Test.AppHost` to verify proxy behavior across a composed development topology. The Aspire AppHost provisions Azurite (resource name: `mockstorage`) automatically for integration tests requiring blob storage.
- **Deploy**: No production deployment path is defined for v1; Mockery is delivered as a local or sandbox development service started via `dotnet run`, container tooling, or Aspire-driven environment composition, with the repo's deployment workflow available when a shared dev-environment image needs publishing. Cloud sandbox environments require a provisioned Azure Storage account for mock persistence.

---

## Non-Goals & Known Constraints

**This system will not:**

- Mediate or inspect production traffic — the service is intentionally limited to workstations and cloud-dev sandboxes so operational and security scope stay narrow.
- Support non-HTTP dependencies in v1 — transparent interception is designed for standard outbound HTTP calls, not queues, databases, or proprietary protocols.
- Maintain a shared cross-environment mock catalog — workstation and sandbox stores are intentionally separate so environments can diverge safely without introducing promotion workflows into the MVP.
- Provide built-in history, approval, or promotion workflows for mocks — v1 focuses on deterministic record and replay behavior instead of governance workflow automation.

**Known limitations and accepted tradeoffs:**

- Strict request-shape matching will create more replay misses for highly variable payloads — this tradeoff is accepted because returning the wrong response is worse than re-recording or authoring a manual mock.
- Multi-hop interception depends on outbound HTTP clients propagating Mockery policy context — the extra plumbing is accepted so one request can mix replayed and live calls deterministically across service boundaries.
- Human-readable, environment-scoped blob stores can drift between workstations (separate Azurite instances) and sandboxes (separate Azure Storage accounts) — this tradeoff is accepted because inspectability and local autonomy matter more than cross-environment deduplication in v1.

---

## Decision Log

| ADR | Title |
|---|---|
| [ADR-0001](./adr/ADR-0001-single-minimal-api-proxy-service.md) | Keep Mockery as a single ASP.NET Core Minimal API proxy service |
| [ADR-0002](./adr/ADR-0002-true-proxy-forwarding-default.md) | Use true-proxy forwarding as the default integration model |
| [ADR-0003](./adr/ADR-0003-request-target-and-shape-matching.md) | Match replays using request target and materially relevant request shape |
| [ADR-0004](./adr/ADR-0004-propagated-request-scoped-mock-policy.md) | Propagate request-scoped mock policy across downstream HTTP hops |
| [ADR-0005](./adr/ADR-0005-human-readable-storage-abstraction.md) | Persist mocks via a human-readable storage abstraction per environment |
| [ADR-0006](./adr/ADR-0006-single-mock-header.md) | Simplify per-request mock control to a single X-Mockery-Mock header |
| [ADR-0007](./adr/ADR-0007-azure-blob-storage-persistence-backend.md) | Use Azure Blob Storage as the persistence backend for mock artifacts |
| [ADR-0008](./adr/ADR-0008-controlled-propagation-depth-via-max-hops.md) | Control multi-hop propagation depth via maxHops in X-Mockery-Mock JSON value |
| [ADR-0009](./adr/ADR-0009-use-core-owned-request-fingerprint-canonicalization.md) | Keep request fingerprint canonicalization in Mockery.Core.Matching |
| [ADR-0010](./adr/ADR-0010-upstream-forwarder-implementation-boundary.md) | UpstreamForwarder Implementation Boundary |

---

## Related Documents

<!-- ../../ resolves from this service docs root to the owning service area -->
- [`AGENTS.md`](../../AGENTS.md) — build commands, project layout, hard constraints for agents
- [`PRD.md`](./PRD.md) — product requirements and feature scope
- [`adr/`](./adr/) — full decision records

---

## Appendices

### Glossary

| Term | Definition |
|---|---|
| Request fingerprint | The deterministic key built from request target and materially relevant request shape to decide whether a stored mock can be replayed |
| Mock policy | The request-scoped rules derived from the `X-Mockery-Mock` header's JSON value that decide whether mocking is active (header present), which destinations are excluded from mocking (`excludeHosts`), the propagation depth (`maxHops`), and whether recording is allowed |
| Manual mock | A developer-authored mock artifact stored in the same environment-scoped format as recorded interactions |
| Multi-hop interception | Propagating the same mock policy across downstream HTTP calls made as part of one request flow, subject to propagation depth limits set by the `maxHops` field in the `X-Mockery-Mock` JSON value |
| Propagation depth (maxHops) | The `maxHops` field in the `X-Mockery-Mock` JSON value representing the number of remaining downstream hops across which mock policy will be forwarded; each hop decrements the value by 1 and re-serializes the JSON, and a value of 0 or absent stops further forwarding while the current service still mocks its own calls |
| X-Forwarded-Host | Standard HTTP header set by the Mockery.Shared `MockPolicyPropagationHandler` to carry the original upstream hostname when the request URL is rewritten to target the Mockery proxy; the proxy reads this header to resolve the real upstream target for forwarding and to include the original host in request fingerprints |
| Mockery.Shared | A standalone .NET class library providing the client-side `DelegatingHandler`, `IMockPolicyAccessor`, and `MockPolicy` model that consuming services reference to participate in the mocking system; the handler rewrites outbound request URLs to target the Mockery proxy and sets `X-Forwarded-Host` with the original hostname; independent of the Mockery proxy service |
| Environment-scoped mock store | The Azure Blob Storage container (Azurite locally, Azure Storage in cloud) that persists mocks for one development environment without sharing them globally |
| Mock storage seeding | The startup process driven by `MockStorageSeedHostedService` that clears the blob container and loads mock artifact JSON files from a configured seed directory (`Mockery:Seed:Path`) so sessions begin with a known baseline |
| Wildcard host pattern | A leading-wildcard string (e.g., `*.example.com`) used in `excludeHosts` and `Mockery:Capture:ExcludedHosts` to match any subdomain of the specified domain; only leading `*` wildcards are supported |

### External References

- [ASP.NET Core Minimal APIs](https://learn.microsoft.com/aspnet/core/fundamentals/minimal-apis) — framework guidance for the target HTTP transport boundary
- [.NET Aspire](https://learn.microsoft.com/dotnet/aspire/) — local and cloud-dev composition model used by the existing test and app-host foundation
- [OpenTelemetry for .NET](https://opentelemetry.io/docs/languages/net/) — tracing and metrics model for replay, passthrough, and forwarding observability
