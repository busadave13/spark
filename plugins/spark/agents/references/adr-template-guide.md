# ADR Section Guide

Detailed guidance for each section of a well-formed ADR. Read this when the decision
involves significant trade-offs, multiple rejected alternatives, or when you need to
document a supersession clearly.

> **For AI agents**: Do not suggest alternatives to established decisions without
> referencing the relevant ADR and explaining why the recorded rejection reasons
> no longer apply.

---

## Table of Contents

1. [Title](#title)
2. [Metadata Block](#metadata-block)
3. [Context](#1-context)
4. [Decision](#2-decision)
5. [Rationale](#3-rationale)
6. [Alternatives Considered](#4-alternatives-considered)
7. [Consequences](#5-consequences)
8. [Revisit Conditions](#6-revisit-conditions)
9. [Related Decisions](#7-related-decisions)

---

## Title

Format: `# ADR-NNNN: {Plain English Decision Statement}`

The title is the decision, not the topic.

**Good:**
- `# ADR-0001: Use MCP Protocol Over REST API`
- `# ADR-0002: Restrict v1 to Read-Only Kubernetes Operations`
- `# ADR-0003: Use .NET 9 for KubeMCP Implementation`

**Bad:**
- `# ADR-0001: API Protocol` (topic, not decision)
- `# ADR-0002: Kubernetes Security` (too vague)
- `# ADR-0003: Why We Chose .NET` (conversational, not declarative)

The title is what agents scan first. It must be unambiguous enough to be a rule on its own.

---

## Metadata Block

```markdown
> **Version**: 1.0<br>
> **Created**: 2026-03-30<br>
> **Last Updated**: 2026-03-30<br>
> **Owner**: Dave<br>
> **Project**: {ProjectName}<br>
> **Status**: Draft
```

### Fields
- **Version** — `{major}.{minor}` format; new documents start at `1.0`. On each update, increment minor: `1.0` → `1.1` → … → `1.9` → `2.0` → `2.1` etc. The version is bumped exactly once after all changes to the ADR are complete — do not bump mid-edit.
- **Created** — the date the ADR was first written
- **Last Updated** — the date the ADR was last modified; update when bumping the version
- **Owner** — resolved from `git config user.name`; for team projects, the primary author
- **Project** — the project name from context
- **Status** — lifecycle state of the ADR; new ADRs start as `Draft`. Valid values: `Draft`, `Approved`. Any update to a non-Draft ADR resets Status to `Draft`. Only the user sets `Approved` manually.

---

## 1. Context

### What it contains
The situation, forces, or problem that made a decision necessary. This is the *why a
decision was needed*, not the background of the technology involved.

### Guidance
Write this from the perspective of someone who had to make the call. What were the
constraints? What was at stake? What would have happened without a deliberate decision?

**Good:**
> KubeMCP needs to expose cluster inspection tools to AI agents (GitHub Copilot,
> Claude Code). Two protocols were viable: REST API, which is well-understood and has
> broad tooling, and MCP (Model Context Protocol), which is natively supported by the
> target agent consumers. Choosing the wrong protocol would either add integration
> overhead for every AI agent consumer, or couple the project to a newer, less-proven
> standard. A deliberate choice was needed before any tool implementation began.

**Bad:**
> MCP is a protocol from Anthropic. REST is a common API style. We needed to pick one.

The bad example provides no context for *why* this decision mattered or what the stakes were.

### Anti-patterns
- Describing the technologies in general terms (Wikipedia-style)
- Omitting the constraint or forcing function
- Making it so long it needs to be skimmed

**Target length:** 3–6 sentences.

---

## 2. Decision

### What it contains
A single, unambiguous statement of what was decided.

### Guidance
This is the most important section for agent-readiness. It must be parseable as a rule.

Format: **"We will {decision}."** or **"We have decided to {decision}."**

**Good:**
> We will use the MCP protocol exclusively for all tool exposure in KubeMCP v1.
> REST endpoints will not be implemented in this version.

**Bad:**
> We think MCP is probably the better choice for our use case given the current
> ecosystem and the tools we're building for.

The bad example hedges. An agent reading it might decide "well, REST is fine then."

### Anti-patterns
- Hedging language ("probably", "might", "we think")
- Compound decisions (two decisions in one ADR — split them)
- Describing the implementation instead of the decision ("We will use `ModelContextProtocol.SDK`")

**Target length:** 1–3 sentences maximum.

---

## 3. Rationale

### What it contains
Why this option was chosen over the alternatives. Should reference the context directly.

### Guidance
Link the rationale back to the constraints in the context section. "We chose X because
of the constraints described above" is weak — be specific.

**Good:**
> MCP is the native integration protocol for both GitHub Copilot and Claude Code, the
> two primary agent consumers identified in the PRD. Using MCP means zero custom
> wrapper code for each agent consumer — tools are discovered and typed automatically
> via the MCP tool manifest. REST would require each agent to implement its own HTTP
> client, schema parsing, and error handling, multiplying integration effort with each
> new consumer. The MCP SDK for .NET (`ModelContextProtocol`) is production-ready and
> actively maintained as of March 2026.

**Bad:**
> MCP is better for AI. It's newer and more purpose-built for this use case.

### Anti-patterns
- Rationale that doesn't reference the context constraints
- Listing only benefits (every choice has trade-offs — those go in Consequences)
- Circular reasoning ("We chose MCP because MCP is good")

**Target length:** 3–6 sentences.

---

## 4. Alternatives Considered

### What it contains
Other options that were evaluated and the specific reason each was rejected.

### Guidance
This section does the most work for agents. An agent that doesn't see this section may
propose the rejected alternative thinking it was never evaluated.

Format per alternative:
```
### {Technology or Approach Name}
**Why rejected:** {Specific reason — not "it wasn't as good"}
```

**Good:**
```
### REST API
**Why rejected:** Every AI agent consumer would need to implement a custom HTTP client
and schema parser. With 2+ agent consumers planned, this multiplies integration effort
and creates per-consumer maintenance burden. REST also lacks the native tool-discovery
mechanism that MCP provides.

### GraphQL
**Why rejected:** Overkill for the read-heavy, tool-invocation pattern KubeMCP uses.
GraphQL's query flexibility is a liability here — tools need fixed signatures for AI
agents to invoke reliably. Adds schema complexity with no benefit for this domain.
```

**Bad:**
```
- REST: not suitable
- GraphQL: too complex
```

The bad examples give agents nothing to work with. They'll see "REST: not suitable" and
think "not suitable for what? Maybe it's suitable for my use case."

### How many alternatives?
- Minimum: 1 (if there was really only one alternative)
- Typical: 2–3
- More than 4 usually means the decision wasn't scoped tightly enough

### Anti-patterns
- Listing alternatives without rejection reasons
- "We didn't evaluate this" — if you didn't evaluate it, don't list it
- Strawman alternatives (options that were never realistic)

---

## 5. Consequences

### What it contains
What this decision enables, what it prevents, and what trade-offs were accepted.

### Guidance
Split into positive consequences and trade-offs. **Never write only positive
consequences** — every real architectural decision has a cost. An ADR with no
trade-offs signals that the decision wasn't thought through.

**Good:**
```
### Positive Consequences
- Zero custom integration code required for Copilot and Claude Code consumers
- Tool signatures are typed and discoverable — reduces prompt engineering burden
- Aligns with the MCP ecosystem trajectory — likely to get better tooling over time

### Trade-offs Accepted
- Non-agent consumers (curl, Postman, custom scripts) cannot use the API in v1
- Coupled to MCP spec evolution — breaking changes in the spec require updates
- Smaller ecosystem than REST — fewer reference implementations to draw from
- REST consumers must wait for v2 if demand emerges
```

**Bad:**
```
- MCP is a good choice that will serve us well
- Makes development easier
```

### Anti-patterns
- Only listing positive consequences
- Consequences that are really rationale ("MCP has native agent support" — that's why
  you chose it, not a consequence of the choice)
- Vague trade-offs ("some things will be harder")

---

## 6. Revisit Conditions

### What it contains
The specific conditions under which this decision should be re-evaluated. Acts as a
trigger list so future contributors know when the recorded rejection reasons may no
longer hold.

### Guidance
Be concrete. Vague triggers like "if requirements change" provide no signal.
Anchor each condition to something observable: a library reaching GA, a metric
crossing a threshold, a new consumer type appearing, a deprecated API being removed.

**Good:**
```markdown
- The MCP spec adds a stable streaming transport, removing the current need to fall
  back to long-polling for large responses.
- A second non-AI consumer (e.g. a CI pipeline) needs to call these tools — REST may
  be cheaper to add than to wrap MCP.
- p95 tool-invocation latency exceeds 500ms, which the current MCP transport cannot
  improve without a protocol change.
```

**Bad:**
```markdown
- If something changes
- If we get more users
- If performance is bad
```

### Anti-patterns
- Catch-all conditions ("if anything changes")
- Conditions that are really nice-to-haves ("if a better library appears")
- Listing the original rationale negated ("if MCP is no longer good") — restate the
  *observable* signal that would make the rationale fail

This section is optional — omit it if no realistic trigger exists.

**Target length:** 2–4 bullets.

---

## 7. Related Decisions

### What it contains
Links to other ADRs that this decision depends on, enables, or constrains.

### Guidance
Use this to build a decision graph. Agents following one ADR can discover related
constraints they need to respect.

```markdown
## 7. Related Decisions

- [ADR-0002: Read-Only Operations in v1](ADR-0002-read-only-operations-v1.md) —
  constrains which MCP tools are implementable
- [ADR-0004: No Cluster-Side Installation](ADR-0004-no-cluster-side-installation.md) —
  reinforces the client-only architecture this protocol choice enables
```

This section is optional — omit it if there are no meaningful relationships.