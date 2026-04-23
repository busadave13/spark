---
name: dotnet-webapi-project
description: Scaffolds a new .NET Web API microservice with companion .Shared library and .UnitTests project.
---

# New .NET Web API Project

Scaffolds an ASP.NET Core Web API microservice plus `.Shared` class library and `.UnitTests` xUnit project. Layout is driven by `resources/projectName.instructions.md` after token replacement (single source of truth). Use when the user asks to create, scaffold, or bootstrap a new service.

## Operating Principles

- **Idempotent** — never `dotnet new --force`; every write is conditional on the destination being missing.
- **`resources/` templates are the source of truth** for layout, VS Code tasks, and instructions.
- **Filesystem checks are authoritative** — command output is supporting context.
- On failure, apply the smallest repair, rerun only the failed step, and halt downstream work.

## Required Inputs

Use a single `ask_user` call to collect all missing values up front. Do **not** proceed until all required inputs are confirmed:

| Input | Description | Example |
|---|---|---|
| `namespaceName` | Parent folder under `{sourceRoot}/` (PascalCase) | `Test`, `XPackage` |
| `projectName`   | Service project name (PascalCase) | `Mockery`, `WeatherCore` |
| `sourceRoot`    | Repo-relative path to the source folder | `src` |
| `instructionsRoot` | Absolute path where the instructions file should be written. **Caller passes this**, derived from Spark's `config.yaml` `roots.instructions`. Falls back to `$repoRoot\.github\instructions` only if the caller did not supply it. | `C:\repo\.github\instructions` or `C:\repo\.copilot\instructions` |

Derived values:

- `projectNameLower = projectName.ToLowerInvariant()` — used for the instructions filename.
- `namespaceNameLower = namespaceName.ToLowerInvariant()` — used for the namespace workspace filename.
- `dotnetVersion = net10.0` (fixed).
- `mvcTestingVersion = 10.0.0` (fixed, paired with `net10.0`).

## Step 1: Compute Path Map

Replace every `{token}` with its concrete value before running the equivalent command.

> PowerShell shown below; adapt syntax and path separators for macOS/Linux.

```powershell
$repoRoot               = git rev-parse --show-toplevel  # or the agent's known repo root
$namespaceRoot          = "{sourceRoot}\{namespaceName}"
$serviceGroup           = "$namespaceRoot\{projectName}"
$serviceProjectDir      = "$serviceGroup\{projectName}"
$servicePath            = "$serviceProjectDir\{projectName}.csproj"
$sharedProjectDir       = "$serviceGroup\{projectName}.Shared"
$sharedPath             = "$sharedProjectDir\{projectName}.Shared.csproj"
$unitTestsDir           = "$serviceGroup\{projectName}.UnitTests"
$unitTestsPath          = "$unitTestsDir\{projectName}.UnitTests.csproj"
$vscodeDir              = "$namespaceRoot\.vscode"
$vscodeTasksPath        = "$vscodeDir\tasks.json"
$workspacePath          = "$namespaceRoot\{namespaceNameLower}.code-workspace"
$instructionsDir        = if ($instructionsRoot) { $instructionsRoot } else { "$repoRoot\.github\instructions" }
$instructionsPath       = "$instructionsDir\{projectNameLower}.instructions.md"

$resourcesDir           = (path to this skill's resources directory)
$folderTemplate         = "$resourcesDir\projectName.instructions.md"
$tasksTemplate          = "$resourcesDir\tasks.json"
$workspaceTemplate      = "$resourcesDir\namespaceName.code-workspace"
```

## Step 2: Create Directory Structure From Template

Read `resources/projectName.instructions.md`, replace tokens (`{sourceRoot}`, `{namespaceName}`, `{projectName}`), and extract bullet entries under `### Folder Structure`. Create each directory-ending entry (`/`) if missing. Also ensure `$vscodeDir` and `$instructionsDir` exist.

## Step 3: Scaffold the Three Projects

All three projects are always created. Skip any `dotnet new` whose `.csproj` already exists.

```powershell
if (-not (Test-Path $servicePath)) {
  dotnet new webapi   -n {projectName}            --output $serviceProjectDir --framework {dotnetVersion} --no-https
}
if (-not (Test-Path $sharedPath)) {
  dotnet new classlib -n {projectName}.Shared     --output $sharedProjectDir  --framework {dotnetVersion}
}
if (-not (Test-Path $unitTestsPath)) {
  dotnet new xunit    -n {projectName}.UnitTests  --output $unitTestsDir      --framework {dotnetVersion}
}
```

Add references and packages only if missing (the `dotnet add` commands are themselves idempotent — re-running upserts):

