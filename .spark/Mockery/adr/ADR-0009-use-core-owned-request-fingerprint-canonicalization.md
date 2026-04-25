<!-- SPARK -->

# ADR-0009: Keep request fingerprint canonicalization in Mockery.Core.Matching

> **Version**: 1.2<br>
> **Created**: 2026-04-14<br>
> **Last Updated**: 2026-04-18<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved
> **Type**: ADR

---

## 1. Context

FEAT-002 introduced deterministic fingerprinting for replay matching, but the implementation history left proxy-specific bridge code and duplicated normalization steps outside the Core matching boundary. Replay lookup, recorded mock persistence, and manual-mock authoring all need the same rules for method, destination, path, query, relevant headers, and body hashing. ADR-0003 already committed Mockery to correctness-first matching, so drift between replay and manual authoring paths would make hit and miss behavior inconsistent and untrustworthy. The architecture also forbids proxy-only matching policy from moving into Mockery.Shared, which means services needing fingerprint behavior must consume HTTP-agnostic Core contracts instead of recreating canonicalization logic.

---

## 2. Decision

> We will keep request fingerprint canonicalization in Mockery.Core.Matching and require replay and manual-mock flows to consume that Core contract directly.

---

## 3. Rationale

Centralizing descriptor construction and canonicalization in Mockery.Core.Matching creates one authoritative rule set for method, destination, path, query, relevant headers, and body hashing. That directly addresses the FEAT-002 risk that proxy bridges or hand-authored mock flows could normalize inputs differently and violate ADR-0003's correctness-first constraint. Using the same Core contract for replay matching and manual-mock authoring keeps recorded artifacts, conflict detection, and runtime lookup aligned without each service re-implementing request-shape rules. It also preserves the documented layer boundaries by keeping matching policy in Core, leaving endpoints and services to translate inputs rather than own fingerprint behavior, and keeping Mockery.Shared host-neutral.

---

## 4. Alternatives Considered

### ASP.NET Core endpoint and service-layer fingerprint adapters
**Why rejected:** Keeping bridge types and normalization code in proxy endpoints or service handlers would duplicate Core rules, couple fingerprint behavior to transport details, and allow replay lookup and manual authoring to drift apart as FEAT-002 evolved.

### Mockery.Shared canonicalization library
**Why rejected:** Moving fingerprint canonicalization into Mockery.Shared would push proxy-only matching policy into a host-neutral library, violating the architecture rule that Shared must not own proxy matching or persistence behavior.

### ManualMockHandler-specific fingerprint generation
**Why rejected:** Letting manual-mock APIs compute fingerprints with their own request-shape mapping would make conflict detection and stored artifacts disagree with runtime replay matching, undermining trust in hits and misses.

---

## 5. Consequences

### Positive Consequences
- Replay lookup, recorded mock persistence, and manual-mock conflict detection now share one deterministic fingerprint contract, making match behavior easier to explain and debug.
- Manual-mock APIs can reuse the same Core descriptor and fingerprint rules instead of carrying their own normalization code.

### Trade-offs Accepted
- ManualMockHandler and related flows now depend directly on Mockery.Core.Matching rather than a lighter shared abstraction, so reuse outside the proxy project remains intentionally limited.
- Any future change to canonicalization rules becomes a coordinated Core change that can affect replay lookup, existing artifacts, and manual authoring workflows at the same time.

---

## 6. Related Decisions

- [ADR-0003: Match replays using request target and materially relevant request shape](ADR-0003-request-target-and-shape-matching.md) — this ADR defines the strict matching rule that the Core-owned canonicalization contract implements.
- [ADR-0001: Keep Mockery as a single ASP.NET Core Minimal API proxy service](ADR-0001-single-minimal-api-proxy-service.md) — keeping matching policy in Core preserves the service's internal layering instead of pushing proxy behavior into a shared runtime.
- [ADR-0005: Persist mocks via a human-readable storage abstraction per environment](ADR-0005-human-readable-storage-abstraction.md) — stored manual and recorded artifacts must stay aligned with the same fingerprint contract.

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
