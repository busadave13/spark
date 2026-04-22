---
applyTo: "{sourceRoot}/{namespaceName}/{projectName}/**"
---

### Folder Structure

- `{sourceRoot}/{namespaceName}/{projectName}/{projectName}/` — ASP.NET Core Minimal API proxy service [required]
- `{sourceRoot}/{namespaceName}/{projectName}/{projectName}.Shared/` — Host-neutral shared contracts and propagation library [required]
- `{sourceRoot}/{namespaceName}/{projectName}/{projectName}.UnitTests/` — xUnit unit and integration test project [required]
- `{sourceRoot}/{namespaceName}/{projectName}/AGENTS.md` — Project coding guidelines [required]
- `{sourceRoot}/{namespaceName}/.vscode/tasks.json` — VS Code build/run/test tasks, shared across all projects in the namespace [required]

### Critical Rules

- The Mockery service project must be a runnable ASP.NET Core web host (not a library). It must contain `Program.cs` with `WebApplication.CreateBuilder`, `public partial class Program { }`, and the Microsoft.NET.Sdk.Web SDK.
- The Mockery.Shared project is a class library (Microsoft.NET.Sdk) providing host-neutral contracts only.
- The Mockery.UnitTests project references the Mockery service project and uses `WebApplicationFactory<Program>` for integration testing.
- All projects target `net10.0`.

### Guidelines

- Follow the AGENTS.md coding guidelines in `{sourceRoot}/{namespaceName}/{projectName}/AGENTS.md`.
- Use xUnit with `WebApplicationFactory<Program>` and `IClassFixture` for integration tests.
- Use `Microsoft.AspNetCore.Mvc.Testing` version 10.0.0.

### Agents must follow the guidelines in AGENTS.md and critical rules above.
- Project AGENTS.md file can be found at `{sourceRoot}/{namespaceName}/{projectName}/AGENTS.md`.
