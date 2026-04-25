---
name: dotnet-webapi-project
description: Copies and token-replaces the project instructions file for a .NET Web API microservice.
---

# .NET Web API Project Instructions

Copies `resources/projectName.instructions.md` into the target instructions directory after replacing `{namespaceName}` and `{projectName}` tokens. Idempotent — skips the write if the destination already exists.

## Required Inputs

| Input | Description | Example |
|---|---|---|
| `namespaceName` | Parent namespace folder (PascalCase) | `Test`, `XPackage` |
| `projectName`   | Service project name (PascalCase) | `Mockery`, `WeatherCore` |

Derived: `projectNameLower = projectName.ToLowerInvariant()`.

## Step 1: Resolve Paths

Read `spark.config.yaml` to obtain `roots.source` and `roots.instructions`. Compute:

```
$repoRoot         = (repo root)
$sourceRoot       = roots.source          # e.g. "src"
$instructionsDir  = roots.instructions    # absolute; fall back to "$repoRoot\.github\instructions"
$instructionsPath = "$instructionsDir\{projectNameLower}.instructions.md"
$templatePath     = (this skill's resources)\projectName.instructions.md
```

Ensure `$instructionsDir` exists.

## Step 2: Copy + Token-Replace

If `$instructionsPath` already exists, skip and report "already existed".

Otherwise read `$templatePath`, replace `{sourceRoot}`, `{namespaceName}`, and `{projectName}` with their concrete values, and write the result to `$instructionsPath`.

## Step 3: Verify

Confirm `Test-Path $instructionsPath` is true and the file contains no unreplaced `{sourceRoot}`, `{namespaceName}`, or `{projectName}` tokens. If either check fails, delete the file and rerun Step 2.

## Step 4: Report

```
| Artifact | Path | Status |
|---|---|---|
| Instructions | {instructionsPath} | [created / already existed] |
```
