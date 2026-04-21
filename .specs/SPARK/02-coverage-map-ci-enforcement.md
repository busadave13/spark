# 02 — Coverage-Map CI Enforcement

## Context

Every test file and implementation file is required to carry an "AC coverage map" header that lists which `FEAT-NNN` acceptance criteria each test/symbol covers. Today this is **policy-only**: `tdd-developer` writes the headers when it implements a feature, and `tdd-reviewer` checks them on demand. Nothing prevents a later edit (by a human, another agent, or an unrelated refactor) from removing a test, renaming a function, or breaking the AC→symbol mapping. The drift is silent until somebody re-runs `tdd-reviewer` manually.

## Goal

Add an automated check that runs on every commit (and in CI) which:

1. Parses every test file and implementation file in the repo.
2. Extracts the AC coverage-map header (or flags missing headers in files that should have them).
3. Cross-references the maps against the feature spec's AC list and the test-plan's test count.
4. Fails the build (or pre-commit hook) on any mismatch: missing headers, AC drift, test count drift, orphaned tests, ACs without coverage.

## Implementation

1. **New script:** `plugins/spark/scripts/check-coverage-maps.ps1` (PowerShell to match existing hook scripts).
   - Walk `.specs/{project}/feature/FEAT-*.md` to build the source-of-truth AC list per feature.
   - Walk `.specs/{project}/feature/FEAT-*.testplan.md` to get expected test counts per feature.
   - Walk implementation/test files; parse coverage-map header (define a stable comment-block format — see references).
   - Emit a structured report (TAP or JSON) and exit non-zero on any failure.
   - Support `--feature FEAT-NNN` to scope to one feature, and `--fix` to auto-add missing header skeletons (no AC mappings — those still need a human).

2. **Pre-commit hook:** add a hook entry to `plugins/spark/hooks/hooks.json` that runs the script on staged files only (use a `--staged` flag in the script).

3. **CI workflow:** add `.github/workflows/coverage-maps.yml` that runs the script in full-repo mode against every PR. Job fails on non-zero exit.

4. **Modify `plugins/spark/agents/tdd-developer.agent.md`:**
   - In Step 10 traceability, instead of inline traceability prose, invoke this script and surface its output.
   - Treat script failure as a block on `Implemented`.

5. **Document the header format** in `plugins/spark/agents/references/` (new file `coverage-map-header.md`) so the script and the agents share one source of truth on syntax.

## Acceptance criteria

- Removing an AC tag from a test file fails the pre-commit hook.
- Renaming a covered function without updating the impl file's coverage map fails CI.
- Adding a new test without an AC tag fails CI.
- An AC declared in `FEAT-NNN.md` with zero corresponding test entries fails CI.
- The script runs in under 5 seconds on a repo with 50 features.
- `tdd-developer` Step 10 produces identical output whether invoked locally or in CI (single source of truth).

## Out of scope

- Auto-generating test code from AC text (covered by proposal 08).
- Drift detection beyond coverage maps (covered by proposal 09).

## References

- `plugins/spark/agents/tdd-developer.agent.md` (current header format examples)
- `plugins/spark/hooks/hooks.json`, `plugins/spark/hooks/scripts/*.ps1` (hook patterns to follow)
- `plugins/spark/agents/references/feature-template.md` (AC numbering convention)

## Pairs with

- **01** (mandatory tdd-reviewer) — same checks at gate time and at commit time.
- **09** (drift detection) — drift detection extends this from "coverage maps" to "spec-vs-code semantic alignment".
