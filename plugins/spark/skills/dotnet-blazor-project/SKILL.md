---
name: dotnet-blazor-project
description: "Scaffolds a new .NET Blazor project with Copilot instructions. Use this skill whenever a user wants to create a new .NET Blazor app, set up Blazor project structure, or generate Copilot/agent guidelines for a Blazor project. Requires two inputs: the Blazor project name and the root namespace."
---

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

5. Report the result to the user: confirm the file was created or updated, show the final output file path, and list what substitutions were made. Example: if user provides `projectName = weather-api`, the file `.github/instructions/weather-api.instructions.md` is created with `{projectName}` replaced by `WeatherApi`.
