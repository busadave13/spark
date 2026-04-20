# PRD Section Guide

Detailed guidance for each section of a well-formed PRD. Read this when generating a PRD
for an unfamiliar domain or when the user's project has nuanced requirements.

## Header / Metadata Block

### What it contains
- **Version** — document version in `{major}.{minor}` format; new documents start at `1.0` and increment the minor version on each update
- **Created** — the date the PRD was first written
- **Last Updated** — the date the PRD was last modified
- **Owner** — resolved from `git config user.name`; for team projects, the primary author
- **Project** — the project name from context
- **Status** — lifecycle state of the PRD; new PRDs start as `Draft`. Valid values: `Draft`, `Approved`. Any update to a non-Draft PRD resets Status to `Draft`

### Guidance
The header block appears at the very top of the document as a blockquote. All fields are
required. The Status field enables review workflows — a PRD starts in `Draft` and moves
to `Approved` when stakeholders sign off. Any subsequent edit resets it to `Draft` for
re-approval.

---

## 1. Overview

### What it contains
- **Product Name** — official name used throughout all docs
- **Tagline** — one sentence: what it does for whom
- **Problem Statement** — the "before" state; why this needs to exist
- **Solution Summary** — the "after" state; what this product does at a high level

### Guidance
The problem statement is the most important part of the PRD. It should describe the
world *without* the product — the friction, inefficiency, or gap that exists today.
A good problem statement makes the solution feel inevitable.

**Good:**
> Kubernetes operators must manually inspect pod logs, events, and resource states
> across multiple CLI commands to diagnose cluster issues. There is no single tool that
> provides a natural-language interface to cluster debugging, forcing operators to
> context-switch between kubectl, Lens, and documentation continuously.

**Bad:**
> There is no MCP server for Kubernetes.

### Anti-patterns
- Starting with the solution ("We will build...")
- Being so vague it could describe any product ("Users need better tooling")

### Agent-readiness tip
The solution summary becomes the system prompt preamble for Copilot/Claude Code.
Write it as a single, dense paragraph that can stand alone as context.

---

## 2. Goals & Success Criteria

### What it contains
- **Primary Goals** — 3–5 high-level things the product must achieve
- **Measurable Outcomes** — how you'll know the goals were met

### Guidance
Goals operate at the product level. Success criteria operate at the outcome level.
Every goal should map to at least one criterion.

**Good:**
| Goal | Success Criterion |
|---|---|
| Reduce time to diagnose cluster issues | Operator resolves common issues 60% faster than via kubectl alone |
| Support non-expert operators | Junior devs can diagnose pod failures without senior assistance |
| Integrate with AI agents | All tools callable via MCP protocol with no custom wrappers |

**Bad:**
- "Make Kubernetes easier" (not measurable)
- "Users should enjoy using it" (not observable)

### Anti-patterns
- Goals that are really features ("The product will support RBAC")
- Success criteria that can't be measured without a data team on day one

---

## 3. Users & Personas

### What it contains
- **Primary Users** — who uses this most, what they're trying to do, what frustrates them
- **Secondary Users** — who else touches it (admins, consumers of output, etc.)

### Guidance
A persona is not just a role. It needs goals and pain points to be useful to an AI agent.

**Good:**
```
### Platform Engineer (Primary)
- **Context**: Manages 3–10 AKS clusters across dev/staging/prod environments
- **Goal**: Quickly identify and resolve infrastructure issues without manual kubectl gymnastics
- **Pain point**: Spends 30–45 min per incident correlating logs, events, and resource state
- **Technical level**: Comfortable with Kubernetes internals; not a developer
```

**Bad:**
```
- DevOps engineers
- Developers
```

### Anti-patterns
- Listing roles without context or pain points
- Inventing personas that don't reflect real users

---

## 4. Scope

### What it contains
- **In Scope** — what this version of the product will do
- **Out of Scope** — what it will explicitly NOT do

### Guidance
Out of scope is as important as in scope. AI agents interpret silence as permission.
If you don't say "no write operations to production clusters", an agent might implement them.

**Good out-of-scope examples:**
- "Mutating or deleting Kubernetes resources (read-only in v1)"
- "Multi-cloud support (AWS EKS, GCP GKE) — AKS only in v1"
- "A GUI or dashboard — CLI/agent interface only"
- "Authentication management — assumes kubeconfig is pre-configured"

**Scoping by version** (recommended for phased projects):
```
### v1 Scope (MVP)
- Read-only cluster inspection tools
- Pod logs, events, resource state
- MCP protocol exposure

### v2 Scope (Post-MVP)
- Controlled write operations with confirmation gates
- Multi-cluster support
```

### Anti-patterns
- Empty out-of-scope section (always add at least 3 items)
- Putting implementation details in scope ("We will use gRPC")

---

## 5. Features & Capabilities

### What it contains
- **Core Features (MVP)** — what must ship for v1 to be useful
- **Future / Stretch Features** — desirable but not blocking

### Guidance
Features are user-facing capabilities, not technical components. Each feature should
answer: "What can the user do with this?"

**Good:**
```
### Core Features (MVP)
- **Pod Inspector**: View pod status, restart count, resource usage, and recent events
  for any pod in any namespace
- **Log Streamer**: Retrieve and filter logs from any container with time-window support
- **Natural Language Query**: Ask questions in plain English; the tool maps to the
  appropriate kubectl commands internally
```

**Bad:**
- "Kubernetes integration" (too vague)
- "Backend API" (not user-facing)
- "Database" (implementation detail)

### Anti-patterns
- Features that are really implementation tasks ("Set up CI/CD")
- No distinction between MVP and future features

---

