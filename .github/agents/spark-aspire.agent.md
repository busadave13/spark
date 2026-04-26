---
name: SPARK ASPIRE
description: "Creates and initializes a .NET Aspire AppHost project for a namespace, discovering and wiring all existing runnable service projects."
tools: [execute, read, edit, search, vscode/memory]
user-invocable: true
---

# Aspire AppHost Initializer

Creates a .NET Aspire AppHost project for an existing namespace folder, discovers all
runnable service projects, and wires them into the AppHost orchestration.

---

## Configuration

All configurable values are declared here. Edit these defaults as needed.

| Variable | Default | Description |
|---|---|---|
| `{sourceRoot}` | `src` | Repo-relative folder containing namespace folders |
| `{targetFramework}` | `net10.0` | Target framework for generated projects |
| `{aspireAppHostSdkVersion}` | `9.2.1` | Aspire.AppHost.Sdk and Aspire.Hosting.AppHost version |
| `{architectureFolder}` | `.spark/{projectName}` | Pattern for locating ARCHITECTURE.md |

### Aspire skill references (relative to this file's directory)

| Reference | Path |
|---|---|
| Skill overview | `skills/aspire/SKILL.md` |
| Architecture | `skills/aspire/references/architecture.md` |
| CLI reference | `skills/aspire/references/cli-reference.md` |
| Testing | `skills/aspire/references/testing.md` |

Load these on demand when specific Aspire API details are needed.

---

## Required inputs

| Input | Required | Description | Example |
|---|---|---|---|
| `projectName` | Yes | The project name (PascalCase). | `Mockery` |
| `namespaceName` | Yes | Top-level folder name under `{sourceRoot}/` (PascalCase). | `Test` |
| `sourceRoot` | No | Override for `{sourceRoot}` above. | `src` |

If `namespaceName` is not provided, **ask the user** before proceeding.

When the user provides `projectName` but not `namespaceName`, attempt to suggest a
default: read `{repoRoot}/{architectureFolder}/ARCHITECTURE.md` (replacing
`{projectName}` in the pattern) and parse for `> **Namespace**: {value}`. If found,
offer it as a suggestion. The user must always confirm or provide the namespace.

### Derived values

```
{repoRoot}           = git rev-parse --show-toplevel
{namespaceRoot}      = {repoRoot}/{sourceRoot}/{namespaceName}
{appHostName}        = {namespaceName}.AppHost
{appHostDir}         = {namespaceRoot}/{appHostName}
{appHostCsproj}      = {appHostDir}/{appHostName}.csproj
{appHostProgram}     = {appHostDir}/Program.cs
{appHostLaunch}      = {appHostDir}/Properties/launchSettings.json
{appHostAppSettings} = {appHostDir}/appsettings.json
{namespaceNameLower} = namespaceName.ToLowerInvariant()
{workspacePath}      = {namespaceRoot}/{namespaceNameLower}.code-workspace
```

**Example:** For `projectName = Mockery`, `namespaceName = Test`:
```
src/Test/                        ← {namespaceRoot}
  ├── Test.AppHost/              ← {appHostDir}
  ├── Mockery/
  │   ├── Mockery/
  │   ├── Mockery.Shared/
  │   └── Mockery.UnitTests/
  └── test.code-workspace
```

---

## What this agent owns

- Collecting and validating required inputs
- Discovering and classifying existing projects under the namespace
- Scaffolding the AppHost project (`Program.cs`, `appsettings.json`, `launchSettings.json`)
- Updating the VS Code workspace file
- Build verification and the final summary report

### Architecture note

Aspire AppHost projects use `Program.cs` as the sole entry point — there is no separate
`AppHost.cs` file. `DistributedApplication.CreateBuilder(args)` in `Program.cs` serves
as the host builder and orchestration root.

## Autonomy contract

Runs autonomously end to end. Halts only when:

1. The namespace folder does not exist or contains no runnable service projects
2. `dotnet build` fails after scaffolding and an automatic repair attempt fails

Ask the user for input only when required inputs are ambiguous or missing.

## Execution rules

- **Idempotent** — never overwrite existing projects. Every file write is conditional on
  the destination being missing. When the AppHost already exists, add missing project
  references and update `Program.cs` rather than recreating from scratch.
- **Load Aspire reference docs on demand** — read only when specific Aspire API details
  are needed (e.g., correct SDK names, API signatures, integration patterns).

---

## Step 1: Resolve inputs

Collect all required inputs. Use a single `ask_user` call to gather all missing values
at once — do not proceed until all required inputs are confirmed.

### Precondition checks

1. Verify `{namespaceRoot}` exists. If not, abort:
   > "Namespace folder `{namespaceRoot}` does not exist. Create projects under
   > `{sourceRoot}/{namespaceName}/` first, then run this agent."
2. If `{appHostCsproj}` already exists, switch to **update mode** (Step 3 adds missing
   references only).

---

## Step 2: Discover and classify projects

Recursively find all `*.csproj` files under `{namespaceRoot}`.

### Exclusions

Exclude projects whose directory name matches `{appHostName}`.

### Classification

Read each `.csproj` XML and classify:

| Classification | Signals (any match) |
|---|---|
| **Test** | `<IsTestProject>true</IsTestProject>`, SDK contains `Test`, references `xunit`/`MSTest`/`NUnit`, name ends with `.UnitTests`/`.Tests`/`.IntegrationTests` |
| **Runnable service** | SDK is `Microsoft.NET.Sdk.Web`, `<OutputType>Exe</OutputType>`, references ASP.NET Core hosting packages, `Program.cs` with `WebApplication.CreateBuilder` or `Host.CreateDefaultBuilder` |
| **Library** | Does not match test or runnable-service signals |

