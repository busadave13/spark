# 06 — ADR-Candidates Queue

## Context

`tdd-developer`'s refactor phase (Step 9) is the most fertile place for architectural insights: when a refactor turns the suite red, it has uncovered an ordering constraint, a hidden invariant, or a coupling that deserves a recorded decision. The current rule is "revert the refactor and record as ADR candidate" — but the candidate is recorded only in the **chat summary** at the end of the feature. Once the conversation ends, the insight is lost. By the time someone thinks to write an ADR, the context is gone.

## Goal

Make ADR candidates **durable artifacts** stored alongside the spec, queued for triage, and easy for `adr-editor` to pick up. Treat them like a bug-tracker for architectural decisions: write once, triage later, never lose.

## Implementation

1. **New folder convention:** `.specs/{project}/adr-candidates/` containing one markdown file per candidate. Filename pattern: `CANDIDATE-{YYYY-MM-DD}-{slug}.md`.

2. **Candidate file format** (define a template in `plugins/spark/agents/references/adr-candidate-template.md`):
   ```markdown
   ---
   discovered_during: FEAT-007
   discovered_at: 2026-04-20
   discovered_by: tdd-developer (refactor revert)
   status: Open  # Open | Promoted | Dismissed
   ---

   # Candidate: <one-line summary>

   ## What I tried
   <The refactor that was reverted, or the cleanup that triggered the insight.>

   ## Why it failed / why it's interesting
   <The ordering constraint, invariant, or coupling that surfaced.>

   ## Suggested ADR direction
   <Loose hint for whoever writes the ADR. Not binding.>

   ## Related code
   <File paths and line ranges.>
   ```

3. **Modify `plugins/spark/agents/tdd-developer.agent.md`:**
   - Step 9 (Refactor): when a refactor is reverted, write a candidate file *before* moving on. Don't rely on summary text.
   - Step 10 summary: list the candidates created during this feature with their filenames.

4. **Modify `plugins/spark/agents/adr-editor.agent.md`:**
   - Add an invocation mode `from-candidate <candidate-file>` that reads the candidate, drafts the ADR using its content as input, and on successful ADR creation marks the candidate `Promoted` (don't delete — keep the audit trail).
   - Add `dismiss <candidate-file> --reason <text>` to mark `Dismissed` with rationale.

5. **Optional but recommended:** add a `triage-adr-candidates` mode to the orchestrator (`spark.agent.md`) that lists all `Open` candidates across the repo and offers to walk through them one by one.

6. **Update `STATE.md`** to show the candidate queue as a side artifact created during refactor.

## Acceptance criteria

- A reverted refactor in `tdd-developer` results in a file in `.specs/{project}/adr-candidates/`, not just chat text.
- `adr-editor from-candidate` produces a draft ADR pre-filled with the candidate's context.
- `Promoted` and `Dismissed` candidates remain in the folder (history preserved); only `Open` ones show in triage.
- Coverage check from proposal 02 (if implemented) does not flag candidate files (they're spec-adjacent, not code).

## Out of scope

- Auto-promotion of candidates to ADRs (always requires user trigger).
- Cross-project candidate aggregation.

## References

- `plugins/spark/agents/tdd-developer.agent.md` (Step 9 refactor)
- `plugins/spark/agents/adr-editor.agent.md`
- `plugins/spark/agents/references/adr-template.md` (existing format to align with)

## Pairs with

- **05** (amendment workflow) — superseded ADRs and dismissed candidates share lifecycle thinking.
