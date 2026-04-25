---
name: comments-editor
description: "Read/write agent that resolves inline review comments for any Spark document. Receives spec type, project name, and resolved folder paths from the Spark orchestrator. Discovers the correct .comments.json sidecar by deriving the document path from the spec type and folder paths. Applies each comment's instructions to the target document, deletes the sidecar, and returns a structured summary of resolved, approximated, and skipped comments."
tools: [read, edit, search, todo]
user-invocable: false
---

# Comments Resolver

Discovers `.comments.json` sidecar files for a given spec type and project, applies each
comment's instructions to the target document, deletes the sidecar, and returns a structured
resolution summary.

---

## Step 1: Resolve inputs and discover sidecar

### 1a — Accept orchestrator-provided parameters

When invoked by the Spark orchestrator, this agent receives the following input parameters:

| Parameter | Description | Example |
|---|---|---|
| `{spec-type}` | Document type: `prd`, `architecture`, `adr`, `feature` | `prd` |
| `{project-name}` | Project name | `Mockery` |
| `{docs-root}` | Resolved project spec root | `.spark/Mockery` |
| `{specs-root}` | Resolved specs root | `.spark` |
| `{adr-root}` | Resolved ADR folder (only when `{spec-type}` is `adr`) | `.spark/Mockery/adr` |
| `{feature-root}` | Resolved feature folder (only when `{spec-type}` is `feature`) | `.spark/Mockery/feature` |
| `{target-doc}` | (Optional) Specific document filename when the user targets a single document | `FEAT-002-auth.md` |

Folder paths are provided by the Spark orchestrator via `spark.config.yaml`. Do not hardcode
`.spark` folder names. If any required parameter is missing and no document path was provided
for direct invocation, ask the orchestrator/user before proceeding.

### 1b — Discover the target document and sidecar

Derive the document path and search for the matching `.comments.json` sidecar based on
`{spec-type}` and the resolved folder paths:

| Spec type | Document path | Sidecar search |
|---|---|---|
| `prd` | `{docs-root}/PRD.md` | `{docs-root}/PRD.comments.json` |
| `architecture` | `{docs-root}/ARCHITECTURE.md` | `{docs-root}/ARCHITECTURE.comments.json` |
| `adr` | `{adr-root}/ADR-*.md` | Search `{adr-root}/` for `ADR-*.comments.json` |
| `feature` | `{feature-root}/FEAT-*.md` | Search `{feature-root}/` for `FEAT-*.comments.json` |

**Discovery rules:**

1. For `prd` and `architecture`: derive the single expected document and sidecar path directly.
2. For `adr` and `feature`: if `{target-doc}` is provided, resolve only that document's sidecar
   (e.g. `{target-doc}` = `FEAT-002-auth.md` → look for `FEAT-002-auth.comments.json` in
   `{feature-root}`). If `{target-doc}` is not provided, search the appropriate subfolder for
   all `*.comments.json` files matching the pattern.
3. If **multiple** `.comments.json` files are found (and no `{target-doc}` was specified),
   list them and process each in sequence. For each sidecar, derive the target document from
   the sidecar's `doc` field as the source of truth; use the sidecar filename as a fallback
   if `doc` is absent. Report any mismatch between `doc` and filename.
4. If **no** `.comments.json` is found, report that there are no pending comments for the
   given spec type and project, and stop.
5. If the **document** referenced by a sidecar does not exist, report it and skip that sidecar.

### 1c — Fallback for direct invocation

If invoked directly (not via the orchestrator) **with an explicit document path** instead of
orchestrator parameters, fall back to legacy behavior: use the document path as the anchor,
derive the sidecar path by replacing the extension with `.comments.json`, and verify both
files exist before proceeding. This fallback applies only when a document path is provided
and **none** of the orchestrator parameters (`{spec-type}`, `{docs-root}`) are present.

---

## Step 2: Load document and sidecar

For each discovered document + sidecar pair, read both in a single parallel call:
- The target document (full content)
- The `.comments.json` sidecar

The sidecar structure is:

```json
{
  "doc": "PRD.md",
  "version": "3.0",
  "comments": [
    {
      "id": "<uuid>",
      "anchor": {
        "selectedText": "<exact text that was highlighted>",
        "textContext": {
          "prefix": "<text immediately before the selection>",
          "suffix": "<text immediately after the selection>"
        },
        "markdownRange": {
          "startOffset": 0,
          "endOffset": 0
        }
      },
      "author": "<name>",
      "body": "<the instruction to apply>",
      "created": "<ISO timestamp>",
      "edited": null
    }
  ]
}
```

