<!-- SPARK -->

# FEAT-004: Self-Contained Runtime and Diagnostics

> **Version**: 1.0<br>
> **Created**: 2026-04-20<br>
> **Last Updated**: 2026-04-20<br>
> **Owner**: Dave Harding<br>
> **Project**: Weather<br>
> **Status**: Draft

## Goal

Define the runtime, configuration, health, readiness, OpenAPI, and diagnostics behavior that lets Weather Service run predictably in local workstations and cloud dev environments as a small internal test-service dependency.

## Motivation

This feature translates the architecture's operational constraints into implementable behavior. Weather is intentionally small, but it still needs predictable startup defaults, health signals, typed-client configuration, and structured diagnostics so dependent teams can detect whether the service is ready to aggregate sibling sensor data. Without these runtime rules, Weather would satisfy only the happy path and still be difficult to operate or debug in development workflows.

## User Stories

- As a **Service Developer**, I want **Weather to start with committed defaults and report readiness clearly when dependency configuration is invalid** so that **I can diagnose environment drift quickly**.
- As a **Platform / Developer Experience Team** member, I want **standard health and diagnostics signals for weather lookups and dependency failures** so that **shared local and cloud-dev workflows can verify the service is usable before downstream scenarios run**.

## Acceptance Criteria

- [ ] Weather loads configuration from `appsettings.json`, environment-specific settings files, and environment variables in the precedence order defined by the approved architecture.
- [ ] `GET /healthz` returns `200 OK` with a liveness payload whenever the process is running.
- [ ] `GET /readyz` returns success only when `Weather:SupportedRegions` is configured, both sibling base URLs are present and parse as valid absolute HTTP or HTTPS URIs, and `Weather:RequestTimeoutSeconds` is greater than zero.
- [ ] Weather registers OpenAPI metadata only when `Weather:EnableOpenApi` is `true`; disabling OpenAPI does not affect the weather or health endpoints.
- [ ] Successful lookups, validation failures, temperature dependency failures, pressure dependency failures, and region mismatch failures are logged as structured events that include request path, normalized region, outcome class, and dependency context when applicable.
- [ ] Weather emits counters for lookup success, validation failure, temperature dependency failure, pressure dependency failure, and a request-duration histogram compatible with OpenTelemetry-based collection.

## API / Interface Definition

GET /healthz
Authorization: N/A - internal development runtime only.

Response [200]:
```json
{
  "status": "healthy"
}
```

GET /readyz
Authorization: N/A - internal development runtime only.

Response [200]:
```json
{
  "status": "ready",
  "supportedRegions": ["eus", "wus2"],
  "temperatureSensorBaseUrl": "http://temperaturesensor",
  "pressureSensorBaseUrl": "http://pressuresensor"
}
```

Response [503]:
```json
{
  "status": "not_ready",
  "errorCode": "invalid_configuration",
  "message": "Weather:PressureSensorBaseUrl is missing or invalid."
}
```

Configuration interface:
- `Weather:SupportedRegions`: string list (default `eus,wus2`) - canonical regions accepted by the public API
- `Weather:TemperatureSensorBaseUrl`: string (default `http://temperaturesensor`) - sibling temperature service base URL
- `Weather:PressureSensorBaseUrl`: string (default `http://pressuresensor`) - sibling pressure service base URL
- `Weather:RequestTimeoutSeconds`: int (default `2`) - timeout budget applied to sibling HTTP calls
- `Weather:EnableOpenApi`: bool (default `true`) - toggles OpenAPI metadata exposure

## Data Model

ReadinessStatus {
  status:                    string     - `ready` or `not_ready`
  supportedRegions:          string[]?  - configured canonical region list when ready
  temperatureSensorBaseUrl:  string?    - configured temperature dependency base URL when ready
  pressureSensorBaseUrl:     string?    - configured pressure dependency base URL when ready
  errorCode:                 string?    - machine-readable readiness failure code
  message:                   string?    - human-readable readiness failure detail
}

WeatherDiagnosticEvent {
  eventName:     string    - `WeatherLookupSucceeded`, `WeatherValidationFailed`, `TemperatureDependencyFailed`, `PressureDependencyFailed`, or `WeatherRegionMismatch`
  requestPath:   string    - inbound HTTP path
  region:        string?   - normalized region when available
  outcome:       string    - success | validation_failure | dependency_failure
  dependency:    string?   - dependency context for downstream failures
  timestampUtc:  datetime  - event timestamp
}

## Edge Cases & Error Handling

| Scenario | Expected behaviour |
|----------|--------------------|
| Process starts with `Weather:PressureSensorBaseUrl` missing | Liveness still reports `200`, but readiness returns `503` with `errorCode` `invalid_configuration`. |
| `Weather:RequestTimeoutSeconds` is `0` or negative | Startup may continue, but readiness returns `503` until configuration is corrected because the service is not safe to use for composed lookups. |
| OpenAPI is disabled through configuration | Weather continues serving `/api/weather/{region}`, `/healthz`, and `/readyz` without exposing OpenAPI metadata. |
| Telemetry export is unavailable in the environment | Request handling continues with local process logging; telemetry export failure does not block weather lookup behavior. |

## Preservation Constraints

- Weather remains a development-time internal service only; no authentication, authorization, or production-only infrastructure is introduced in MVP.
- Readiness validates configuration and service usability signals, but v1 does not require active network probes to sibling dependencies on every readiness request.
- Diagnostics stay additive and do not change the success or failure payload contracts defined by FEAT-001 and FEAT-003.

## Out of Scope

- Production deployment, autoscaling, or external alerting systems.
- Mandatory remote telemetry backends or cloud credentials.
- Retry loops or active dependency health probes beyond configuration validation in v1.

## Dependencies

- Requires: ADR-0001 for the single-host runtime model
- Requires: ADR-0002 because readiness and diagnostics are defined around sibling HTTP dependencies
- Supports: FEAT-001, FEAT-002, and FEAT-003 by providing the operational environment and diagnostics for the Weather lookup flow