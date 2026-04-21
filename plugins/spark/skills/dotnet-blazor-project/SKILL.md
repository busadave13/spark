---
name: dotnet-blazor-project
description: "Bootstrap or reconcile the repo-specific .github/instructions/{project}.instructions.md file for a .NET Blazor project. Use when Spark/TDD needs project instructions. This skill does not scaffold AppHost, companion projects, or a runnable Blazor web app."
---

## Scope

This skill manages the repo-specific instruction file only. It is not a full project
scaffolder and must not be reported as proof that the project is implementation-ready.

After this skill runs, another workflow step must still read the instruction file and
validate that the required on-disk structure exists, including any AppHost, companion
projects, and runnable Blazor web app the instructions require.

## Required Inputs

Collect these two values before proceeding. If the user didn't provide them in their message, ask now:

- **projectName** — The Blazor project name (e.g., `AdminPortal`, `CustomerApp`). Used for project folders. The instructions file name will use the lowercase version (e.g., `adminportal.instructions.md`).
- **projectNamespaceName** — The root namespace (e.g., `MyCompany.Apps`, `Acme.Platform`). Groups the Blazor project with related projects under a shared AppHost.

Do not proceed until both values are confirmed.

## Steps

1. Read the template file at `references/projectName.instructions.md` from this skill's directory.

2. Create the `.github/instructions/` directory in the repository root if it doesn't exist.

3. Check if `.github/instructions/{projectName-lowercase}.instructions.md` already exists:
   - **If the file does NOT exist**: Create it with the template content and apply token substitution (see step 4).
   - **If the file DOES exist**: Do NOT overwrite it. Instead, inform the user that the file exists and present the differences between the template and the existing file. Ask the user for approval before making any changes. If approved, merge the differences while preserving the intent and naming conventions of the original file.

4. Apply token substitution when writing:
   - For the filename: use projectName in lowercase
   - For token replacement inside the file: convert both values to PascalCase
     - Replace every `{projectName}` with the PascalCase version of projectName
     - Replace every `{projectNamespace}` with the PascalCase version of projectNamespaceName

5. Report the result to the user as instruction-file bootstrap/reconciliation, not full
    project initialization:
    - confirm the file was created or updated
    - show the final output file path
    - list what substitutions were made
    - state that required scaffolding must still be present and validated separately before
       implementation proceeds

    Example: if user provides `projectName = weather-app`, the file
    `.github/instructions/weather-app.instructions.md` is created with `{projectName}`
    replaced by `WeatherApp`. Report that the instruction file was bootstrapped, not that the
    project is fully initialized.
