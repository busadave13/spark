# FEAT-001: Seeded Temperature Lookup API

> **Version**: 1.1.0<br>
> **Created**: 2026-04-14<br>
> **Last Updated**: 2026-04-18<br>
> **Owner**: Dave Harding<br>
> **Project**: Temperature Sensor WebAPI Service<br>
> **Status**: Approved

## Goal

Provide the read-only HTTP feature that lets internal callers request a deterministic mock temperature reading for a supported region and sensor ID. This feature directly supports PRD Goal 1 and Goal 2 by giving service developers and test automation one stable API contract for seeded temperature lookups in local and cloud dev environments.

## Motivation

This feature implements FR-001 through FR-005 from PRD Section 6. The PRD identifies inconsistent service-specific stubs as a current pain point for the Service Developer persona, and this feature removes that duplication by centralizing seeded lookup behavior behind one documented JSON API. It also carries the architecture decision to keep the service as a single Minimal API surface defined by ADR-0001.

## User Stories

- As a **Service Developer**, I want **to request a mock temperature reading for a known sensor in a supported region** so that **my dependent service can exercise temperature-driven logic against one shared test endpoint**.
- As a **Test Automation Engineer**, I want **the lookup API to return the same success and error shapes on every run** so that **integration tests can assert the contract without custom per-suite adapters**.

## Acceptance Criteria

- [x] `GET /api/temperature/{region}/{sensorId}` returns `200 OK` with JSON containing `sensorId`, `region`, `temperature`, `humidity`, and `unit` when both route values are valid and a seeded mock exists.
- [x] The endpoint accepts only supported canonical regions from configuration and only 8-character alphanumeric sensor IDs; invalid route values return `400 Bad Request` with `application/problem+json` describing the validation failure.
- [x] If the route values are syntactically valid but no seeded mock exists for the normalized lookup key, the endpoint returns `404 Not Found` with `application/problem+json` and a machine-readable error code.
- [x] All success and failure responses are JSON in v1 and expose one stable contract shape documented in this spec. Failure responses use the RFC 7807 fields `type`, `title`, `status`, and `detail` plus the machine-readable `errorCode`; v1 failure codes are `invalid_sensor_id`, `unsupported_region`, `mock_not_found`, and `dataset_unavailable`.
- [x] The endpoint performs no external HTTP, database, or queue call while fulfilling a request.

## API / Interface Definition

GET /api/temperature/{region}/{sensorId}
Authorization: N/A - v1 is intentionally unauthenticated in isolated test environments per PRD Section 7.

Route parameters:
- `region`: string (required) - canonical region code from `TemperatureSensor:SupportedRegions`, expected values `eus` or `wus2` in v1
- `sensorId`: string (required) - 8-character alphanumeric identifier validated against `^[A-Za-z0-9]{8}$`

Request body:
None.

Response [200]:
```json
{
  "sensorId": "A1B2C3D4",
  "region": "eus",
  "temperature": 21.5,
  "humidity": 45.0,
  "unit": "C"
}
```

Field contract:
- `sensorId`: string - requested sensor identifier echoed from the normalized lookup result
- `region`: string - canonical supported region code used for lookup
- `temperature`: number - seeded numeric temperature value for the lookup key
- `humidity`: number - seeded numeric humidity value paired with the temperature reading
- `unit`: string - seeded unit label for the temperature value, echoed from the stored mock artifact; v1 seeded test data uses `C`, but the API does not hard-code or reject future artifact values solely because they differ from `C`

Errors:
- `400` `application/problem+json`
```json
{
  "type": "https://httpstatuses.com/400",
  "title": "Invalid lookup request",
  "status": 400,
  "detail": "Sensor ID must be 8 alphanumeric characters.",
  "errorCode": "invalid_sensor_id"
}
```
All `400` validation failures use the same `application/problem+json` shape. `title` is `Invalid lookup request`. `errorCode` is `invalid_sensor_id` when the sensor ID fails `TemperatureSensor:SensorIdPattern`, or `unsupported_region` when the region is not in `TemperatureSensor:SupportedRegions`. The `detail` field identifies the invalid value and, for unsupported regions, includes the configured canonical region list.
- `404` `application/problem+json`
```json
{
  "type": "https://httpstatuses.com/404",
  "title": "Mock reading not found",
  "status": 404,
  "detail": "No seeded temperature reading exists for region 'eus' and sensor 'A1B2C3D4'.",
  "errorCode": "mock_not_found"
}
```
- `500` `application/problem+json`
```json
{
  "type": "https://httpstatuses.com/500",
  "title": "Mock dataset unavailable",
  "status": 500,
  "detail": "The configured mock dataset could not be read.",
  "errorCode": "dataset_unavailable"
}
```
This runtime `500` contract applies when `TemperatureSensor:ValidateDatasetOnStartup` is `false` and the dataset cannot be read during request handling. When startup validation is enabled, missing or unreadable datasets fail startup per FEAT-003.

## Data Model

TemperatureReadingResponse {
  sensorId:    string   - normalized 8-character sensor identifier from the lookup key
  region:      string   - canonical supported region code
  temperature: decimal  - seeded temperature value returned to the caller
  humidity:    decimal  - seeded humidity value returned to the caller
  unit:        string   - temperature unit label stored in the mock artifact
}

LookupError {
  type:        string   - RFC 7807 problem type URI
  title:       string   - short error title
  status:      int      - HTTP status code
  detail:      string   - human-readable failure description
  errorCode:   string   - machine-readable error category for caller assertions
}

## Edge Cases & Error Handling

| Scenario | Expected behaviour |
|----------|--------------------|
| Caller supplies `EUS` or mixed-case region text | The endpoint normalizes the region to the canonical configured form before lookup and returns `200` or `404` based on the normalized key rather than rejecting case differences. |
| Caller supplies a sensor ID shorter than 8 characters or containing punctuation | The endpoint rejects the request before lookup with `400` and `errorCode` `invalid_sensor_id`. |
| Caller supplies a supported region with a syntactically valid sensor ID that has no seeded artifact | The endpoint returns `404` with `errorCode` `mock_not_found`, allowing callers to distinguish missing seed data from malformed input. |
| Caller issues an unsupported route such as `/api/temperature/eu/A1B2C3D4` | The endpoint returns `400` with `errorCode` `unsupported_region` and does not touch the dataset provider. |

## Out of Scope

- Live sensor integration, simulated telemetry streams, or any runtime call to a real temperature platform.
- Historical lookup queries, bulk lookup requests, or filtering beyond a single `{region}` and `{sensorId}` pair.
- Authentication, authorization, rate limiting, or production internet exposure.

## Dependencies

- Requires: ADR-0001, ADR-0002, ADR-0003
- Requires: a readable mock dataset path configured via `TemperatureSensor:MockDataPath`
- Requires: FEAT-002 for the seeded file format and dataset validation behavior used by this API

## Open Questions

None - v1 seeded data uses `C`, and the API echoes the stored artifact value without constraining future dataset expansion.