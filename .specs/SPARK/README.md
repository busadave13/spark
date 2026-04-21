# Spark Workflow Improvements

This folder contains proposed improvements to the Spark plugin workflow documented in `STATE.md`. Each file is written as a self-contained implementation prompt: open one in a Claude Code session and ask Claude to implement it.

The proposals are independent — pick any in any order — but a few have natural pairings (called out in each doc).

## Index

| # | Proposal | Touches | Pairs With |
| --- | --- | --- | --- |
| 01 | [Mandatory tdd-reviewer gate](01-mandatory-tdd-reviewer.md) | `tdd-developer`, `tdd-reviewer` | 02 |
| 02 | [Coverage-map CI enforcement](02-coverage-map-ci-enforcement.md) | New script + CI | 01, 09 |
| 03 | [Status-transition slash commands](03-status-transition-commands.md) | New skill/command | — |
| 04 | [Collapse reviewer→comments→editor cycle](04-collapse-review-cycle.md) | All editor/reviewer agents | — |
| 05 | [Spec-amendment workflow](05-spec-amendment-workflow.md) | `spark.instructions`, all editors | 06 |
| 06 | [ADR-candidates queue](06-adr-candidates-queue.md) | `tdd-developer`, `adr-editor` | 05 |
| 07 | [Parallel feature implementation](07-parallel-feature-implementation.md) | `spark` orchestrator | — |
| 08 | [Generated test-plan draft](08-generated-testplan-draft.md) | `tdd-developer` | — |
| 09 | [Spec-code drift detection](09-spec-code-drift-detection.md) | New agent + scheduler | 02 |

## How to use these prompts

In a Claude Code session at the repo root, run:

```
Read .specs/SPARK/<file>.md and implement the change end-to-end. Stop and ask if anything is ambiguous.
```

Each prompt is sized to be implementable in one focused session. None require coordination with another proposal unless explicitly noted under "Depends on".
