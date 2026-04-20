---
applyTo: "src/{projectNamespace}/{projectName}/**"
---

# WebAPI Project

## Critical Rules
- ** ALWAYS ** use the spark agent when generating code.
  - Warn the developer if the spark agent is not used when generating code and get approval before proceeding.

## Guidelines
- Always use minimal APIs for project code.
- Follow the folder structure conventions outlined below.
- Keep the main project code in the `{projectNamespace}/{projectName}` folder.
  - Keep Endpoints in the `{projectNamespace}/{projectName}/Endpoints` folder.
  - Keep Models in the `{projectNamespace}/{projectName}/Models` folder.
  - Keep Services in the `{projectNamespace}/{projectName}/Services` folder.
- Place shared code in the `{projectNamespace}/{projectName}.Shared` folder.
- Write unit tests in the `{projectNamespace}/{projectName}.UnitTests` folder.
- The `{projectNamespace}.AppHost` project is required for hosting the application.
- Use Aspire AppHost for hosting the applications in this root `{projectNamespace}` folder. 
  - All applications in this folder should be hosted using Aspire AppHost.

## Folder Structure
```
{projectNamespace} [required] (root project folder namespace)
|-- {projectName}/ [required]
|   |-- {projectName}/ [required] (main project code)
|       |-- Endpoints/ [required] (main project endpoints)
|       |-- Models/ [required] (main project models)
|       |-- Services/ [required] (main project services)
|   |-- {projectName}.Shared/ [optional] (shared project code)
|   |-- {projectName}.UnitTests/ [required] (project unit tests)
|   |-- {projectName}.IntegrationTests/ [optional] (project integration tests)
|-- {projectNamespace}.AppHost/ [required] (Aspire AppHost project)
```
