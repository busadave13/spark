<!-- SPARK -->

# Product Requirements Document

> **Version**: {VERSION}<br>
> **Created**: {DATE}<br>
> **Last Updated**: {DATE}<br>
> **Owner**: {OWNER}<br>
> **Project**: {PROJECT_NAME}<br>
> **Status**: Draft

---

## 1. Overview

### Product Name
{Product Name}

### Tagline
> {One sentence: what it does for whom}

### Problem Statement
{Describe the world without this product. What pain, inefficiency, or gap exists today?
Write from the user's perspective, not the builder's. 2–4 sentences.}

### Solution Summary
{Describe what this product does and how it addresses the problem above.
Keep technology-agnostic; save implementation details for `ARCHITECTURE.md`. 2–4 sentences.}

---

## 2. Goals & Success Criteria

### Primary Goals
1. {Goal 1}
2. {Goal 2}
3. {Goal 3}

### Measurable Outcomes

| Goal | Success Criterion |
|---|---|
| {Goal 1} | {How will you know this goal was achieved?} |
| {Goal 2} | {Observable or measurable outcome} |
| {Goal 3} | {Observable or measurable outcome} |

---

## 3. Users & Personas

### Primary User: {Role / Title}
- **Context**: {Who are they, what environment do they work in?}
- **Goal**: {What are they trying to accomplish?}
- **Pain point**: {What frustrates them today?}
- **Technical level**: {Beginner / Intermediate / Expert — in what domain?}

### Secondary User: {Role / Title} *(if applicable)*
- **Context**: {Who are they?}
- **Goal**: {What do they need from this product?}
- **Pain point**: {What frustrates them today?}
- **Technical level**: {Beginner / Intermediate / Expert — in what domain?}

---

## 4. Scope

### In Scope (v1 / MVP)
- {Capability or user story 1}
- {Capability or user story 2}
- {Capability or user story 3}

### Out of Scope
- {Explicitly excluded capability 1}
- {Explicitly excluded capability 2}
- {Explicitly excluded capability 3}
- {Deferred to v2: ...}

---

## 5. Features & Capabilities

### Core Features (MVP)

| Feature | Description |
|---|---|
| **{Feature Name}** | {What the user can do with this feature — 1–2 sentences} |
| **{Feature Name}** | {What the user can do with this feature — 1–2 sentences} |
| **{Feature Name}** | {What the user can do with this feature — 1–2 sentences} |

### Future / Stretch Features
- {Feature idea for v2 or later}
- {Feature idea for v2 or later}

---

## 6. Functional Requirements

> Format: `FR-NNN: The system shall {behavior} when {condition}.`

| ID | Requirement |
|---|---|
| FR-001 | The system shall {specific, testable behavior}. |
| FR-002 | The system shall {specific, testable behavior}. |
| FR-003 | The system shall {specific, testable behavior}. |
| FR-004 | The system shall {specific, testable behavior}. |

---

## 7. Non-Functional Requirements

### Performance
- {Response time target, throughput requirement, or "Not a constraint in v1"}

### Security
- {Auth model, data sensitivity rules, principle of least privilege constraints}

### Availability
- {Uptime target, failure behavior, or "Local tool — no SLA required"}

### Compliance
- {Regulatory or organizational requirements, or "None identified"}

---

## 8. Integrations & Dependencies

| Integration | Purpose | Version / Notes |
|---|---|---|
| {System Name} | {Why it's needed} | {Version constraints or auth method} |
| {System Name} | {Why it's needed} | {Version constraints or [TBD] if genuinely unknown} |

---

## 9. Assumptions & Constraints

### Assumptions
- {Something believed to be true that this product depends on}
- {If this assumption is wrong, the product design may need to change}

### Constraints
- {Hard limit: supported platform, delivery environment, installation model, or required integration}
- {Hard limit: what this product must NOT require}

---

## 10. User Stories

> Format: `As a **[persona from §3]**, I want **[capability]** so that **[outcome]**.`
> Each story must reference a persona defined in §3 and map to a feature from §5.

1. As a **{persona from §3}**, I want **{capability from §5}** so that **{outcome}**.
2. As a **{persona from §3}**, I want **{capability from §5}** so that **{outcome}**.
3. As a **{persona from §3}**, I want **{capability from §5}** so that **{outcome}**.

---

## 11. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| {Risk description} | High / Medium / Low | High / Medium / Low | {Specific, actionable mitigation strategy} |
| {Risk description} | High / Medium / Low | High / Medium / Low | {Specific, actionable mitigation strategy} |
| {Risk description} | High / Medium / Low | High / Medium / Low | {Specific, actionable mitigation strategy} |

---

## 12. Glossary

| Term | Definition |
|---|---|
| {Domain-specific term} | {Clear 1–2 sentence definition} |
| {Domain-specific term} | {Clear 1–2 sentence definition} |
| {Domain-specific term} | {Clear 1–2 sentence definition} |

---

*This PRD is the source of truth for **what** is being built. For **how**, see `ARCHITECTURE.md` in the project docs root.*