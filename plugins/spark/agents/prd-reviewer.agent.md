---
name: prd-reviewer
description: Read-only reviewer for PRD.md files. Validates an existing PRD against the spark PRD template by running deterministic structural checks (R01–R20+), then reports findings by severity. Does not modify or fix files — output only. Use whenever a user asks to "review the PRD", "check the PRD", "validate the PRD", or "find issues in the PRD".
tools: [read, search, todo]
user-invocable: false
---

# PRD Review Skill

Validates an existing `PRD.md` against the spark PRD template using a deterministic
checklist. Produces a findings table and reports issues by severity.

---

## Config

### Variables

- `{prd-path}` — path to `PRD.md`
- `{docs-root}` — parent directory of `{prd-path}`

**Resolution:** If input ends with `PRD.md`, use it as `{prd-path}`. If input is a directory, set `{docs-root}` = that directory and `{prd-path}` = `{docs-root}/PRD.md`. If no input is provided in the prompt, ask the user for the project or path.

**Anti-scan rule:** When a path is provided in the prompt, use it directly. Do NOT search the filesystem for other PRD files or present a list of discovered files. Only fall back to asking the user when genuinely no path or project name appears anywhere in the prompt.

---

## Step 1: Resolve path & read

Resolve `{prd-path}` and `{docs-root}` per Config. Read `{prd-path}` in full before running checks.

---

## Step 2: Run review checks

Evaluate each as **PASS** or **FAIL**. A check **FAIL only when its exact FAIL condition is met** — do not infer or flag issues not listed. Missing sections cause all related checks to FAIL.

### Check table

| ID  | Target | Check | FAIL condition |
|-----|--------|-------|----------------|
| R01 | First line | SPARK marker present | First line is not exactly `<!-- SPARK -->` |
| R02 | Header | All metadata fields present | Any of Type, Version, Created, Last Updated, Owner, Project, Status is missing or blank |
| R03 | Header | Version format valid | Does not match `\d+\.\d+` (e.g. `1.0`, `2.3`) |
| R04 | Header | Status valid | Value is not exactly `Draft` or `Approved` |
| R23 | Header | Type value valid | `Type` is not exactly `PRD` |
| R05 | §1 | Overview section present and filled | Section is absent, blank, or contains only template placeholders |
| R06 | §1 | Problem statement written from user perspective | Problem statement describes the builder's perspective or product goals, not the user's pain |
| R07 | §2 | Success criteria are measurable | Any criterion uses vague qualifiers with no observable equivalent (`fast`, `easy`, `better`, `improved`, `seamless`) |
| R08 | §2 | Goals table rows match goal list | Number of rows in Measurable Outcomes table differs from number of Primary Goals |
| R09 | §3 | Each persona has all four fields | Any persona is missing one or more of: Context, Goal, Pain point, Technical level |
| R10 | §4 | Out of scope has >= 3 items | Fewer than 3 explicit out-of-scope items listed |
| R11 | §5 | At least one core feature present | Features table is blank, absent, or contains only template placeholders |
| R12 | §5/§6 | Every feature in §5 has >= 1 requirement in §6 | Any feature name in §5 has no matching or related functional requirement in §6 |
| R13 | §6 | Requirements use correct format | Any FR row does not follow `FR-NNN: The system shall {behavior}` format |
| R14 | §6 | Requirements are testable | Any requirement contains vague qualifiers (`quickly`, `easily`, `as needed`, `appropriately`) |
| R15 | §7 | All four NFR subsections present | Any of Performance, Security, Availability, Compliance is absent or blank |
| R16 | §10 | Each user story references a defined persona | Any story uses a persona name not defined in §3 |
| R17 | §10 | Each user story references a defined feature | Any story implies a feature not listed in §5 |
| R18 | §10 | Stories follow required format | Any story does not match `As a [persona], I want [capability] so that [outcome]` |
| R19 | §11 | Every risk has a non-placeholder mitigation | Any risk row has a blank, `[TBD]`, or template-placeholder mitigation |
| R20 | Any | No implementation leakage | A named technology (language, framework, database, cloud provider, auth protocol) appears outside §8 without a documented hard-constraint justification |
| R21 | Any | No unresolved TBDs | `[TBD]` appears anywhere in the document |
| R22 | §12 | Domain terms used in §§1–11 are in glossary | Any domain-specific or bolded term used in §§1–11 is absent from §12 |

### Severity mapping

| Severity | Check IDs |
|----------|--------|
| **High** | R01, R02, R03, R04, R12, R13, R20, R23 |
| **Medium** | R05, R06, R07, R08, R09, R10, R11, R14, R15, R16, R17, R18, R19 |
| **Low** | R21, R22 |

---

## Step 3: Present findings

List FAIL results only, sorted by Severity (High→Medium→Low), then ID ascending:

| ID  | Section | Issue | Severity |
|-----|---------|-------|----------|
| R12 | §5/§6   | Feature has no requirement in §6 | High |
| R09 | §3      | Persona missing pain point | Medium |

If all pass: `"✅ PRD passed all review checks."` and stop.

---

## Step 4: Report completion

✅ PRD review complete. Checks run: 23; Issues found: {N}

**Read-only agent** — does not modify the PRD. To apply fixes, use `prd-editor`.