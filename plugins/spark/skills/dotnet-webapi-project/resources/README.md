# `dotnet-webapi-project` — Resources

The files in this folder are **scaffold templates** consumed by the
`dotnet-webapi-project` skill. They are not standalone source files and are not part of
any compilable project on their own.

The skill reads these templates, substitutes project-specific tokens (project name,
namespace, version), and writes the result into the target repo when scaffolding a new
.NET Web API microservice.

| File | Purpose |
|---|---|
| `AGENTS.md` | Per-project agent guidance copied into the new service folder |
| `IWeatherForecastService.cs` | Sample service interface template |
| `WeatherForecastService.cs` | Sample service implementation template |
| `WeatherForecastEndpoints.cs` | Minimal-API endpoint registration template |
| `WeatherForecastResponse.cs` | DTO template |
| `UnitTest1.cs` | Initial xUnit test template |
| `tasks.json` | VS Code tasks for build/test/run |
| `Workspace.code-workspace` | VS Code workspace template |

Do not edit these files expecting them to be live code in this repo — they are inert
until the skill copies them out.
