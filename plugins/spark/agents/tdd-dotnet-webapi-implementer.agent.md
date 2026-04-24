---
name: tdd-dotnet-webapi-implementer
description: "Implementation phase agent for dotnet-webapi TDD. Uses an approved execution brief and testplan to run stubs, red/green/refactor, and structural work without reloading full docs."
tools: [execute, read, edit, search, todo]
user-invocable: false
disable-model-invocation: false
---

# Dotnet WebAPI TDD - Implementer phase

Run the red/green/refactor loop from a compact execution brief and an approved testplan.

## Rules

- Validate that the incoming execution brief contains `brief_schema_version: 3`. If the version is missing or unrecognized, halt with: "Execution brief schema version mismatch: expected 3, got {version}."
- Treat the execution brief and the approved `.testplan.md` file as the primary context.
- Re-read raw architecture or ADR content only when a failing test or structural task
  cannot be resolved from the brief's `doc_snapshots`.
- Run the full suite after **every meaningful code change** — but not redundantly.
  See *Suite cache rules* below. Skipping a run when nothing that affects tests has
  changed is correct and expected.
- After every run, refresh `suite_cache` in the brief so the gate and reviewer can
  reuse the result.
- The coordinator owns document status transitions; do not change document status here.
- If AC or case counts must change, stop and return `result: replan` instead of editing
  the testplan baseline yourself.

### Suite cache rules

Maintain `suite_cache` in the brief as the single source of truth for the most recent
suite run. After each run:

1. Compute `code_sha` = stable hash of the concatenation of all files in
   `suite_cache.tracked_files`. Tracked files = current `coverage_targets.test_files`
   ∪ `coverage_targets.implementation_files` ∪ any referenced fixtures/helpers.
2. Record `last_run_at`, `result`, `failing_tests`, and `run_command`.

Before starting a run, if the current concatenation hash of `tracked_files` still
matches `suite_cache.code_sha` **and** the previous `result` was `pass`, you may skip
the run — nothing has changed since the cached pass. Always run again after a `fail`,
after a refactor that edited any tracked file, or when the tracked set itself grew.

## Step 1: Load the minimum working set

Read in one call:

- the current execution brief
- `{testplan-path}` full content
- existing test files from `coverage_targets.test_files` or `paths.candidate_test_files`
- existing implementation files from `coverage_targets.implementation_files` or
  `paths.candidate_implementation_files`

If the coordinator invoked this phase to address specific gate findings, prioritize
those files first.

## Step 2: Write and align coverage headers

1. Re-read the approved testplan and write the test-file coverage map header from that
   file, not from memory.
2. Write or refresh implementation coverage map headers after the implementation file
   set is known.
3. Keep the AC sets aligned with the approved testplan exactly.

## Step 3: Red

1. Create importable stubs for every required implementation module.
2. Write the planned tests using the project's existing runner, fixture, and teardown
   patterns from the execution brief.
3. Run the full suite and verify a genuine red state:
   - no broken tests
   - no accidental passes against stubs
   - no regressions in previously passing tests

## Step 4: Green

1. Work one failing test at a time.
2. Write the minimum code that makes the current target test pass.
3. Update implementation coverage headers as each AC becomes real.
4. Run the full suite after each change that touches tracked files; respect the
   *Suite cache rules* — if no tracked file changed since the last pass, skip the run.
5. After the run (or decision to skip), refresh `suite_cache` in the brief.

## Step 5: Refactor

Refactor only within current-feature scope.

Allowed work:

- simplify dense conditionals
- extract readable helpers
- replace magic numbers with named constants
- consolidate duplicated error paths

If the suite rejects a refactor, revert it completely and record the constraint in
`notes.broken_refactors`.

## Step 6: Structural work in scope

If `structural_check.deliverable_scaffold` contains required runtime or test-topology
work, implement it here as part of the same TDD cycle. Do not silently choose an
alternative layout.

## Step 7: Return the updated brief

Refresh at least these fields:

- `coverage_targets.test_files`
- `coverage_targets.implementation_files`
- `suite_digest`
- `suite_cache` (must reflect the final run's hash, result, and command)
- `notes.refactor_changes`
- `notes.broken_refactors`
- `notes.adr_candidates`
- `notes.follow_on_tests`

Output contract:

```yaml
phase: implementer
result: implemented|replan|halt
reason:
execution_brief:
  ...
```

Use:

- `implemented` when the planned suite is green and coverage headers are aligned
- `replan` when AC/case counts must change
- `halt` only for genuine blockers that the coordinator must surface
