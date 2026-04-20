<!-- SPARK -->

# Product Requirements Document

> **Version**: 2.6<br>
> **Created**: 2026-04-01<br>
> **Last Updated**: 2026-04-18<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved

---

## 1. Overview

### Product Name
Mockery

### Tagline
> Development-time HTTP proxy that records real upstream responses once and replays matching responses later so service teams can develop without running the full dependency chain.

### Problem Statement
Service developers working in a shared repository of interdependent services lose time every time a new dependency must be started, stubbed, or coordinated with another team before local work can begin. Existing approaches often require each upstream dependency to be explicitly registered or stubbed in advance, turning routine onboarding into ongoing configuration work instead of letting standard outbound traffic just flow. This also makes hybrid debugging harder because developers cannot easily choose, per request, which upstream calls should stay mocked and which should reach real systems. As a result, local and cloud development remain slower, more fragile, and harder to keep aligned with real upstream behavior.

### Solution Summary
Mockery is a development-time HTTP proxy that captures the first real response for an outbound request and replays it on later requests when the request target and request shape match. It is intended to behave like a true proxy for standard HTTP dependencies without requiring a dedicated per-upstream proxy entry for common record-and-replay scenarios, while still allowing manual mocks when an upstream is unavailable. The product also supports per-request mock activation, selective passthrough to chosen outbound destinations, and multi-hop interception so an entire request pipeline can be exercised without running the full dependency tree. Recorded and manually authored mocks persist across runs in environment-appropriate storage on developer workstations and cloud-hosted development sandboxes.

---

## 2. Goals & Success Criteria

### Primary Goals
1. Reduce dependency startup time for service developers.
2. Eliminate dedicated per-upstream onboarding work for standard HTTP mocking.
3. Preserve replay correctness for recorded upstream interactions.
4. Support hybrid debugging with per-request mock control.
5. Persist recorded and manually authored mocks across runs in supported development environments.

### Measurable Outcomes

| Goal | Success Criterion |
|---|---|
| Reduce dependency startup time for service developers | A developer can start a service with dependencies satisfied in under 90 seconds in supported local development profiles. |
| Eliminate dedicated per-upstream onboarding work for standard HTTP mocking | A developer can route a new HTTP dependency through Mockery without adding a dedicated per-upstream proxy configuration entry for standard record-and-replay behavior. |
| Preserve replay correctness for recorded upstream interactions | After the first real call is recorded, a later request with the same request target and request shape replays the stored response, while a materially different request results in a replay miss or a new recording attempt. |
| Support hybrid debugging with per-request mock control | A developer or CI workflow can activate mocking for one request and allow selected outbound destinations in that same request to pass through to real upstreams without restarting services or changing shared environment configuration. |
| Persist recorded and manually authored mocks across runs in supported development environments | Captured and manually authored mocks remain available across restarts and subsequent development sessions in environment-appropriate storage on both developer workstations and cloud-hosted development sandboxes. |

---

## 3. Users & Personas

### Primary User: Service Developer
- **Context**: Engineer building or debugging one service that depends on several upstream HTTP services in a shared repository, working on a workstation or in a cloud-hosted development sandbox.
- **Goal**: Exercise their service quickly without starting the full dependency chain, while still being able to switch specific upstream calls back to real systems during debugging.
- **Pain point**: Running or stubbing each dependency is slow, brittle, and often blocked by per-upstream setup that does not scale as dependencies change.
- **Technical level**: Intermediate to expert in service development, HTTP troubleshooting, and development workflows.

### Secondary User: Platform / Developer Experience Team
- **Context**: Maintains shared development workflows, templates, and tooling used by multiple service teams across the repository.
- **Goal**: Provide a default dependency-mocking path that works for common HTTP cases without asking every team to hand-author stubs or register each upstream separately.
- **Pain point**: Supporting many one-off stub strategies and configuration models creates onboarding overhead, inconsistent developer experience, and more support requests.
- **Technical level**: Expert in development tooling, service orchestration, and cross-team platform support.