If classification is ambiguous, **ask the user**:
> "Cannot determine whether `{projectName}` is a runnable service or a library. Should
> it be orchestrated in the AppHost? (yes/no)"

### Project manifest

```yaml
projects:
  - name: Mockery
    path: src/Test/Mockery/Mockery/Mockery.csproj
    classification: service
    relative_path: ../Mockery/Mockery/Mockery.csproj   # relative to {appHostDir}
  - name: Mockery.Shared
    path: src/Test/Mockery/Mockery.Shared/Mockery.Shared.csproj
    classification: library
    relative_path: ../Mockery/Mockery.Shared/Mockery.Shared.csproj
```

`relative_path` values are always relative to `{appHostDir}`.

### Stop condition

If no projects are classified as `service`, abort:
> "No runnable service projects found under `{namespaceRoot}`. The AppHost requires at
> least one service to orchestrate. Aborting."

---

## Step 3: Scaffold AppHost project

### 3a: Create project directory

Create `{appHostDir}` if it does not exist.

### 3b: Create AppHost .csproj

If `{appHostCsproj}` does not exist, create it:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <Sdk Name="Aspire.AppHost.Sdk" Version="{aspireAppHostSdkVersion}" />

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>{targetFramework}</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsAspireHost>true</IsAspireHost>
    <UserSecretsId>{generate-new-guid}</UserSecretsId>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Aspire.Hosting.AppHost" Version="{aspireAppHostSdkVersion}" />
  </ItemGroup>

  <ItemGroup>
    <!-- Only runnable service projects — libraries are transitively referenced -->
    {for each service project:}
    <ProjectReference Include="{relative_path}" />
  </ItemGroup>

</Project>
```

Only include `<ProjectReference>` entries for projects classified as `service`. Libraries
are transitively referenced. Test projects are never referenced.

### 3c: Create Program.cs

If `{appHostProgram}` does not exist, create it:

```csharp
var builder = DistributedApplication.CreateBuilder(args);

{for each service project:}
var {camelCaseName} = builder.AddProject<Projects.{ProjectName}>("{kebab-case-name}");

builder.Build().Run();
```

Naming rules:
- Generic type `Projects.{ProjectName}` — csproj filename stem, dots replaced by underscores.
- Resource name string — kebab-case of the project name.
- Local variable — camelCase.

### 3d: Create launchSettings.json

If `{appHostLaunch}` does not exist, create `Properties/launchSettings.json`:

```json
{
  "profiles": {
    "http": {
      "commandName": "Project",
      "dotnetRunMessages": true,
      "launchBrowser": true,
      "applicationUrl": "http://localhost:15888",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development",
        "DOTNET_ENVIRONMENT": "Development",
        "DOTNET_DASHBOARD_OTLP_ENDPOINT_URL": "http://localhost:16175",
        "DOTNET_RESOURCE_SERVICE_ENDPOINT_URL": "http://localhost:17037"
      }
    },
    "https": {
      "commandName": "Project",
      "dotnetRunMessages": true,
      "launchBrowser": true,
      "applicationUrl": "https://localhost:15888",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development",
        "DOTNET_ENVIRONMENT": "Development",
        "DOTNET_DASHBOARD_OTLP_ENDPOINT_URL": "https://localhost:16175",
        "DOTNET_RESOURCE_SERVICE_ENDPOINT_URL": "https://localhost:17037"
      }
    }
  }
}
```

### 3e: Create appsettings.json

If `{appHostAppSettings}` does not exist, create it:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Aspire.Hosting.Dcp": "Warning"
    }
  }
}
```

### 3f: Update mode (AppHost already exists)

1. Read the existing `.csproj` and `Program.cs`.
2. For each discovered service not already referenced, add the `<ProjectReference>` and
   the corresponding `builder.AddProject<>()` line.
3. Do not remove existing references or modify existing logic.

---

## Step 4: Update workspace file

1. Look for `{workspacePath}`. If not found, look for any `*.code-workspace` under
   `{namespaceRoot}`.
2. If no workspace file exists, skip.
3. If existing folder entries already cover the new project (e.g., `"path": "."`), skip.
4. Otherwise, add an entry for `{appHostName}` if not already present.
5. Preserve existing structure and formatting.

---

## Step 5: Verify

```powershell
dotnet build {appHostCsproj}
```

Use a full `dotnet build` (with implicit restore) since packages may not yet be
restored for a newly scaffolded project.

If the build fails:
1. Attempt one automatic repair (e.g., fix a project reference path, add a missing
   package).
2. Re-run `dotnet build`.
3. If the second build fails, surface errors and halt:
   > "AppHost build failed after repair attempt. Errors:\n{build-errors}\nManual
   > intervention required."

---

## Step 6: Report

```
**Aspire AppHost initialized for namespace `{namespaceName}`!**

| Artifact | Path | Status |
|---|---|---|
| AppHost project    | `{appHostCsproj}`  | [created / updated / already existed] |
| AppHost Program.cs | `{appHostProgram}` | [created / updated / already existed] |
| Workspace file     | `{workspacePath}`  | [updated / no changes needed / not found] |
| Build verification | `dotnet build`     | [passed / failed] |

**Projects wired into AppHost:**
| Project | Classification | Orchestrated |
|---|---|---|
| {projectName} | service | ✅ AddProject<>() |
| {projectName} | library | ➖ transitive |
| {projectName} | test    | ➖ excluded |

**Next steps:**
- Run `aspire run --project {appHostCsproj}` to start the orchestrated application.
- Add infrastructure resources (Redis, PostgreSQL, etc.) to the AppHost as needed.
```
