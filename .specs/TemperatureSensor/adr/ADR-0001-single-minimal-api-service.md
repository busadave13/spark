# ADR-0001: Keep Temperature Sensor Service as a single ASP.NET Core Minimal API

> **Version**: 1.0<br>
> **Created**: 2026-04-14<br>
> **Last Updated**: 2026-04-14<br>
> **Owner**: Dave Harding<br>
> **Project**: Temperature Sensor WebAPI Service<br>
> **Status**: Approved

---

## 1. Context

Temperature Sensor Service is a narrow test-only capability whose only v1 responsibility is serving deterministic temperature payloads for supported region and sensor ID combinations. The intended callers are internal services and test automation running in local or cloud dev environments, not public consumers or production workloads. Splitting such a small surface across multiple deployable components would add unnecessary operational overhead before any broader capability has been proven. A deliberate hosting choice was needed so the service can follow existing repo conventions while remaining easy to build, test, and reason about.

---

## 2. Decision

We will implement Temperature Sensor Service as a single ASP.NET Core Minimal API application.

---

## 3. Rationale

The repo already uses Minimal API guidance for small HTTP services, which makes that model the lowest-friction fit for a development-only service with one primary route. A single process keeps routing, validation, lookup orchestration, and observability in one place, reducing startup complexity and documentation overhead. Minimal APIs also provide an explicit boundary for route validation and response shaping without forcing MVC controller structure onto a very small surface. This choice preserves a clean path to future refactoring if the service grows, while avoiding premature decomposition in v1.

---

## 4. Alternatives Considered

### ASP.NET Core MVC controllers
**Why rejected:** Controllers would add ceremony and folder structure without solving a real complexity problem for a single read-only endpoint and a tiny request surface.

### Split API and lookup worker into separate services
**Why rejected:** A multi-service design would add deployment, testing, and configuration overhead while providing no meaningful benefit for a self-contained lookup flow with no background processing requirement.

---

## 5. Consequences

### Positive Consequences
- The service fits naturally with existing .NET web API conventions already used in this repo.
- Endpoint validation, response shaping, and observability can remain straightforward because the runtime topology is a single host.

### Trade-offs Accepted
- If the service later adds broader capabilities, some refactoring may be needed to preserve clean boundaries inside one process.
- The architecture does not pre-optimize for independent scaling of components because that is out of scope for a development-only service.

---

## 6. Related Decisions

- [ADR-0002: Use a file-backed JSON mock dataset keyed by region and sensor ID](ADR-0002-file-backed-json-mock-dataset.md) - defines how the single API host resolves deterministic responses
- [ADR-0003: Restrict runtime to self-contained local and cloud dev environments](ADR-0003-self-contained-dev-environment-runtime.md) - constrains where this single service is intended to run

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
