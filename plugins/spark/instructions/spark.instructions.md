---
applyTo: "**/.specs/**"
---
> Version: 1.0.0

# Spark Agents — Required for `.specs/` Projects

## Critical Rules

- **ALWAYS** use the appropriate spark agent when working with files in a `.specs/` folder. Never edit these files directly — route to the correct agent below.
  - Warn the developer and get approval before proceeding without a spark agent.
- A project-specific instruction file under `.github/instructions/` is not proof that the
  project is scaffolded or implementation-ready.
- User requests such as "create a new project", "start a new service", or "set up a new
  app" are spec-workflow requests first.
  - Route them to spark's PRD/architecture pre-flight.
  - Do not satisfy them by invoking instruction-bootstrap skills or by creating
    `.github/instructions/{project}.instructions.md` directly.
- Before implementation begins, the responsible spark agent must read the repo-specific
  instructions and validate every required path, companion project, and required host on
  disk.
- If required scaffolding is missing or only partially present, classify it before deciding
  whether to stop.
  - If it is only a repo prerequisite and is not part of the approved target state,
    stop and surface an explicit initialization/reconciliation step.
  - If approved architecture, ADRs, or feature specs require it as part of the feature's
    target system or test topology, treat it as implementation scope and create it.
- When repo instructions or approved docs require a namespace-root AppHost, the agent must
  also verify that the AppHost is named `{Namespace}.AppHost`, lives directly under the
  namespace folder root, and registers every runnable main project in that namespace for
  local Aspire `dotnet run`.
- Do not silently work around the mismatch by implementing in an alternative or library-only
  layout.
- Do not mark a feature implemented while required approved scaffolding such as AppHost,
  `Test.AppHost`, or required Aspire resources is still missing.
- `tdd-developer` must invoke `tdd-reviewer` as a mandatory gate before marking a feature
  `Implemented`. `BLOCK`-severity findings halt the transition unless the user records an
  override with written justification in the feature spec's `Implementation Overrides`
  section.

### Agent Routing

| Task | Agent |
|---|---|
| Create or update `PRD.md` | **prd-editor** |
| Review / validate `PRD.md` | **prd-reviewer** |
| Create or update `ARCHITECTURE.md` (and supporting ADRs) | **architecture-editor** |
| Review / validate `ARCHITECTURE.md` | **architecture-reviewer** |
| Add a single ADR or small set of ADRs | **adr-editor** |
| Review / validate ADR files | **adr-reviewer** |
| Create or update feature specs (`FEAT-NNN-*.md`) | **feature-editor** |
| Review / validate feature specs | **feature-reviewer** |
| Resolve inline review comments (`.comments.json` sidecars on any spark document, including `.testplan.md`) | **comments-editor** |
| Implement a feature using TDD (red-green-refactor) | **tdd-developer** |
| Review test suite quality for feature specs | **tdd-reviewer** |
| Transition Status on an artifact (Draft ↔ Approved, Approved → Implemented) | **spark-status** (skill) |
| Orchestrate multi-step spec-driven development workflows | **spark** |

### When Multiple Agents Could Apply
- For **code generation / implementation**, use **spark** (it orchestrates sub-agents including tdd-developer).
- For **standalone ADR additions** to a project that already has `ARCHITECTURE.md`, prefer **adr-editor** over architecture-editor.
- For **full architecture rewrites** (new project or major overhaul), use **architecture-editor**.
- For **test plan review or viewing**, use **tdd-reviewer** (read-only validation of test suite quality).
- Distinguish between "implement" (use **tdd-developer** via **spark**) and "build"/"code up" (ad-hoc code generation, which falls outside the spec-driven workflow).

---

## Key Workflows

### New Project Initialization
When the user says **"create a new project"**, **"create a PRD"**, or **"create an architecture"** without enough context to identify the project, `.specs/` location, or namespace, **spark** runs a pre-flight interview before delegating:

1. Resolves `{projectName}` (asks if unknown).
2. Locates `.specs/{projectName}/` — walks the working directory, common subdirs (`src/`, `services/`, `apps/`, `packages/`, `projects/`), and the repo root. Asks the user to disambiguate if multiple matches exist. Records as `{docs-root}`, or notes that the project is brand new.
3. Recovers `{resolvedNamespace}` by reading the metadata block of `{docs-root}/ARCHITECTURE.md` when present (PRD.md has no Namespace field — only architecture does).
4. Asks which documents to produce when ambiguous (PRD, Architecture, Both, or Abort).
5. Asks per document for an **input source**: scan an existing codebase (path), use supporting documentation URLs, create from scratch, or abort. Multiple sources can be combined.
6. Asks for Namespace only if architecture will run and it's still unset.
7. Delegates to `prd-editor` and/or `architecture-editor` with a pre-resolved context block that includes `{projectName}`, `{docs-root}`, `{resolvedNamespace}` (arch only), and the list of input sources. The editors fetch URLs and read code themselves.

