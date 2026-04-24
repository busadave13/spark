# TDD Execution Brief

Use this as the compact handoff contract between the resolved TDD coordinator, its
phase agents, and `tdd-reviewer`.

## Goal

Carry forward only the normalized data later phases need. Do not copy raw sections
from feature specs, architecture docs, ADRs, source files, or test output when a
concise summary or file path list will do.

## Required shape

```yaml
brief_version: 2
project:
  name:
  type:
  repo_root:
  project_root:
  docs_root:
  agents_root:         # resolved from Spark config.yaml roots.agents
  skills_root:         # resolved from Spark config.yaml roots.skills
  instructions_root:   # resolved from Spark config.yaml roots.instructions
feature:
  id:
  name:
  slug:
  path:
  status:
  version:
testplan:
  path:
  status:
  plan_baseline:
# Snapshots of source docs the phases would otherwise re-read. Populate once in the
# context phase; refresh the specific sub-field only when a phase writes to the source.
doc_snapshots:
  feature:
    status:            # mirrors on-disk Status; phases trust this
    version:
    ac_summary: []     # id + one-line
    sections: {}       # name -> short digest
  testplan:
    status:
    version:
    plan_baseline:
    ac_ids: []
  architecture:
    version:
    project_type:
    layers: []
    conventions: []
  adrs: []             # [{ id, title, decision_summary }]
paths:
  project_instructions:
  candidate_test_files: []
  candidate_implementation_files: []
  relevant_project_files: []
acceptance_criteria:
  - id:
    text:
    resolved_text:
    status: clear|flag|blocker
    notes: []
architecture_constraints:
  layers: []
  conventions: []
  required_scaffolding: []
adr_decisions:
  - id:
    title:
    decision:
    consequence:
repo_conventions:
  test_runner:
  suite_command:
  naming:
  fixtures: []
  helpers: []
structural_check:
  requires_instruction_bootstrap: false
  bootstrap_needs: []          # inputs the coordinator must collect if bootstrap is deferred
  prerequisites_missing: []
  deliverable_scaffold: []
coverage_targets:
  ac_ids: []
  expected_case_count:
  test_files: []
  implementation_files: []
suite_digest:
  last_run_command:
  passed:
  failed:
  notable_failures: []
# Cached suite result. Gate and tdd-reviewer consume this when code_sha still matches
# the current on-disk state of the impl+test files, and skip re-running the suite.
# Implementer writes/refreshes; context phase leaves nulls.
suite_cache:
  last_run_at:             # ISO-8601 timestamp
  code_sha:                # hash of (impl_files + test_files) content; implementer computes
  tracked_files: []        # paths contributing to code_sha
  result: null             # pass | fail | null
  failing_tests: []
  run_command:
reviewer_gate:
  previous_block_ids: []
  warn_ids: []
  # Populated on gate retry. Lets the coordinator send only the new/changed blocks
  # back to the implementer instead of the whole set.
  delta:
    new_blocks: []
    resolved_blocks: []
    unchanged_blocks: []
  # IDs of checks that have already passed at least once this cycle. Gate/reviewer may
  # skip re-evaluating these on retry when their inputs have not changed.
  passed_check_ids: []
notes:
  refactor_changes: []
  broken_refactors: []
  adr_candidates: []
  follow_on_tests: []
```

## Rules

- Keep values concise and normalized.
- Carry file paths and short summaries, not raw file bodies.
- Include only ADRs directly relevant to the target feature.
- When a phase changes the testplan, coverage targets, suite result, or reviewer
  block set, rewrite those fields in the returned brief.
- Every phase agent returns the full updated brief in a fenced YAML block at the
  end of its output.

### Cache invariants

- `suite_cache.code_sha` is a stable hash of the concatenation of all files listed in
  `suite_cache.tracked_files`. The implementer updates `code_sha` and result together;
  readers treat the entry as valid only when a fresh hash of the same files still
  matches `code_sha`. Mismatch = re-run the suite.
- `doc_snapshots.<doc>.status` is authoritative between phases. The only place a phase
  must re-read on disk is when `spark-status` (or another writer) just changed the
  file; that writer must also update the matching snapshot.
- `reviewer_gate.passed_check_ids` is additive within one feature cycle; it is cleared
  when the feature cycle ends (gate PASS/OVERRIDE + spark-status implement succeeded).