## 6. Functional Requirements

### What it contains
Numbered list of specific, testable behaviors the product must exhibit.

### Guidance
Functional requirements are the bridge between features and implementation. They should
be specific enough to generate acceptance tests from.

Format: `FR-{number}: The system shall {observable behavior} when {condition}.`

**Good:**
```
FR-001: The system shall return pod logs within 3 seconds for log windows up to 1 hour.
FR-002: The system shall display a human-readable error when a requested resource does not exist.
FR-003: The system shall require explicit confirmation before executing any write operation.
FR-004: The system shall expose all capabilities as MCP tool definitions with typed parameters.
```

**Bad:**
- "The app should be fast" (not measurable)
- "Users can see logs" (not specific enough)

### Anti-patterns
- Requirements that can't be tested
- Using "should" instead of "shall" (ambiguous obligation level)

---

## 7. Non-Functional Requirements

### What it contains
Quality attributes: performance, security, reliability, scalability, compliance.

### Guidance
Only include NFRs that are actually constraints — don't pad with generic boilerplate.
If performance doesn't matter for v1, say so explicitly.

**Categories to consider:**

**Performance** — Response time targets, throughput requirements

**Security** — Auth model, data sensitivity, principle of least privilege

**Availability** — Uptime target, failure behavior

**Compliance** — SOC2, HIPAA, GDPR (only if applicable)

**Example:**
```
### Performance
- All read operations must respond within 5 seconds under normal cluster load

### Security
- Never log or return Kubernetes secret values; redact automatically
- Respect kubeconfig RBAC — surface permission errors clearly to the user

### Availability
- Designed as a local CLI tool — no uptime SLA required in v1
```

---

## 8. Integrations & Dependencies

### What it contains
External systems, APIs, auth providers, databases, and infrastructure this product
connects to or depends on.

### Guidance
Be specific. "Kubernetes" is not enough — which distribution, version range, auth method?

**Good:**
```
| Integration | Purpose | Notes |
|---|---|---|
| Kubernetes API Server | Core data source | Supports AKS 1.28+; kubeconfig auth |
| MCP Protocol (Anthropic) | Tool exposure to AI agents | v2025-03 spec |
| Azure AD | Identity (future) | Not required for v1 |
```

**Bad:**
- "Cloud infrastructure" (too vague)
- Listing the language runtime as an integration

---

## 9. Assumptions & Constraints

### What it contains
- **Assumptions** — things believed to be true that the product depends on
- **Constraints** — hard limits the product must work within

### Guidance
Assumptions are risk items — listing them explicitly invites early challenge.
Constraints should stay at the product level. Describe externally visible limits such as
supported platforms, installation model, required integrations, or forbidden dependencies.
Do not smuggle implementation choices into this section unless they are true business constraints.

**Good:**
```
### Assumptions
- Users have valid kubeconfig files with sufficient RBAC permissions
- AI agent consumers will use the MCP protocol (not raw REST)

### Constraints
- Must run on macOS, Linux, and WSL2 (Windows native not required)
- Cannot require cluster-side installation (no CRDs, operators, or sidecars)
```

### Anti-patterns
- Hiding major assumptions instead of writing them explicitly
- Listing implementation decisions as constraints (`Must use .NET 10`, `Deploy on Kubernetes`) when they are not business requirements

---

## 10. User Stories

### What it contains
Concrete user stories tied to personas from section 3 and features from section 5.

### Guidance
Each story should describe a user-visible capability and the outcome it enables.
Use the template format exactly.

**Good:**
```
1. As a **platform engineer**, I want **to inspect pod logs and events in one place** so that **I can diagnose incidents without switching tools**.
2. As a **junior developer**, I want **plain-language guidance on common failures** so that **I can resolve issues without senior help**.
```

**Bad:**
- As a **user**, I want **better tooling** so that **things are easier**.
- As a **developer**, I want **to use PostgreSQL** so that **the stack is modern**.

### Anti-patterns
- Using personas not defined in section 3
- Writing implementation tasks instead of user outcomes
- Stories that do not map to a feature in section 5

---

## 11. Risks & Mitigations

### What it contains
A table of meaningful delivery, adoption, dependency, or scope risks and how the team will reduce them.

### Guidance
Risks should be specific and paired with an actionable mitigation. If a risk matters enough
to list, the mitigation should tell the reader what will actually be done about it.

**Good:**
```
| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Users lack the RBAC permissions needed for core workflows | High | Medium | Document required permissions early and validate them during onboarding |
| External API rate limits degrade the primary workflow | Medium | Medium | Cache repeat lookups and define a degraded-mode response for limit breaches |
```

**Bad:**
- `Adoption risk` with no explanation
- `High` impact and `High` likelihood with `Monitor closely` as the mitigation

### Anti-patterns
- Generic risks with no product context
- Mitigations that are placeholders rather than actions
- Listing dozens of low-signal risks instead of the few that materially affect delivery

---

## 12. Glossary

### What it contains
Definitions for domain-specific, product-specific, or ambiguous terms that a new reader might not know.

### Guidance
Use the glossary to reduce ambiguity, not to restate obvious words. Define terms that appear
throughout the PRD or are important to scope, requirements, or user understanding.

**Good:**
```
| Term | Definition |
|---|---|
| Cluster incident | A production-impacting failure involving workloads, scheduling, networking, or platform services |
| Read-only workflow | A workflow that inspects system state without mutating or deleting resources |
```

**Bad:**
- `User` — A person who uses the product
- Circular definitions that depend on undefined terms

### Anti-patterns
- Including generic software terms nobody needs explained
- Defining terms that never appear in the PRD
- Writing definitions that are vague or circular



