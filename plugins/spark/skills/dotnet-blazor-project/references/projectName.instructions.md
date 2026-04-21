---
applyTo: "src/{projectNamespace}/{projectName}/**"
---

# Blazor Project

## Critical Rules
- ** ALWAYS ** use the spark agent when generating code.
  - Warn the developer if the spark agent is not used when generating code and get approval before proceeding.

## Guidelines
- Default to Interactive Server render mode unless the feature spec calls out a different mode.
- Organise Razor components by role: routable pages, layouts, and reusable components live in distinct folders.
- Keep `@page` directives only on files under `Pages/`.
- Follow the folder structure conventions outlined below.
- The namespace folder root must contain exactly one Aspire AppHost project named `{projectNamespace}.AppHost`.
- Keep the main project code in the `{projectNamespace}/{projectName}` folder.
  - Keep routable pages in `{projectNamespace}/{projectName}/Pages`.
  - Keep layouts in `{projectNamespace}/{projectName}/Layout`.
  - Keep reusable non-routable components in `{projectNamespace}/{projectName}/Components`.
  - Keep DI-registered services in `{projectNamespace}/{projectName}/Services`.
  - Keep view models and DTOs in `{projectNamespace}/{projectName}/Models`.
  - Keep static assets in `{projectNamespace}/{projectName}/wwwroot`.
- Place shared code in the `{projectNamespace}/{projectName}.Shared` folder.
- Write component tests with bUnit in the `{projectNamespace}/{projectName}.UnitTests` folder.
- The `{projectNamespace}.AppHost` project is required and must live directly under the `{projectNamespace}` folder root.
- Use Aspire AppHost for hosting the applications in this root `{projectNamespace}` folder.
  - Every runnable main project in this namespace folder must be configured in `{projectNamespace}.AppHost` so the full local topology can be started with Aspire `dotnet run`.
  - Shared libraries, unit test projects, and other non-runnable companion projects must not be treated as standalone AppHost app resources unless the repo has an explicit reason to run them as processes.

## Folder Structure
```
{projectNamespace} [required] (root project folder namespace)
|-- {projectName}/ [required]
|   |-- {projectName}/ [required] (main project code)
|       |-- Pages/ [required] (routable @page components)
|       |-- Layout/ [required] (layout components)
|       |-- Components/ [optional] (reusable non-routable components)
|       |-- Services/ [optional] (DI-registered services)
|       |-- Models/ [optional] (view models and DTOs)
|       |-- wwwroot/ [required] (static assets)
|   |-- {projectName}.Shared/ [optional] (shared project code)
|   |-- {projectName}.UnitTests/ [required] (bUnit component tests)
|   |-- {projectName}.IntegrationTests/ [optional] (end-to-end tests)
|-- {projectNamespace}.AppHost/ [required] (Aspire AppHost project at the namespace root; configures every runnable main project under this namespace for local Aspire `dotnet run`)
```