### Secondary User: Security / Compliance Reviewer
- **Context**: Reviews captured mock artifacts and storage practices to ensure development tooling does not encourage unsafe data capture or uncontrolled reuse of mock data.
- **Goal**: Ensure captured mocks are understandable, inspectable, and manageable under existing organizational data-handling practices.
- **Pain point**: Automatically captured data can be hard to inspect or govern if stored in opaque formats or if developers do not have clear ways to exclude sensitive outbound calls from capture.
- **Technical level**: Expert in data-handling policy and review practices; intermediate in development workflows.

---

## 4. Scope

### In Scope (v1 / MVP)
- Reduce development setup effort by satisfying common outbound service dependencies without bespoke onboarding for each dependency.
- Reuse previously captured dependency behavior for repeat development scenarios when a later call matches a known prior interaction.
- Allow developers to create and maintain manual mocks for dependencies that are unavailable, unstable, or not yet built.
- Let developers enable mocking for an individual development flow while allowing selected dependency calls in that same flow to use live systems.
- Support consistent mock behavior across downstream dependency calls that occur within a single end-to-end development flow.
- Keep recorded and manually authored mocks available across restarts and later development sessions in supported environments.

### Out of Scope
- Managing or mediating production traffic.
- Supporting dependency categories outside the standard service-to-service scenarios targeted in v1.
- Requiring a shared mock catalog across local and cloud development environments.
- Requiring advanced configuration before teams can use basic record-and-replay behavior.
- Built-in mock history, versioning, promotion, sharing, or approval workflows in v1.
- Automatically covering every highly variable dependency interaction without developer curation.

---

## 5. Features & Capabilities

### Core Features (MVP)

| Feature | Description |
|---|---|
| **True-Proxy Forwarding** | Routes standard outbound HTTP requests through Mockery so the first real response can be captured without dedicated per-upstream setup in the common case. |
| **Correct Replay Matching** | Replays a stored response only when the original request target and request shape align, favoring correctness over overly broad reuse. |
| **Manual Mock Authoring** | Allows developers to create or edit stored mocks directly when a dependency is unavailable or not yet built. |
| **Per-Request Mock Control** | Lets developers or automation activate mocking for one request at a time and allow selected outbound destinations to pass through to real upstreams. |
| **Multi-Hop Interception** | Carries the same mock policy across downstream HTTP calls in a request pipeline so dependent calls can also be recorded or replayed. |
| **Persistent Mock Storage** | Stores captured and manual mocks in a persistent, human-readable form backed by environment-appropriate storage so they survive restarts and can be inspected or edited in place. |

### Future / Stretch Features
- Optional normalization rules or per-destination policy controls for exceptional request patterns that need looser or stricter matching than the default model.
- Mock drift detection and guided re-record suggestions when stored mocks no longer reflect real upstream behavior.
- Mock history, versioning, promotion, sharing, or approval workflows across teams and development environments.

---

## 6. Functional Requirements

> Format: `FR-NNN: The system shall [specific, testable behavior] when [the relevant condition applies].`

| ID | Requirement |
|---|---|
| FR-001 | The system shall forward an outbound HTTP request to the real upstream and return the real response when no stored mock matches the request target and request shape. |
| FR-002 | The system shall store the response from a successfully forwarded upstream call as a human-readable mock in persistent storage when recording is active for the request. |
| FR-003 | The system shall replay a stored response without contacting the upstream when a later request matches the same request target and request shape. |
| FR-004 | The system shall treat a change in request method, destination, path, query, or materially relevant input shape as a non-match when evaluating whether a stored mock can be replayed. |
| FR-005 | The system shall allow a developer to route a new standard HTTP dependency through Mockery without adding a dedicated per-upstream proxy configuration entry when the dependency is reachable from the development environment. |
| FR-006 | The system shall allow a manually authored mock to satisfy a request when no recorded mock exists and the authored mock matches the request target and request shape. |
| FR-007 | The system shall record outbound requests and replay stored responses when mocking has been explicitly enabled for that request. |
| FR-008 | The system shall allow selected outbound destinations to bypass replay and reach the real upstream when a request's mock policy marks those destinations for passthrough. |
| FR-009 | The system shall apply the current request's mock policy to downstream outbound HTTP calls in the same request pipeline when multi-hop interception is active for that request. |
| FR-010 | The system shall allow the same request pipeline to contain both replayed calls and real upstream calls when selective passthrough is used for part of that request. |
| FR-011 | The system shall read from and write to the environment's selected persistent mock store when running on a developer workstation or a cloud-hosted development sandbox. |
| FR-012 | The system shall make recorded and manually authored mocks available from the selected mock store when Mockery restarts or a later development session begins. |
| FR-013 | The system shall write stored mocks in a human-readable form that developers and reviewers can inspect and edit directly when persisting them to the selected mock store. |

