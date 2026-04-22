<!-- SPARK -->

# ADR-0011: Use dual-write blob persistence for manual mock CRUD and replay lookup

> **Version**: 1.0<br>
> **Created**: 2026-04-20<br>
> **Last Updated**: 2026-04-20<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved

---

## 1. Context

During the FEAT-003 manual mock authoring and FEAT-006 persistent mock storage work completed in April 2026, Mockery converged on `BlobMockStore` as the single concrete persistence path for both recorded mocks and manually authored mocks. The manual mock management API needs stable CRUD semantics by ID for list, get-by-id, update, and delete operations, while the runtime replay path must continue to resolve mocks by the same request fingerprint contract defined by ADR-0003 and centralized by ADR-0009. If manual mocks used a separate store shape or a special replay lookup path, the proxy would need duplicate persistence behavior, extra replay branching, or scan-based lookup logic that would drift from the existing fingerprint-based model. Azure Blob Storage also writes blobs independently, so coordinating more than one blob per logical manual mock cannot rely on a cross-blob transaction.

---

## 2. Decision

> We will persist each manual mock as two coordinated blob representations in `BlobMockStore`: an index blob at `manual-index/{id}.json` for CRUD-by-ID operations and a replay blob at `{normalizedHost}/{HTTP_METHOD}/{fingerprintHash}.json` for runtime fingerprint lookup.
>
> Create, update, and delete operations will maintain both representations, including deleting the old replay blob during updates when the request fingerprint changes.

---

## 3. Rationale

This design keeps FEAT-003 manual mock authoring and FEAT-006 persistent storage on one concrete persistence implementation instead of introducing a separate manual-only store. The `manual-index/{id}.json` representation gives the management API a stable object keyed by manual mock ID, which makes list, get-by-id, update, and delete straightforward without scanning the replay tree or deriving identity from request shape. The replay-facing blob path keeps manual mocks on the same fingerprint contract and blob organization as recorded mocks, so `GetAsync` and the broader replay pipeline can resolve them without a special-case lookup model. That alignment reinforces ADR-0005 and ADR-0007 by keeping artifacts human-readable in blob storage, and it reinforces ADR-0003 and ADR-0009 by ensuring authored mocks are replayed through the same request-shape matching rules as recorded mocks.

---

## 4. Alternatives Considered

| Alternative | Why rejected |
|---|---|
| Keep manual mocks only in an ID-addressed blob store such as `manual-index/{id}.json`, then add a separate replay lookup path or scan the manual index on misses | This would introduce replay-specific branching and scan-based fallback behavior for manual mocks, making runtime lookup slower and more complex while allowing the manual path to drift from the same fingerprint contract used for recorded mocks. |
| Store only replay-addressed blobs at `{normalizedHost}/{HTTP_METHOD}/{fingerprintHash}.json` and derive CRUD operations from those blobs | This would remove stable CRUD-by-ID semantics, make list and get-by-id operations expensive or indirect, and complicate updates when the fingerprint changes because the management API would lose a durable identity-oriented index. |
| Add a compensating transaction or write-ahead workflow immediately so both blobs update atomically | Blob storage does not provide a native cross-blob transaction, and introducing a compensating or journaled workflow now would add operational and implementation complexity that is not justified for the current development-time scale and usage patterns. |

---

## 5. Consequences

### Positive Consequences
- Manual mock CRUD and runtime replay now share one concrete persistence adapter, which reduces duplicate storage logic and keeps FEAT-003 and FEAT-006 aligned.
- Replay lookup can resolve manual mocks through the same fingerprint-based path shape used for recorded mocks, which keeps behavior consistent and easier to reason about.
- Manual mocks remain directly inspectable as human-readable JSON blobs in Azure Blob Storage, both by stable ID and by replay address.

### Trade-offs Accepted
- Each logical manual mock is stored twice, which adds storage duplication and requires update and delete flows to coordinate two blob paths instead of one.
- Azure Blob Storage cannot atomically commit both writes or deletes together, so the system accepts eventual consistency and last-writer-wins behavior if one write succeeds and the companion write fails.
- Fingerprint-changing updates must explicitly remove the old replay blob to avoid stale replay hits, which adds extra mutation logic to the update path.

---

## 6. Revisit Conditions

Revisit this decision if partial-write or partial-delete failures become a meaningful operational problem, if Mockery needs stronger consistency guarantees for manual mock mutations, or if the storage backend changes to one that can support transactional coordination without disproportionate complexity. Revisit it as well if manual mock volume or listing patterns make the dual-write duplication materially more expensive than a different index strategy.

---

## 7. Related Decisions

- [ADR-0003: Match replays using request target and materially relevant request shape](ADR-0003-request-target-and-shape-matching.md) — the replay copy exists so manual mocks are resolved with the same request-shape matching contract as recorded mocks.
- [ADR-0005: Persist mocks via a human-readable storage abstraction per environment](ADR-0005-human-readable-storage-abstraction.md) — the dual-write design stays within the same inspectable storage abstraction rather than creating a separate opaque persistence path for manual mocks.
- [ADR-0007: Use Azure Blob Storage as the persistence backend for mock artifacts](ADR-0007-azure-blob-storage-persistence-backend.md) — this ADR defines the blob-backed infrastructure whose lack of cross-blob transactions drives the accepted consistency trade-off.
- [ADR-0009: Keep request fingerprint canonicalization in Mockery.Core.Matching](ADR-0009-use-core-owned-request-fingerprint-canonicalization.md) — the replay copy depends on the same Core-owned fingerprint contract used by runtime lookup and manual authoring.

---

*This ADR is part of the [Architecture Decision Records index](README.md).*