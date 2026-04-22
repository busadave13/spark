<!-- SPECIT -->

# ADR-0010: UpstreamForwarder Implementation Boundary

> **Version**: 1.0<br>
> **Created**: 2026-04-20<br>
> **Last Updated**: 2026-04-20<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved

---

## 1. Context

This decision was surfaced during TDD implementation of Mockery features, especially FEAT-001 True Proxy Forwarding and FEAT-005 Multi-Hop Interception, when the team had to decide where outbound HTTP transport behavior should live. `ProxyRequestService` needs to orchestrate replay, record, and policy behavior deterministically, while FEAT-002 Correct Replay Matching and FEAT-004 Per-Request Mock Control indirectly depend on that orchestration staying easy to unit test without real network behavior leaking into the core decision path. During the 2026-04 implementation cycle, embedding raw `HttpClient` transport logic directly into orchestration services would have coupled policy decisions, request forwarding, and wire-level concerns in the same unit, making fast TDD feedback harder to preserve. Without a clear boundary, the codebase risked violating the documented Core-to-Infrastructure separation, complicating DI and service registration, and forcing unit tests to either simulate fragile transport internals or become slower integration-heavy tests.

---

## 2. Decision

> We will keep outbound HTTP forwarding behind a dedicated abstraction such as `IUpstreamForwarder`, with infrastructure implementations such as `UpstreamForwarder` owning raw `HttpClient` transport behavior instead of embedding that logic directly in `ProxyRequestService` or other proxy orchestration services.

---

## 3. Rationale

Keeping forwarding behind `IUpstreamForwarder` preserves a clean implementation boundary between orchestration logic and transport mechanics. `ProxyRequestService` can then focus on replay lookup, record-on-miss rules, policy application, and response handling, while `UpstreamForwarder` owns request reconstruction, `HttpClient` usage, and wire-level concerns. That separation keeps unit tests for orchestration logic fast and deterministic, which is important for the TDD workflow used to evolve FEAT-001, FEAT-005, and adjacent behavior. It also makes dependency injection and service registration clearer because the core depends on an interface, not on transport primitives, and it reserves real end-to-end forwarding verification for integration tests where actual HTTP behavior belongs.

---

## 4. Alternatives Considered

| Alternative | Why rejected |
|---|---|
| Inject `HttpClient` directly into `ProxyRequestService` / the orchestration layer | This would mix replay and policy orchestration with transport execution, weaken the Core-to-Infrastructure boundary, and make unit tests for orchestration behavior depend on lower-level HTTP details. |
| Mock `HttpClient` / `HttpMessageHandler` directly in unit tests | While possible, this still pulls transport mechanics into tests whose primary concern is orchestration logic, creating brittle test setups and making TDD feedback less focused and less deterministic. |
| Test forwarding behavior only via integration tests without a forwarder abstraction | This would preserve real wire validation but leave orchestration services coupled to transport code, reducing isolation and making everyday behavior changes to replay, recording, and policy logic more expensive to verify. |

---

## 5. Consequences

### Positive Consequences
- `ProxyRequestService` and related orchestration code keep a cleaner separation of concerns, with transport details isolated in `IUpstreamForwarder` / `UpstreamForwarder`.
- Unit tests for replay, recording, and policy behavior stay fast and deterministic because they can substitute the forwarder boundary instead of configuring raw HTTP transport plumbing.
- Orchestration logic can evolve independently of concrete forwarding mechanics, which reduces churn across FEAT-001, FEAT-005, and indirect consumers of the same decision path.

### Trade-offs Accepted
- Mockery must maintain an extra abstraction and concrete adapter (`IUpstreamForwarder` plus `UpstreamForwarder`) along with corresponding DI and service registration wiring.
- Concrete transport behavior still needs integration-test coverage because unit tests that mock the abstraction do not prove real wire semantics, streaming behavior, or `HttpClient` configuration correctness.

---

## 6. Revisit Conditions

Revisit this decision if Mockery adopts forwarding scenarios whose correctness depends on transport behavior that cannot be meaningfully represented behind the current abstraction, if integration tests prove insufficient to validate real forwarding semantics, or if the platform introduces a framework-native forwarding boundary that provides the same testability benefits with less custom infrastructure.

---

## 7. Related Decisions

- [ADR-0002: Use true-proxy forwarding as the default integration model](ADR-0002-true-proxy-forwarding-default.md) — this ADR defines the default forwarding behavior that the `IUpstreamForwarder` boundary helps implement cleanly.
- [ADR-0004: Propagate request-scoped mock policy across downstream HTTP hops](ADR-0004-propagated-request-scoped-mock-policy.md) — multi-hop propagation relies on forwarding remaining isolated enough to rewrite and re-emit policy data without collapsing orchestration and transport concerns.
- [ADR-0009: Keep request fingerprint canonicalization in Mockery.Core.Matching](ADR-0009-use-core-owned-request-fingerprint-canonicalization.md) — keeping matching in Core complements keeping forwarding transport in Infrastructure, preserving clear architectural ownership lines.

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
