---
name: new-webapi-project
description: Scaffolds a new .NET Web API microservice project (with companion shared, unit-test, AppHost, and integration-test projects) and aligns it to the project AGENTS.md guidelines.
---

# New .NET Web API Project

This skill scaffolds a new ASP.NET Core Web API microservice and its companion projects in a single inline run. It performs all work directly — there are no sub-agent launches. The aligned templates under `resources/` are written into place during scaffolding rather than reshaped after the fact.

## When to Use

- User asks to "create a new project", "add a new service", "scaffold a new API", or "bootstrap a new microservice"
- User wants a new backend (core) or front-door (FD) service added to the repo

## Operating Principles

- **Idempotent**: never `dotnet new --force`; never blindly overwrite an existing `.cs`, `.csproj`, `.json`, `.code-workspace`, `.http`, `AGENTS.md`, or launch/settings file. Make the smallest targeted edit when a required line, package, project reference, or managed `tasks.json` task entry is missing or stale.
- **Existing files are the source of truth**, except for the skill-managed task entries in `src\{namespaceFolder}\.vscode\tasks.json` (which may be reconciled).
- **Direct filesystem and project-reference checks are authoritative.** Treat all step output as supporting context.
- On any step failure, apply the smallest targeted repair, rerun only the failed step, and stop downstream work until it is healthy.

## Execution Order

1. Gather inputs → 2. Compute path map and existing-state snapshot → 3. Reconcile namespace assets → 4. Scaffold service + write aligned source → 5. Optional shared project + reference → 6. Scaffold unit tests → 7. Scaffold AppHost → 8. Optional integration tests → 9. Direct verification → 10. Runtime validation → 11. Report.

## Execution Summary

Maintain one concise summary covering: `namespaceFolder`, `projectName`, `projectNameLowerCase`, `dotnetVersion`; the checklist selections (`includeShared`, `includeIntegrationTests`); every managed path (mark unselected optional projects as skipped); the resolved namespace workspace filename and AppHost project name (and whether each was discovered or defaulted); the configured container base image and lowercase container repository; for each artifact whether it was created, updated, or already existed; the runtime validation outcome (including whether container publish used the local OCI runtime or the tarball fallback); warnings, skipped steps, fallback actions, and explicit blockers; and the exact files touched.

---

## Step 1: Gather Inputs

Use `ask_user` to collect:

```
1. Namespace folder — parent folder under `src/` (e.g. `XPackage`, `Duet`, `Test`)
2. Project name — name of the new service (e.g. `MyNewServiceCore`)
3. .NET version — target framework (default: `net10.0`)
```

Offer `net10.0` (default) and `net9.0`. Derive `projectNameLowerCase` from `projectName` using lowercase invariant rules. Do **not** proceed until confirmed.

### Project Checklist

After Step 2 has computed the existing-state snapshot, present a second `ask_user` with a multi-select checklist:

```
The following projects will always be created:
  • {projectName}                  (Web API service)
  • {projectName}.UnitTests
  • {namespaceFolder}.AppHost

Which optional projects should also be created?

☐ {projectName}.Shared             – class library for shared models/contracts
☐ {projectName}.IntegrationTests   – Aspire-based integration tests
```

Both items are **unchecked by default** — except: if Step 2 found the optional project already on disk (`sharedProjectExists` or `integrationTestProjectExists`), pre-check it so the user must explicitly uncheck to skip an existing project.

Persist the choices as `includeShared` and `includeIntegrationTests` for the rest of the run. Do **not** proceed until confirmed.

## Step 2: Compute Path Map and Existing State

Replace every `{token}` with its concrete value before running the equivalent command.

