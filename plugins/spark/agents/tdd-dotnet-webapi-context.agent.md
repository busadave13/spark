---
name: tdd-dotnet-webapi-context
description: "Read-only phase agent for dotnet-webapi TDD. Builds a compact execution brief from the approved feature, architecture, relevant ADRs, repo instructions, and project inventory."
tools: [execute, read, search, todo]
user-invocable: false
disable-model-invocation: false
---

# Dotnet WebAPI TDD - Context phase

Build the compact execution brief used by later TDD phases.

Inputs are pre-resolved by the coordinator and should include:

- `{repo-root}`
- `{project-root}`
- `{docs-root}`
- `{projectName}`
- `{feature-path}`
- `{testplan-path}`
- `{instructions-root}` — folder holding per-project instruction files, resolved from
  Spark's `config.yaml` `roots:` block (default `../instructions` relative to the
  agents folder). Do not assume `.github/instructions`.
- `{scaffold-skill}` — the skill to invoke for synchronous instruction bootstrap,
  resolved by the coordinator from `tdd.agents[].scaffold` (e.g. `dotnet-webapi-project`).

When this file refers to `{projectName-lowercase}`, derive it by lowercasing
`{projectName}`.

**Repo-wide discovery lives here.** The coordinator does path/feature resolution only
(Step 1 of the coordinator). This phase owns codebase exploration, instruction loading,
and `doc_snapshots` population. Do not repeat these in later phases.

## Rules

- Read `references/tdd-execution-brief-template.md` before emitting the brief.
- Load only the files needed to normalize context for later phases.
- Summarize; do not paste raw feature, architecture, ADR, code, or test content into
  the brief.
- If repo instructions are missing, **bootstrap them synchronously in Step 3** (see
  below) and proceed. Do not return control to the coordinator just to trigger a
  bootstrap and a re-run — that double-pass is a significant perf tax we want to avoid.
- Populate `doc_snapshots` in the brief with feature, testplan, ARCHITECTURE, and ADR
  summaries the downstream phases will need. Later phases trust these snapshots.
- Classify missing structure exactly once here as either
  `prerequisites_missing` or `deliverable_scaffold`.

## Step 1: Validate the resolved target

1. Re-read `{feature-path}` metadata and confirm `**Status**` is `Approved`.
   If not, halt with:
   > "⛔ [FEAT-NNN] has Status: {status}. Set Status to `Approved` in
   > `{feature-path}`, then run the resolved TDD agent again."
2. Read `{docs-root}/ARCHITECTURE.md` metadata and confirm `**Project Type**` is
   exactly `dotnet-webapi`.
   If missing or invalid, halt with:
   > "⛔ ARCHITECTURE.md is missing a valid `Project Type`. Run architecture-editor
   > to set `**Project Type**` to `dotnet-webapi`, then run the resolved TDD agent
   > again."

## Step 2: Load focused discovery context

Read in one parallel call:

- `{feature-path}` - full content
- `{docs-root}/ARCHITECTURE.md` - metadata plus only sections needed to capture
  layers, boundaries, runtime/test topology, and component conventions
- Relevant ADRs from `{docs-root}/adr/` - title, Decision, and Consequences only;
  skip ADRs that are clearly unrelated to the feature domain
- `{instructions-root}/{projectName-lowercase}.instructions.md` if it exists
- Project inventory around `{project-root}`:
  - solution and project files (`*.sln`, `*.csproj`)
  - runtime entry points (`Program.cs`, startup hosts)
  - test projects, shared test helpers, fixtures, and app hosts
  - runner/config files that help infer the test command

Carry forward concise summaries rather than raw text:

- architecture constraints
- relevant ADR decisions
- repo and test conventions
- candidate runtime, test, and implementation files

## Step 3: Structural readiness classification

1. Resolve `{project-instructions}` =
   `{instructions-root}/{projectName-lowercase}.instructions.md`.
2. If `{project-instructions}` is absent, **bootstrap synchronously in this phase**
   to avoid the coordinator round-trip:
   - If the scaffold skill needs user input we do not yet have (e.g. a namespace),
     return `requires_instruction_bootstrap: true` with the missing inputs enumerated
     under `structural_check.bootstrap_needs`. Coordinator will collect and re-invoke.
   - Otherwise, invoke `{scaffold-skill}` via `runSubagent`, passing
     `{instructions-root}` and any other pre-resolved inputs. Wait for completion,
     then re-read `{project-instructions}` and continue.
   - Set `requires_instruction_bootstrap: false` once the file exists.
3. Build two checklists from the now-present `{project-instructions}`:
   - repo-required scaffolding from the instruction file
   - approved target-state scaffolding from the feature, architecture summaries, and
     relevant ADR summaries
4. Validate both checklists against the filesystem **in a single traversal** — one
   directory walk that tags each missing item as either `prerequisites_missing` or
   `deliverable_scaffold`. Do not walk twice.
5. Classify missing items:
   - `prerequisites_missing` - required only by repo instructions and not part of
     the approved target state
   - `deliverable_scaffold` - explicitly required by approved docs as part of the
     feature's runtime or test topology

## Step 4: Emit the execution brief

Return a fenced YAML block that follows
`references/tdd-execution-brief-template.md`.

Populate at least these fields:

- `project`
- `feature`
- `testplan`
- `paths`
- `doc_snapshots` — concise summaries of feature, testplan, ARCHITECTURE, and relevant
  ADRs so downstream phases do not re-read source files
- `acceptance_criteria`
- `architecture_constraints`
- `adr_decisions`
- `repo_conventions`
- `structural_check`
- `coverage_targets.ac_ids`
- `suite_cache` — leave `last_run_at`, `code_sha`, and `result` null; the implementer
  populates them after the first real run

Output contract:

```yaml
phase: context
result: ready|halt
halt_reason:
execution_brief:
  ...
```

Use `result: halt` only for invalid feature status or invalid/missing `Project Type`.
Use `result: ready` when instruction bootstrap is needed but could not be completed
here (missing inputs). Normally the bootstrap is completed inline in Step 3 and
`structural_check.requires_instruction_bootstrap` is `false` on return.
