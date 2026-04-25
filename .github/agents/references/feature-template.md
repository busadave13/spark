<!-- SPARK -->

# FEAT-[NNN]: [Feature Name]

> **Version**: {VERSION}<br>
> **Created**: {DATE}<br>
> **Last Updated**: {DATE}<br>
> **Owner**: {OWNER}<br>
> **Project**: {PROJECT_NAME}<br>
> **Status**: Draft
> **Type**: FEATURE<br>

## Goal

[2–3 sentences. What is this feature, why does it exist, and what user need does it serve.
Derive this from the PRD goals and the user's feature description — do not re-ask.
If it maps to a goal in the PRD, reference it directly.]

## Motivation

[Why does this feature need to exist? Link to specific PRD goals, user pain points,
or business drivers that justify this feature. Reference PRD section numbers where applicable.
If this feature implements a specific FR from the PRD, cite it (e.g., "Implements FR-003").]

## User Stories

- As a **[role from PRD personas]**, I want **[capability]** so that **[outcome]**.

## Acceptance Criteria

Each criterion must be independently testable. If you can't write a test for it, rewrite it.

- [ ] [Specific, testable condition]
- [ ] [Error case — e.g. "If X is missing, return error Y"]
- [ ] [At least 3 criteria minimum]

## API / Interface Definition

[METHOD] /api/v1/[path]
Authorization: Bearer <token>

Request:
{
  "field": "type — description, required/optional"
}

Response [status]:
{
  "field": "type"
}

Errors:
[status] { "error": "code", "message": "human-readable description" }

<!-- Mark N/A with a one-line reason if this feature has no external-facing interface. -->

## Data Model

[Fields and relationships for data this feature creates, reads, updates, or deletes.
Match the conventions of the tech stack in ARCHITECTURE.md.]

[Entity] {
  id:        uuid
  [field]:   [type]  — [description]
  createdAt: timestamp
}

<!-- Mark N/A with a one-line reason if no data model changes are required. -->

## Edge Cases & Error Handling

| Scenario | Expected behaviour |
|----------|--------------------|
| [Case]   | [How the system responds] |

## Preservation Constraints

<!-- Brownfield only — list existing behaviours that MUST NOT be broken by this feature.
     Omit this section entirely for greenfield features. -->

## Out of Scope

- [Not included: X]
- [Not included: Y — at least 2 explicit boundaries]

## Dependencies

- Requires: [other FEAT specs, ADRs, or external services this depends on, or "None"]
