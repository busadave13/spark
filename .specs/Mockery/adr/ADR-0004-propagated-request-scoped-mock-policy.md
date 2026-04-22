<!-- SPECIT -->

# ADR-0004: Propagate request-scoped mock policy across downstream HTTP hops

> **Version**: 1.4<br>
> **Created**: 2026-04-13<br>
> **Last Updated**: 2026-04-18<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved

---

## 1. Context

One of Mockery's defining requirements is that a single development flow can mix replayed calls and live passthrough calls without restarting services or changing shared environment configuration. The PRD also requires the same mock policy to follow downstream HTTP calls made deeper in the request pipeline when multi-hop interception is active. A simple process-wide flag would not distinguish one request from another, and isolated local decisions inside each service would break end-to-end consistency. Without a request-scoped propagation model, multi-hop debugging would be incomplete and unpredictable.

---

## 2. Decision

> We will represent mock behavior as request-scoped policy context and propagate that context across downstream HTTP hops.

---

## 3. Rationale

Request-scoped policy is the only model that lets one flow activate mocking while another flow in the same environment remains live. Propagating that policy through outbound HTTP clients preserves consistency when downstream services continue the same business operation and need the same replay versus passthrough decisions. As of [ADR-0006](ADR-0006-single-mock-header.md), the propagated context is a single `X-Mockery-Mock` header rather than the original multi-header scheme (`X-Mockery-Mode`, `X-Mockery-Passthrough`, `X-Mockery-Propagated`), which simplifies the propagation surface while preserving full request-scoped semantics. As of [ADR-0008](ADR-0008-controlled-propagation-depth-via-max-hops.md), propagation depth is controlled by the `maxHops` field embedded in the `X-Mockery-Mock` JSON value, replacing both the implicit always-propagate model and the separate `X-Mockery-MaxHops` header with explicit depth control inside the single mock header. This approach also fits distributed tracing practices, because the same context used for diagnostics can carry mock policy metadata across service boundaries. The added context plumbing is justified because it directly enables the mixed replay-and-live behavior that the product promises, while `maxHops` gives callers precise control over how far that behavior extends.

---

## 4. Alternatives Considered

### Global process or environment toggle
**Why rejected:** A global switch cannot support one request using mocks while another request in the same service instance uses live upstreams, which is a core hybrid-debugging requirement.

### Independent policy evaluation inside each service with no propagation
**Why rejected:** Recomputing policy per hop without shared context would make downstream behavior inconsistent and would not preserve one request's selective passthrough decisions across the full pipeline.

---

## 5. Consequences

### Positive Consequences
- A single end-to-end request can mix replay hits and live upstream calls deterministically because every hop sees the same passthrough and recording intent.
- Trace data becomes more useful during debugging because policy outcome, replay decisions, and downstream propagation all share one request context.

### Trade-offs Accepted
- Outbound client adapters and handlers must be instrumented to forward policy metadata explicitly, which increases plumbing work across HTTP integrations.
- Misconfigured or stripped propagation headers can create confusing partial coverage, so the implementation must surface propagation failures clearly in logs and metrics.

---

## 6. Related Decisions

- [ADR-0002: Use true-proxy forwarding as the default integration model](ADR-0002-true-proxy-forwarding-default.md) — propagated policy determines when the transparent proxy replays or forwards downstream requests.
- [ADR-0003: Match replays using request target and materially relevant request shape](ADR-0003-request-target-and-shape-matching.md) — downstream hops still rely on the same correctness-first matching rules once policy arrives.
- [ADR-0006: Simplify per-request mock control to a single X-Mockery-Mock header](ADR-0006-single-mock-header.md) — supersedes the original multi-header propagation mechanism with a single-header model.
- [ADR-0008: Control multi-hop propagation depth via maxHops in X-Mockery-Mock JSON value](ADR-0008-controlled-propagation-depth-via-max-hops.md) — adds explicit depth control embedded in the single mock header to the propagation model established by this ADR.

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
