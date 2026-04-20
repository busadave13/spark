<!-- SPARK -->

# Product Requirements Document

> **Version**: 1.2<br>
> **Created**: 2026-04-15<br>
> **Last Updated**: 2026-04-17<br>
> **Owner**: Dave Harding<br>
> **Project**: Weather<br>
> **Status**: Draft

---

## 1. Overview

### Product Name
Weather Service

### Tagline
> Aggregation service that combines temperature and pressure sensor data into a unified weather response for a given region.

### Problem Statement
Client services that need weather information for a region must currently call the Temperature Sensor and Pressure Sensor services independently, correlate their responses, and handle partial-failure scenarios on their own. Each consumer reimplements the same aggregation and error-handling logic, leading to duplicated code, inconsistent response shapes, and tighter coupling to the upstream sensor contracts. When either upstream service changes its contract or failure behavior, every consumer must be updated individually.

### Solution Summary
Weather Service provides a single API that accepts a region identifier, calls the Temperature Sensor and Pressure Sensor services on behalf of the client, and returns a combined weather response containing temperature, humidity, and barometric pressure data. Clients make one call instead of two, receive a single consistent contract, and are insulated from the details of upstream sensor integration.

---

## 2. Goals & Success Criteria

### Primary Goals
1. Provide a single API endpoint that returns aggregated weather data for a region.
2. Insulate client services from direct dependencies on upstream sensor services.
3. Deliver a consistent, documented response contract for weather data consumers.

### Measurable Outcomes

| Goal | Success Criterion |
|---|---|
| Provide a single API endpoint that returns aggregated weather data for a region | A single API call returns combined temperature and pressure data for any supported region, replacing two separate upstream calls. |
| Insulate client services from direct dependencies on upstream sensor services | Client services integrate with Weather Service only; they do not import or call Temperature Sensor or Pressure Sensor APIs directly. |
| Deliver a consistent, documented response contract for weather data consumers | All successful responses use one documented JSON contract that includes region, temperature, humidity, temperature unit, pressure, and pressure unit. |

---

## 3. Users & Personas

### Primary User: Service Developer
- **Context**: Engineer building or testing an internal service that needs combined weather data (temperature and pressure) to drive application logic or validate end-to-end workflows in local or cloud development environments. Today, every consuming service must independently integrate with multiple upstream sensor APIs, adding friction and slowing development.
- **Goal**: Retrieve a single, pre-aggregated weather response for a region so the consuming service does not need to orchestrate multiple upstream calls.
- **Pain point**: Must currently call Temperature Sensor and Pressure Sensor separately, correlate responses, and duplicate aggregation and error-handling logic in every consuming service.
- **Technical level**: Intermediate — comfortable with service-to-service API calls but should not need to understand upstream sensor internals.

### Secondary User: Integration Test Author
- **Context**: Engineer writing integration or end-to-end tests that require realistic weather data for a region.
- **Goal**: Exercise weather-dependent code paths with deterministic, predictable aggregated responses.
- **Pain point**: Setting up two separate upstream mocks and correlating their outputs adds friction to test authoring.
- **Technical level**: Intermediate — familiar with test tooling and mock data patterns.

---

## 4. Scope

### In Scope (v1 / MVP)
- Single endpoint to retrieve aggregated weather data by region
- Integration with Temperature Sensor service to obtain temperature and humidity readings
- Integration with Pressure Sensor service to obtain barometric pressure readings
- Aggregation of upstream responses into a unified weather response contract
- Error handling when one or both upstream services are unavailable or return errors

### Out of Scope
- Historical weather data or time-series queries
- Batch queries across multiple regions in a single request
- Alerting or threshold-based notifications
- Write operations — weather data is read-only from upstream sensors
- Direct sensor management (adding, removing, or configuring sensors)
- Authentication or authorization — assumes internal network trust in v1
- GUI or dashboard — API-only in v1

---

## 5. Features & Capabilities

### Core Features (MVP)

| Feature | Description |
|---|---|
| **Region Weather Lookup** | Client requests weather data for a region and receives an aggregated response containing temperature, humidity, and pressure readings from the best-available sensor in that region. |
| **Upstream Sensor Aggregation** | The service calls Temperature Sensor and Pressure Sensor APIs, correlates their responses by region, and merges them into a single response payload. |
| **Graceful Upstream Failure Handling** | When one upstream sensor service is unavailable or returns an error, the service returns a clear error response indicating which upstream data is missing rather than failing silently or returning partial data without indication. |

