---
name: architecture-reviewer
description: Read-only reviewer for ARCHITECTURE.md files. Validates an existing architecture doc against the spark architecture template by running deterministic structural checks (A01–A30), then reports findings by severity. Does not modify or fix files — output only. Use whenever a user asks to "review the architecture", "check ARCHITECTURE.md", "validate the architecture doc", or "find issues in the architecture".
tools: [read, search, todo]
user-invocable: false
---

# Architecture Review Skill

Validates an existing `ARCHITECTURE.md` against the spark architecture template using
a deterministic checklist. Produces a findings table and reports issues by severity.

This skill reviews `ARCHITECTURE.md` only. To review ADRs, use `adr-reviewer`.

---

## Step 1: Resolve path

Accept a path to `ARCHITECTURE.md` or a docs root directory.

- If the path ends with `ARCHITECTURE.md`, that file is `{arch-path}` and `{docs-root}` is its parent directory.
- If the path is a directory, `{docs-root}` = that directory and `{arch-path}` = `{docs-root}/ARCHITECTURE.md`.
- If no path is given, ask the user which project to review, then use the provided `{architecture-root}` folder path or ask the user for the ARCHITECTURE.md location. Set `{arch-path}` = `{docs-root}/ARCHITECTURE.md`.

In a single parallel call, read:
- `{arch-path}` in full
- `{docs-root}/PRD.md` metadata block and §5 features only (read-only reference context)
- scan `{docs-root}/adr/` for `ADR-*.md` filenames only (needed for Decision Log count check — do not read their contents)

---

## Step 2: Run review checks

Evaluate each check as **PASS** or **FAIL**.

A check is **FAIL only when its exact FAIL condition is met**. Do not infer, extrapolate,
or flag issues not listed. If a section is genuinely absent from the document, every
check targeting that section is FAIL.

**Mandatory procedure for enumeration checks (A02, A20):** Before marking PASS, list
every required field/item by name and verify each one is present in the document.
Do not infer presence from the fields you happen to see — explicitly check the full
required set against what exists. A missing field is a FAIL, not an oversight.

For A02, the required metadata fields are exactly: `Type`, `Version`, `Created`,
`Last Updated`, `Owner`, `Namespace`, `Project`, `Project Type`, `Status`. All nine
must be present and non-blank for A02 to PASS. If A02 fails because `Project Type`
is missing, A30 also fails (a missing field cannot have a valid value). If A02 fails
because `Type` is missing, A31 also fails.

### Check table

| ID  | Target | Check | FAIL condition |
|-----|--------|-------|----------------|
| A01 | First line | SPARK marker present | First line is not exactly `<!-- SPARK -->` |
| A02 | Header | All metadata fields present | Any of Type, Version, Created, Last Updated, Owner, Namespace, Project, Project Type, Status is missing or blank |
| A03 | Header | Version format valid | Does not match `\d+\.\d+` (e.g. `1.0`, `2.3`) — three-part versions like `1.0.0` are non-conforming |
| A04 | Header | Status valid | Value is not exactly `Draft` or `Approved` |
| A05 | North Star | North Star paragraph present as blockquote | Opening blockquote is absent, blank, or contains only template placeholders |
| A06 | North Star | North Star answers what / who / problem | Paragraph does not address all three: what the system does, who uses it, what problem it solves |
| A07 | Principles | At least 3 architecture principles | Fewer than 3 numbered, named principles present |
| A08 | System Overview | Component Map mermaid diagram present | No `graph LR` mermaid block present in System Overview |
| A09 | System Overview | Component table present and filled | Component table is absent or contains only template placeholders |
| A10 | Layers & Boundaries | Layers mermaid diagram present | No `graph TB` mermaid block present in Layers & Boundaries |
| A11 | Layers & Boundaries | At least 2 hard dependency rules stated | Fewer than 2 explicit dependency rules listed under the diagram |
| A12 | Key Architectural Decisions | At least 2 decisions with ADR links | Fewer than 2 decision entries, or any entry lacks a relative link to an ADR file |
| A13 | Primary Data Flow | Happy path numbered steps present | No numbered step list present in Primary Data Flow |
| A14 | Primary Data Flow | Sequence diagram present | No `sequenceDiagram` mermaid block present |
| A15 | Primary Data Flow | At least 1 error path documented | No error path listed under Key error paths |
| A16 | External Dependencies | Table present and filled | Table is absent, has zero data rows, or contains only template placeholders |
| A17 | External Dependencies | Every row has failure behavior | Any row has blank or placeholder failure behavior |
| A18 | Configuration Reference | Table present and filled | Table is absent, has zero data rows, or contains only template placeholders |
| A19 | Security & Trust Boundary | Section present unless system is internal read-only | Section is absent and the system has write operations, external callers, or sensitive data |
| A20 | Observability | All four observability fields present | Any of Logging, Metrics, Tracing, Health endpoint is absent or blank |
| A21 | Infrastructure & Deployment | Environments table present | Table is absent or has zero data rows |
| A22 | Non-Goals & Known Constraints | At least 2 non-goals listed | Fewer than 2 explicit non-goals with rationale |
| A23 | Non-Goals & Known Constraints | At least 2 limitations listed | Fewer than 2 explicit limitations with tradeoff reasoning |
| A24 | Decision Log | One row per ADR file found in adr/ | Number of rows in Decision Log differs from number of `ADR-*.md` files found in `{docs-root}/adr/` |
| A25 | Decision Log | All ADR links use relative paths | Any ADR link is absolute or malformed |
| A26 | Related Documents | PRD.md linked | `PRD.md` link absent from Related Documents |
| A27 | Any | No implementation detail in non-implementation sections | Technology choice (language, framework, database, cloud provider, auth protocol) appears outside System Overview, Component table, or Config Reference without a documented hard-constraint justification |
| A28 | Any | No unresolved TBDs | `[TBD]` appears anywhere in the document |
| A29 | Glossary | At least 1 glossary entry | Glossary table is absent or has zero data rows |
| A30 | Header | Project Type valid | `**Project Type**` value is not exactly `dotnet-webapi` |
| A31 | Header | Type value valid | `**Type**` value is not exactly `ARCHITECTURE` |

### Severity mapping

Apply these mechanically — do not override based on document context.

| Severity | Check IDs |
|----------|-----------|
| **High** | A01, A02, A03, A04, A08, A10, A12, A14, A24, A27, A30, A31 |
| **Medium** | A05, A06, A07, A09, A11, A13, A15, A16, A17, A18, A19, A20, A21, A22, A23, A25, A26 |
| **Low** | A28, A29 |

---

## Step 3: Present findings

List only FAIL results, sorted by Severity (High first), then by ID ascending within each group.

```
| ID  | Section                     | Issue                                            | Severity |
|-----|-----------------------------|--------------------------------------------------|----------|
| A12 | Key Architectural Decisions | Decision "Auth strategy" missing ADR link        | High     |
| A07 | Architecture Principles     | Only 2 principles present; minimum is 3          | Medium   |
```

If all checks pass, report: `"✅ ARCHITECTURE.md passed all review checks."` and stop.

---

## Step 4: Report completion

```
✅ Architecture review complete.

- Checks run: 31
- Issues found: {N}
```

This agent is read-only. It does not apply fixes or modify the architecture document.
To apply fixes, use `architecture-editor`.
