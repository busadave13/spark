# 04 — Collapse the Reviewer → Comments-Editor → Editor Cycle

## Context

Each artifact (PRD, Architecture, ADR, Feature) has three agents that handle its review loop:

1. **Reviewer** (e.g. `prd-reviewer`) — read-only; produces a findings table and writes `.comments.json` sidecar.
2. **Comments-editor** — reads `.comments.json`, applies edits, deletes the sidecar.
3. **Editor** (e.g. `prd-editor`) — re-runs to address structural changes.

This means a single round of feedback requires **three agent invocations and a transient file**. The `.comments.json` sidecar exists *only* because the three agents need to share state. For users, this is friction: more handoffs, more context-switching, slower iteration.

## Goal

Collapse the cycle to **one** agent per artifact type that can both review and apply fixes, presenting the user with a diff and an accept/reject decision per finding (or "accept all"). Eliminate the `.comments.json` sidecar entirely.

## Implementation

1. **For each `<artifact>-editor` / `<artifact>-reviewer` pair, merge into one agent** with two invocation modes:
   - `--review` mode (default): read the artifact, produce a findings table inline (no file written), then *for each finding* propose a concrete diff and ask the user to accept/reject/skip. On accept, apply the edit immediately. On finish, report what was changed.
   - `--edit` mode: behaves like the current editor (write/update the artifact from scratch).

2. **Affected agents (merge each pair into the editor):**
   - `plugins/spark/agents/prd-editor.agent.md` ← absorb `prd-reviewer.agent.md`
   - `plugins/spark/agents/architecture-editor.agent.md` ← absorb `architecture-reviewer.agent.md`
   - `plugins/spark/agents/adr-editor.agent.md` ← absorb `adr-reviewer.agent.md`
   - `plugins/spark/agents/feature-editor.agent.md` ← absorb `feature-reviewer.agent.md`

3. **Delete:**
   - The four `*-reviewer.agent.md` files.
   - `plugins/spark/agents/comments-editor.agent.md`.
   - All references to `.comments.json` in `spark.instructions.md` and the orchestrator.

4. **Keep separate** (do *not* merge):
   - `tdd-reviewer.agent.md` — its checks are deterministic/automated and gate `Implemented`; conceptually different from spec review.
   - `tdd-developer.agent.md` — already does its own implementation work; doesn't need a reviewer-fold.

5. **Update `plugins/spark/agents/spark.agent.md` and `plugins/spark/instructions/spark.instructions.md`:**
   - Replace the three-agent flow with the single-agent flow for each artifact.
   - Update `STATE.md` legend.

6. **Migration note:** any existing `.comments.json` files in the user's projects should be drained by running the merged editor in `--review` mode once before the old agents are removed. Document this in a one-time migration section of the implementation prompt's PR description.

## Acceptance criteria

- A user can move a PRD from "review needed" to "all comments applied" in one agent invocation.
- No `.comments.json` files are created during normal operation.
- The four reviewer files and `comments-editor.agent.md` are deleted from the repo.
- The merged editors can still produce a read-only findings table when the user only wants the audit (no edits applied).
- `STATE.md` reflects the simplified flow.

## Out of scope

- Changing the *content* of the review checks — same checks, fewer agents.
- Changing TDD review (`tdd-reviewer` stays).
- Diff-based reviews of code (this is about spec artifacts).

## References

- `plugins/spark/agents/prd-editor.agent.md`, `prd-reviewer.agent.md`
- `plugins/spark/agents/architecture-editor.agent.md`, `architecture-reviewer.agent.md`
- `plugins/spark/agents/adr-editor.agent.md`, `adr-reviewer.agent.md`
- `plugins/spark/agents/feature-editor.agent.md`, `feature-reviewer.agent.md`
- `plugins/spark/agents/comments-editor.agent.md`
- `plugins/spark/instructions/spark.instructions.md`
