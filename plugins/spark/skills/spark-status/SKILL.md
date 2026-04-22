---
name: spark-status
description: "Transition the Status field of a Spark artifact atomically (Draft ↔ Approved, Approved → Implemented for features and test plans). Validates the upstream prerequisite chain, bumps the version per the rule in spark.instructions.md, and updates Last Updated (or the testplan date fields). Use when the user asks to approve, revert, or mark implemented a PRD, ARCHITECTURE, ADR, feature spec, or test plan — e.g. 'approve the Mockery PRD', 'revert ARCHITECTURE to Draft', 'mark FEAT-001 implemented', or when the user invokes `/spark-status`. Also supports a read-only `status` subcommand that prints current status plus the prerequisite chain."
---

## Scope

This skill only rewrites the metadata header of an existing Spark artifact. It does not:

- Edit artifact body content.
- Invoke editor, reviewer, or TDD agents.
- Operate on multiple artifacts in one call (bulk transitions are not supported — invoke once per artifact).

The decision to approve remains a human judgment. This skill enforces the mechanical
rules: prerequisite chain, version bump, date update, and status value.

## Required inputs

Parse two values from the user's request:

- **subcommand** — one of `approve`, `revert`, `implement`, `status`.
- **path** — path to the target artifact (relative or absolute).

If either is missing or ambiguous, ask the user before proceeding. Do not guess which
artifact they mean — if the user says "approve the PRD" without a project, ask which
project.

## Step 1 — Classify the artifact

From the filename and its location relative to a `.specs/{project}/` folder, determine
the artifact type and set `{docs-root}` = the `.specs/{project}/` directory containing
the file.

| Filename pattern | Type |
|---|---|
| `PRD.md` at `{docs-root}/PRD.md` | `prd` |
| `ARCHITECTURE.md` at `{docs-root}/ARCHITECTURE.md` | `architecture` |
| `ADR-NNNN-*.md` at `{docs-root}/adr/` | `adr` |
| `FEAT-NNN-*.md` at `{docs-root}/feature/` (not `.testplan.md`) | `feature` |
| `FEAT-NNN-*.testplan.md` at `{docs-root}/testplan/` | `testplan` |

If the file does not match any pattern or is not inside a `.specs/{project}/` folder,
reject:

> "⛔ `{path}` is not a recognized Spark artifact. Expected one of: PRD.md,
> ARCHITECTURE.md, adr/ADR-*.md, feature/FEAT-*.md, testplan/FEAT-*.testplan.md under a
> `.specs/{project}/` folder."

> **Note on legacy location.** Earlier versions of this workflow co-located
> `FEAT-NNN-*.testplan.md` files inside `{docs-root}/feature/`. Reject any
> `*.testplan.md` found there with the message above and direct the user to move it to
> `{docs-root}/testplan/`. Do not silently accept the legacy location.

## Step 2 — Read and parse the header

Read the file in full. Extract the metadata block.

- For `prd`, `architecture`, `adr`, `feature`: expect `**Version**`, `**Last Updated**`,
  and `**Status**` fields.
- For `testplan`: expect `**Status**` and typically `**Approved**`. `**Completed**`
  appears once `implement` runs.

If the file does not begin with `<!-- SPARK -->` or is missing `**Status**`, reject with
a clear message. Do not try to repair malformed headers — direct the user to the
appropriate editor agent.

## Step 3 — Apply the subcommand

### `status` (read-only)

Print:

- Current `**Status**` and `**Version**` (for non-testplan) or `**Approved**` /
  `**Completed**` (for testplan).
- The prerequisite chain for the next forward transition (see Step 4), with ✓/✗ per
  prerequisite.

Do not edit the file.

### `approve` — Draft → Approved

Reject with explanation if:

- Current `**Status**` ≠ `Draft`.
- Any prerequisite fails (Step 4).

Otherwise apply the transition (Step 5).

### `revert` — Approved → Draft

Reject if current `**Status**` ≠ `Approved`.

Warn the user that downstream artifacts referencing this may now be inconsistent — do
**not** auto-revert them. Proceed with the transition on the target file only.

### `implement` — Approved → Implemented (features and test plans only)

Reject if:

- Artifact type is not `feature` or `testplan`.
- Current `**Status**` ≠ `Approved`.
- The implement-side prerequisites (Step 4) fail.

