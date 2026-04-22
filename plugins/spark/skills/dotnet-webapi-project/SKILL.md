---
name: dotnet-webapi-project
description: Scaffolds a new .NET Web API microservice project with a companion shared class library and unit-test project, aligned to the project AGENTS.md guidelines.
---

# New .NET Web API Project

This skill scaffolds a new ASP.NET Core Web API microservice plus its companion `.Shared` class library and `.UnitTests` xUnit project. The directory layout is driven by `resources/projectName.instructions.md` after token replacement, so that template stays the single source of truth for the on-disk shape.

The skill performs all work directly — no sub-agent launches, no aligned source-file rewrites, no runtime validation.

## When to Use

- User asks to "create a new project", "add a new service", "scaffold a new API", or "bootstrap a new microservice".

## Operating Principles

- **Idempotent.** Never `dotnet new --force`; never overwrite an existing `.cs`, `.csproj`, `.json`, `AGENTS.md`, or `.instructions.md` file. Every write is conditional on the destination being missing.
- **Templates under `resources/` are the source of truth** for layout, AGENTS guidance, VS Code tasks, and instructions metadata.
- **Direct filesystem checks are authoritative** — treat command output as supporting context.
- On any step failure, apply the smallest targeted repair, rerun only the failed step, and stop downstream work until it is healthy.

## Required Inputs

Use a single `ask_user` call to collect all three values up front. Do **not** proceed until all three are confirmed:

| Input | Description | Example |
|---|---|---|
| `namespaceName` | Parent folder under `{sourceRoot}/` (PascalCase) | `Test`, `XPackage` |
| `projectName`   | Service project name (PascalCase) | `Mockery`, `WeatherCore` |
| `sourceRoot`    | Repo-relative path to the source folder | `src` |

Derived values:

- `projectNameLower = projectName.ToLowerInvariant()` — used for the instructions filename.
- `namespaceNameLower = namespaceName.ToLowerInvariant()` — used for the namespace workspace filename.
- `dotnetVersion = net10.0` (fixed).
- `mvcTestingVersion = 10.0.0` (fixed, paired with `net10.0`).

## Step 1: Compute Path Map

Replace every `{token}` with its concrete value before running the equivalent command.

