<!-- SPARK -->

# ADR-0008: Control multi-hop propagation depth via maxHops in X-Mockery-Mock JSON value

> **Version**: 1.2<br>
> **Created**: 2026-04-14<br>
> **Last Updated**: 2026-04-18<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved
> **Type**: ADR

---

## 1. Context

Mockery's propagation model (ADR-0004) forwards the `X-Mockery-Mock` header to every downstream HTTP hop, meaning that once mocking is activated, every service in the request pipeline receives the mock header and participates in replay. In practice, developers often want to mock only the immediate dependencies of the service they are debugging — not an entire chain of transitive dependencies they may not own or understand. The always-propagate default makes it impossible to scope mocking to a controlled depth, which leads to unexpected replay behavior in deep call chains and makes it harder to isolate the service under test from cascading mock artifacts. Without explicit depth control, developers must either accept full-chain mocking or manually strip headers at intermediate services, neither of which is ergonomic or reliable.

---

## 2. Decision

> We will embed a `maxHops` field in the `X-Mockery-Mock` JSON value to control how far mock policy is forwarded to downstream services.

---

## 3. Rationale

Explicit depth control gives callers precise, predictable boundaries for mock propagation without requiring changes to intermediate services or ad-hoc header stripping. The decrement-per-hop model is simple to reason about and mirrors established patterns like IP TTL fields. By making `maxHops` default to `0` (or absent) inside the JSON, existing callers that never set it get safe, non-propagating behavior by default — preserving backward compatibility while making full-chain propagation an opt-in choice. Embedding `maxHops` in the same JSON value as `excludeHosts` eliminates the edge case of a separate `X-Mockery-MaxHops` header being present without `X-Mockery-Mock`, and keeps propagation as a re-serialization of one value rather than coordination of two headers. The `maxHops` field controls only forwarding, not local mocking: if `X-Mockery-Mock` is present, the service always mocks its own calls regardless of `maxHops` value, which keeps the mental model clean — `maxHops` answers "how far downstream?" while `X-Mockery-Mock` presence answers "should I mock?"

---

## 4. Alternatives Considered

### Separate X-Mockery-MaxHops header
**Why rejected:** A separate header for propagation depth created edge cases when `X-Mockery-MaxHops` was present without `X-Mockery-Mock`, required a second config key (`Mockery:Policy:MaxHopsHeader`), and meant propagation logic had to coordinate two headers during forwarding. Embedding `maxHops` in the JSON value keeps all policy in one self-describing payload.

### Always propagate with an explicit opt-out header (e.g., X-Mockery-StopPropagation)
**Why rejected:** An opt-out model reverses the safe default — new services added to a call chain would automatically participate in mocking unless they knew to set the stop header. This makes deep-chain mocking the implicit default, which is the exact problem being solved. A depth-based approach makes propagation explicit and bounded without requiring every intermediate service to opt out.

### Per-service configuration to ignore propagated mock headers
**Why rejected:** This pushes propagation control to the receiving service rather than the caller, meaning the developer debugging Service A would need to reconfigure Service B and Service C to stop them from mocking. This violates the principle that the caller initiating the debug flow should control its scope, and it creates environment-specific configuration drift that is hard to track across teams.

### Boolean propagate/don't-propagate flag without depth counting
**Why rejected:** A simple boolean cannot express "mock my immediate dependencies but not their dependencies." It collapses all multi-hop scenarios into either "mock everything downstream" or "mock nothing downstream," which is too coarse for the common case of wanting one or two levels of mocking depth during service-level debugging.

---

## 5. Consequences

### Positive Consequences
- Developers can scope mocking to exactly the depth they need during debugging — typically one or two hops — without affecting services further down the call chain.
- The default behavior (`maxHops` absent or `0`) is non-propagating, which is the safest and most predictable default for services that did not explicitly request multi-hop mocking.
- The decrement model is self-documenting in traces and logs: each service sees the remaining hop count in the JSON value, making propagation behavior visible during debugging.
- All mock policy lives in one JSON value, eliminating header coordination bugs and the separate `Mockery:Policy:MaxHopsHeader` config key.

### Trade-offs Accepted
- Callers must explicitly set `maxHops` in the JSON value to enable multi-hop mocking, which is a behavioral change from the previous always-propagate default; existing workflows that relied on implicit full-chain propagation must be updated.
- The hop count is based on service boundaries, not logical operation boundaries — a single logical operation that fans out to multiple services at the same depth will decrement `maxHops` once per service, which may not align with the caller's intent in complex topologies.

---

## 6. Related Decisions

- [ADR-0004: Propagate request-scoped mock policy across downstream HTTP hops](ADR-0004-propagated-request-scoped-mock-policy.md) — establishes the propagation model that this ADR refines with depth control.
- [ADR-0006: Simplify per-request mock control to a single X-Mockery-Mock header](ADR-0006-single-mock-header.md) — defines the header and JSON value format in which `maxHops` is embedded.

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