> **Cross-platform note:** PowerShell shown below; on macOS/Linux use Bash/Python or any equivalent. Path separators (`\` vs `/`) and command syntax differ — adapt as needed.

```powershell
$namespaceRoot = "src\{namespaceFolder}"
$serviceGroupPath = "$namespaceRoot\{projectName}"
$serviceProjectDirectory = "$serviceGroupPath\{projectName}"
$servicePath = "$serviceProjectDirectory\{projectName}.csproj"
$sharedProjectDirectory = "$serviceGroupPath\{projectName}.Shared"
$sharedPath = "$sharedProjectDirectory\{projectName}.Shared.csproj"
$unitTestsDirectory = "$serviceGroupPath\{projectName}.UnitTests"
$unitTestsPath = "$unitTestsDirectory\{projectName}.UnitTests.csproj"
$integrationTestsDirectory = "$serviceGroupPath\{projectName}.IntegrationTests"
$integrationTestsPath = "$integrationTestsDirectory\{projectName}.IntegrationTests.csproj"
$vscodeDirectory = "$namespaceRoot\.vscode"
$vscodeTasksPath = "$vscodeDirectory\tasks.json"
$agentsPath = "$serviceGroupPath\AGENTS.md"
$programPath = "$serviceProjectDirectory\Program.cs"
$httpFilePath = "$serviceProjectDirectory\{projectName}.http"
$controllersDirectory = "$serviceProjectDirectory\Controllers"
$businessLogicDirectory = "$serviceProjectDirectory\BusinessLogic"
$endpointsPath = "$serviceProjectDirectory\Endpoints\WeatherForecastEndpoints.cs"
$serviceInterfacePath = "$serviceProjectDirectory\Services\IWeatherForecastService.cs"
$serviceImplPath = "$serviceProjectDirectory\Services\WeatherForecastService.cs"
$responsePath = "$serviceProjectDirectory\Models\WeatherForecastResponse.cs"
$unitTestFilePath = "$unitTestsDirectory\UnitTest1.cs"
$integrationTestFilePath = "$integrationTestsDirectory\IntegrationTest1.cs"

$containerBaseImage = switch ("{dotnetVersion}") {
  "net10.0" { "mcr.microsoft.com/dotnet/aspnet:10.0-azurelinux3.0" }
  "net9.0"  { "mcr.microsoft.com/dotnet/aspnet:9.0-azurelinux3.0" }
  default   { throw "Unsupported framework: {dotnetVersion}" }
}
$containerRepository = "{projectNameLowerCase}"
$mvcTestingVersion = switch ("{dotnetVersion}") {
  "net10.0" { "10.0.0" }
  "net9.0"  { "9.0.0" }
  default   { throw "Unsupported framework: {dotnetVersion}" }
}

# Discover existing namespace-level workspace + AppHost (single-instance policy)
$workspaceMatches = @()
$appHostProjectMatches = @()
if (Test-Path $namespaceRoot) {
  $workspaceMatches = @(Get-ChildItem -Path $namespaceRoot -Filter *.code-workspace -File)
  $appHostProjectMatches = @(
    Get-ChildItem -Path $namespaceRoot -Directory -Filter *.AppHost |
      ForEach-Object {
        Get-ChildItem -Path $_.FullName -Filter "$($_.Name).csproj" -File -ErrorAction SilentlyContinue
      }
  )
}
if ($workspaceMatches.Count -gt 1) { throw "Expected at most one .code-workspace under $namespaceRoot but found $($workspaceMatches.Count)." }
if ($appHostProjectMatches.Count -gt 1) { throw "Expected at most one *.AppHost project under $namespaceRoot but found $($appHostProjectMatches.Count)." }

$workspaceName = if ($workspaceMatches.Count -eq 1) { $workspaceMatches[0].Name } else { "{namespaceFolder}.code-workspace" }
$workspacePath = "$namespaceRoot\$workspaceName"

$appHostProjectName = if ($appHostProjectMatches.Count -eq 1) { $appHostProjectMatches[0].BaseName } else { "{namespaceFolder}.AppHost" }
$appHostProjectTypeName = $appHostProjectName.Replace('.', '_')
$appHostDirectory = if ($appHostProjectMatches.Count -eq 1) { $appHostProjectMatches[0].Directory.FullName } else { "$namespaceRoot\$appHostProjectName" }
$appHostPath = if ($appHostProjectMatches.Count -eq 1) { $appHostProjectMatches[0].FullName } else { "$appHostDirectory\$appHostProjectName.csproj" }
$appHostSourcePath = "$appHostDirectory\AppHost.cs"

# Existing-state snapshot (drives idempotent decisions in every later step)
$existingState = @{
  serviceProjectExists           = Test-Path $servicePath
  sharedProjectExists            = Test-Path $sharedPath
  unitTestProjectExists          = Test-Path $unitTestsPath
  integrationTestProjectExists   = Test-Path $integrationTestsPath
  appHostProjectExists           = Test-Path $appHostPath
  vscodeTasksExists              = Test-Path $vscodeTasksPath
  workspaceExists                = Test-Path $workspacePath
  serviceGroupAgentsExists       = Test-Path $agentsPath
  programFileExists              = Test-Path $programPath
  httpFileExists                 = Test-Path $httpFilePath
  appHostSourceExists            = Test-Path $appHostSourcePath
  unitTestFileExists             = Test-Path $unitTestFilePath
  integrationTestFileExists      = Test-Path $integrationTestFilePath
  endpointsExists                = Test-Path $endpointsPath
  serviceInterfaceExists         = Test-Path $serviceInterfacePath
  serviceImplExists              = Test-Path $serviceImplPath
  responseExists                 = Test-Path $responsePath
  staleControllersDirectoryExists  = Test-Path $controllersDirectory
  staleBusinessLogicDirectoryExists = Test-Path $businessLogicDirectory
  workspaceWasDiscovered         = $workspaceMatches.Count -eq 1
  appHostWasDiscovered           = $appHostProjectMatches.Count -eq 1
}
```

If exactly one workspace file or one `*.AppHost` project is discovered, reuse it as-is — do **not** rename, copy, recreate, or overwrite.

## Step 3: Reconcile Namespace Assets

Use the templates in `resources\` directly.

1. **`src\{namespaceFolder}\.vscode\tasks.json`**
   - If missing: create `.vscode\` if needed, copy `resources\tasks.json`, replace `{projectName}`, `{namespaceFolder}`, and `{appHostProjectName}` tokens. If `includeIntegrationTests` is **false**, remove the `{projectName}.IntegrationTests: Run` task entry before writing.
   - If present: parse the JSON, leave unrelated tasks untouched, and ensure these skill-managed entries (matched by `label`) exist with the correct `args`/`options.cwd`/`presentation`:
     - `{appHostProjectName}: Build` and `{appHostProjectName}: Run` → resolved AppHost project
     - `{projectName}.UnitTests: Run` → current service-group path
     - `{projectName}.IntegrationTests: Run` → current service-group path **only when `includeIntegrationTests` is true**; if `includeIntegrationTests` is false and the entry exists from a prior run, remove it
2. **Namespace workspace** (`*.code-workspace`)
   - If no workspace was discovered: copy `resources\Workspace.code-workspace` unchanged to `$workspacePath`.
   - If exactly one was discovered: reuse it. Do **not** create or rename another.
3. **Project AGENTS.md** (`$agentsPath`)
   - If missing: copy `resources\AGENTS.md` unchanged.
   - If present: leave unchanged — existing file is the source of truth.

If a filesystem error blocks any of these writes, stop and surface as a blocker.

## Step 4: Scaffold the Service and Write Aligned Source

This step combines the original "scaffold service" and "AGENTS alignment" phases. Because the templates in `resources\` are already aligned to the project AGENTS.md guidelines (Minimal API endpoint extension methods, HTTP-agnostic services, dedicated models, file-scoped namespaces), they are written into place during scaffolding.

1. **Create the project if missing** (never `--force`):
   ```powershell
   dotnet new webapi -n {projectName} --output $serviceProjectDirectory --framework {dotnetVersion} --no-https
   ```
2. **Service `.csproj` reconciliation** (smallest targeted edits only):
   - Ensure `<ContainerBaseImage>$containerBaseImage</ContainerBaseImage>` is present in a `<PropertyGroup>`.
   - Ensure `<ContainerRepository>$containerRepository</ContainerRepository>` is present in a `<PropertyGroup>` (lowercase is required — the default AssemblyName-derived image name is invalid because `{projectName}` is PascalCase).
   - Do **not** add `Microsoft.NET.Build.Containers` (SDK container support is built in) and do **not** add `EnableSdkContainerSupport`.
3. **Write aligned source files** under `$serviceProjectDirectory`. For each of the four files below, copy the template, replace every `{projectName}` token, and write to the listed destination — but only if the destination is missing **or** still matches the prior skill-managed shape (i.e. it has not been customized beyond a safe targeted reconciliation). If the destination appears user-customized, stop and surface the blocker; do **not** overwrite.

   | Template | Destination |
   |---|---|
   | `resources\WeatherForecastEndpoints.cs` | `Endpoints\WeatherForecastEndpoints.cs` |
   | `resources\IWeatherForecastService.cs`  | `Services\IWeatherForecastService.cs` |
   | `resources\WeatherForecastService.cs`   | `Services\WeatherForecastService.cs` |
   | `resources\WeatherForecastResponse.cs`  | `Models\WeatherForecastResponse.cs` |

   Create only the folders actually used by this sample. Do **not** pre-create unrelated empty folders such as `Clients\`, `Clients\Handlers\`, or `Middleware\`.

4. **Reconcile `Program.cs`** with the smallest targeted edits, only when the file is missing, still matches the generated `dotnet new webapi` scaffold shape, or already matches the aligned shape. If the file has diverged beyond safe reconciliation, stop and surface the blocker. Final state must:
   - Add `using {projectName}.Endpoints;` and `using {projectName}.Services;` imports
   - Preserve `AddOpenApi()` and the development-only `MapOpenApi()` behavior
   - Register `IWeatherForecastService` via `builder.Services.AddScoped<IWeatherForecastService, WeatherForecastService>();`
   - Call `app.MapWeatherForecastEndpoints();`
   - Contain exactly one `public partial class Program { }` declaration (so `WebApplicationFactory<Program>` works)
   - **Not** contain the inline `app.MapGet("/weatherforecast", ...)` sample, the inline `record WeatherForecast(...)`, `AddControllers()`, or `MapControllers()`
5. **Stale-artifact cleanup** — if any of these exist from a previous run, delete them:
   - `Controllers\WeatherForecastController.cs`
   - `BusinessLogic\IWeatherForecastBusinessLogic.cs`, `BusinessLogic\WeatherForecastBusinessLogic.cs`
   - The `Controllers\` and `BusinessLogic\` directories themselves once empty
   - Any `AddScoped<IWeatherForecastBusinessLogic, ...>()` registration in `Program.cs`
6. **Generated `.http` file** (`$httpFilePath`):
   - If the project was just created in this run, leave the file `dotnet new webapi` produced.
   - If the service project already existed and `$httpFilePath` is missing, surface this as an explicit blocker — do **not** synthesize one. The Runtime Validation step relies on it.
   - Never overwrite an existing `.http` file.

## Step 5: Optional Shared Project (only when `includeShared` is true)

Skip entirely if `includeShared` is false.

1. If the shared project is missing:
   ```powershell
   dotnet new classlib -n {projectName}.Shared --output $sharedProjectDirectory --framework {dotnetVersion}
   ```
2. If the service `.csproj` does not already reference the shared project:
   ```powershell
   dotnet add $servicePath reference $sharedPath
   ```
3. Verify both `$sharedPath` exists and the service-to-shared `<ProjectReference>` is present before continuing.

## Step 6: Scaffold the Unit Test Project

1. If the unit test project is missing:
   ```powershell
   dotnet new xunit -n {projectName}.UnitTests --output $unitTestsDirectory --framework {dotnetVersion}
   ```
2. **Seed `UnitTest1.cs`** from `resources\UnitTest1.cs` (the canonical aligned seed — `IClassFixture<WebApplicationFactory<Program>>` plus a `GetFromJsonAsync<List<WeatherForecastResponse>>` shape). Replace every `{projectName}` token. Write the file when:
   - it is missing, **or**
   - it still matches the raw `dotnet new xunit` default scaffold shape, **or**
   - it already matches the aligned template shape

   Otherwise leave it unchanged and surface the blocker — do **not** overwrite a customized test file.
3. Add the service reference if missing: `dotnet add $unitTestsPath reference $servicePath`
4. **Reconcile `Microsoft.AspNetCore.Mvc.Testing` to the framework-aligned version** (`$mvcTestingVersion` from Step 2: `10.0.0` for `net10.0`, `9.0.0` for `net9.0`).
   - If missing, add it: `dotnet add $unitTestsPath package Microsoft.AspNetCore.Mvc.Testing --version $mvcTestingVersion`
   - If present at a different version, update it to `$mvcTestingVersion` (re-run the same `dotnet add package` command, which upserts the `<PackageReference Version="...">`).
   - If present at the correct version, leave unchanged.

## Step 7: Scaffold the AppHost

1. If the AppHost project is missing:
   ```powershell
   dotnet new aspire-apphost -n $appHostProjectName --output $appHostDirectory --framework {dotnetVersion}
   ```
   - If the template is unavailable, install `Aspire.ProjectTemplates` and retry once. If NuGet restore fails because nuget.org is not configured, recommend `dotnet nuget add source https://api.nuget.org/v3/index.json -n nuget.org` as a temporary fix and rerun.
2. If the AppHost project **already exists**, treat it as the source of truth. Do **not** recreate, replace, or overwrite — even if it was discovered under a non-default name.
3. Add the service reference if missing: `dotnet add $appHostPath reference $servicePath`
4. In `$appHostSourcePath`, ensure exactly one occurrence of:
   ```csharp
   builder.AddProject<Projects.{projectName}>("{projectNameLowerCase}");
   ```
   If the line is already present (verbatim), leave the file unchanged. Otherwise insert it once at a safe anchor — try these patterns in order, and use the first one that produces an unambiguous, single-shot insertion:
   1. The line immediately before `builder.Build().Run();`
   2. The line immediately before `var app = builder.Build();`
   3. The line immediately before any other `builder.Build()` call (sync or async)
   4. The line immediately before the first `await builder.Build...` invocation

   If none of those anchors match unambiguously (or there are multiple `builder.Build*` sites), stop and surface an explicit blocker — do **not** guess. Do **not** rewrite the rest of `AppHost.cs`. Do **not** use `aspire init` or `aspire add`.

## Step 8: Optional Integration Tests (only when `includeIntegrationTests` is true)

Skip entirely if `includeIntegrationTests` is false.

1. If the integration test project is missing:
   ```powershell
   dotnet new aspire-xunit -n {projectName}.IntegrationTests --output $integrationTestsDirectory --framework {dotnetVersion}
   ```
   (Same template/restore fallbacks as Step 7.)
2. **Seed `IntegrationTest1.cs`** from `resources\IntegrationTest1.cs`. Replace every `{projectName}`, `{projectNameLowerCase}`, and `{appHostProjectTypeName}` token. Write the file when it is missing, still matches the raw `dotnet new aspire-xunit` default shape, or already matches the aligned template shape — otherwise leave unchanged and surface the blocker.
3. Add the AppHost reference if missing: `dotnet add $integrationTestsPath reference $appHostPath`.

## Step 9: Direct Verification

> **Path-separator note:** the `ProjectReference Include=` patterns below must be **separator-agnostic** — `dotnet add reference` writes OS-native separators in the generated XML. Use a regex like `[/\\]` for separator positions.

### Always-verified

```powershell
Test-Path $servicePath
Test-Path $endpointsPath
Test-Path $serviceInterfacePath
Test-Path $serviceImplPath
Test-Path $responsePath
Test-Path $unitTestsPath
Test-Path $unitTestFilePath
Test-Path $appHostPath
Test-Path $appHostSourcePath
Test-Path $httpFilePath
Test-Path $vscodeTasksPath
Test-Path $workspacePath
Test-Path $agentsPath
@(Get-ChildItem -Path $namespaceRoot -Filter *.code-workspace -File).Count -eq 1

-not (Test-Path $controllersDirectory)
-not (Test-Path $businessLogicDirectory)

Select-String -Path $unitTestsPath -Pattern "ProjectReference Include=.*[/\\]{projectName}\.csproj" -Quiet
Select-String -Path $unitTestsPath -Pattern ([regex]::Escape("Microsoft.AspNetCore.Mvc.Testing"))         -Quiet
Select-String -Path $unitTestsPath -Pattern ([regex]::Escape("Version=`"$mvcTestingVersion`""))            -Quiet
Select-String -Path $appHostPath   -Pattern "ProjectReference Include=.*[/\\]{projectName}\.csproj" -Quiet

Select-String -Path $programPath -Pattern "MapWeatherForecastEndpoints\("                             -Quiet
Select-String -Path $programPath -Pattern "AddScoped<IWeatherForecastService,\s*WeatherForecastService>\(" -Quiet
Select-String -Path $programPath -Pattern "public partial class Program"                              -Quiet
-not (Select-String -Path $programPath -Pattern 'MapGet\("/weatherforecast"' -Quiet)
-not (Select-String -Path $programPath -Pattern 'record WeatherForecast'      -Quiet)
-not (Select-String -Path $programPath -Pattern 'AddControllers\('            -Quiet)
-not (Select-String -Path $programPath -Pattern 'MapControllers\('            -Quiet)

Select-String -Path $endpointsPath        -Pattern 'MapGet\("/weatherforecast"'           -Quiet
Select-String -Path $serviceInterfacePath -Pattern "interface IWeatherForecastService"    -Quiet
Select-String -Path $serviceImplPath      -Pattern "class WeatherForecastService"         -Quiet
Select-String -Path $responsePath         -Pattern "record WeatherForecastResponse"       -Quiet
Select-String -Path $unitTestFilePath     -Pattern "GetFromJsonAsync"                     -Quiet
Select-String -Path $unitTestFilePath     -Pattern ([regex]::Escape("{projectName}.Models")) -Quiet
Select-String -Path $appHostSourcePath    -Pattern "AddProject<Projects\.{projectName}>\(\"{projectNameLowerCase}\"\)" -Quiet

Select-String -Path $servicePath -Pattern ([regex]::Escape("<ContainerBaseImage>$containerBaseImage</ContainerBaseImage>")) -Quiet
Select-String -Path $servicePath -Pattern ([regex]::Escape("<ContainerRepository>$containerRepository</ContainerRepository>")) -Quiet

$openBrace  = [char]123
$closeBrace = [char]125
Select-String -Path $vscodeTasksPath -Pattern ([regex]::Escape("$appHostProjectName/$appHostProjectName.csproj"))                          -Quiet
Select-String -Path $vscodeTasksPath -Pattern ([regex]::Escape('"{projectName}.UnitTests: Run"'))                                          -Quiet
Select-String -Path $vscodeTasksPath -Pattern ([regex]::Escape("{projectName}/{projectName}.UnitTests/{projectName}.UnitTests.csproj"))   -Quiet
-not (Select-String -Path $vscodeTasksPath -Pattern ([regex]::Escape([string]$openBrace) + '(projectName|namespaceFolder|appHostProjectName)' + [regex]::Escape([string]$closeBrace)) -Quiet)
```

### Conditional — only when `includeShared` is true

```powershell
Test-Path $sharedPath
Select-String -Path $servicePath -Pattern "ProjectReference Include=.*[/\\]{projectName}\.Shared[/\\]{projectName}\.Shared\.csproj" -Quiet
```

### Conditional — only when `includeIntegrationTests` is **false**

```powershell
# Stale-task absence check: if a previous run added the IntegrationTests entry and the
# user later unchecked the option, Step 3 must have removed it.
-not (Select-String -Path $vscodeTasksPath -Pattern ([regex]::Escape('"{projectName}.IntegrationTests: Run"')) -Quiet)
-not (Select-String -Path $vscodeTasksPath -Pattern ([regex]::Escape("{projectName}/{projectName}.IntegrationTests/{projectName}.IntegrationTests.csproj")) -Quiet)
```

### Conditional — only when `includeIntegrationTests` is true

```powershell
Test-Path $integrationTestsPath
Test-Path $integrationTestFilePath
Select-String -Path $integrationTestsPath  -Pattern ([regex]::Escape("$appHostProjectName.csproj"))                                            -Quiet
Select-String -Path $integrationTestFilePath -Pattern "GetFromJsonAsync"                                                                       -Quiet
Select-String -Path $vscodeTasksPath -Pattern ([regex]::Escape('"{projectName}.IntegrationTests: Run"'))                                       -Quiet
Select-String -Path $vscodeTasksPath -Pattern ([regex]::Escape("{projectName}/{projectName}.IntegrationTests/{projectName}.IntegrationTests.csproj")) -Quiet
```

If any check fails, rerun only the owning step, then rerun the failed check. Do **not** advance to runtime validation until the checks pass or a blocker is explicitly surfaced.

## Step 10: Runtime Validation

All checks below run inline. Stay source-read-only — temporary build outputs are allowed but **must be cleaned up** before reporting.

1. `dotnet test $unitTestsPath`
2. **Only when `includeIntegrationTests` is true:** `dotnet test $integrationTestsPath`
3. Launch the resolved AppHost from `$appHostDirectory` with `aspire run`. Keep it alive only long enough to execute the smoke test, then stop it cleanly.
4. Read `$httpFilePath`, take the request method + path from the first GET defined there, and confirm the request succeeds against the AppHost-hosted service (HTTP 200, `application/json`).
5. Validate SDK container publishing for the service:
   ```powershell
   dotnet publish $servicePath --os linux --arch x64 /t:PublishContainer
   ```
   Prefer the local OCI runtime path. If that fails because no local OCI runtime is available, rerun the publish with `-p:ContainerArchiveOutputPath=` pointing to a tarball path **under the system temp directory** (`$env:TEMP`, `$TMPDIR`, `/tmp/`, etc.) — never inside the source tree. Treat the tarball build as the fallback success path.
6. **Cleanup**: delete any tarball files, temporary directories, or build outputs created solely for this validation. Do not leave validation-only artifacts anywhere.

If validation fails, apply the smallest viable repair, rerun any affected direct checks, and rerun the failed validation step.

## Step 11: Report Success

Report with two markdown tables. Use ✅ for pass, ❌ for fail, ⏭️ for skipped. Resolve every `{token}` and `[bracketed choice]`.

```
**Projects scaffolded successfully!**

| Step | Result |
|---|---|
| **Namespace assets**     | ✅ [pass / fail] |
| **Service + alignment**  | ✅ [pass / fail / pass after repairs] |
| **Shared**               | [✅ pass / fail] or [⏭️ skipped] |
| **Unit tests**           | ✅ [pass / fail] |
| **AppHost**              | ✅ [pass / fail] |
| **Integration tests**    | [✅ pass / fail] or [⏭️ skipped] |
| **Direct verification**  | ✅ [pass / fail / pass after repairs] |
| **Runtime validation**   | ✅ [pass / fail / pass after repairs] |

| Artifact | Path | Status |
|---|---|---|
| Service project              | `src\{namespaceFolder}\{projectName}\{projectName}\{projectName}.csproj` | [created / already existed] |
| Aligned endpoint             | `src\{namespaceFolder}\{projectName}\{projectName}\Endpoints\WeatherForecastEndpoints.cs` | [created / updated / already aligned] |
| Aligned service interface    | `src\{namespaceFolder}\{projectName}\{projectName}\Services\IWeatherForecastService.cs`   | [created / updated / already aligned] |
| Aligned service implementation | `src\{namespaceFolder}\{projectName}\{projectName}\Services\WeatherForecastService.cs`  | [created / updated / already aligned] |
| Aligned model                | `src\{namespaceFolder}\{projectName}\{projectName}\Models\WeatherForecastResponse.cs`     | [created / updated / already aligned] |
| Stale Controllers cleanup    | `src\{namespaceFolder}\{projectName}\{projectName}\Controllers\`     | [removed / not present] |
| Stale BusinessLogic cleanup  | `src\{namespaceFolder}\{projectName}\{projectName}\BusinessLogic\`   | [removed / not present] |
| Shared project *(if selected)* | `src\{namespaceFolder}\{projectName}\{projectName}.Shared\{projectName}.Shared.csproj` | [created / already existed / ⏭️ skipped] |
| Service → Shared ref *(if selected)* | — | [added / already existed / ⏭️ skipped] |
| Unit test project            | `src\{namespaceFolder}\{projectName}\{projectName}.UnitTests\{projectName}.UnitTests.csproj` | [created / already existed] |
| Unit test file               | `src\{namespaceFolder}\{projectName}\{projectName}.UnitTests\UnitTest1.cs` | [created / rewritten / already aligned] |
| UnitTests → Service ref      | — | [added / already existed] |
| Mvc.Testing package          | — | [added (v{mvcTestingVersion}) / already existed] |
| AppHost project              | `[resolved AppHost project path]` | [created / already existed] |
| AppHost → Service ref        | — | [added / already existed] |
| Service in AppHost.cs        | — | [added / already existed] |
| Integration test project *(if selected)* | `src\{namespaceFolder}\{projectName}\{projectName}.IntegrationTests\{projectName}.IntegrationTests.csproj` | [created / already existed / ⏭️ skipped] |
| Integration test file *(if selected)*    | `src\{namespaceFolder}\{projectName}\{projectName}.IntegrationTests\IntegrationTest1.cs` | [created / rewritten / already aligned / ⏭️ skipped] |
| IntTests → AppHost ref *(if selected)*   | — | [added / already existed / ⏭️ skipped] |
| Container base image         | `[configured base image]` | [configured / already existed] |
| Container repository         | `[configured repository]` | [configured / already existed] |
| Container publish            | — | [local OCI runtime / tarball fallback] |
| VS Code tasks                | `src\{namespaceFolder}\.vscode\tasks.json` | [created / updated / already existed] |
| Workspace file               | `[resolved namespace workspace path]` | [created / already existed] |
| Project AGENTS               | `src\{namespaceFolder}\{projectName}\AGENTS.md` | [created / already existed] |
```

## Error Handling

| Symptom | Resolution |
|---|---|
| `dotnet new` failed | Verify the output path is writable, framework is supported, and template is installed. Rerun only the owning step. |
| Multiple `*.code-workspace` files in `$namespaceRoot` | Single-workspace policy is ambiguous. Remove or pick the intended file manually, then rerun. |
| Multiple `*.AppHost` projects in `$namespaceRoot` | AppHost target is ambiguous. Remove or pick the intended project manually, then rerun. |
| Aspire template missing (`aspire-apphost` / `aspire-xunit`) | Install `Aspire.ProjectTemplates`, then rerun the affected step. |
| NuGet restore failure for Aspire packages | Repo NuGet config is missing nuget.org. Temporarily add the source, rerun, then revert. |
| Existing `tasks.json` could not be reconciled safely | Preserve unrelated tasks, apply the smallest task-entry repair (matched by `label`), and rerun Step 3 only. |
| Aligned source file appears user-customized | Stop and surface the blocker; do **not** overwrite. Resolve manually, then rerun the relevant step. |
| `Program.cs` diverged beyond safe reconciliation | Stop and surface the blocker; do **not** overwrite. Resolve manually, then rerun Step 4. |
| Existing service is missing its `.http` file | Stop and surface the blocker — Runtime Validation depends on the request defined there. Resolve manually (e.g. restore the file from history) and rerun. |
| Existing `AppHost.cs` has no unambiguous safe insertion anchor | Stop and surface the blocker; do **not** guess. Add `builder.AddProject<Projects.{projectName}>("{projectNameLowerCase}");` manually at the appropriate location and rerun Step 7 from item 4. |
| `Microsoft.AspNetCore.Mvc.Testing` is at the wrong version | Step 6 reconciles this automatically by re-running `dotnet add package` with `--version $mvcTestingVersion`. If the upsert fails, restore the project file and rerun Step 6. |
| Invalid container repository (PascalCase image name) | Set `<ContainerRepository>` to the lowercase value computed in Step 2 and rerun Step 4. |
| Container publish: no local OCI runtime | Rerun the publish with `-p:ContainerArchiveOutputPath=` pointing under the system temp directory. Record the tarball path as the successful validation mode and clean up after. |
| Direct check fails after a step reported success | Rerun only the owning step, then rerun the failed direct check. |
| Runtime validation fails | Apply the smallest fix, rerun affected direct checks, and rerun the failed validation step. |