```powershell
# service -> shared
dotnet add $servicePath   reference $sharedPath
# unittests -> service
dotnet add $unitTestsPath reference $servicePath
# Mvc.Testing for WebApplicationFactory<Program>
dotnet add $unitTestsPath package Microsoft.AspNetCore.Mvc.Testing --version {mvcTestingVersion}
```

This skill does **not** rewrite `Program.cs`, does **not** add aligned WeatherForecast sample sources, and does **not** reconcile container metadata. Those concerns are out of scope.

## Step 4: Copy + Token-Replace + Merge `tasks.json`

`tasks.json` lives at `$vscodeDir` (namespace root) and is shared across all projects in the namespace.

1. Read `$tasksTemplate` and replace `{projectName}` to produce the **rendered template**.
2. **If `$vscodeTasksPath` is missing** — write the rendered template verbatim.
3. **If `$vscodeTasksPath` exists** — JSON-aware merge:
   - Parse existing file. If malformed, surface a blocker — do **not** overwrite.
   - Collect existing task labels from `existing.tasks[*].label`.
   - Append any rendered tasks whose `label` is not already present.
   - Write back only if tasks were appended; preserve existing top-level fields and order.

The merge is label-based and order-preserving. The skill never modifies or removes existing tasks.

## Step 5: Copy + Rename Namespace Workspace File

The namespace root gets a single VS Code workspace file named in lowercase (e.g. `Test` → `test.code-workspace`). It is namespace-scoped — a second project under the same namespace skips this step.

If `$workspacePath` is missing, copy `$workspaceTemplate` verbatim (no token replacement). If present, leave unchanged.

## Step 6: Copy + Token-Replace Instructions File

If `$instructionsPath` is missing, read `$folderTemplate`, replace `{sourceRoot}`, `{namespaceName}`, and `{projectName}`, and write to `$instructionsPath`. If present, leave unchanged.

## Step 7: Direct Verification

All must be true. If any fails, rerun the owning step and recheck. Do not advance until all pass or a blocker is surfaced.

```powershell
Test-Path $servicePath
Test-Path $sharedPath
Test-Path $unitTestsPath
Test-Path $vscodeTasksPath
Test-Path $workspacePath
Test-Path $instructionsPath

Select-String -Path $servicePath   -Pattern "ProjectReference Include=.*[/\\]{projectName}\.Shared[/\\]{projectName}\.Shared\.csproj" -Quiet
Select-String -Path $unitTestsPath -Pattern "ProjectReference Include=.*[/\\]{projectName}\.csproj"                                  -Quiet
Select-String -Path $unitTestsPath -Pattern ([regex]::Escape("Microsoft.AspNetCore.Mvc.Testing"))                                    -Quiet
```

If any check fails, rerun only the owning step and recheck.

## Step 8: Report

```
**Project scaffolded successfully!**

| Artifact | Path | Status |
|---|---|---|
| Service project   | `{sourceRoot}\{namespaceName}\{projectName}\{projectName}\{projectName}.csproj`                             | [created / already existed] |
| Shared project    | `{sourceRoot}\{namespaceName}\{projectName}\{projectName}.Shared\{projectName}.Shared.csproj`               | [created / already existed] |
| Unit test project | `{sourceRoot}\{namespaceName}\{projectName}\{projectName}.UnitTests\{projectName}.UnitTests.csproj`         | [created / already existed] |
| Service → Shared reference   | — | [added / already existed] |
| UnitTests → Service reference| — | [added / already existed] |
| Mvc.Testing package          | — | [added (v{mvcTestingVersion}) / already existed] |
| VS Code tasks   | `{sourceRoot}\{namespaceName}\.vscode\tasks.json`                     | [created / merged / already up to date] |
| VS Code workspace | `{sourceRoot}\{namespaceName}\{namespaceNameLower}.code-workspace`  | [created / already existed] |
| Instructions    | `{instructionsDir}\{projectNameLower}.instructions.md` (resolved from caller's `instructionsRoot` or default `.github\instructions`) | [created / already existed] |
```

## Error Handling

| Symptom | Resolution |
|---|---|
| `dotnet new` failed | Verify the output path is writable, the framework is supported (`net10.0`), and the template is installed. Rerun only the owning sub-step. |
| Missing `### Folder Structure` heading in the instructions template | The template is malformed. Restore it from version control before rerunning Step 2. |
| Token left in a written file (`{sourceRoot}`, `{namespaceName}`, `{projectName}`) | Token replacement was incomplete — rerun the owning copy step (4 or 7). |
| Direct check fails after a step reported success | Rerun only the owning step, then rerun the failed direct check. |
| Destination file exists with stale token text | Skill is idempotent and does **not** overwrite. Resolve manually (delete or fix the file) and rerun the relevant step. |
