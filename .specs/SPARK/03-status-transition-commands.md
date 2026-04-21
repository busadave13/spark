# 03 — Status-Transition Slash Commands

## Context

Every artifact in the workflow (`PRD.md`, `ARCHITECTURE.md`, each `ADR-NNNN-*.md`, each `FEAT-NNN-*.md`, each `FEAT-NNN.testplan.md`) carries a `Status:` field that must be moved manually from `Draft` → `Approved` (and, for features, → `Implemented`). The user does this by editing YAML/markdown frontmatter, which means:

- The `Last Updated` field is forgotten.
- The version number is not bumped per the rules in `spark.instructions.md`.
- Prerequisite checks (e.g. "you can't approve a feature spec until ARCHITECTURE is approved") aren't enforced — they're a convention the user has to remember.
- Every approval is a context switch that pulls the user out of the conversation flow.

## Goal

Provide first-class commands that perform a status transition atomically: validate prerequisites, set the status, bump the version per the rules, update `Last Updated`, and report what changed. Make approvals a one-line action instead of a manual edit.

## Implementation

1. **Decide on surface.** Two viable options — pick one in the implementation prompt:
   - **(A) Skill-based:** add `plugins/spark/skills/spark-status/SKILL.md` callable as `/spark-status approve <artifact-path>`. Lower friction to ship; lives entirely inside the plugin.
   - **(B) Agent-based:** add `plugins/spark/agents/status-editor.agent.md` invoked by `spark` orchestrator. More verbose but matches the existing agent pattern.

   Recommend **(A)** unless there's a reason to prefer agent style.

2. **Commands to support:**
   - `approve <path>` — Draft → Approved. Validates: all upstream prerequisites are also Approved.
   - `revert <path>` — Approved → Draft (e.g. for amendment; see proposal 05).
   - `implement <path>` — Approved → Implemented. Only valid for `FEAT-*` and `*.testplan.md`. Validates: `tdd-reviewer` last result was clean (see proposal 01).
   - `status <path>` — read-only; print current status, version, and prerequisite chain.

3. **Behaviour shared by all transitions:**
   - Bump version per the rule in `spark.instructions.md` (minor on update; recompute next patch).
   - Update `Last Updated:` to today's date.
   - Reject with explanation if prerequisites unmet (don't silently allow).
   - Print a one-line confirmation: `FEAT-007 Draft → Approved (v1.0 → v1.1, prerequisites: PRD ✓ ARCHITECTURE ✓ ADRs ✓)`.

4. **Update `plugins/spark/instructions/spark.instructions.md`:**
   - Replace prose like "user marks Approved" with a pointer to the command.
   - Keep manual editing as a documented fallback, not the primary path.

## Acceptance criteria

- `approve` on a feature spec while ARCHITECTURE is still Draft fails with a clear message.
- Version is bumped exactly once per transition.
- `Last Updated` is set without the user editing the file.
- `implement` on a feature without a clean `tdd-reviewer` result is rejected (assuming proposal 01 is also implemented; otherwise this check is a no-op).
- The command works on Windows (PowerShell) and bash; no shell-specific path assumptions.

## Out of scope

- Automating the *decision* to approve (that remains a human judgment).
- Bulk operations across multiple artifacts.

## References

- `plugins/spark/instructions/spark.instructions.md` (status semantics, version-bumping rules)
- `plugins/spark/skills/dotnet-webapi-project/SKILL.md` (existing skill structure to mirror if going option A)
- `plugins/spark/agents/spark.agent.md` (orchestrator integration if going option B)