---

## 7. Non-Functional Requirements

### Performance
- Development workflows that rely on Mockery shall keep local service startup with dependencies satisfied under 90 seconds for supported development profiles.

### Security
- Stored mock content shall remain human-readable and inspectable within the selected persistent storage location.
- The product shall allow teams to exclude outbound destinations from capture when those calls contain sensitive or environment-specific data.

### Availability
- Development tool — no production uptime SLA is required.
- When mocking is not activated for a request, normal outbound development traffic shall continue without depending on Mockery.

### Compliance
- No external regulatory compliance requirement has been identified for v1.
- Stored mocks shall remain understandable enough for teams to apply existing organizational data-handling policies in workstation and sandbox environments.

---

## 8. Integrations & Dependencies

| Integration | Purpose | Version / Notes |
|---|---|---|
| Upstream HTTP services | Provide the real responses used for first-call recording and the destinations used for selective passthrough | HTTP/1.1 and HTTP/2 over standard development-time outbound dependencies |
| Development orchestrator / local development environment | Provides the environment in which service traffic is routed through Mockery during local or cloud development | Must support HTTP proxy routing for outbound service traffic |
| Persistent mock storage | Persists recorded and manually authored mocks across runs for later replay | Environment-appropriate persistent storage; separate stores per environment are acceptable |

---

## 9. Assumptions & Constraints

### Assumptions
- Developers can reach a real upstream at least once when a response must be recorded instead of manually authored.
- Most standard outbound HTTP dependency calls can be routed through Mockery without requiring a custom per-upstream onboarding step.
- Teams can inspect recorded mocks in persistent storage and decide which outbound destinations, if any, should be excluded from capture.
- Request target and request shape provide enough information to distinguish the majority of replayable calls without mandatory advanced normalization.

### Constraints
- The product is for developer workstations and cloud-hosted development sandboxes only.
- The product must support standard HTTP traffic and does not cover non-HTTP dependencies in v1.
- Basic record-and-replay behavior must not require prior per-upstream registration or mandatory advanced normalization or policy setup.
- Default replay matching must prioritize correctness based on the original request target and request shape rather than broad generalized patterns.
- Separate mock sets across local and cloud environments are acceptable; shared cross-environment identity or deduplication is not required.
- Recorded and manually authored mocks must persist using environment-appropriate storage without depending on mock history, versioning, promotion, sharing, or approval workflows for basic v1 use.

---

## 10. User Stories

> Format: `As a **[persona from §3]**, I want **[capability]** so that **[outcome]**.`
> Each story must reference a persona defined in §3 and map to a feature from §5.

