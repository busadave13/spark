# Architecture Section Guide

Detailed guidance for each section of a well-formed ARCHITECTURE.md. Read this when generating
an architecture document for an unfamiliar domain or when the user's project has nuanced
requirements.

---

## Table of Contents

1. [Header & North Star](#header--north-star)
2. [Architecture Principles](#architecture-principles)
3. [System Overview](#system-overview)
4. [Layers & Boundaries](#layers--boundaries)
5. [Key Architectural Decisions](#key-architectural-decisions)
6. [Primary Data Flow](#primary-data-flow)
7. [External Dependencies](#external-dependencies)
8. [Configuration Reference](#configuration-reference)
9. [Security & Trust Boundary](#security--trust-boundary)
10. [Observability](#observability)
11. [Infrastructure & Deployment](#infrastructure--deployment)
12. [Non-Goals & Known Constraints](#non-goals--known-constraints)
13. [Decision Log](#decision-log)
14. [Related Documents](#related-documents)
15. [Appendices](#appendices)

---

## Header & North Star

### What it contains
- **Header block** — Version, Created, Last Updated, Owner, Namespace, Project, Project Type, Status
  - **Project Type** is required; valid values are `dotnet-webapi` or `dotnet-blazor`. Downstream agents (e.g., tdd-developer) read this field to decide which project-initialization skill to run.
- **North Star paragraph** — one paragraph orienting the reader to what the system does
  and for whom

### Guidance
The North Star paragraph is the single permitted bridge between product context (from a PRD
or from the user's interview answers) and this document. It should be dense enough that
someone reading only this paragraph understands the system's purpose, but short enough that
it doesn't expand into product-level content.

**Good:**
> KubeMCP is an MCP server that exposes read-only Kubernetes cluster inspection tools to
> AI agents (GitHub Copilot, Claude Code). It translates natural-language queries into
> kubectl-equivalent operations and returns structured results over the MCP protocol.

**Bad:**
> Our team needed a tool because Kubernetes is complex and operators spend too much time
> debugging. After extensive research, we decided to build a product that solves this
> problem for platform engineers who manage multiple clusters across environments...

The bad example is PRD content. The architecture North Star says what the system *is* and
*does*, not why it was created or who suffers without it.

### Anti-patterns
- Expanding into multi-paragraph product justification
- Listing user personas or business goals (those belong in a PRD, not here)
- Omitting the North Star entirely — the document needs a framing anchor

---

## Architecture Principles

### What it contains
A numbered list of at least 3 guiding principles that shape design decisions across the project.

### Guidance
Each principle should have a project-specific explanation — not a generic software engineering
platitude. The principle name is the anchor; the explanation tells agents *how* to apply it
in this codebase.

**Good:**
1. **Separation of HTTP and domain** — Transport-layer code must not contain business logic;
   endpoints map requests to service calls and return responses.
2. **Interface-driven dependencies** — All cross-boundary dependencies use interfaces defined
   in the consuming layer, implemented in the providing layer.
3. **Fail loud, recover fast** — Errors are logged with full context at the point of detection;
   transient failures use retry with exponential backoff.

**Bad:**
1. **SOLID** — We follow SOLID principles.
2. **Clean code** — Code should be clean.

The bad examples are generic — they apply to every project and tell an agent nothing about
*this* project's specific constraints.

### Anti-patterns
- Fewer than 3 principles
- Principles without project-specific explanations
- Generic software engineering truisms ("DRY", "KISS") without context

---

## System Overview

### What it contains
- **High-level description** — 2–3 sentences on the major moving parts and their relationships
- **Component Map** — Mermaid `graph LR` diagram + a table with Component, Responsibility,
  and Technology columns

### Guidance
The system overview answers: "If I had to draw this system on a whiteboard in 30 seconds,
what would I draw?" Keep it at the architectural level — components by name and responsibility,
not by file path.

**Good component table:**
| Component | Responsibility | Technology |
|---|---|---|
| API Gateway | Routes inbound HTTP requests, rate limiting, auth validation | Express.js, helmet |
| Domain Service | Core business logic, validation, orchestration | TypeScript, Zod |
| Data Store | Persistent storage, query execution | PostgreSQL 16 |
| Event Bus | Async message dispatch between services | RabbitMQ 3.13 |

**Bad component table:**
| Component | Responsibility | Technology |
|---|---|---|
| Backend | Does the work | Node.js |
| Database | Stores data | SQL |

The bad example is too vague — "does the work" tells an agent nothing about where to add
new logic. "SQL" is not a specific technology.

### Mermaid diagram guidance
- Use `graph LR` for component maps (left-to-right shows service relationships)
- `[name]` for internal components, `[(name)]` for databases, `[/name/]` for external services
- Solid arrows `-->` for synchronous calls, dotted arrows `-.->` for optional or async

### Anti-patterns
- Listing every file or folder as a "component"
- Using "various" or "TBD" in the Technology column
- Omitting the Mermaid diagram

---

## Layers & Boundaries

### What it contains
- **Mermaid `graph TB` diagram** showing the conceptual layer stack
- **Dependency rules** — hard constraints about what can depend on what

### Guidance
This section is the most important for AI agents adding new code. It tells them where new
code goes and what it is allowed to import. Write dependency rules as hard constraints,
not suggestions.

**Good:**
```
**Dependency rules — these are hard constraints, not guidelines:**

- Dependencies flow downward only: Transport → Handlers → Core → Infrastructure
- Core must not reference Infrastructure directly — use interfaces defined in Core,
  implemented in Infrastructure
- Transport layer must not contain business logic — it maps requests to handler calls
- Infrastructure implementations must not import from Transport or Handlers
```

**Bad:**
```
- Try to keep things organized
- Business logic should ideally be separate from the API layer
```

The bad example uses "try" and "should ideally" — agents interpret these as optional.
Use "must", "must not", and "will not" for constraints agents must obey.

### Anti-patterns
- Describing layers without dependency rules (the rules are the point)
- Framing constraints as guidelines or recommendations
- Fewer than 2 hard constraint rules

---

## Key Architectural Decisions

### What it contains
3–5 decisions that most constrain how the system is built, each with a brief rationale
and a link to the corresponding ADR.

### Guidance
Each entry should be one sentence of rationale — just enough that a reader knows *why*
without opening the ADR. The ADR link provides full context.

**Good:**
- **MCP protocol over REST** — native support by target AI agent consumers eliminates
  per-consumer integration code. → [ADR-0001](./adr/ADR-0001-use-mcp-over-rest.md)
- **Read-only in v1** — reduces security surface and avoids confirmation-gate complexity
  for the MVP. → [ADR-0002](./adr/ADR-0002-read-only-operations-v1.md)

**Bad:**
- **MCP** → [ADR-0001](./adr/ADR-0001.md)
- **Read-only** → [ADR-0002](./adr/ADR-0002.md)

The bad example describes *what* was decided but not *why*. An agent reading this section
needs to know the rationale at a glance to decide whether the constraint applies to their
current task.

### Anti-patterns
- Listing decisions without any rationale
- Missing ADR links
- Fewer than 2 entries

---

## Primary Data Flow

### What it contains
- **Happy path** — numbered steps walking through the most important request path,
  naming which component does what at each step
- **Mermaid `sequenceDiagram`** — visual representation of the happy path
- **Key error paths** — at least 1 specific error scenario with which component catches
  it and what is returned

### Guidance
This section lets agents know where to add logic for a new capability without tracing
execution through the codebase. Be concrete — name components, not abstractions.

**Good happy path:**
1. AI agent sends `tools/call` request via MCP transport (stdio)
2. MCP Server deserializes the request and dispatches to the matching tool handler
3. Tool handler validates parameters using Zod schema
4. Handler calls KubernetesClient to execute the kubectl-equivalent operation
5. KubernetesClient returns structured result (or typed error)
6. Handler maps result to MCP tool response format
7. MCP Server serializes and returns the response to the agent

**Good error path:**
- **Kubernetes API 403 Forbidden**: KubernetesClient catches the API error, wraps it in
  a `PermissionDeniedError`, and the tool handler returns it as an MCP error response with
  a human-readable message explaining which RBAC permission is missing.

**Bad error path:**
- **Errors**: Handled appropriately at each layer.

### Anti-patterns
- Unnumbered or vague happy-path steps ("data flows through the system")
- Missing the Mermaid sequence diagram
- No error paths documented
- Error paths that say "handled appropriately" without specifics

---

## External Dependencies

### What it contains
A table of everything the system calls or relies on at runtime, with columns for
Dependency, Purpose, Required?, and Failure behavior.

### Guidance
The Failure behavior column is the most important — it tells agents and operators what
happens when a dependency is unavailable. Every row must have a specific, actionable
failure behavior.

**Good:**
| Dependency | Purpose | Required? | Failure behavior |
|---|---|---|---|
| Kubernetes API Server | Cluster data source for all tools | Yes | Tools return MCP error with "cluster unreachable" message; server stays running |
| Azure Key Vault | Secret retrieval for connection strings | Yes | Server fails to start; logs missing-secret error with key name |
| Redis | Response caching | Optional | Cache misses; all requests hit the primary data source directly |

**Bad:**
| Dependency | Purpose | Required? | Failure behavior |
|---|---|---|---|
| Kubernetes | Data | Yes | N/A |
| Cache | Caching | Optional | Degrades |

The bad example has no actionable information. "N/A" and "Degrades" tell an operator
nothing about what actually happens.

### Anti-patterns
- "N/A" or "unknown" in the Failure behavior column
- Listing the language runtime as an external dependency
- Missing the Required? column

---

## Configuration Reference

### What it contains
All environment variables and config keys that change runtime behavior, with their
defaults and purpose.

### Guidance
This section saves agents from hunting through config files or guessing variable names.
Include the config loading order so agents know which source wins.

**Good:**
| Key | Default | Purpose |
|---|---|---|
| `KUBE_CONTEXT` | `current-context` | Which kubeconfig context to use |
| `LOG_LEVEL` | `info` | Minimum log level (debug, info, warn, error) |
| `CACHE_TTL_SECONDS` | `300` | How long cached responses are valid |
| `MCP_TRANSPORT` | `stdio` | Transport protocol (stdio or sse) |

**Bad:**
| Key | Default | Purpose |
|---|---|---|
| `CONFIG` | — | Configuration |

### Anti-patterns
- Listing keys without defaults or purpose
- Omitting the config loading order
- Leaving placeholder text in the table

---

## Security & Trust Boundary

### What it contains
- Caller trust model — who can call this and how it's enforced
- Write/destructive operations — what can mutate state and what gates exist
- Sensitive data — what flows through and how it's protected
- Protected resources — what must never be modified without confirmation
- Audit trail — what is logged for auditability

### Guidance
Include this section for any system with write operations, external callers, or sensitive
data. Only omit it for purely read-only, fully internal tools with no sensitive data — and
even then, consider documenting the trust model briefly.

**Good:**
- **Caller trust model**: Only AI agents with a valid MCP session can invoke tools.
  Authentication is delegated to the MCP transport layer — the server trusts the agent
  runtime's identity assertion.
- **Write / destructive operations**: None in v1 (read-only). If added in v2, all write
  operations must require explicit user confirmation via the MCP confirmation protocol.
- **Sensitive data handled**: Kubernetes secret values are never returned in tool
  responses — the server redacts them automatically and returns metadata only.

**Bad:**
- **Security**: Standard security practices are followed.

### Anti-patterns
- Generic statements without specifics ("follows best practices")
- Omitting the section for a system that handles credentials or PII
- Not documenting what happens with sensitive data in transit

---

## Observability

### What it contains
- **Logging** — format, conventions, level meanings
- **Metrics** — what is measured and where it's emitted
- **Tracing** — distributed tracing approach
- **Health endpoint** — how to verify the system is alive

### Guidance
Be specific about formats and conventions so agents writing new code produce consistent
observability output.

**Good:**
- **Logging**: Structured JSON via Serilog. Info for successful operations, Warn for
  recoverable errors (e.g., cache miss, retry succeeded), Error for failures requiring
  investigation. Every log entry includes `correlationId`.
- **Metrics**: Request duration histogram and error counter exposed via `/metrics`
  endpoint (Prometheus format).
- **Health endpoint**: `GET /healthz` returns 200 when the server is ready to accept
  requests; 503 if the Kubernetes API is unreachable.

**Bad:**
- **Logging**: We use logging.
- **Metrics**: TBD.

### Anti-patterns
- Placeholder content ("TBD", "will be added later")
- Not specifying the logging format or level conventions
- Missing the health check endpoint

---

## Infrastructure & Deployment

### What it contains
- **Environments table** — each environment with its purpose and access method
- **Deployment Topology** — how the system is deployed (containers, serverless, VMs, etc.)
- **CI/CD Pipeline** — build, test, and deploy steps

### Guidance
Be specific about how code gets from commit to production. Agents proposing infrastructure
changes need to know the deployment model to avoid incompatible suggestions.

**Good:**
| Environment | Purpose | URL / Access |
|---|---|---|
| Development | Local development with Docker Compose | `localhost:5000` |
| Staging | Pre-production validation | `staging.internal.example.com` (VPN required) |
| Production | Live traffic | `api.example.com` |

**Bad:**
| Environment | Purpose | URL / Access |
|---|---|---|
| Dev | Development | — |
| Prod | Production | — |

### Anti-patterns
- Missing the environments table
- Not describing the deployment model (containers? VMs? serverless?)
- CI/CD described as "standard pipeline" without specifics

---

## Non-Goals & Known Constraints

### What it contains
- **Non-goals** — things the system intentionally does NOT do, with rationale
- **Known limitations** — accepted tradeoffs with rationale for why they were accepted

### Guidance
This section prevents scope creep. AI agents interpret silence as permission — if you
don't say "no GUI", an agent might build one. Non-goals must include *why* they are out
of scope so agents don't re-evaluate them.

**Good non-goals:**
- **No GUI or dashboard** — the system is an agent-consumable API; visual interfaces are
  a separate product concern and would add significant maintenance burden.
- **No multi-cloud support in v1** — AKS only. EKS and GKE support deferred until the
  core tool set stabilizes and demand is validated.

**Good known limitations:**
- **Single-cluster only** — connecting to multiple clusters requires separate server
  instances. Accepted because multi-cluster routing adds complexity that isn't justified
  for the initial use case.
- **No streaming for large log outputs** — logs are returned as a single response, which
  may timeout for very large time windows. Accepted because streaming adds protocol
  complexity and the 1-hour default window covers 95% of use cases.

**Bad:**
- No GUI
- Single cluster only

The bad examples state facts without rationale. An agent reading "No GUI" doesn't know
if that's a permanent constraint or a temporary gap it should fill.

### Anti-patterns
- Fewer than 2 non-goals or 2 known limitations
- Non-goals without rationale
- Known limitations without tradeoff reasoning

---

## Decision Log

### What it contains
A table linking to every ADR, with columns for ADR number and Title.

### Guidance
This is the index that agents scan to find relevant decisions before making changes.
Every ADR written in this pass must appear here. Use relative links to the `adr/` directory.

**Good:**
| ADR | Title |
|---|---|
| [ADR-0001](./adr/ADR-0001-use-mcp-over-rest.md) | Use MCP Protocol Over REST API |
| [ADR-0002](./adr/ADR-0002-read-only-operations-v1.md) | Restrict v1 to Read-Only Operations |

### Anti-patterns
- Missing ADRs that were written in this pass
- Broken links to ADR files
- Using ADR numbers without the title

---

## Related Documents

### What it contains
Links to the ADR directory and PRD.md (if one was provided for the project).

### Guidance
The architecture prerequisite gate requires `PRD.md` to exist before architecture work
begins, so always include the PRD link.

**Good:**
- [`PRD.md`](./PRD.md) — product requirements and feature scope
- [`adr/`](./adr/) — full decision records

### Anti-patterns
- Omitting the link to ADRs or PRD
- Using absolute paths instead of relative links

---

## Appendices

### What it contains
- **Glossary** — project-specific terms and definitions (≥ 2 entries)
- **External References** — links to external documentation relevant to the architecture (≥ 1 entry)

### Guidance
The glossary defines terms that have project-specific meaning or might be ambiguous. Only
include terms that would confuse someone unfamiliar with this project — skip universally
understood terms.

**Good:**
| Term | Definition |
|---|---|
| Mock Policy | A set of rules that determines how Mockery responds to a request — replay, forward, or error |
| Upstream Forwarder | The HTTP client that proxies unmatched requests to the real service |

**Bad:**
| Term | Definition |
|---|---|
| API | Application Programming Interface |
| HTTP | Hypertext Transfer Protocol |

The bad examples define universally known terms — they add noise, not clarity.

### External References

Provide at least 1 link to external documentation relevant to the architecture.

**Good:**
- [ASP.NET Middleware Pipeline](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/middleware/) — explains the request pipeline model this architecture follows
- [MCP Specification](https://modelcontextprotocol.io/spec) — defines the protocol used for tool exposure

**Bad:**
- [Wikipedia: REST](https://en.wikipedia.org/wiki/REST) — general background

The bad example links to generic background reading. External references should be directly relevant to understanding *this* architecture's design choices.

### Anti-patterns
- Glossary with fewer than 2 entries
- Glossary defining universally understood terms
- No external references
- External references that are generic background rather than project-relevant

