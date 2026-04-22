<!-- SPARK -->

# ADR-0002: Compose weather data through HTTP calls to sibling sensor services

> **Version**: 1.0<br>
> **Created**: 2026-04-20<br>
> **Last Updated**: 2026-04-21<br>
> **Owner**: Dave Harding<br>
> **Project**: Weather<br>
> **Status**: Approved

---

## 1. Context

The PRD defines Weather Service as an internal API that aggregates deterministic temperature, humidity, and pressure data from configured upstream weather-related services into one regional response. The repository already models Temperature Sensor and Pressure Sensor as separate services with their own contracts and operational boundaries. Weather therefore needs an integration model that preserves those boundaries, keeps the development environment realistic, and avoids coupling the aggregator directly to upstream datasets or implementation details.

---

## 2. Decision

We will retrieve required weather inputs through HTTP calls to the sibling Temperature Sensor Service and Pressure Sensor Service.

---

## 3. Rationale

HTTP-based composition lets Weather exercise the same service boundaries that downstream consumers will depend on during integrated development flows. This keeps the aggregator decoupled from upstream storage models, file formats, and in-process implementation details, making each service free to evolve behind its published contract. The approach also aligns with the repo's broader service-oriented development model and makes integration tests more representative because they can validate the full contract chain rather than a shared internal library or data store.

---

## 4. Alternatives Considered

### Read upstream mock files directly from shared storage
**Why rejected:** Shared file access would collapse service boundaries, couple Weather to upstream storage conventions, and bypass the contracts the repo is trying to exercise.

### Share one in-process library for all weather inputs
**Why rejected:** A shared library would reduce network hops but would hide integration behavior and make the aggregator less representative of real service composition.

---

## 5. Consequences

### Positive Consequences
- Weather remains loosely coupled to sibling services through explicit contracts and base URLs.
- Integration tests can validate the full composed development-time workflow rather than only local mapping logic.

### Trade-offs Accepted
- One weather lookup now depends on multiple HTTP calls, which adds latency and more failure modes than a local data model.
- Contract drift between sibling services becomes an explicit integration risk that must be caught with tests and review.

---

## 6. Related Decisions

- [ADR-0001: Implement Weather as a single ASP.NET Core Minimal API aggregator](ADR-0001-single-minimal-api-aggregator.md) - defines the host that owns the HTTP composition logic
- [ADR-0003: Fail whole weather lookups when required upstream inputs are missing or invalid](ADR-0003-no-partial-success-for-required-weather-inputs.md) - defines how aggregation behaves when one HTTP dependency cannot satisfy the request
