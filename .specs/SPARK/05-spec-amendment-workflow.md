# 05 — Spec-Amendment Workflow

## Context

The current workflow has a clear forward path: `Draft → Approved → Implemented`. It does **not** define what happens when an `Implemented` artifact must change. Every team hits this — a PRD requirement shifts, an ADR is superseded, a feature gets a new AC. Today the implicit answer is "set it back to Draft and run the workflow again," but the rules around:

- Which downstream artifacts are invalidated by an upstream change.
- Whether tests for unchanged ACs need to re-run.
- How to record *why* the amendment happened (vs. the original rationale).
- Whether a superseded ADR stays or gets deleted.

…are all unspecified. This causes real problems: silent inconsistency between PRD and code, lost rationale, ADRs that conflict without acknowledging each other.

## Goal

Define a first-class amendment workflow that:

1. Captures the amendment reason explicitly (audit trail).
2. Computes the blast radius (which downstream artifacts are now stale).
3. Produces a clear list of follow-up work the user must approve and re-run.
4. Preserves history (superseded ADRs, prior AC versions) instead of overwriting.

## Implementation

1. **Add a "Status: Amending" intermediate state.** When an `Implemented` (or `Approved`) artifact needs to change, the user (or proposal 03's command) moves it to `Amending` instead of straight back to `Draft`. This signals "in flight" without losing the prior approval.

2. **Add an `Amendment Log` section** to each artifact template (`prd-template.md`, `architecture-template.md`, `adr-template.md`, `feature-template.md`):
   ```
   ## Amendment Log
   - YYYY-MM-DD v1.2 → v2.0 — Reason: <why>. Affects: <downstream FEAT-NNN list>.
   ```
   Required when transitioning out of `Amending`.

3. **Define blast-radius rules** in `plugins/spark/instructions/spark.instructions.md`:
   - PRD amended → all features touching the changed sections must be re-reviewed.
   - ARCHITECTURE amended → all features must be re-reviewed for compatibility; impacted ADRs flagged.
   - ADR amended → either supersede (new ADR with `Supersedes: ADR-NNNN` field) or update in place if the change is clarifying. Define when each is appropriate.
   - Feature spec amended → testplan must be re-reviewed; existing tests for unchanged ACs may stay green; tests for changed ACs go back to Red.

4. **Add an `amend` command** (extends proposal 03 if implemented; otherwise a standalone agent):
   - Marks the artifact as `Amending`.
   - Computes blast radius by reading downstream artifacts and grepping coverage maps.
   - Prints the list of artifacts that need re-review/re-run.
   - Refuses to mark the source artifact `Approved` again until all downstream items are at least back to `Draft`.

5. **Supersedence convention for ADRs:**
   - New ADR file with `Supersedes: ADR-NNNN` in frontmatter.
   - Old ADR keeps its content (don't delete history); add `Status: Superseded by ADR-MMMM` and `Last Updated`.
   - `ARCHITECTURE.md` Decision Log shows both with a strikethrough on the superseded one.

6. **Update `STATE.md`** to add the amendment cycle as a side-loop from `FeatureImplemented` (and corresponding states for upstream artifacts).

## Acceptance criteria

- Amending a PRD section reports exactly which features are impacted (based on AC coverage maps and prose references).
- An ADR can be superseded without losing the original; both are queryable.
- The amendment log entry is mandatory before re-approval.
- A feature whose AC-03 changes can re-run TDD scoped to AC-03 only, leaving AC-01/AC-02 tests untouched.
- Attempting to mark a PRD `Approved` while a downstream feature is still `Amending` is rejected.

## Out of scope

- Auto-detection of *what* changed in an artifact (the user describes the amendment reason; tooling doesn't diff prose).
- Migrating historical un-logged amendments retroactively.

## References

- `plugins/spark/instructions/spark.instructions.md` (status semantics)
- `plugins/spark/agents/references/prd-template.md`
- `plugins/spark/agents/references/architecture-template.md`
- `plugins/spark/agents/references/adr-template.md`
- `plugins/spark/agents/references/feature-template.md`

## Pairs with

- **03** (status commands) — `amend` becomes another command in the same surface.
- **06** (ADR queue) — superseded ADRs and ADR candidates share lifecycle concerns.
