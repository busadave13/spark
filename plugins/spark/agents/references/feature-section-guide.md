# Feature Spec Section Guide

Detailed guidance for each section of a well-formed feature spec. Use this when writing
or reviewing `FEAT-NNN-*.md` files in `{docs-root}/feature/`.

---

## Table of Contents

1. [Title](#title)
2. [Metadata Block](#metadata-block)
3. [Goal](#goal)
4. [Motivation](#motivation)
5. [User Stories](#user-stories)
6. [Acceptance Criteria](#acceptance-criteria)
7. [API / Interface Definition](#api--interface-definition)
8. [Data Model](#data-model)
9. [Edge Cases & Error Handling](#edge-cases--error-handling)
10. [Preservation Constraints](#preservation-constraints)
11. [Out of Scope](#out-of-scope)
12. [Dependencies](#dependencies)

---

## Title

Format: `# FEAT-NNN: {Feature Name}`

The title names the feature, not the problem it solves.

**Good:**
- `# FEAT-001: User Authentication Flow`
- `# FEAT-002: Bulk Import API`
- `# FEAT-003: Dashboard Usage Metrics`

**Bad:**
- `# FEAT-001: Security` (too vague — which part of security?)
- `# FEAT-002: We Need an Import Feature` (conversational, not declarative)
- `# FEAT-003: Metrics and Logging and Alerts` (compound — split into separate features)

Use 3-digit zero-padded numbering. The slug after the number should be kebab-case
(e.g., `FEAT-001-user-authentication-flow.md`).

---

## Metadata Block

```markdown
> **Version**: 1.0<br>
> **Created**: 2026-04-15<br>
> **Last Updated**: 2026-04-15<br>
> **Owner**: Dave<br>
> **Project**: {ProjectName}<br>
> **Status**: Draft
```

### Fields
- **Version** — `{major}.{minor}` format; new features start at `1.0`. On each update, increment minor: `1.0` → `1.1` → … → `1.9` → `2.0` → `2.1` etc.
- **Created** — the date the feature spec was first written
- **Last Updated** — the date the feature spec was last modified
- **Owner** — resolved from `git config user.name`; for team projects, the primary author
- **Project** — the project name from context
- **Status** — lifecycle state of the feature spec. Valid values: `Draft`, `Approved`, `Implemented`
  - New features start as `Draft`
  - Any update to a non-Draft feature resets Status to `Draft`
  - Only the user may set `Approved`
  - Only `tdd-agent` may set `Implemented`, except when `feature-editor` determines during codebase exploration (Step 3) that the feature is already fully implemented — in that case `feature-editor` may set `Implemented` directly

---

## Goal

### What it contains
A concise statement of what this feature does, who uses it, and what need it serves.

### Guidance
Derive the goal from the PRD — do not invent new business context. If the feature maps
to a specific PRD goal, reference it. Keep it to 2–3 sentences.

**Good:**
> Provide a bulk import API that allows operations teams to upload CSV files of up to
> 10,000 records in a single request. This directly supports PRD Goal 2 (reduce manual
> data entry by 80%) and eliminates the current row-by-row workflow.

**Bad:**
> This feature adds an import capability to the system.

The bad example gives no context on who benefits, what scale is expected, or why it matters.

**Target length:** 2–3 sentences.

---

## Motivation

### What it contains
Why this feature needs to exist. Links to specific PRD goals, user pain points, or
business drivers.

### Guidance
Reference PRD section numbers, FR identifiers, or business metrics. The motivation
section justifies the feature's existence — if you can't point to a PRD driver, the
feature may not belong in this release.

**Good:**
> Implements FR-003 (Bulk data ingestion). Operations teams currently spend ~4 hours/week
> on manual entry (PRD §3.2). This feature reduces that to < 30 minutes by accepting
> batch uploads.

**Bad:**
> Users want to import data.

### Anti-patterns
- Motivation that doesn't reference the PRD or a measurable outcome
- Restating the Goal section with different words

**Target length:** 2–4 sentences.

---

## User Stories

### What it contains
One or more user stories using real persona roles from the PRD.

### Guidance
Format: `As a **[role]**, I want **[capability]** so that **[outcome]**.`

Use personas defined in the PRD — not generic roles like "user" or "admin" unless
those are the actual PRD personas.

**Good:**
> - As a **data operator**, I want to **upload a CSV of device records** so that
>   **I don't have to enter each device manually**.
> - As a **team lead**, I want to **see import status and error counts** so that
>   **I know whether to re-submit or investigate failures**.

**Bad:**
> - As a user, I want to import data so that it's in the system.

### Anti-patterns
- Using generic roles not from the PRD
- Stories that don't specify a concrete outcome
- Stories that describe implementation ("As a developer, I want to call the API…")

**Minimum:** 1 story with a real persona role.

---

## Acceptance Criteria

### What it contains
Independently testable conditions that define "done" for this feature.

### Guidance
Each criterion must be specific enough to write a test for. Use `- [ ]` checkbox format.
Include at least one error/failure case — features that only describe the happy path are
incomplete.

**Good:**
> - [ ] CSV upload accepts files up to 10 MB and 10,000 rows
> - [ ] Rows with validation errors are skipped; valid rows are imported
> - [ ] Response includes `imported_count`, `skipped_count`, and `errors[]` array
> - [ ] If the file exceeds 10 MB, return `413` with a clear error message
> - [ ] If the CSV has no valid rows, return `422` with row-level error details

**Bad:**
> - [ ] Import works correctly
> - [ ] Errors are handled

### Anti-patterns
- Criteria that can't be independently tested
- Vague conditions ("works correctly", "handles errors")
- Missing error cases

**Minimum:** 3 criteria, including ≥ 1 error case.

---

## API / Interface Definition

### What it contains
The external-facing interface for this feature — endpoints, methods, request/response
shapes, and error responses.

### Guidance
Define typed fields with required/optional annotations. List all error responses with
status codes and error body shapes. If this feature has no external-facing interface,
write `N/A` with a one-line reason.

**Good:**
```
POST /api/v1/imports
Authorization: Bearer <token>
Content-Type: multipart/form-data

Request:
  file: file (CSV, required, max 10 MB)
  dry_run: boolean (optional, default: false)

Response [202]:
{
  "import_id": "uuid",
  "status": "processing",
  "submitted_at": "ISO 8601 timestamp"
}

Errors:
  413 { "error": "file_too_large", "message": "File exceeds 10 MB limit" }
  422 { "error": "no_valid_rows", "message": "CSV contains no valid rows", "details": [...] }
  401 { "error": "unauthorized", "message": "Bearer token is missing or invalid" }
```

**Bad:**
```
POST /imports — sends a file, returns results
```

### Anti-patterns
- Missing error responses
- Untyped fields ("data" without specifying shape)
- `TBD` — resolve before finalizing the spec

---

## Data Model

### What it contains
Fields and relationships for data this feature creates, reads, updates, or deletes.

### Guidance
Match the conventions of the tech stack defined in ARCHITECTURE.md (e.g., if the
architecture uses PostgreSQL, use SQL types; if CosmosDB, use JSON shapes). If no data
model changes are required, write `N/A` with a one-line reason.

**Good:**
```
ImportJob {
  id:           uuid        — unique import identifier
  file_name:    string      — original uploaded filename
  status:       enum        — pending | processing | completed | failed
  total_rows:   int         — total rows in the CSV
  imported:     int         — successfully imported rows
  skipped:      int         — rows skipped due to validation errors
  submitted_by: uuid        — FK to users.id
  created_at:   timestamp
  completed_at: timestamp?  — null until processing finishes
}
```

**Bad:**
```
ImportJob has some fields for tracking imports
```

### Anti-patterns
- Fields without types
- Missing relationships (FKs, references to other entities)
- `TBD` — resolve before finalizing the spec

---

## Edge Cases & Error Handling

### What it contains
A table of specific scenarios and how the system responds.

### Guidance
Think about boundary conditions, concurrent operations, invalid input, and partial
failures. Each row should describe a precise scenario and the exact expected behavior —
not a vague "handle gracefully."

**Good:**

| Scenario | Expected behaviour |
|----------|--------------------|
| CSV with 0 rows (header only) | Return `422` with `"no_data_rows"` error |
| Duplicate records in same file | Import first occurrence, skip duplicates, include in `skipped_count` |
| Server crash mid-import | ImportJob status remains `processing`; background job retries on restart |

**Bad:**

| Scenario | Expected behaviour |
|----------|--------------------|
| Bad input | Handle error |
| Edge case | Respond appropriately |

**Minimum:** 3 rows with specific scenarios and precise expected behaviors.

---

## Preservation Constraints

### What it contains
Existing behaviors that MUST NOT be broken by this feature.

### Guidance
**Brownfield only** — omit this section entirely for greenfield features.

List specific existing behaviors, APIs, data formats, or integrations that must continue
to work unchanged after this feature is implemented.

**Good:**
> - Existing single-record `POST /api/v1/devices` endpoint must continue to work unchanged
> - Current CSV export format must remain compatible with the new import format
> - Device records created via import must be indistinguishable from manually created records

**Bad:**
> - Don't break anything

---

## Out of Scope

### What it contains
Explicit boundaries — things this feature does NOT do.

### Guidance
Be specific about what's excluded and why. This prevents scope creep during implementation
and helps agents understand the feature's boundaries.

**Good:**
> - Not included: Excel (.xlsx) file support — CSV only for v1; Excel adds parsing complexity
> - Not included: Real-time progress streaming — polling the import status endpoint is sufficient

**Bad:**
> - Not included: Other stuff

**Minimum:** 2 explicit boundaries.

---

## Dependencies

### What it contains
Other FEAT specs, ADRs, or external services this feature depends on.

### Guidance
Use relative links to other specs. If there are no dependencies, write `None`.

**Good:**
> - Requires: [ADR-0003: Use Azure Blob Storage for File Uploads](../adr/ADR-0003-azure-blob-storage.md)
> - Requires: [FEAT-001: User Authentication Flow](FEAT-001-user-authentication-flow.md) — needs authenticated user context

**Bad:**
> - Depends on some stuff
