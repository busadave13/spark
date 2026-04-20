# ADR-0003: Restrict runtime to self-contained local and cloud dev environments

> **Version**: 1.0<br>
> **Created**: 2026-04-14<br>
> **Last Updated**: 2026-04-14<br>
> **Owner**: Dave Harding<br>
> **Project**: Temperature Sensor WebAPI Service<br>
> **Status**: Approved

---

## 1. Context

The PRD makes isolation a primary goal: dependent services must be able to retrieve temperature data without requiring a live upstream platform or any other external network dependency. The intended operating environments are developer workstations and cloud dev environments, both of which benefit from predictable startup and minimal configuration. Introducing remote dependencies would undermine the product's core value proposition and make failures harder to reason about during testing. The architecture therefore needed an explicit boundary around where the service runs and what runtime dependencies are allowed.

---

## 2. Decision

We will restrict Temperature Sensor Service to self-contained local and cloud dev environments and disallow external runtime dependencies in v1.

---

## 3. Rationale

This decision keeps the service aligned with its primary job: acting as a stable test dependency when real sensor systems are unavailable or unnecessary. By keeping runtime dependencies local to the service package or mounted content, developers avoid network reachability issues, external credentials, and environment drift tied to shared infrastructure. The same rule also makes cloud dev deployments simpler because the service can move with its seeded dataset rather than coordinating with a separate platform. Explicitly drawing this line prevents later implementation work from quietly eroding deterministic local behavior.

---

## 4. Alternatives Considered

### Integrate with a live sensor platform for fallback data
**Why rejected:** Calling a live platform would reintroduce the very dependency and instability that the service is intended to remove from development workflows.

### Use a shared remote test backend
**Why rejected:** A shared backend would centralize seeded data but would add network, availability, and access-management concerns that are unnecessary for a small development-only service.

---

## 5. Consequences

### Positive Consequences
- Local and cloud dev environments can run the service with predictable behavior and minimal setup.
- Failures remain easier to diagnose because request fulfillment depends only on local process state and packaged mock content.

### Trade-offs Accepted
- Teams must distribute or mount the mock dataset alongside the service instead of relying on a central shared store.
- The service intentionally does not provide a path to live-data validation in v1, so callers needing that behavior must use a different test strategy.

---

## 6. Related Decisions

- [ADR-0001: Keep Temperature Sensor Service as a single ASP.NET Core Minimal API](ADR-0001-single-minimal-api-service.md) - the small host model fits isolated dev-only deployments
- [ADR-0002: Use a file-backed JSON mock dataset keyed by region and sensor ID](ADR-0002-file-backed-json-mock-dataset.md) - packaged file content is the concrete mechanism that enables self-contained operation

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
