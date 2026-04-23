<!-- SPARK -->

# ADR-0013: Extract HostPatternMatcher Utility to Mockery.Shared for Reuse

> **Version**: 1.0<br>
> **Created**: 2026-04-22<br>
> **Last Updated**: 2026-04-23<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved
> **Type**: ADR

---

## 1. Context

During FEAT-001 (True-Proxy Forwarding) TDD implementation, a `HostPatternMatcher` utility was created in the Mockery proxy service to satisfy AC-7: matching host patterns against the `Mockery:Capture:ExcludedHosts` configuration and the per-request `excludeHosts` array. The utility performs wildcard glob-style pattern matching for hostnames (e.g., `*.internal.com`) and encapsulates the rules for determining whether a given host should be excluded from capture or passthrough. FEAT-007 and potentially other features that make host-based routing or exclusion decisions will need the same pattern-matching logic, and without a shared location the likely outcome is either duplication of the matching rules across projects or tight coupling to proxy-internal types that should not leak beyond the service boundary. The architecture already defines Mockery.Shared as the home for host-neutral contracts, immutable models, and reusable helpers that consuming services reference and that the proxy may also reuse when sharing removes duplicated logic (see dependency rules in ARCHITECTURE.md). HostPatternMatcher is a stateless, host-neutral utility with no dependency on proxy transport, orchestration, fingerprinting, or persistence, so it fits the Mockery.Shared charter without violating the established boundary constraints.

---

## 2. Decision

> We will extract `HostPatternMatcher` from the Mockery proxy service into Mockery.Shared so that host pattern matching is available as a single canonical implementation reusable by the proxy, by consuming services, and by any future feature that needs host-based glob matching.

---

## 3. Rationale

HostPatternMatcher is a pure, stateless utility: it takes a hostname and a collection of glob patterns and returns a match result. It has no dependency on ASP.NET Core hosting, proxy transport, request fingerprinting, storage, or any other proxy-only concern. Placing it in Mockery.Shared aligns with the existing dependency rules that allow Mockery.Shared to contain host-neutral helpers and the proxy to depend on Mockery.Shared for shared logic that removes duplication. Keeping one canonical implementation ensures that the proxy's `ExcludedHosts` evaluation, the per-request `excludeHosts` resolution, and any future host-based routing in FEAT-007 or other features all use identical matching semantics — including edge cases around leading wildcards, case sensitivity, and port handling. A single implementation also concentrates test coverage in one project, reducing the risk that separately maintained copies drift in behavior over time.

---

## 4. Alternatives Considered

| Alternative | Why rejected |
|---|---|
| Keep HostPatternMatcher as an internal implementation detail of the Mockery proxy service | This forces any other project or feature needing host-pattern matching to either duplicate the logic or take a dependency on proxy-internal types. Duplication creates a drift risk where exclusion semantics diverge between the proxy and consuming services, and exposing proxy internals would violate the boundary constraint that Mockery.Shared must not depend on the proxy. |
| Duplicate the matching logic in each consuming project or feature as needed | This is the simplest short-term path, but it produces multiple independent implementations of the same glob-matching rules. Each copy must be tested and maintained separately, and any semantic change (e.g., adding support for new wildcard positions or port-aware matching) must be applied in every location, creating a maintenance and correctness burden that grows with each new consumer. |
| Introduce a separate NuGet package or utility library outside Mockery.Shared | This would decouple the utility from Mockery entirely, but it adds package management overhead, versioning complexity, and a new dependency boundary for a utility that is tightly scoped to the Mockery system's host-matching semantics. The existing Mockery.Shared library already serves this exact purpose for host-neutral reusable components. |

---

## 5. Consequences

### Positive Consequences
- FEAT-007 and future features that need host-based matching can reference a tested, canonical utility without duplicating logic or depending on proxy internals.
- All host pattern matching in the Mockery system uses identical semantics, eliminating drift risk between the proxy's exclusion evaluation and any downstream consumer's matching behavior.
- Test coverage for glob matching is consolidated in one project, making it easier to verify edge cases and evolve the matching rules in a single place.

### Trade-offs Accepted
- Mockery.Shared gains a new public surface (`HostPatternMatcher`) that all consumers couple to; any change to its signature or matching semantics now affects every dependent project rather than only the proxy service.
- The extraction sets a precedent for moving proxy-originated utilities into Mockery.Shared, which requires ongoing judgment to avoid gradually bloating the shared library with logic that is actually proxy-specific.

---

## 6. Revisit Conditions

Revisit this decision if host pattern matching needs diverge between the proxy and consuming services to the point where a single implementation cannot satisfy both without compromising clarity, if the Mockery.Shared library grows to include too many proxy-originated utilities and a clearer boundary is needed, or if .NET introduces a platform-native glob matching utility that renders the custom implementation unnecessary.

---

## 7. Related Decisions

- [ADR-0002: Use true-proxy forwarding as the default integration model](ADR-0002-true-proxy-forwarding-default.md) — true-proxy forwarding introduced the need for host-based exclusion matching, which HostPatternMatcher implements.
- [ADR-0009: Keep request fingerprint canonicalization in Mockery.Core.Matching](ADR-0009-use-core-owned-request-fingerprint-canonicalization.md) — this decision established that proxy-only matching logic stays in Core; HostPatternMatcher is not proxy-only matching but a host-neutral utility, so it appropriately belongs in Shared rather than Core.

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
