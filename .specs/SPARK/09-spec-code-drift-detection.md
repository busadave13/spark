# 09 — Spec-Code Drift Detection

## Context

Once a feature reaches `Implemented`, nothing in the workflow continues to verify that the code still matches the spec. A future refactor in feature B can quietly break feature A's coverage map, silently delete a test, or change behaviour in ways the spec doesn't reflect. The traceability check happens **once**, at the moment of marking `Implemented`. After that, the spec and code can drift indefinitely without any signal.

Proposal 02 (CI coverage maps) catches the *structural* form of this drift — missing headers, removed AC tags. This proposal catches the *semantic* form: the code still has all its tags, but the actual behaviour no longer matches what the AC describes.

## Goal

Provide a `drift-detector` agent that, on demand or on a schedule, audits every `Implemented` feature in the repo and reports where spec and code have diverged. It does not fix the drift — it reports it, so the user can decide whether to amend the spec (proposal 05) or fix the code.

## Implementation

1. **New agent:** `plugins/spark/agents/drift-detector.agent.md`.
   - Inputs: `.specs/{project}/` path, optional `--feature FEAT-NNN` to scope.
   - For each `Implemented` feature:
     - Read the feature spec (ACs and behaviour notes).
     - Read every test and impl file referenced by the coverage map.
     - For each AC, compare the AC's stated behaviour to what the test actually asserts and what the impl actually does.
     - Flag drift in three categories:
       - **AC vs test** — test no longer covers what the AC describes.
       - **AC vs impl** — implementation behaviour no longer matches AC.
       - **Test vs impl** — tests pass but assert weaker behaviour than the impl provides (orphan capability).
   - Output: a per-feature drift report with severity (`HIGH` if behaviour deviates, `LOW` if only naming/comments).

2. **Scheduling:**
   - Document a `schedule` skill invocation that runs the detector weekly (use the existing `schedule` skill — see `plugins/` for triggers).
   - Output goes to `.specs/{project}/drift-reports/REPORT-{YYYY-MM-DD}.md`.

3. **Integration with proposal 05 (amendments):**
   - When drift is detected, the report includes a one-line suggestion: "amend FEAT-NNN" or "fix code to match FEAT-NNN AC-03".
   - If proposal 03 is implemented, this can link to the `amend` command.

4. **Integration with proposal 02 (CI):**
   - Drift detection is *not* a CI blocker (it's a judgment call, not a hard rule). It produces reports for human triage.

5. **Update `STATE.md`:**
   - Add a note that `Implemented` is not a terminal state in the long run — drift may push a feature back into `Amending`.

## Acceptance criteria

- Running `drift-detector` against a known-drifted feature (e.g. an AC says "must validate email format" but the impl no longer validates) produces a `HIGH` severity finding.
- A clean feature produces no findings.
- Reports are written to disk (don't disappear with the chat session).
- The detector runs in under 30 seconds for a 20-feature project.
- The detector never modifies code or specs — read-only.

## Out of scope

- Auto-fixing drift (that's an amendment, which the user must drive).
- Detecting drift during active development (`tdd-reviewer` covers that on the feature being worked on).
- Cross-feature semantic drift (e.g. two ACs that contradict each other).

## References

- `plugins/spark/agents/tdd-reviewer.agent.md` (similar audit pattern, scoped differently)
- `plugins/spark/agents/feature-editor.agent.md` (AC structure)
- Existing `schedule` skill for periodic runs

## Pairs with

- **02** (CI coverage maps) — structural drift; this catches semantic drift.
- **05** (amendment workflow) — drift findings flow into amendments.
