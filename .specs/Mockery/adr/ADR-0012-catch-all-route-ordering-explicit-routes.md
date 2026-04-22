<!-- SPARK -->

# ADR-0012: Catch-All Route Ordering vs Explicit Routes

> **Version**: 1.0<br>
> **Created**: 2026-04-21<br>
> **Last Updated**: 2026-04-21<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved

---

## 1. Context

During FEAT-001 implementation, Mockery introduced a catch-all `/{**path}` Minimal API route so the service can accept true-proxy forwarding traffic for arbitrary upstream paths. That route now coexists with explicit framework and product endpoints such as `MapOpenApi()`, and future features are expected to add more explicit surfaces including manual mock CRUD endpoints, health checks, and observability endpoints. Testing during FEAT-001 confirmed that if the catch-all route is mapped before explicit routes, it intercepts requests that should instead reach those explicit endpoints, including the OpenAPI document. Without an explicit decision, future contributors could add or reorder endpoint mappings in ways that silently break non-proxy surfaces while keeping proxy forwarding apparently functional.

---

## 2. Decision

> We will map Mockery's catch-all proxy route only after all explicit routes and framework surfaces have been registered, and we will treat route precedence as an intentional invariant when adding new endpoints.

---

## 3. Rationale

The catch-all route is necessary for true-proxy forwarding, but it is also the broadest possible endpoint match in the application and therefore has the highest risk of shadowing more specific routes when mapped too early. The FEAT-001 acceptance tests proved that OpenAPI behavior depends on `MapOpenApi()` being registered before the catch-all proxy endpoint, so the ordering constraint is not theoretical. Documenting the rule at the ADR level makes the constraint visible to contributors implementing future features rather than leaving it as implicit framework knowledge embedded only in `Program.cs` and test coverage. This choice preserves Mockery's ability to grow explicit control-plane endpoints without sacrificing the transparent proxy model established by ADR-0002.

---

## 4. Alternatives Considered

### Allow the catch-all route to be mapped in any order
**Why rejected:** This relies on contributors remembering ASP.NET Core route precedence details and creates an easy path for accidental regressions where explicit routes, including OpenAPI and operational endpoints, are intercepted by the proxy handler.

### Move explicit endpoints under a special prefix and treat collisions as acceptable
**Why rejected:** Prefixing reduces some collisions, but it does not remove the underlying precedence problem and still leaves framework-provided or future non-prefixed routes vulnerable if the catch-all is registered too early.

### Split proxy forwarding and explicit endpoints into separate hosts
**Why rejected:** A separate host would avoid in-process route ordering concerns, but it adds deployment and development complexity that conflicts with the single-service Minimal API direction already established for Mockery.

---

## 5. Consequences

### Positive Consequences
- OpenAPI and future explicit endpoints remain reachable alongside the true-proxy forwarding surface.
- Contributors have a documented rule for endpoint registration order, reducing accidental regressions as Mockery adds control-plane and observability routes.

### Trade-offs Accepted
- Mockery must preserve a deliberate endpoint-mapping order in `Program.cs` or equivalent composition code instead of treating route registration as freely reorderable.
- Future refactoring may need additional guardrails such as tests or helper extensions to keep the ordering invariant obvious and enforceable.

---

## 6. Revisit Conditions

Revisit this decision if Mockery adopts a routing composition model that can enforce precedence automatically, if ASP.NET Core introduces clearer ordering primitives for this pattern, or if the service is split so proxy traffic and explicit operational endpoints no longer share the same host and route table.

---

## 7. Related Decisions

- [ADR-0001: Keep Mockery as a single ASP.NET Core Minimal API proxy service](ADR-0001-single-minimal-api-proxy-service.md) — keeping proxy and explicit endpoints in one service makes route precedence an architectural concern instead of a deployment concern.
- [ADR-0002: Use true-proxy forwarding as the default integration model](ADR-0002-true-proxy-forwarding-default.md) — the catch-all route exists to support the transparent forwarding model chosen here.

---

*This ADR is part of the [Architecture Decision Records index](README.md).*