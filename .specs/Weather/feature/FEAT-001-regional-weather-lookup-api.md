<!-- SPARK -->

# FEAT-001: Regional Weather Lookup API

> **Version**: 1.0<br>
> **Created**: 2026-04-20<br>
> **Last Updated**: 2026-04-20<br>
> **Owner**: Dave Harding<br>
> **Project**: Weather<br>
> **Status**: Draft

## Goal

Provide the single caller-facing HTTP endpoint that returns one deterministic regional weather response so dependent services and test automation can integrate with Weather Service through one stable contract instead of orchestrating sibling sensor services directly.

## Motivation

This feature implements the public API boundary required by PRD Goal 1, Goal 2, and Goal 3, and directly covers FR-001, FR-005, and FR-006. The approved architecture constrains Weather to a single ASP.NET Core Minimal API endpoint at `GET /api/weather/{region}` and requires the endpoint layer to stay thin: validate the route, invoke aggregation, and shape JSON success or failure responses without embedding orchestration logic.

## User Stories

- As a **Service Developer**, I want **to request one weather response for a supported region** so that **my service can integrate with one stable weather API instead of coordinating Temperature Sensor and Pressure Sensor calls directly**.
- As a **Test Automation Engineer**, I want **the weather endpoint to return one consistent JSON contract for success and failure** so that **integration tests can assert one boundary without custom upstream-specific adapters**.

## Acceptance Criteria

- [ ] `GET /api/weather/{region}` returns `200 OK` with JSON containing `region`, `temperature`, `humidity`, `pressure`, and `unit` when the region is supported and the aggregation service returns a complete result.
- [ ] The endpoint accepts only canonical region values from `Weather:SupportedRegions`; unsupported regions return `400 Bad Request` with `application/problem+json` and `errorCode` `unsupported_region` before any downstream dependency call is attempted.
- [ ] The endpoint normalizes mixed-case region input to the canonical configured form before delegating to the aggregation layer, so requests such as `EUS` and `eus` resolve the same supported-region lookup path.
- [ ] All successful and failed responses are JSON in v1. Failure responses use RFC 7807 fields `type`, `title`, `status`, and `detail` plus machine-readable extension fields `errorCode` and, when applicable, `dependency`.
- [ ] The endpoint remains read-only and does not access sibling services, files, or configuration stores directly beyond request validation and delegation to the aggregation service.

## API / Interface Definition

GET /api/weather/{region}
Authorization: N/A - v1 is intentionally unauthenticated for internal local and cloud development environments per PRD Section 7.

Route parameters:
- `region`: string (required) - canonical region code from `Weather:SupportedRegions`; expected v1 values are `eus` and `wus2`

Request body:
None.

Response [200]:
```json
{
  "region": "eus",
  "temperature": 21.5,
  "humidity": 45.0,
  "pressure": 1013.2,
  "unit": {
    "temperature": "C",
    "pressure": "hPa"
  }
}
```

Field contract:
- `region`: string - canonical supported region code used throughout the aggregation flow
- `temperature`: number - deterministic temperature value returned by the Temperature Sensor dependency for the selected region
- `humidity`: number - deterministic humidity value paired with the temperature reading for the selected region
- `pressure`: number - deterministic pressure value returned by the Pressure Sensor dependency for the selected region
- `unit`: object - stable unit object containing `temperature` and `pressure` labels for the aggregated readings

Errors:
- `400` `application/problem+json`
```json
{
  "type": "https://httpstatuses.com/400",
  "title": "Invalid weather lookup request",
  "status": 400,
  "detail": "Region 'xyz' is not supported. Supported regions: eus, wus2.",
  "errorCode": "unsupported_region"
}
```
- `502` `application/problem+json`
```json
{
  "type": "https://httpstatuses.com/502",
  "title": "Weather dependency failure",
  "status": 502,
  "detail": "Pressure data could not be retrieved for region 'eus'.",
  "errorCode": "pressure_dependency_failed",
  "dependency": "PressureSensor"
}
```
The detailed `502` behavior, dependency classifications, and no-partial-success rule are defined by FEAT-003.

## Data Model

WeatherResponse {
  region:      string   - canonical supported region code
  temperature: decimal  - aggregated temperature reading
  humidity:    decimal  - aggregated humidity reading
  pressure:    decimal  - aggregated pressure reading
  unit:        object   - structured unit contract for the aggregated response
}

WeatherUnit {
  temperature: string   - temperature unit label returned from normalized upstream data, expected `C` in v1 seeded scenarios
  pressure:    string   - pressure unit label returned from normalized upstream data, expected `hPa` in v1 seeded scenarios
}

WeatherLookupError {
  type:        string   - RFC 7807 problem type URI
  title:       string   - short error title
  status:      int      - HTTP status code
  detail:      string   - human-readable failure description
  errorCode:   string   - machine-readable error classification
  dependency:  string?  - optional upstream dependency name for dependency failures
}

## Edge Cases & Error Handling

| Scenario | Expected behaviour |
|----------|--------------------|
| Caller supplies `EUS` or mixed-case region text | The endpoint normalizes the region to the canonical configured form before delegating to the aggregation layer. |
| Caller supplies a region not listed in `Weather:SupportedRegions` | The endpoint returns `400` with `errorCode` `unsupported_region` and does not call either sibling dependency. |
| Aggregation returns a dependency failure for an otherwise valid region | The endpoint returns `502` `application/problem+json` and includes the dependency classification defined in FEAT-003. |
| Caller uses an unsupported HTTP method such as `POST /api/weather/eus` | The service returns the framework-standard method-not-allowed response; no write workflow is introduced in v1. |

## Preservation Constraints

- The inbound Weather route stays `GET /api/weather/{region}` in v1; no sensor ID, batch, or write route is introduced by this feature.
- The endpoint layer must not embed sibling-service orchestration logic; orchestration remains behind a dedicated aggregation service interface.
- The success contract shape defined here is the single caller-facing weather contract for MVP and must not leak raw upstream response payloads.

## Out of Scope

- Sensor discovery or selection APIs exposed directly by Weather to callers.
- Batch weather lookup for multiple regions in one request.
- Historical weather, forecasting, alerts, or any write operation.

## Dependencies

- Requires: ADR-0001 for the single Minimal API host boundary
- Requires: ADR-0003 for the all-or-nothing success rule enforced by the endpoint's failure responses
- Requires: FEAT-002 to retrieve the upstream readings needed to assemble the response
- Requires: FEAT-003 to map aggregation failures into stable caller-facing `ProblemDetails`
