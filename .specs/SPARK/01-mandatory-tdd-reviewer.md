# 01 — Mandatory `tdd-reviewer` Gate Before `Implemented`

## Context

`tdd-reviewer` runs deterministic quality checks (T01–T18, C01–C04, C06) on a feature's test suite, but today it is **opt-in**: the user must explicitly ask for it. `tdd-developer` will mark `FEAT-NNN.md` and `FEAT-NNN.testplan.md` as `Implemented` based purely on its own traceability check (Step 10), with no second-pair-of-eyes audit on test quality. This makes it possible to ship features whose tests pass but are weak (e.g. asserting on stub internals, missing AC tags, single-test ACs that don't cover edge cases).

## Goal

Make `tdd-reviewer` a **mandatory** transition between `TestsRefactored` and `FeatureImplemented`. `tdd-developer` should never set `Status: Implemented` without first invoking `tdd-reviewer` and either passing all checks or surfacing every failure to the user for explicit override.

## Implementation

1. **Modify `plugins/spark/agents/tdd-developer.agent.md`:**
   - In Step 10 (Traceability), after the existing checks pass, add a sub-step that delegates to `tdd-reviewer` with the same `.specs/` path and feature number.
   - Block setting `Status: Implemented` until `tdd-reviewer` returns no `BLOCK`-severity findings.
   - On `BLOCK` findings: surface them to the user verbatim, ask whether to (a) fix and re-run, or (b) override with documented justification appended to the feature spec's notes section.

2. **Modify `plugins/spark/agents/tdd-reviewer.agent.md`:**
   - Add a "severity" column to the findings table (`BLOCK` / `WARN` / `INFO`).
   - Classify existing checks: T01–T05, T17 → `BLOCK`; T06–T15 → `WARN`; T16, T18, C01–C06 → context-dependent (define per check).
   - Add a structured machine-readable summary block at the end of output (e.g. fenced JSON) so `tdd-developer` can parse pass/fail without re-reading prose.

3. **Modify `plugins/spark/instructions/spark.instructions.md`:**
   - Update the "Status field rules" section to require `tdd-reviewer` pass before `Implemented`.
   - Update the workflow diagram references to show `tdd-reviewer` as a gate, not an aside.

4. **Update `STATE.md` at repo root:**
   - Insert a `TestQualityReview` state between `TestsRefactored` and `FeatureImplemented` in both diagrams.

## Acceptance criteria

- A feature attempting to mark `Implemented` with a known T01 violation (e.g. test asserting on a private field) is blocked.
- The user receives the full `tdd-reviewer` findings table inline, not a summary.
- The user can explicitly override `WARN` and (with justification) `BLOCK` findings; the override is recorded in the feature spec.
- `STATE.md` diagrams render and reflect the new gate.

## Out of scope

- Adding new checks to `tdd-reviewer` (the existing T01–T18 set is the baseline).
- CI integration of the reviewer (covered by proposal 02).

## References

- `plugins/spark/agents/tdd-developer.agent.md` (Step 10 traceability)
- `plugins/spark/agents/tdd-reviewer.agent.md` (existing check IDs)
- `plugins/spark/instructions/spark.instructions.md` (status semantics)
- `STATE.md` (diagrams to update)

## Pairs with

- **02** (coverage-map CI) — proposal 02 enforces the same checks at commit/PR time so they catch drift after `Implemented`.