**PRD is not a prerequisite for architecture.** `architecture-editor` can produce `ARCHITECTURE.md` for a project that has no `PRD.md` — the codebase review and user interview cover the gap.

Creating or updating `.github/instructions/{project}.instructions.md` bootstraps repo
guidance only. It does not, by itself, create or verify an AppHost, runnable web host, or
other required companion projects.

When approved docs require that missing structure as part of the implementation target,
Spark must create it during TDD rather than treating it as an ignorable omission.

The `dotnet-webapi-project` and `dotnet-blazor-project` skills are for instruction-file
bootstrap or reconciliation only. They are valid only when the user explicitly asks to
create or update the repo instruction file, or when a later Spark implementation step has
already identified missing repo instructions as a dependency.

### Reviewer-to-Editor Delegation
When a reviewer agent (prd-reviewer, architecture-reviewer, adr-reviewer, feature-reviewer, tdd-reviewer) flags issues, the findings are returned to **spark**, which routes fixes back to the corresponding editor:
- `prd-reviewer` issues → `prd-editor`
- `architecture-reviewer` issues → `architecture-editor`
- `adr-reviewer` issues → `adr-editor`
- `feature-reviewer` issues → `feature-editor`
- `tdd-reviewer` issues → `tdd-developer` (with one exception: see below)

**`tdd-reviewer` has two invocation paths:**
- **Inline (mandatory gate):** `tdd-developer` invokes `tdd-reviewer` at Step 10d before marking a feature `Implemented`. `BLOCK` findings are resolved in the same run — either fixed by looping back through the relevant TDD steps, or overridden by appending a justification to the feature spec's `Implementation Overrides` section. No separate handoff to **spark**.
- **Standalone (ad-hoc audit):** When a user invokes `tdd-reviewer` directly against an already-Implemented feature, findings flow back through **spark** to `tdd-developer` as with the other reviewers.

**Special case — T16/T17 flags from `tdd-reviewer`:** If `tdd-reviewer` flags T16 (missing test plan file) or T17 (coverage map mismatch), delegating back to `tdd-developer` will re-run the full TDD cycle from Step 4 (test plan approval gate), not just update the test plan. This applies to both invocation paths.

### TDD-to-ADR Handoff
After `tdd-developer` completes implementation, it surfaces ADR candidates (decisions made or crystallized during TDD). **spark** presents these candidates to the user with a prompt: "These decisions were surfaced during TDD. Create ADRs for them?" If the user accepts, **spark** invokes `adr-editor` for each candidate in sequence, then offers to add them to `ARCHITECTURE.md`.

### Parallel ADR Review
When reviewing multiple ADRs, **spark** invokes one `adr-reviewer` subagent **per ADR file in parallel** to validate them simultaneously, then collects and returns all findings to the user.

### Batch Feature Implementation
To implement all approved features:
1. **spark** scans `{docs-root}/feature/` for all `FEAT-*.md` files with `Status: Approved`
2. Creates a todo list (one entry per feature)
3. Invokes `tdd-developer` for each feature **sequentially** (never in parallel — each run modifies the codebase, and the test suite must stay green between features)

### `prd-editor` Review Mode
Although `prd-reviewer` is the read-only review agent, `prd-editor` also has an internal review path: if the user asks to "review the PRD," `prd-editor` skips the interview and generation steps and runs its review checklist directly. Both paths are valid; the choice depends on whether the user wants to make edits in the same session.

### `feature-editor` Review Mode
Although `feature-reviewer` is the read-only review agent, `feature-editor` also has an internal review path: if the user asks to "review the feature specs" and wants to make edits in the same session, `feature-editor` runs its review checklist (Step 5) directly, skipping the interview and generation steps. Choose `feature-reviewer` for standalone read-only review and `feature-editor` when edits are expected in the same session.

### Status Transitions
Status field changes (`Draft` → `Approved`, `Approved` → `Draft`, `Approved` → `Implemented`) are the primary path through the **spark-status** skill rather than hand-editing the metadata block. The skill validates the upstream prerequisite chain, bumps the version per the version-bump rule, updates `**Last Updated**` (or the testplan's `**Approved**` / `**Completed**` dates), and prints a one-line summary.

- `approve` — Draft → Approved. Rejects if any upstream artifact is still Draft (e.g. a feature cannot be approved while `ARCHITECTURE.md` is Draft; a testplan cannot be approved while its sibling feature spec is Draft).
- `revert` — Approved → Draft. Warns about downstream artifacts but does not cascade the revert.
- `implement` — Approved → Implemented. Features and test plans only. `tdd-developer` remains the normal path that marks a feature `Implemented`; use `/spark-status implement` for manual cleanup or repair.
- `status` — read-only; prints current status, version, and the prerequisite chain.

Manual editing of the metadata block remains a valid fallback, but the skill is the primary path — it is the only way to guarantee the version bump and prerequisite chain are applied consistently.
