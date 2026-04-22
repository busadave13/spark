<!-- SPECIT -->
# ADR-0001: Use a Single Minimal API Service

> **Version**: 1.0<br>
> **Created**: 2026-04-15<br>
> **Last Updated**: 2026-04-15<br>
> **Owner**: Dave Harding<br>
> **Project**: Pressure Sensor<br>
> **Status**: Approved

---

## 1. Context

Pressure Sensor Service needs to expose mock barometric pressure data through HTTP endpoints for dependent internal services. The repository already hosts sibling test services (TemperatureSensor, Mockery) that follow established patterns. The service must be simple enough for any team member to understand, run, and extend without deep framework knowledge. Choosing the wrong hosting model would either over-complicate a straightforward mock service or create inconsistency with the existing codebase conventions.

---

## 2. Decision

> We will implement Pressure Sensor Service as a single ASP.NET Core Minimal API project targeting .NET 10, following the same structural conventions as the sibling TemperatureSensor project.

---

## 3. Rationale

Minimal API is the lightest-weight ASP.NET Core hosting model — it eliminates controller classes, filters, and attribute-based routing in favor of direct endpoint mapping in `Program.cs`. This matches the service's scope: a small number of lookup endpoints with no complex middleware chains or controller inheritance hierarchies. The sibling TemperatureSensor project already uses this pattern successfully, so adopting it reduces onboarding friction and keeps the test service portfolio consistent. A single-project structure avoids inter-service coordination overhead that would be unnecessary for a stateless mock data server.

---

## 4. Alternatives Considered

### ASP.NET Core MVC Controllers
**Why rejected:** Controller-based routing adds ceremony (controller classes, action methods, attribute routing, model binding conventions) that provides no benefit for a service with two simple lookup endpoints. It would be inconsistent with the TemperatureSensor sibling project and would increase the code surface without adding capability.

### Separate Microservices per Lookup Type
**Why rejected:** Splitting sensor lookup and region lookup into separate services would multiply deployment units, configuration, and DI setup for two endpoints that share the same mock data store and response contract. The PRD explicitly describes one unified pressure-data integration point, not multiple specialized services.

### Azure Functions (Serverless)
**Why rejected:** Azure Functions would introduce a dependency on the Functions runtime and tooling, complicate local development workflow, and diverge from the Aspire-based orchestration model used by the rest of the test service portfolio. The service has no scaling requirements that would benefit from serverless execution.

---

## 5. Consequences

### Positive Consequences
- Minimal boilerplate — endpoints are registered directly in `Program.cs` with lambda handlers, keeping the codebase small and readable.
- Consistent with the sibling TemperatureSensor project, reducing cognitive load when navigating between test services.
- Straightforward Aspire AppHost integration as a standalone project reference with no special configuration.

### Trade-offs Accepted
- Minimal API lacks built-in controller features like automatic model validation and filter pipelines. Input validation must be implemented explicitly in endpoint handlers.
- A single-project structure means all endpoints share one process — there is no independent scaling or deployment of individual lookup types. This is acceptable for a development-only service.

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
