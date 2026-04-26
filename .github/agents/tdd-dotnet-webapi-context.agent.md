---
name: tdd-dotnet-webapi-context
description: "Read-only phase agent for dotnet-webapi TDD. Builds a compact execution brief from the approved feature, architecture, relevant ADRs, repo instructions, and project inventory."
tools: [execute, read, search, todo]
user-invocable: false
disable-model-invocation: false
---

# Dotnet WebAPI TDD - Context phase

Build the compact execution brief used by later TDD phases.

## Inputs

All inputs are pre-resolved by the coordinator. `{projectName-lowercase}` = lowercased `{projectName}`.

| Variable | Description |
|---|---|
| `{repo-root}` | Repository root |
| `{project-root}` | Project root for solution/project inventory discovery |
| `{docs-root}` | Docs folder for this project |
| `{projectName}` | Project name |
| `{feature-path}` | Path to the target feature spec |
| `{testplan-path}` | Path to the testplan file |
| `{adr-root}` | ADR folder for this project |
| `{testplan-root}` | Testplan folder for this project |
| `{instructions-root}` | Instructions folder (no hardcoded default) |
| `{scaffold-skill}` | Scaffold skill to invoke if instructions are missing |
| `{brief-reference}` | Path to the brief template reference file |

## Rules

- Include `brief_schema_version: 3` in the emitted brief.
- Read `{brief-reference}` before emitting the brief.
- Load only files needed to normalize context for later phases.
- Summarize — never paste raw content into the brief.
- If repo instructions are missing, bootstrap them in Step 3 inline. Do not return to the coordinator for a re-run.
- Populate `doc_snapshots` with feature, testplan, ARCHITECTURE, and ADR summaries. Later phases trust these.
- Classify missing structure exactly once as `prerequisites_missing` or `deliverable_scaffold`.

This phase owns codebase exploration, instruction loading, and `doc_snapshots` population. Do not repeat these in later phases.

## Step 1: Validate target

1. Read `{feature-path}` metadata — confirm `**Status**` is `Approved`.
   If not, halt: `"⛔ [FEAT-NNN] has Status: {status}. Set to Approved, then re-run."`
2. Read `{docs-root}/ARCHITECTURE.md` metadata — confirm `**Project Type**` is `dotnet-webapi`.
   If not, halt: `"⛔ ARCHITECTURE.md missing valid Project Type. Run architecture-editor to fix."`

## Step 2: Load discovery context

Read in one parallel call:

- `{feature-path}` — full content
- `{docs-root}/ARCHITECTURE.md` — layers, boundaries, runtime/test topology, conventions
- Relevant ADRs from `{adr-root}` — title, Decision, Consequences only; skip unrelated ADRs
- `{instructions-root}/{projectName-lowercase}.instructions.md` if it exists
- Project inventory around `{project-root}`: `*.sln`, `*.csproj`, `Program.cs`, test projects, fixtures, runner configs

Carry forward concise summaries of: architecture constraints, ADR decisions, repo/test conventions, candidate files.

## Step 3: Structural readiness

1. Resolve `{project-instructions}` = `{instructions-root}/{projectName-lowercase}.instructions.md`.
2. If absent, bootstrap inline:
   - If the scaffold skill needs unknown inputs → set `requires_instruction_bootstrap: true` with missing inputs in `structural_check.bootstrap_needs`.
   - Otherwise → invoke `{scaffold-skill}` via `runSubagent`, wait, re-read, continue. Set `requires_instruction_bootstrap: false`.
3. Build two checklists from `{project-instructions}`:
   - Repo-required scaffolding
   - Approved target-state scaffolding (from feature, architecture, ADR summaries)
4. Validate both against the filesystem in **one traversal**, tagging each missing item as `prerequisites_missing` or `deliverable_scaffold`.

## Step 4: Emit the execution brief

Return a fenced YAML block following the template at `{brief-reference}`.

Required fields: `project`, `feature`, `testplan`, `paths`, `doc_snapshots`, `acceptance_criteria`, `architecture_constraints`, `adr_decisions`, `repo_conventions`, `structural_check`, `coverage_targets.ac_ids`, `suite_cache` (leave `last_run_at`, `code_sha`, `result` null).

Output contract:

```yaml
phase: context
result: ready|halt
halt_reason:
execution_brief:
  ...
```

`halt` = invalid feature status or missing/invalid Project Type. `ready` = all other cases (including pending bootstrap with missing inputs).
