# 07 — Parallel Feature Implementation via Worktrees

## Context

Today the workflow implements features **strictly sequentially**: one feature's TDD cycle must complete before the next starts. The reasoning is sound — each feature modifies the codebase and the suite must stay green between features. But for large architectures with dozens of features, this serializes work that could safely run in parallel: feature A and feature B that touch disjoint files have no real dependency.

## Goal

Allow multiple `tdd-developer` cycles to run **in parallel** for features that don't share files, using git worktrees for isolation, and serialize only at merge. Keep the safety invariants (green suite, traceability, etc.) intact per worktree.

## Implementation

1. **Disjointness analysis** in `plugins/spark/agents/spark.agent.md`:
   - Before launching parallel TDD, read each candidate feature's spec and predict the files it will touch (use the architecture doc, the `Affects` section of the feature spec, and any AC coverage maps already drafted).
   - Two features are "parallel-safe" if their predicted file sets are disjoint *and* their dependency graphs (based on `Depends on:` field in feature specs) don't intersect.
   - Conservative default: when in doubt, mark as conflicting and serialize.

2. **Worktree orchestration:**
   - For each parallel batch, create a worktree per feature: `.worktrees/FEAT-NNN/` (or via `git worktree add`).
   - Launch `tdd-developer` in each worktree as a background agent. Use the existing background agent mechanism.
   - Each agent runs the full Red→Green→Refactor cycle independently.

3. **Merge coordinator:**
   - When all parallel agents finish, the orchestrator merges worktrees back to the base branch one at a time, running the suite after each merge.
   - On merge conflict or post-merge red: stop, surface the conflict, and ask the user how to proceed (manual resolve / re-run / abort).

4. **Add a `--parallel` flag** to `spark` orchestration. Default remains sequential to preserve current behaviour. Document the trade-off clearly.

5. **Update `plugins/spark/instructions/spark.instructions.md`:**
   - New section: "Parallel feature execution rules" — disjointness criteria, merge order (lexical by FEAT number for determinism), failure handling.

6. **Update `STATE.md`:**
   - Add a note that the multi-feature loop can be parallel; show a conceptual fork/join in a separate "multi-feature" diagram (do not modify the single-feature diagram).

## Acceptance criteria

- Two features touching disjoint files can run in parallel and produce two green suites in their worktrees.
- Merge order is deterministic and the suite is verified green after each merge step.
- A predicted-disjoint pair that turns out to conflict (file overlap discovered during TDD) is detected at merge time, not silently merged.
- Sequential behaviour is unchanged when `--parallel` is not specified.

## Out of scope

- Distributed execution across machines.
- Auto-resolving merge conflicts.
- Parallelizing PRD/Architecture/ADR work (those are inherently shared).

## References

- `plugins/spark/agents/spark.agent.md` (orchestration)
- `plugins/spark/agents/tdd-developer.agent.md` (single-feature lifecycle)
- `plugins/spark/instructions/spark.instructions.md`
- `STATE.md` (multi-feature loop reference)