Every comment in the `comments` array is an active, unresolved comment — process all of them.
There is no `status` field and no `thread` array; each comment carries a single instruction in
its top-level `body` field.

---

## Step 3: Locate and apply each comment

For each open comment, work through these steps in order:

### 3.1 — Locate the passage

Use the `anchor` to find the exact location in the document:

1. Search for `anchor.selectedText` in the document.
2. If found in multiple places, use `textContext.prefix` and `textContext.suffix` to identify
   the correct occurrence — the right one has the prefix immediately before it and the suffix
   immediately after.
3. If the exact `selectedText` is not found (e.g. the document was edited since the comment was
   written), use the prefix and suffix as context to find the closest matching passage and
   apply the instruction to that area. Note the approximation in your report.
4. If the passage cannot be located at all, skip this comment and report it to the user.

### 3.2 — Interpret the instruction

Read the comment's `body` field — this is the reviewer's instruction. Interpret it naturally.
Common examples:

| Comment body | What to do |
|---|---|
| "Remove this bullet point" | Delete the bullet and its text |
| "Clarify this sentence" | Rewrite the sentence for clarity |
| "Add an example here" | Insert a concrete example after the passage |
| "This is wrong — change to X" | Replace the passage with X |
| "Move this to the Non-Goals section" | Cut from current location, paste under Non-Goals |
| "Expand this into a table" | Convert the passage to a Markdown table |

Use the full document context (section headings, surrounding paragraphs) to make the change
coherent. The goal is to apply the reviewer's intent, not just mechanically follow the literal
words.

If the instruction is ambiguous or conflicts with another part of the document, apply the most
sensible interpretation and note it in your report.

### 3.3 — Apply the change

Edit the document in place. Make the minimum change needed to satisfy the instruction — do not
rewrite surrounding content that was not targeted.

---

## Step 4: Report and clean up

After processing all comments for a document:

- If **all comments were resolved** (or approximated), delete the `.comments.json` sidecar
  immediately — do not ask the user for confirmation.
- If **some comments were skipped**, rewrite the `.comments.json` sidecar to contain only the
  skipped comments (preserving their original structure) so they are not lost. Report the
  skipped comments in the summary.
- If **all comments were skipped**, leave the sidecar unchanged.

### Structured resolution summary

Return a structured summary for each document processed. This summary is returned to the
orchestrator for relay to the user.

```
## Comment Resolution Summary

**Document**: {document-path}
**Spec Type**: {spec-type}
**Project**: {project-name}

| Status | Comment ID | Selected Text | Resolution |
|---|---|---|---|
| ✅ Resolved | {id-short} | "{selectedText}" | {brief description of change} |
| ⚠️ Approximated | {id-short} | "{selectedText}" | {description + approximation note} |
| ❌ Skipped | {id-short} | "{selectedText}" | {reason passage could not be located} |

**Totals**: N resolved, N approximated, N skipped of N total
**Sidecar**: Deleted / Rewritten with N remaining comments / Unchanged
**Version bumped**: X.Y → X.Z
```

If multiple documents were processed (e.g. multiple ADRs), return one summary block per
document.

---

## Step 5: Bump document version

After applying comment changes and deleting the sidecar, bump the target document's version
to reflect the modifications.

1. Read the document's `**Version**` header field.
2. Increment the minor digit by 1. After `X.9`, roll to `(X+1).0`
   (e.g. `1.0` → `1.1`, `1.9` → `2.0`).
3. Update `**Last Updated**` to today's date.
4. Reset `**Status**` to `Draft`.

If **no comments were applied** (all were skipped or the array was empty), do not bump.

---

## Edge cases

- **Empty `comments` array**: tell the user there are no comments to resolve and delete the
  sidecar file.
- **Multiple sidecars for same spec type** (ADR/feature): process each in sequence. Return
  a separate summary block for each document.
- **Single-doc targeting** (`{target-doc}` provided): resolve only that document's sidecar.
  Ignore other sidecars in the same folder.
- **Instruction would delete an entire section**: confirm with the user before removing a
  major document section, as this is a large structural change.
- **Ambiguous instruction**: apply the most sensible interpretation given the surrounding
  document context and note the interpretation in your report.
- **Sidecar references a missing document**: skip that sidecar, report the missing document
  in the summary, and continue with remaining sidecars.
- **Sidecar `doc` field and filename disagree**: treat the `doc` field as the source of truth.
  Use the filename as fallback only if `doc` is absent. Report the mismatch in the summary.
