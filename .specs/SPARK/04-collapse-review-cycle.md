# 04 — Collapse the Reviewer → Editor Cycle

## Context

Each spec artifact (PRD, Architecture, ADR, Feature) currently has a read-only reviewer agent and a read/write editor agent:

- **Reviewer** (e.g. `prd-reviewer`) — runs a deterministic checklist and returns a findings table. Does not modify files.
- **Editor** (e.g. `prd-editor`) — creates or updates the artifact.

When a user asks for a review, `spark` dispatches the reviewer, collects findings, then re-dispatches the editor with those findings so fixes can be applied (`plugins/spark/instructions/spark.instructions.md` — "Reviewer-to-Editor Delegation"). That's **two agent hops for one round of feedback**, and the handoff is lossy — the editor has to re-load everything the reviewer already read.

Two of the four editors already sidestep this: `prd-editor` (Step 3a) and `feature-editor` (Step 5) have internal review paths that present findings and apply fixes in a single invocation. `architecture-editor` and `adr-editor` do not.

> ### Not the same problem as `.comments.json`
>
> `.comments.json` sidecars are **not** produced by the reviewer agents. They are written by the spark-view VS Code extension (`src/spark-view/sidecarManager.ts`, schema v3.0) when a user highlights text in the preview and writes a comment. `comments-editor` then applies those human-authored comments to the target document. That is a separate workflow — **this proposal does not touch it**.

## Goal

Collapse the machine-review loop to **one agent per artifact type** that can both audit and apply fixes, following the pattern already established by `prd-editor` and `feature-editor`. Remove the four spec-reviewer agents. Leave the spark-view / `comments-editor` workflow untouched.

## Implementation

1. **Bring `architecture-editor` and `adr-editor` up to parity** with `prd-editor` and `feature-editor` by adding an internal review path:
   - Detect the user's intent (e.g. "review the architecture", "review the ADRs") at the same dispatch point the other editors use.
   - Skip the interview and generation steps; run the reviewer's existing checklist.
   - Present the findings table, then prompt: resolve by number, `all`, or `none` (same UX as `prd-editor` Step 3a).
   - Apply accepted fixes and proceed to the existing final step (version bump, report).
   - Lift the check definitions verbatim from the reviewer agents — same checks, same IDs, same severity mapping.

2. **Delete the four spec-reviewer agents** once their checks are folded in:
   - `plugins/spark/agents/prd-reviewer.agent.md`
   - `plugins/spark/agents/architecture-reviewer.agent.md`
   - `plugins/spark/agents/adr-reviewer.agent.md`
   - `plugins/spark/agents/feature-reviewer.agent.md`

3. **Update `plugins/spark/instructions/spark.instructions.md`:**
   - Routing table: the "Review / validate X" rows point at the corresponding `*-editor` instead of `*-reviewer`.
   - "Reviewer-to-Editor Delegation": remove the four spec-reviewer bullets. Keep the `tdd-reviewer` paths and the T16/T17 note exactly as-is.
   - "Parallel ADR Review": have `spark` invoke `adr-editor` in review mode, one per ADR file, in parallel.
   - Generalise "`prd-editor` Review Mode" and "`feature-editor` Review Mode" into a single section that covers all four editors.

4. **Update `plugins/spark/agents/spark.agent.md`** to remove references to the deleted reviewers.

5. **Update `.specs/SPARK/STATE.md`** legend if it names any of the four reviewers.

## Keep separate (do NOT merge or delete)

- `plugins/spark/agents/tdd-reviewer.agent.md` — its checks gate `Implemented` and its invocation paths (inline mandatory gate + standalone audit) are deliberately distinct from spec review.
- `plugins/spark/agents/tdd-developer.agent.md` — already does its own implementation work.
- `plugins/spark/agents/comments-editor.agent.md` — owned by the spark-view human-comment workflow.
- `src/spark-view/**` including `sidecarManager.ts`, `markdownFilesProvider.ts`, and related tests.
- Any `.comments.json` file and every reference to it in `spark.instructions.md` — those describe the human-comment loop and must remain.

## Acceptance criteria

- A user can move a PRD (or Architecture, ADR, Feature) from "review needed" to "all accepted fixes applied" in one editor invocation.
- The four `*-reviewer.agent.md` files are deleted.
- `architecture-editor` and `adr-editor` have an internal review path equivalent to `prd-editor` Step 3a / `feature-editor` Step 5.
- `spark.instructions.md` routing table no longer mentions `prd-reviewer`, `architecture-reviewer`, `adr-reviewer`, or `feature-reviewer`.
- `tdd-reviewer`, `comments-editor`, `.comments.json`, and spark-view are unchanged.
- `STATE.md` reflects the simplified flow.

## Out of scope

- Changing the *content* of the review checks — same checks, fewer agents.
- TDD review (`tdd-reviewer` stays, with both invocation paths intact).
- The spark-view human-comment workflow (`comments-editor`, `.comments.json`, `sidecarManager.ts`).
- Diff-based code review.

## References

- `plugins/spark/agents/prd-editor.agent.md` (Step 3a — review-path template)
- `plugins/spark/agents/feature-editor.agent.md` (Step 5 — review-path template)
- `plugins/spark/agents/architecture-editor.agent.md` (needs a review path added)
- `plugins/spark/agents/adr-editor.agent.md` (needs a review path added)
- `plugins/spark/agents/prd-reviewer.agent.md`, `architecture-reviewer.agent.md`, `adr-reviewer.agent.md`, `feature-reviewer.agent.md` (to delete; lift their checklists first)
- `plugins/spark/instructions/spark.instructions.md` (routing table + "Reviewer-to-Editor Delegation" + "Parallel ADR Review" + the two "Review Mode" sections)
- `plugins/spark/agents/spark.agent.md`
- `.specs/SPARK/STATE.md`
