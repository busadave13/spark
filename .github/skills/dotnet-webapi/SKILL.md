---
name: dotnet-webapi
description: Scaffolds the directory structure, .NET projects, solution file, and instructions file for a .NET Web API microservice.
---

# .NET Web API Project Scaffold

Creates the project directory structure, scaffolds .NET projects via the `dotnet` CLI, wires up a solution file with project references, and generates an instructions file. Idempotent — skips artifacts that already exist.

## Required Inputs

| Input | Description | Example |
|---|---|---|
| `sourceRoot`     | Relative path from repo root to the source directory | `src` |
| `namespaceName`  | Parent namespace folder (PascalCase) | `Test`, `XPackage` |
| `projectName`    | Service project name (PascalCase) | `Mockery`, `WeatherCore` |

Derived: `projectNameLower = projectName.ToLowerInvariant()`.

## Step 1: Resolve Paths

```
$repoRoot         = (repo root)
$projectRoot      = "$repoRoot\{sourceRoot}\{namespaceName}\{projectName}"
$instructionsDir  = "$repoRoot\.github\instructions"
$instructionsPath = "$instructionsDir\{projectNameLower}.instructions.md"
$templatePath     = (this skill's resources)\projectName.instructions.md
$slnPath          = "$projectRoot\{projectName}.sln"
```

## Step 2: Scaffold Projects

Skip any project whose directory already contains a `.csproj`. Otherwise run:

```
dotnet new webapi    --name {projectName}                  --output {projectRoot}/{projectName}                  --use-minimal-apis --no-openapi
dotnet new classlib  --name {projectName}.Shared           --output {projectRoot}/{projectName}.Shared
dotnet new xunit     --name {projectName}.UnitTests        --output {projectRoot}/{projectName}.UnitTests
dotnet new xunit     --name {projectName}.IntegrationTests --output {projectRoot}/{projectName}.IntegrationTests
```

Also ensure `.github/instructions/` exists.

## Step 3: Solution and References

Create the solution if `$slnPath` does not exist, then add all projects and references:

```
dotnet new sln --name {projectName} --output {projectRoot}

dotnet sln {slnPath} add {projectRoot}/{projectName}/{projectName}.csproj
dotnet sln {slnPath} add {projectRoot}/{projectName}.Shared/{projectName}.Shared.csproj
dotnet sln {slnPath} add {projectRoot}/{projectName}.UnitTests/{projectName}.UnitTests.csproj
dotnet sln {slnPath} add {projectRoot}/{projectName}.IntegrationTests/{projectName}.IntegrationTests.csproj
```

Project references (skip any that already exist):

- **Service** → Shared
- **UnitTests** → Service, Shared
- **IntegrationTests** → Service, Shared

Add the integration test NuGet package:

```
dotnet add {projectRoot}/{projectName}.IntegrationTests/{projectName}.IntegrationTests.csproj package Microsoft.AspNetCore.Mvc.Testing
```

## Step 4: Build

Run `dotnet build {slnPath}` and confirm it succeeds. Fix any issues before continuing.

## Step 5: Instructions

If `$instructionsPath` already exists, skip. Otherwise read `$templatePath`, replace `{sourceRoot}`, `{namespaceName}`, and `{projectName}` tokens with concrete values, and write to `$instructionsPath`.

## Step 6: Verify

- Each project directory contains a `.csproj`.
- `dotnet sln {slnPath} list` shows all four projects.
- `$instructionsPath` exists with no unreplaced tokens. If verification fails, delete and rerun Step 5.

## Step 7: Report

```
| Artifact | Path | Status |
|---|---|---|
| Service | {projectRoot}/{projectName}/{projectName}.csproj | created / already existed |
| Shared | {projectRoot}/{projectName}.Shared/{projectName}.Shared.csproj | created / already existed |
| UnitTests | {projectRoot}/{projectName}.UnitTests/{projectName}.UnitTests.csproj | created / already existed |
| IntegrationTests | {projectRoot}/{projectName}.IntegrationTests/{projectName}.IntegrationTests.csproj | created / already existed |
| Solution | {slnPath} | created / already existed |
| Instructions | {instructionsPath} | created / already existed |
| Build | dotnet build | passed / failed |
```
