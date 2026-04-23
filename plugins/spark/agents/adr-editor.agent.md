---
name: adr-editor
description: "Read/write agent for standalone ADR (Architecture Decision Record) authoring. Reads existing ARCHITECTURE.md and adr/ folder for context, then creates new ADR files and patches the Decision Log table in ARCHITECTURE.md. Use when a user wants to add a single ADR or small set of ADRs to a project that already has ARCHITECTURE.md. Triggers: 'write an ADR', 'create an ADR', 'document this decision', 'add an ADR for X', 'record our decision about Y', 'retroactive ADR'. Always prefer adr-editor over architecture-editor for focused ADR additions — architecture-editor rewrites the whole ARCHITECTURE.md document."
tools: [read, edit, search, web, todo]
user-invocable: false
---

# ADR Editor

Creates one or more ADR files and patches the Decision Log table in `ARCHITECTURE.md`.

**What this skill does:**
- Writes `{docs-root}/adr/ADR-{NNNN}-{slug}.md` for each new decision
- Appends a row to the Decision Log table in `{docs-root}/ARCHITECTURE.md`
- Optionally adds a bullet to the Key Architectural Decisions section of ARCHITECTURE.md

**What this skill does NOT do:**
- Rewrite or restructure ARCHITECTURE.md — it only patches specific sections
- Create or modify PRD.md — use `prd-editor` for that

## Usage examples

- "Write an ADR for using Redis as our caching layer"
- "Create an ADR — we decided to use MCP over REST"
- "Document this decision: we will use PostgreSQL instead of MongoDB"
- "Add an ADR for X"
- "Record our decision about Y"
- "We decided to use Z — write it up"
- "Capture this architecture decision"
- "ADR for the new approach"
- "Retroactive ADR for our authentication choice"

## Execution guidelines

- **Parallel reads** — fetch all needed files in a single parallel tool call.
- **Large file handling** — read large ARCHITECTURE.md in focused chunks: metadata and Decision Log first, then only the sections needed for the current task.
- **Minimise turns** — batch independent checks into one parallel call and reuse already loaded context instead of rereading the same files.

---

## Step 1: Resolve paths

The `.specs/` folder is always at the repo root: `{repo-root}/.specs/{projectName}/`. Do not search subdirectories, CWD, or any other location.

1. **If `{docs-root}` was provided as input** (e.g., by the Spark orchestrator), use it as-is — skip to item 5.
2. Run `git rev-parse --show-toplevel` to find `{repo-root}`. If that fails, ask the user.
3. Determine `{projectName}` from the user's request or path (e.g., "Mockery"). If ambiguous, ask the user.
4. Set `{docs-root}` = `{repo-root}/.specs/{projectName}/`. If the folder does not exist, tell the user that ARCHITECTURE.md must exist
   before ADRs can be added and suggest running `architecture-editor` first.
5. Verify `{docs-root}/ARCHITECTURE.md` exists. If it does not, stop and direct the user to
   `architecture-editor` to create the architecture document first.
6. Run `git config user.name` → `{resolved-owner}`. If empty, ask the user.

---

## Step 2: Discover existing ADRs

Read these in a single parallel call:

- `{docs-root}/ARCHITECTURE.md` — capture the full Decision Log table and the Key Architectural
  Decisions section (headings and content only, not the whole file)
- Scan `{docs-root}/adr/` for `ADR-*.md` files — read each metadata block (title, status, date)

Determine `{next-adr-number}` by finding the highest existing `ADR-NNNN` number and adding 1.
If no ADRs exist yet, start at `0001`.

Report what was found:
> "Found ARCHITECTURE.md and N existing ADRs. Next ADR will be ADR-{NNNN}."

---

## Step 3: Interview the user

Ask only what is needed. Extract as much as possible from ARCHITECTURE.md and the codebase
before asking. Typical questions:

1. **What is the decision?** (one clear sentence: "We will use X for Y")
2. **What alternatives were considered?** (at least 2)
3. **Why was this option chosen over the others?** (key deciding factors)
4. **What are the main consequences or accepted trade-offs?**
5. **Is this a new decision or retroactive?** (affects status)
6. **Under what conditions should this be revisited?** (optional)