1. As a **Service Developer**, I want **a new outbound HTTP dependency to record on first use without dedicated per-upstream setup** so that **I can start developing before the full dependency tree is running**.
2. As a **Service Developer**, I want **Mockery to replay only when the request target and request shape truly match** so that **I can trust that a replayed response represents the call I am making**.
3. As a **Service Developer**, I want **to activate mocking per request and let selected outbound destinations pass through to real upstreams** so that **I can debug mixed real-and-mocked request flows without restarting services**.
4. As a **Service Developer**, I want **to author or edit a stored mock directly when an upstream is unavailable** so that **I can keep building before that dependency is ready**.
5. As a **Service Developer**, I want **mock policy to follow downstream outbound calls within the same request pipeline** so that **I can exercise multi-hop flows without starting every dependent service**.
6. As a **Platform / Developer Experience Team**, I want **a default proxy workflow that covers common HTTP dependencies without per-upstream registration** so that **I can reduce onboarding work and support requests across teams**.
7. As a **Service Developer**, I want **recorded and manually authored mocks to persist across restarts and later development sessions** so that **I do not have to re-record dependencies every time I resume work**.
8. As a **Security / Compliance Reviewer**, I want **captured mocks to stay human-readable and persist in a known storage location** so that **I can assess what data is being retained before teams reuse it**.

---

## 11. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| A stored response is replayed for a similar but materially different request | High | Medium | Make request target and request shape the default replay key, surface replay misses clearly, and allow manual mock curation for edge cases. |
| Sensitive data is captured in stored mocks and reused without appropriate review | High | Medium | Allow selective passthrough for sensitive outbound destinations, keep mocks human-readable, and provide clear review guidance before reuse. |
| Some downstream calls in a request pipeline bypass Mockery and leave developers with partial dependency coverage | Medium | Medium | Validate multi-hop coverage against representative request pipelines and document unsupported call paths before wider rollout. |
| Environment-specific mock stores drift or become hard to manage over time | Medium | Medium | Keep mock stores scoped per environment, support re-recording or manual curation when behavior changes, and defer promotion or sharing workflows to future releases. |
| Low-configuration proxying does not cover unusual request patterns well enough for every upstream | Medium | High | Keep the default path focused on standard HTTP traffic and provide optional future normalization or policy controls only for exceptions. |

---

## 12. Glossary

| Term | Definition |
|---|---|
| Correct replay matching | Evaluating a later request's target and shape against stored mocks and replaying a response only when both align, to avoid returning a response that does not represent the actual call. |
| Manual mock authoring | Creating or editing a stored mock by hand so that a dependency can be satisfied when the real upstream is unavailable, unstable, or not yet built. |
| Mock | A stored upstream response that can be replayed during development instead of calling the real dependency again. |
| Request target | The original outbound destination being called, including the parts of the target that identify which upstream endpoint the request is meant to reach. |
| Request shape | The meaningful characteristics of a request that determine replay correctness, such as the method and other inputs that distinguish one call from another. |
| Selective passthrough | A per-request capability that allows chosen outbound destinations to bypass replay and reach the real upstream while other calls in the same flow remain mocked. |
| Multi-hop interception | Applying the same mock policy across downstream outbound calls made as part of a single request pipeline. |
| Per-request mock control | Enabling or disabling mocking for an individual request and choosing which outbound destinations in that request pass through to real upstreams, without restarting services or changing shared configuration. |
| Persistent mock storage | The environment-appropriate storage location used to retain recorded and manual mocks across restarts and subsequent development sessions. |
| Mock policy | The set of per-request directives that control whether outbound calls are recorded, replayed, or passed through to real upstreams, and which destinations are affected. |
| Request pipeline | The chain of downstream outbound HTTP calls triggered while handling a single inbound request, where each hop may itself make further outbound calls. |
| Replay miss | The outcome when an incoming request does not match any stored mock by request target and request shape, triggering either a new recording attempt or an error. |
| True-proxy forwarding | Routing all standard outbound HTTP traffic through Mockery without requiring a dedicated configuration entry for each upstream, as opposed to proxy setups that require per-upstream registration. |
| Cloud-hosted development sandbox | A cloud-based isolated development environment — such as a Codespace or Dev Box — where a developer runs services and their dependencies remotely. |
| Development profile | A preconfigured local launch or run configuration that defines which services and dependencies start together for a given development scenario. |

---

*This PRD is the source of truth for **what** is being built. For **how**, see `ARCHITECTURE.md` in the project docs root.*
