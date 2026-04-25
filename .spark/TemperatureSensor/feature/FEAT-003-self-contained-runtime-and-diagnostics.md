<!-- SPARK -->
# FEAT-003: Self-Contained Runtime and Diagnostics

> **Version**: 1.0<br>
> **Created**: 2026-04-14<br>
> **Last Updated**: 2026-04-18<br>
> **Owner**: Dave Harding<br>
> **Project**: Temperature Sensor WebAPI Service<br>
> **Status**: Approved

## Goal

Provide the operational feature set that lets Temperature Sensor Service run predictably in local workstations and cloud dev environments without any external runtime dependency. This feature supports PRD Goal 1 and Goal 3 by defining configuration, readiness, health, and telemetry behavior that keeps the API usable as a stable shared test dependency.

## Motivation

This feature implements FR-007 and the operational expectations in PRD Section 7, while following ADR-0003. The value of the service is not only that it returns mock data, but that it can be started and diagnosed reliably in isolated development environments where no real sensor platform is available. Without clear runtime and diagnostics requirements, dependent teams would still lose time diagnosing startup drift and silent dataset failures.

## User Stories

- As a **Service Developer**, I want **the service to start with committed defaults and fail clearly when required mock data is unavailable** so that **I can diagnose local environment issues quickly**.
- As a **Integration Test Author**, I want **health and readiness signals plus structured lookup diagnostics** so that **test orchestration can detect whether the seeded service is actually ready before integration scenarios run**.

## Acceptance Criteria

- [x] The service loads configuration from `appsettings.json`, environment-specific settings files, and environment variables in the precedence order defined by the approved architecture.
- [x] `GET /healthz` returns a liveness response whenever the process is running, and `GET /readyz` returns success only when the configured dataset path is accessible and readable.
- [x] Successful lookups, validation failures, dataset misses, and dataset read failures are logged as structured events with enough fields to identify the request path, normalized region, sensor ID, and outcome class.
- [x] The service exposes OpenAPI metadata when `TemperatureSensor:EnableOpenApi` is `true` and can disable it when the setting is `false`.
- [x] If required configuration is invalid or the dataset cannot be validated on startup when `TemperatureSensor:ValidateDatasetOnStartup` is `true`, the service fails clearly instead of serving partial behavior.

## API / Interface Definition

GET /healthz
Authorization: N/A - local and cloud dev runtime only.

Request:
None.

Response [200]:
```json
{
  "status": "healthy"
}
```

GET /readyz
Authorization: N/A - local and cloud dev runtime only.

Request:
None.

Response [200]:
```json
{
  "status": "ready",
  "mockDataPath": "Mocks"
}
```

Errors:
- `503`
```json
{
  "status": "not_ready",
  "mockDataPath": "Mocks",
  "errorCode": "dataset_unavailable",
  "message": "Configured mock dataset path is missing or unreadable."
}
```

Configuration interface:
- `TemperatureSensor:MockDataPath`: string (optional, default `Mocks`) - mock dataset root
- `TemperatureSensor:SupportedRegions`: string list (optional, default `eus,wus2`) - allowed canonical regions
- `TemperatureSensor:SensorIdPattern`: string (optional, default `^[A-Za-z0-9]{8}$`) - boundary validation pattern
- `TemperatureSensor:ValidateDatasetOnStartup`: boolean (optional, default `true`) - toggles startup dataset validation
- `TemperatureSensor:EnableOpenApi`: boolean (optional, default `true`) - toggles OpenAPI endpoint exposure

## Data Model

ReadinessStatus {
  status:        string   - `ready` or `not_ready`
  mockDataPath:  string   - configured dataset root checked by readiness logic
  errorCode:     string?  - present when readiness fails
  message:       string?  - human-readable readiness failure detail
}

DiagnosticLogEvent {
  eventName:     string   - `LookupSucceeded`, `LookupValidationFailed`, `LookupMissed`, or `DatasetReadFailed`
  requestPath:   string   - inbound HTTP path
  region:        string?  - normalized region when available
  sensorId:      string?  - normalized sensor identifier when available
  outcome:       string   - success | validation_failure | miss | dependency_failure
  timestampUtc:  datetime - event timestamp
}

## Edge Cases & Error Handling

| Scenario | Expected behaviour |
|----------|--------------------|
| Process starts with `TemperatureSensor:ValidateDatasetOnStartup=true` and the dataset path is missing | Startup fails clearly and readiness never reports success until configuration is corrected. |
| `GET /healthz` is called while the dataset path is unavailable | Liveness still returns `200` because the process is running, while `GET /readyz` returns `503` with `dataset_unavailable`. |
| OpenAPI is disabled through configuration | The service does not expose the OpenAPI endpoint, but the lookup and health endpoints continue to function normally. |
| Telemetry export is unavailable in a dev environment | The service continues handling requests and falls back to local process logging without external telemetry dependencies. |

## Out of Scope

- Production deployment topology, autoscaling, or production-grade SLAs.
- External alerting systems, dashboards, or mandatory remote telemetry backends.
- Authentication or authorization for health, readiness, or lookup endpoints.

## Dependencies

- Requires: ADR-0001 and ADR-0003
- Requires: FEAT-002 so readiness checks can validate the configured dataset path and artifact readability
- Supports: FEAT-001 by providing the operational environment in which the lookup API runs