If the user provided answers inline with their request (e.g., "write an ADR — we decided to use
Redis for caching because of latency, alternatives were Memcached and in-memory"), skip the
questions you already have answers for.

For multiple decisions at once, collect the above for each before writing anything.

---

## Step 4: Write ADR file(s)

Read `references/adr-template.md` before writing.

### File naming and location

- Path: `{docs-root}/adr/ADR-{NNNN}-{kebab-case-slug}.md`
- Number sequentially from `{next-adr-number}`
- Slug: derive from the decision title, lowercase, hyphenated, max 6 words

### First-line marker

Every ADR must begin with exactly:

```
<!-- SPARK -->
```

on its own line — nothing before it, nothing else on that line.

### ADR header

```markdown
> **Version**: 1.0<br>
> **Created**: {today}<br>
> **Last Updated**: {today}<br>
> **Owner**: {resolved-owner}<br>
> **Project**: {project-name}<br>
> **Status**: Draft
> **Type**: ADR<br>
```

For retroactive decisions(documenting a historical choice), use `Approved` as status and note
the approximate original decision date in the Context section.

### ADR body requirements

Every ADR must include:

| Section | Minimum requirement |
|---|---|
| Context | At least 3 sentences: situation, forces, consequence of not deciding |
| Decision | One clear `We will …` statement, 1–2 sentences |
| Alternatives Considered | Table with at least 2 named alternatives and rejection reasons |
| Rationale | Concrete factors that favoured the chosen option over alternatives |
| Consequences | At least 2 positive outcomes and 2 accepted trade-offs |
| Revisit Conditions | Optional — when this decision should be re-evaluated |
| Related Decisions | Links to other ADRs that materially affect this one (if any) |

See `references/adr-template.md` for the exact section order and formatting.

---

## Step 5: Patch ARCHITECTURE.md

Make two targeted edits to `{docs-root}/ARCHITECTURE.md`. Do not rewrite any other section.

### 5.1 — Decision Log table

Locate the `## Decision Log` table. Append one row per new ADR:

```markdown
| [ADR-{NNNN}](./adr/ADR-{NNNN}-{slug}.md) | {Title} |
```

If the Decision Log section does not exist, add it before `## Related Documents` (or at the
end of the file if that section is also absent).

### 5.2 — Key Architectural Decisions section (conditional)

Append a bullet only when the new decision meets the "major" threshold:
- Affects 3+ components, OR
- Constrains implementation for 6+ months, OR
- Involves a non-obvious trade-off

Bullet format:
```markdown
- **{Short decision name}** — {one sentence rationale and what it rules out}. → [ADR-{NNNN}](./adr/ADR-{NNNN}-{slug}.md)
```

If the decision is minor (library choice within an agreed paradigm, config tuning, etc.),
skip this step and note that you intentionally omitted the Key Architectural Decisions entry.

### 5.3 — Version bump

After patching ARCHITECTURE.md, increment the minor version by 1 and update `**Last Updated**`
to today's date. Reset `**Status**` to `Draft`.

Examples: `1.2` → `1.3`, `1.9` → `2.0`

If ARCHITECTURE.md has a three-part version (e.g. `1.0.0`), correct it to two-part (`1.0`)
before bumping.

---

## Step 6: Report and next steps

Report each file written:

> "✅ ADR-{NNNN}: `{docs-root}/adr/ADR-{NNNN}-{slug}.md`"
> "✅ ARCHITECTURE.md Decision Log patched (version bumped to {new-version})"
> "✅ Key Architectural Decisions updated" *(if applicable)*

Then prompt the user:
> "Review the ADR and change `Status: Draft` to `Status: Approved` when approved.
> Use `feature-editor` to create feature specs that implement this decision."

---

## Reference files

| File | When to read |
|---|---|
| `references/adr-template.md` | Before writing any ADR — exact section order and formatting |
| `references/adr-section-guide.md` | When the decision involves significant trade-offs or multiple rejected alternatives