Note: the normal path for marking a feature `Implemented` is `tdd-developer`. Use
`implement` here for manual cleanup, repair, or when the user is re-asserting an already-
shipped feature's status. If a mandatory `tdd-reviewer` gate has been wired into the
workflow and records a machine-readable pass/fail anywhere the skill can read, require
that result to be clean. Otherwise the reviewer check is a no-op — do not block.

Apply the transition (Step 5).

## Step 4 — Prerequisite chain

### `approve` prerequisites

| Artifact type | Required state of upstream artifacts |
|---|---|
| `prd` | None |
| `architecture` | None (PRD is optional) |
| `adr` | `{docs-root}/ARCHITECTURE.md` has `**Status**: Approved` |
| `feature` | `{docs-root}/ARCHITECTURE.md` has `**Status**: Approved` |
| `testplan` | Sibling `FEAT-NNN-*.md` at `{docs-root}/feature/` (same prefix, no `.testplan.md`) has `**Status**: Approved` or `Implemented` |

### `implement` prerequisites

| Artifact type | Required state |
|---|---|
| `feature` | Sibling `FEAT-NNN-*.testplan.md` at `{docs-root}/testplan/` has `**Status**: Approved` or `Implemented` |
| `testplan` | Sibling `FEAT-NNN-*.md` at `{docs-root}/feature/` has `**Status**: Approved` or `Implemented` |

**Sibling resolution.** Test plans live in `{docs-root}/testplan/` and feature specs live
in `{docs-root}/feature/`. To resolve a sibling, take the file's basename without the
`.testplan` segment (for testplans) or with `.testplan` appended before `.md` (for
features), and look in the sibling folder. Do **not** look in the same folder.

### How to check

For each prerequisite file:

1. Resolve the expected path. Fail if the file is missing.
2. Read only enough of the file to parse the metadata block (the first ~20 lines is
   sufficient for every Spark artifact).
3. Extract `**Status**` and compare to the required set.

If any prerequisite fails, collect all failing prerequisites into one rejection message
— do not stop at the first failure.

## Step 5 — Apply the transition atomically

Update the file in a single edit:

1. **`**Status**`** — set to the target value (`Approved`, `Draft`, or `Implemented`).

2. **`**Version**`** — for `prd`, `architecture`, `adr`, `feature` only:
   - Parse the current value as `major.minor`.
   - Increment `minor` by 1.
   - If the result would be `major.10`, roll to `(major + 1).0`.
   - Examples: `1.0` → `1.1`, `1.9` → `2.0`, `2.9` → `3.0`.
   - Test plans have no `**Version**` field — skip.

3. **Dates:**
   - `prd`, `architecture`, `adr`, `feature`: set `**Last Updated**` to today in
     `YYYY-MM-DD` format.
   - `testplan` on `approve`: set `**Approved**` to today (add the field if it did not
     exist yet).
   - `testplan` on `implement`: set `**Completed**` to today (add the field if it did not
     exist yet).
   - `testplan` on `revert`: leave dates untouched.

Do not modify any other content in the document. Do not resequence or rename sections.

## Step 6 — Report

Print a one-line confirmation. Examples:

```
✅ PRD (Mockery) Draft → Approved — v2.6 → v2.7, Last Updated 2026-04-21 (prerequisites: none)
✅ FEAT-007 Draft → Approved — v1.0 → v1.1, Last Updated 2026-04-21 (prerequisites: ARCHITECTURE ✓)
✅ FEAT-001.testplan Approved → Implemented — Completed 2026-04-21 (prerequisites: spec ✓)
⛔ FEAT-007 approve rejected: ARCHITECTURE.md has Status: Draft (requires Approved)
⛔ ADR-0003 approve rejected: ARCHITECTURE.md not found at .specs/Mockery/ARCHITECTURE.md
```

For `status`, print the current state plus the prerequisite chain:

```
📄 FEAT-007 — Status: Draft, Version: 1.0, Last Updated: 2026-04-18
   Prerequisites for approve:
     - ARCHITECTURE.md: Status: Draft ✗  (requires Approved)
```

## Fallback

Manual editing of the metadata block is still valid. If the user explicitly prefers to
edit the file by hand, do not block them — remind them to bump `**Version**` and update
`**Last Updated**` per the rules in `plugins/spark/instructions/spark.instructions.md`
(see also the version-bump rule in Step 5 of this skill).
