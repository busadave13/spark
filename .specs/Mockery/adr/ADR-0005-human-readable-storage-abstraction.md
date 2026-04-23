<!-- SPARK -->

# ADR-0005: Persist mocks via a human-readable storage abstraction per environment

> **Version**: 1.2<br>
> **Created**: 2026-04-13<br>
> **Last Updated**: 2026-04-18<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved
> **Type**: ADR

---

## 1. Context

Mockery must keep both recorded and manually authored mocks available across restarts on developer workstations and cloud-hosted development sandboxes. The PRD also requires those artifacts to remain human-readable so developers and reviewers can inspect, edit, and govern captured data directly. Local and sandbox environments may not share the same storage technology, so the persistence strategy must tolerate different backing stores without changing core replay logic. Without a storage abstraction and readable artifact format, persistence would either become environment-specific application code or an opaque store that is hard to review safely.

---

## 2. Decision

> We will persist recorded and manual mocks through a storage abstraction with environment-specific adapters while keeping stored artifacts human-readable.

---

## 3. Rationale

An abstraction boundary lets the core replay and recording logic stay independent from the concrete storage technology. The concrete implementation uses Azure Blob Storage (Azurite locally, Azure Storage in cloud), which provides a consistent API across environments while keeping artifacts as human-readable JSON blobs. Human-readable artifacts support manual mock authoring, security review, and straightforward debugging when a replay does not behave as expected. This decision also supports the user's explicit preference to keep artifacts inspectable rather than hiding them behind a database or binary serialization format. By separating policy from storage mechanics, the system can evolve storage adapters later without changing how matching and replay behave.

---

## 4. Alternatives Considered

### Shared central database or mock catalog
**Why rejected:** A central store would introduce cross-environment coupling, identity, and promotion concerns that the PRD explicitly leaves out of scope for v1.

### Binary or opaque serialized artifact format
**Why rejected:** Opaque storage would make manual mock authoring, security review, and replay debugging harder, conflicting with the requirement that stored mocks remain directly inspectable.

---

## 5. Consequences

### Positive Consequences
- Developers can inspect and edit persisted mocks directly in the environment store, which supports manual authoring when an upstream is unavailable.
- The core service can depend on one storage contract while infrastructure adapters map that contract onto workstation paths or sandbox-mounted storage as needed.

### Trade-offs Accepted
- Separate environment stores can drift over time, so a mock captured locally may not exist or may differ in the sandbox until it is re-recorded or curated there.
- Human-readable artifacts require careful normalization and redaction rules because sensitive request or response data is easier to see and easier to misuse if capture exclusions are not configured.

---

## 6. Related Decisions

- [ADR-0001: Keep Mockery as a single ASP.NET Core Minimal API proxy service](ADR-0001-single-minimal-api-proxy-service.md) — the single service owns the storage abstraction and decides when artifacts are written.
- [ADR-0003: Match replays using request target and materially relevant request shape](ADR-0003-request-target-and-shape-matching.md) — the stored artifact must preserve the fingerprint inputs needed for strict replay matching.
- [ADR-0007: Use Azure Blob Storage as the persistence backend for mock artifacts](ADR-0007-azure-blob-storage-persistence-backend.md) — implements this abstraction with Azure Blob Storage as the concrete backend.

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
