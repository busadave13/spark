# 08 — Generated Test-Plan Draft from Feature Spec

## Context

`tdd-developer` Step 4 generates the test plan, but in practice it starts from a blank page each time and asks the user to approve from scratch. The feature spec already contains structured ACs (numbered, with descriptions, often with explicit happy/edge/error notes). A first-pass test plan is largely **derivable** from these ACs — the user's real value-add is editing the draft, not authoring it.

The hard human-approval gate on the test plan is correct and must stay. This proposal only changes what the *starting draft* looks like.

## Goal

When `tdd-developer` reaches Step 4, instead of presenting a blank slate or a brief outline, present a **fully drafted** test plan derived mechanically from the feature spec's ACs. The user reviews, edits, and approves — same gate, less typing.

## Implementation

1. **Modify `plugins/spark/agents/tdd-developer.agent.md` Step 4:**
   - Read the feature spec's AC list.
   - For each AC, generate at minimum:
     - One happy-path test (named after the AC).
     - One edge-case test (boundary value or empty/null input, depending on AC type).
     - One error-path test if the AC mentions an error/failure mode.
   - Apply heuristics from AC text:
     - "must reject when X" → error-path test for X.
     - "supports up to N" → boundary test at N and N+1.
     - "validates against Y" → invalid-input test.
   - Output a complete `FEAT-NNN.testplan.md` *as a draft proposal* (not committed).

2. **Present the draft to the user for approval:**
   - Show the full draft.
   - Highlight which tests are heuristic-derived vs. which need user input (mark with `[needs review]` tag).
   - Ask explicit accept/edit/reject.
   - Only on accept: write the file with `Status: Approved` (since the user has explicitly approved).

3. **Add a `testplan-generation-rules.md`** in `plugins/spark/agents/references/` documenting the heuristics so users can predict and tune what gets generated.

4. **Update `plugins/spark/agents/references/testplan-template.md`** if needed to support the `[needs review]` marker.

5. **Update `plugins/spark/agents/references/feature-section-guide.md`** to recommend AC phrasing patterns that generate well (e.g. "must reject" vs. "should not allow" — first phrase generates an error-path test cleanly).

## Acceptance criteria

- A feature with 5 well-phrased ACs produces a draft test plan with at least 5 happy + 5 edge + N error tests with no user input beyond approval.
- The draft clearly distinguishes generated tests from those needing user input.
- The user can still reject the entire draft and author manually.
- The hard approval gate from `tdd-developer` Step 4 still requires explicit approval before stubs are written.

## Out of scope

- Generating actual test *code* (still happens in Step 7; this only generates the test *plan*).
- LLM-generated tests for ACs without enough information — those should be marked `[needs review]`, not invented.
- Replacing user judgment on coverage strategy.

## References

- `plugins/spark/agents/tdd-developer.agent.md` (Step 4 test plan)
- `plugins/spark/agents/references/testplan-template.md`
- `plugins/spark/agents/references/feature-section-guide.md` (AC phrasing)