> **Cross-platform note:** PowerShell shown below; on macOS/Linux use Bash/Python or any equivalent. Path separators (`\` vs `/`) and command syntax differ — adapt as needed.

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
$agentsPath             = "$serviceGroup\AGENTS.md"
$vscodeDir              = "$namespaceRoot\.vscode"
$vscodeTasksPath        = "$vscodeDir\tasks.json"
$workspacePath          = "$namespaceRoot\{namespaceNameLower}.code-workspace"
$instructionsDir        = "$repoRoot\.github\instructions"
$instructionsPath       = "$instructionsDir\{projectNameLower}.instructions.md"

$resourcesDir           = (path to this skill's resources directory)
$folderTemplate         = "$resourcesDir\projectName.instructions.md"
$agentsTemplate         = "$resourcesDir\AGENTS.md"
$tasksTemplate          = "$resourcesDir\tasks.json"
$workspaceTemplate      = "$resourcesDir\namespaceName.code-workspace"
```

## Step 2: Create Directory Structure From Template

The folder list comes from `resources/projectName.instructions.md`. Read that file, replace the three tokens (`{sourceRoot}`, `{namespaceName}`, `{projectName}`) with the input values, and extract the bullet entries under the `### Folder Structure` heading. For each entry that ends with `/`, create the directory if missing. File entries are produced by later steps and are not pre-created here.

Always also ensure `$vscodeDir` and `$instructionsDir` exist (they are not in the template's bullet list because they are managed by Steps 4 and 6).

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

`tasks.json` lives at the namespace root (`$vscodeDir = $namespaceRoot\.vscode`) and
is shared across every project scaffolded under the same namespace. Each skill run
must contribute its project's tasks without clobbering tasks added by previous runs.

Render the template first:

1. Read `$tasksTemplate`.
2. Replace `{projectName}` with the input value to produce the **rendered template**
   (a JSON document with a top-level `tasks` array).

Then write or merge:

- **If `$vscodeTasksPath` is missing**, write the rendered template to
  `$vscodeTasksPath` verbatim.
- **If `$vscodeTasksPath` already exists**, perform a JSON-aware merge:
  1. Parse the existing file as JSON. If parsing fails, surface a blocker — do **not**
     overwrite or wrap a malformed file.
  2. Build the set of existing task labels from `existing.tasks[*].label`.
  3. For each task in the rendered template's `tasks` array whose `label` is not in
     that set, append it to `existing.tasks`.
  4. If at least one task was appended, write the updated JSON back to
     `$vscodeTasksPath`, preserving the existing file's other top-level fields
     (e.g. `version`, `inputs`) and overall structure. If nothing was appended, leave
     the file untouched (re-running the skill for the same project must be a no-op).

The merge is label-based and order-preserving: appended tasks go at the end of the
existing `tasks` array. The skill never modifies or removes tasks that are already
present, even if their bodies differ from the rendered template.

## Step 5: Copy `AGENTS.md`

If `$agentsPath` is missing, copy `$agentsTemplate` to `$agentsPath` unchanged. If present, leave it untouched (the existing file is the source of truth).

## Step 6: Copy + Rename Namespace Workspace File

The namespace folder gets a single VS Code multi-root workspace file at the namespace
root, named after the namespace in lowercase (e.g. namespace `Test` →
`test.code-workspace`). It is namespace-scoped, not project-scoped: the second project
scaffolded under the same namespace will find this file already in place and skip the
copy.

If `$workspacePath` is missing, copy `$workspaceTemplate`
(`resources/namespaceName.code-workspace`) to `$workspacePath` verbatim. The template
contains no tokens — do **not** perform token replacement.

If `$workspacePath` already exists, leave it unchanged.

## Step 7: Copy + Rename + Token-Replace Instructions File

If `$instructionsPath` is missing:

1. Read `$folderTemplate` (`resources/projectName.instructions.md`).
2. Replace every occurrence of `{sourceRoot}`, `{namespaceName}`, and `{projectName}` with the input values.
3. Write the result to `$instructionsPath` (i.e. `<repoRoot>/.github/instructions/{projectNameLower}.instructions.md`).

If the destination already exists, leave it unchanged.

## Step 8: Direct Verification

Run only these checks (all must be true):

```powershell
Test-Path $servicePath
Test-Path $sharedPath
Test-Path $unitTestsPath
Test-Path $agentsPath
Test-Path $vscodeTasksPath
Test-Path $workspacePath
Test-Path $instructionsPath

Select-String -Path $servicePath   -Pattern "ProjectReference Include=.*[/\\]{projectName}\.Shared[/\\]{projectName}\.Shared\.csproj" -Quiet
Select-String -Path $unitTestsPath -Pattern "ProjectReference Include=.*[/\\]{projectName}\.csproj"                                  -Quiet
Select-String -Path $unitTestsPath -Pattern ([regex]::Escape("Microsoft.AspNetCore.Mvc.Testing"))                                    -Quiet
```

If any check fails, rerun only the owning step and rerun the failed check. Do **not** advance to the report until either all checks pass or a blocker is explicitly surfaced.

## Step 9: Report

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
| AGENTS.md       | `{sourceRoot}\{namespaceName}\{projectName}\AGENTS.md`                | [created / already existed] |
| VS Code tasks   | `{sourceRoot}\{namespaceName}\.vscode\tasks.json`                     | [created / merged / already up to date] |
| VS Code workspace | `{sourceRoot}\{namespaceName}\{namespaceNameLower}.code-workspace`  | [created / already existed] |
| Instructions    | `.github\instructions\{projectNameLower}.instructions.md`             | [created / already existed] |
```

## Error Handling

| Symptom | Resolution |
|---|---|
| `dotnet new` failed | Verify the output path is writable, the framework is supported (`net10.0`), and the template is installed. Rerun only the owning sub-step. |
| Missing `### Folder Structure` heading in the instructions template | The template is malformed. Restore it from version control before rerunning Step 2. |
| Token left in a written file (`{sourceRoot}`, `{namespaceName}`, `{projectName}`) | Token replacement was incomplete — rerun the owning copy step (4 or 7). |
| Direct check fails after a step reported success | Rerun only the owning step, then rerun the failed direct check. |
| Destination file exists with stale token text | Skill is idempotent and does **not** overwrite. Resolve manually (delete or fix the file) and rerun the relevant step. |
