# .NET Web API project guidance

Read this file before making changes to this service.

## Coding guidelines

- Use Minimal API patterns for all HTTP endpoints; do not use MVC controllers.
- Prefer small, focused types with one clear responsibility.
- Use positional `record` types for immutable request/response models and DTOs; use `class` when mutation, inheritance, or framework behavior makes it the better fit.
- Use file-scoped namespaces (`namespace X;`) in every file.
- Use primary constructors for dependency injection in services and clients.
- Follow standard C# naming: PascalCase for types and members, camelCase for locals and parameters.
- Prefix interfaces with `I` (e.g. `IWeatherAggregationService`, `ITemperatureSensorClient`).
- Keep async flows async end-to-end and pass `CancellationToken` through async entry points.
- Prefer letting cancellable APIs observe the token instead of sprinkling `cancellationToken.ThrowIfCancellationRequested()`. Use an explicit check only for long-running CPU-bound work.
- Keep validation and error handling explicit at the boundary; do not hide failures behind silent defaults.
- Use braces on their own lines and keep formatting consistent with the surrounding project.

## Directory responsibilities

- `Endpoints\` — Minimal API endpoint definitions as static extension methods on `WebApplication`. Own routing, authorization, request binding, and response shaping using `Results.*`.
- `Services\` — use-case orchestration and business rules. Must stay HTTP-agnostic. Consume client interfaces to call downstream services.
- `Models\` — request/response models and DTOs shared across endpoints, services, and clients.
- `Clients\` — typed `HttpClient` wrappers behind interface abstractions for downstream service calls.
- `Clients\Handlers\` — `DelegatingHandler` implementations for cross-cutting HTTP client pipeline concerns (e.g. header propagation, logging).
- `Middleware\` — ASP.NET Core middleware and dependent components.

## Separation of concerns

### Endpoints own HTTP constructs

Keep HTTP-specific concepts inside `Endpoints\`:

- Route definitions and route constraints (e.g. `{temperatureSensorId:int}`)
- Request parameter binding (route, query-string, body)
- `Results.Ok()`, `Results.Problem()`, and status-code shaping
- Exception-to-HTTP mapping (e.g. catch `HttpRequestException` → 502 Bad Gateway)

Endpoints extract request parameters, call a service, and translate the result into an HTTP response. They should not contain business logic.

### Services stay HTTP-agnostic

Do **not** use these in `Services\`:

- `HttpContext`, `HttpRequest`, `HttpResponse`
- `Results`, `IResult`, or status codes
- Routing or model-binding constructs

Services accept normalized inputs (models, identities, primitives, `CancellationToken`) and return service or domain results. They orchestrate calls to client interfaces and may run work in parallel (e.g. `Task.WhenAll`).

## Typed HttpClient patterns

- Define an interface per downstream service (e.g. `ITemperatureSensorClient`).
- Implement as a class with a primary constructor accepting `HttpClient`.
- Register in `Program.cs` using `AddHttpClient<TInterface, TImplementation>()` with a base address from configuration.
- Chain `DelegatingHandler` implementations via `.AddHttpMessageHandler<THandler>()` for cross-cutting concerns.
- Clients call `EnsureSuccessStatusCode()` and deserialize via `ReadFromJsonAsync<T>()`.