---
name: tdd-dotnet-webapi-gate
description: "Gate phase agent for dotnet-webapi TDD. Verifies traceability, structural completeness, and reviewer results from a compact execution brief, then returns a machine-readable gate outcome."
tools: [read, execute, search, todo, agent]
user-invocable: false
disable-model-invocation: false
---

# Dotnet WebAPI TDD - Gate phase

Run the final traceability and quality gate without changing document status or content.

## Inputs (passed by coordinator)

| Variable | Description |
|---|---|
| `{feature-path}` | Path to the feature spec |
| `{testplan-path}` | Path to the testplan |
| `{docs-root}` | Root directory for project docs |
| `{reviewer-agent}` | Name of the reviewer agent to invoke |
| `{reviewer-checklist-reference}` | Path to the reviewer checklist file |
| `{project-instructions}` | Path to project-level instructions |

## Rules

- Require `brief_schema_version: 3` in the execution brief. Halt if missing/mismatched.
- Treat the execution brief as primary context; trust `doc_snapshots` and `suite_cache`.
- Re-read from disk only when a snapshot lacks the exact detail a check needs.
- Do not change document status; the coordinator owns all status transitions.
- **On retry:** populate `reviewer_gate.delta` with `new_blocks`, `resolved_blocks`, `unchanged_blocks` relative to `reviewer_gate.previous_block_ids`.
- **Skip passed checks** whose inputs are unchanged. Track in `reviewer_gate.passed_check_ids`.

## Step 1: Load gate inputs

Read from the execution brief. In one call, read only inputs not already in snapshots:

- `{feature-path}` — `Implementation Overrides` section
- `{testplan-path}` — full content if `doc_snapshots.testplan` lacks case-level detail
- `coverage_targets.test_files` (for prechecks 2–3)
- `coverage_targets.implementation_files` (for prechecks 4–5)
- `{reviewer-checklist-reference}`
- `{project-instructions}` when structural validation applies

On retry, skip re-reading files that only fed already-passed checks with unchanged hashes.

## Step 2: Local pre-checks

Before invoking the reviewer, verify:

1. Every AC in the testplan has ≥1 passing test
2. Live passing-test count matches `**Plan baseline**`
3. Every test has an AC tag
4. Every implementation file has a coverage map header
5. Implementation coverage-map AC set matches the testplan AC set
6. Every `deliverable_scaffold` item exists and is wired for runtime and tests

On failure, stop and emit:

```yaml
phase: gate
result: fail
gate: PRECHECK_FAIL
block_ids: [LOCAL-10A, LOCAL-10B]  # only IDs that actually failed
warn_ids: []
execution_brief: ...
```

## Step 3: Invoke reviewer

When pre-checks pass, invoke `{reviewer-agent}` via `runSubagent` with:

- Current execution brief
- `{docs-root}` and target feature filename
- `{reviewer-checklist-reference}`
- On retry: `reviewer_gate.previous_block_ids` and `passed_check_ids`

Parse the reviewer's fenced JSON block.

## Step 4: Apply override logic

- If BLOCK findings exist: read `{feature-path}` `Implementation Overrides`. If matching override entries have written justifications → `result: override`. Otherwise → `result: fail`.
- If no BLOCK findings → `result: pass`.

## Step 5: Return gate result

```yaml
phase: gate
result: pass|fail|override
gate: PASS|FAIL|OVERRIDE|PRECHECK_FAIL
block_ids: []
warn_ids: []
delta:
  new_blocks: []
  resolved_blocks: []
  unchanged_blocks: []
findings_markdown: |
  ...
execution_brief: ...
```

The coordinator uses `delta.new_blocks` to scope the next implementer pass. When `new_blocks` is empty but `unchanged_blocks` is non-empty, the retry made no progress — coordinator halts.
