<!-- SPARK -->

# ADR-0001: Keep Mockery as a single ASP.NET Core Minimal API proxy service

> **Version**: 1.1<br>
> **Created**: 2026-04-13<br>
> **Last Updated**: 2026-04-18<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved
> **Type**: ADR

---

## 1. Context

The repository already provides a .NET 10 Minimal API scaffold, shared library, unit tests, and integration tests that are suitable as the implementation foundation for Mockery. The product needs to run easily on local workstations and cloud-hosted development sandboxes without asking every dependent service to host its own proxy logic. The team also wants explicit transport, service, and infrastructure boundaries so proxy concerns can grow without turning the service into an unstructured middleware blob. Without a deliberate deployment-shape decision, the implementation could fragment into per-service libraries, sidecars, or multiple coordinating services that are harder to host and test consistently.

---

## 2. Decision

> We will implement Mockery as a single ASP.NET Core Minimal API service with explicit transport, core, and infrastructure boundaries.

---

## 3. Rationale

Keeping Mockery as one service aligns with the existing repository template and container publishing settings already present in the solution. A single process gives developers one endpoint to route through in both local and sandbox environments, which keeps setup predictable for the common development workflow. Clear internal boundaries preserve the ability to evolve matching, persistence, and forwarding logic independently without splitting the runtime into separately deployed components too early. This choice also rejects the operational overhead of a control-plane or library-per-service model before the proxy behavior is proven in practice.

---

## 4. Alternatives Considered

### Separate control-plane and data-plane services
**Why rejected:** Splitting policy management from request execution would add another deployable unit, cross-service coordination, and distributed-state concerns before v1 has enough complexity to justify them.

### Embed proxy logic as a library inside every dependent service
**Why rejected:** A library model would force each service team to adopt and configure the same interception stack independently, undermining the goal of minimal onboarding and making multi-hop behavior inconsistent across the repository.

---

## 5. Consequences

### Positive Consequences
- Local and sandbox hosting need only one Mockery endpoint and one configuration surface, which fits the current service template.
- Matching, persistence, and forwarding stay behind well-defined interfaces, so new infrastructure adapters can be added without rewriting the HTTP boundary.

### Trade-offs Accepted
- All proxy ingress, matching, and persistence work share one scaling unit, so future high-throughput scenarios may require careful performance tuning inside a single process.
- Administrative capabilities such as manual mock maintenance must coexist with data-plane traffic in the same service boundary unless a later ADR intentionally separates them.

---

## 6. Related Decisions

- [ADR-0002: Use true-proxy forwarding as the default integration model](ADR-0002-true-proxy-forwarding-default.md) — the chosen service boundary hosts the transparent proxy execution model.
- [ADR-0005: Persist mocks via a human-readable storage abstraction per environment](ADR-0005-human-readable-storage-abstraction.md) — the single service owns the storage abstraction that serves both replay and recording.

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
