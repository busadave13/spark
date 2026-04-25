<!-- SPARK -->

# ADR-0002: Use true-proxy forwarding as the default integration model

> **Version**: 1.1<br>
> **Created**: 2026-04-13<br>
> **Last Updated**: 2026-04-18<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved
> **Type**: ADR

---

## 1. Context

Mockery is intended to reduce the per-upstream setup burden that service teams face when they need a new dependency to work in development. The PRD explicitly requires developers to route a new standard HTTP dependency through Mockery without creating a dedicated per-upstream proxy registration for common record-and-replay behavior. The existing scaffold does not yet implement outbound interception, so the team still has a choice between a transparent proxy model and a curated stub-catalog model. Without a clear decision, the product could drift toward manual destination registration and lose its main differentiator.

---

## 2. Decision

> We will forward standard outbound HTTP requests through Mockery as a transparent true proxy by default, without requiring per-upstream registration for common record-and-replay flows.

---

## 3. Rationale

The transparent proxy model directly serves the goal of minimal onboarding because new HTTP dependencies can participate as soon as traffic is routed through Mockery. It also preserves the ability to record real upstream behavior on first use, which is much harder when every dependency needs predeclared stubs or bespoke handlers. This decision still leaves room for explicit passthrough and manual mocks, but it makes those controls exceptions layered on top of the primary path instead of the required setup mechanism. Choosing true-proxy forwarding therefore keeps the common case simple while still supporting targeted debugging controls.

---

## 4. Alternatives Considered

### Dedicated per-upstream proxy registration
**Why rejected:** Requiring a registration entry for each upstream recreates the onboarding work the product is meant to remove and creates ongoing maintenance whenever dependency graphs change.

### Pre-authored stub catalog as the default path
**Why rejected:** Starting from a curated stub set cannot guarantee fresh, real upstream behavior on first use and would force platform teams to maintain mock definitions for services they do not own.

---

## 5. Consequences

### Positive Consequences
- A newly introduced HTTP dependency can participate in capture and replay as soon as outbound traffic is routed through Mockery, which reduces setup friction for service teams.
- Selective passthrough becomes a policy decision on top of normal proxy behavior rather than a separate integration mechanism for each destination.

### Trade-offs Accepted
- Transparent proxying depends on local or sandbox routing control, so environments that cannot steer outbound traffic through Mockery will not benefit from record-and-replay behavior.
- Some unusual request patterns still need explicit exclusions or future normalization rules, because the default true-proxy path is intentionally optimized for standard HTTP calls only.

---

## 6. Related Decisions

- [ADR-0001: Keep Mockery as a single ASP.NET Core Minimal API proxy service](ADR-0001-single-minimal-api-proxy-service.md) — the transparent proxy model is hosted inside the single service boundary.
- [ADR-0003: Match replays using request target and materially relevant request shape](ADR-0003-request-target-and-shape-matching.md) — true-proxy forwarding needs a precise matching model once traffic has been captured.
- [ADR-0004: Propagate request-scoped mock policy across downstream HTTP hops](ADR-0004-propagated-request-scoped-mock-policy.md) — true-proxy behavior must carry the same policy when downstream services make additional HTTP calls.

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