### Future / Stretch Features
- Support for requesting data from a specific sensor ID within a region
- Batch endpoint to retrieve weather data for multiple regions in one call
- Caching of upstream responses to reduce redundant calls within a configurable time window

---

## 6. Functional Requirements

> Format: `FR-NNN: The system shall {behavior} when {condition}.`

| ID | Requirement |
|---|---|
| FR-001 | The system shall accept a region identifier and return a JSON response containing temperature, humidity, temperature unit, pressure, and pressure unit for that region. |
| FR-002 | The system shall call the Temperature Sensor service to retrieve temperature and humidity data for the requested region. |
| FR-003 | The system shall call the Pressure Sensor service to retrieve barometric pressure data for the requested region. |
| FR-004 | The system shall return a 400 error with a descriptive message when the requested region is not supported by either upstream service. |
| FR-005 | The system shall return a 502 error with a descriptive message when the Temperature Sensor service is unreachable or returns a server error. |
| FR-006 | The system shall return a 502 error with a descriptive message when the Pressure Sensor service is unreachable or returns a server error. |
| FR-007 | The system shall propagate upstream 404 responses as a 404 to the client when no sensor data exists for the requested region. |

---

## 7. Non-Functional Requirements

### Performance
- Aggregated response latency is bounded by upstream service response times; the service itself shall add negligible overhead to the combined upstream round-trip.

### Security
- No authentication required in v1; the service operates within a trusted internal network boundary.

### Availability
- Local development tool — no SLA required. The service should start and respond to requests without manual configuration beyond standard project setup.

### Compliance
- None identified.

---

## 8. Integrations & Dependencies

| Integration | Purpose | Version / Notes |
|---|---|---|
| Temperature Sensor Service | Source of temperature and humidity readings by region and sensor ID | Internal test service; endpoint `GET /api/temperature/{region}/{sensorId}` |
| Pressure Sensor Service | Source of barometric pressure readings by region and sensor ID | Internal test service; endpoint `GET /api/pressure/{region}/sensors/{sensorId}` |

---

## 9. Assumptions & Constraints

### Assumptions
- Temperature Sensor and Pressure Sensor services are running and reachable when Weather Service handles a request.
- Each supported region has at least one sensor registered in both upstream services.
- Upstream sensor services return deterministic mock data suitable for development and testing scenarios.

### Constraints
- Weather Service is read-only; it does not create, update, or delete sensor data.
- The service must run locally without requiring external cloud resources or credentials.
- The aggregated response contract must include data from both upstream services — partial responses are treated as errors in v1.

---

## 10. User Stories

> Format: `As a **[persona from §3]**, I want **[capability]** so that **[outcome]**.`

1. As a **Service Developer**, I want **to call a single weather endpoint for a region** so that **I don't have to orchestrate separate calls to Temperature Sensor and Pressure Sensor services**.
2. As a **Service Developer**, I want **a consistent JSON response containing temperature, humidity, and pressure** so that **I can integrate weather data without mapping multiple upstream contracts**.
3. As a **Service Developer**, I want **clear error responses when an upstream sensor service fails** so that **I can distinguish between bad input and infrastructure issues**.
4. As an **Integration Test Author**, I want **deterministic aggregated weather responses for known regions** so that **my tests produce repeatable results without external dependencies**.
5. As an **Integration Test Author**, I want **aggregated weather responses that combine data from both upstream sensors** so that **I can validate end-to-end weather data flows without manually correlating separate service outputs**.

---

## 11. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Upstream sensor service contract changes break Weather Service aggregation | High | Medium | Pin integration tests against known upstream response shapes; detect contract drift early through automated tests. |
| One upstream service becomes unavailable during development, blocking Weather Service testing | Medium | Medium | Weather Service includes mock/fallback data for supported regions so development can continue when an upstream is down. |
| Region identifiers differ between Temperature Sensor and Pressure Sensor services | Medium | Low | Normalize region identifiers to lowercase and validate against a shared list of supported regions at startup. |

---

## 12. Glossary

| Term | Definition |
|---|---|
| Region | A named geographic area (e.g. "us-west", "eu-north") for which sensor data is available. |
| Sensor ID | A unique identifier for a specific temperature or pressure sensor device within a region. |
| Upstream service | A service that Weather Service calls to obtain raw sensor data — specifically Temperature Sensor and Pressure Sensor. |
| Aggregated response | A single JSON payload that combines temperature, humidity, and pressure data from multiple upstream sources into one response. |

---

*This PRD is the source of truth for **what** is being built. For **how**, see `ARCHITECTURE.md` in the project docs root.*
