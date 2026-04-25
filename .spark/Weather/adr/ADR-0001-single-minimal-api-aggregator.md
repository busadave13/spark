<!-- SPARK -->

# ADR-0001: Implement Weather as a single ASP.NET Core Minimal API aggregator

> **Version**: 1.0<br>
> **Created**: 2026-04-20<br>
> **Last Updated**: 2026-04-21<br>
> **Owner**: Dave Harding<br>
> **Project**: Weather<br>
> **Status**: Approved

---

## 1. Context

Weather Service has one narrow v1 responsibility: return a complete regional weather payload by composing a small number of deterministic upstream dependencies used in development and integration testing. The repository already documents similar internal services as single ASP.NET Core Minimal API hosts, and no Weather source project exists yet, so the first implementation choice should minimize ceremony while staying consistent with the repo's service conventions. A host model decision is required before endpoint shape, dependency integration, and testing boundaries can be documented or implemented.

---

## 2. Decision

We will implement Weather Service as a single ASP.NET Core Minimal API application.

---

## 3. Rationale

The service has a small HTTP surface and a straightforward orchestration flow, so a single Minimal API host keeps route validation, aggregation orchestration, dependency wiring, and observability in one place without forcing a more elaborate application structure. This model aligns with the sibling Temperature Sensor and Pressure Sensor documentation already present in the repo, reducing architectural drift and lowering the cost of future implementation work. It also keeps unit and integration testing simple because the full inbound boundary remains within one process.

---

## 4. Alternatives Considered

### ASP.NET Core MVC controllers
**Why rejected:** Controllers would add more ceremony than value for one read-only endpoint and a narrow aggregation capability.

### Split gateway and aggregation worker services
**Why rejected:** Multiple deployable components would add configuration, testing, and hosting overhead without solving a real v1 problem.

---

## 5. Consequences

### Positive Consequences
- The service fits naturally into the repository's existing .NET test-service pattern.
- Endpoint validation, dependency orchestration, and diagnostics can stay easy to reason about because the runtime topology is one host.

### Trade-offs Accepted
- If the service expands beyond its narrow v1 scope, internal refactoring may be needed to preserve clean boundaries.
- The architecture does not pre-optimize for independently deployable aggregation components because that is out of scope for a development-only service.

---

## 6. Related Decisions

- [ADR-0002: Compose weather data through HTTP calls to sibling sensor services](ADR-0002-http-based-aggregation-over-sibling-sensor-services.md) - defines how the single host retrieves required upstream inputs
- [ADR-0003: Fail whole weather lookups when required upstream inputs are missing or invalid](ADR-0003-no-partial-success-for-required-weather-inputs.md) - constrains the aggregation behavior implemented inside that host
