<!-- SPARK -->

<!--
  This file lives at {docs-root}/testplan/FEAT-{NNN}-{kebab-name}.testplan.md
  (a sibling folder to {docs-root}/feature/, NOT inside it).
  The agent that writes it must REPLACE the file in full on every write —
  never append. The first byte must be the `<!-- SPARK -->` marker above and
  the file must contain exactly one such marker.
-->

# Test Plan — FEAT-{NNN}: {Feature Name}

> **Feature**: FEAT-{NNN}: {feature name}<br>
> **Spec**: {docs-root}/feature/FEAT-{NNN}-{kebab-name}.md<br>
> **Test file**: {path to test file}<br>
> **Test runner**: {runner}<br>
> **Plan baseline**: {N} ACs · {N} cases<br>
> **Approved**: {YYYY-MM-DD}<br>
> **Status**: Draft

## Test plan — FEAT-{NNN}: {feature name}

{N} ACs · {N} test cases total (must equal the **Plan baseline** above)

### AC-01: {AC text}

| Category | Test name |
|---|---|
| happy | {test_name} |
| failure | {test_name} |
| edge | {test_name} |

### AC-02: {AC text}

| Category | Test name |
|---|---|
| happy | {test_name} |
| failure | {test_name} |

## Coverage gaps

{Any ACs not in the plan and why, or "None"}

## Resolved ambiguities

{For each resolved blocker: AC-ID — original vague text — agreed concrete value}
{For each confirmed flag: AC-ID — default used and source}
{Or "None" if no ambiguities were found}
