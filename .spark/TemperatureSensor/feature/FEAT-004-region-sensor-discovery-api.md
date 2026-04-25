<!-- SPARK -->
# FEAT-004: Region Sensor Discovery API

> **Version**: 1.0<br>
> **Created**: 2026-04-15<br>
> **Last Updated**: 2026-04-18<br>
> **Owner**: Dave Harding<br>
> **Project**: Temperature Sensor WebAPI Service<br>
> **Status**: Approved

## Goal

Provide a discovery endpoint that returns the list of available sensor IDs for a given region so that callers can enumerate sensors before requesting individual temperature readings. This feature also restructures the temperature API route hierarchy by nesting sensor operations under a `/sensors` segment, changing the existing lookup route from `GET /api/temperature/{region}/{sensorId}` to `GET /api/temperature/{region}/sensors/{sensorId}`.

## Motivation

Callers of the temperature lookup API currently need to know valid sensor IDs in advance — there is no way to discover which sensors exist for a given region through the API itself. This forces dependent services and test automation to hard-code sensor IDs or maintain separate lists outside the temperature service, undermining PRD Goal 2 (standardize mock temperature responses used in local integration scenarios). Adding a sensor list endpoint directly supports the Service Developer and Test Automation Engineer personas identified in PRD §3 by giving them a self-service discovery mechanism within the same API boundary. The route restructuring groups sensor operations under a common `/sensors` resource segment, improving discoverability and aligning with RESTful resource nesting conventions.

## User Stories

- As a **Service Developer**, I want **to request the list of available sensor IDs for a region** so that **my dependent service can dynamically discover valid sensors instead of hard-coding IDs**.
- As a **Integration Test Author**, I want **a discovery endpoint that returns all seeded sensor IDs for a region** so that **automated tests can enumerate sensors and exercise each one without maintaining a separate inventory**.

## Acceptance Criteria

- [ ] `GET /api/temperature/{region}/sensors` returns `200 OK` with a JSON array of sensor ID strings when the region is supported and at least one mock artifact exists for that region.
- [ ] The sensor IDs returned are derived at runtime by scanning the mock dataset folder for files matching the `{region}-{sensorId}.json` naming pattern — no separate static list is maintained.
- [ ] If the region is supported but no mock artifacts exist for it, the endpoint returns `200 OK` with an empty JSON array.
- [ ] If the region is not in the configured `TemperatureSensor:SupportedRegions` list, the endpoint returns `400 Bad Request` with `application/problem+json` and `errorCode` `unsupported_region`.
- [ ] The existing temperature lookup endpoint moves from `GET /api/temperature/{region}/{sensorId}` to `GET /api/temperature/{region}/sensors/{sensorId}` with no change to its request validation, response contract, or error behaviour.
- [ ] The endpoint performs no external HTTP, database, or queue call while fulfilling a request.

## API / Interface Definition

### Sensor list endpoint (new)

GET /api/temperature/{region}/sensors
Authorization: N/A — v1 is intentionally unauthenticated per PRD §7.

Route parameters:
- `region`: string (required) — canonical region code from `TemperatureSensor:SupportedRegions`, expected values `eus` or `wus2` in v1

Request body:
None.

Response [200]:
```json
{
  "region": "eus",
  "sensorIds": ["A1B2C3D4"]
}
```

Field contract:
- `region`: string — the canonical supported region code echoed from the normalized route value
- `sensorIds`: string[] — list of 8-character alphanumeric sensor IDs discovered from the mock dataset for the given region, sorted alphabetically

Errors:
- `400` `application/problem+json`
```json
{
  "type": "https://httpstatuses.com/400",
  "title": "Invalid lookup request",
  "status": 400,
  "detail": "Region 'xyz' is not supported.",
  "errorCode": "unsupported_region"
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

### Temperature lookup endpoint (route change only)

The existing `GET /api/temperature/{region}/{sensorId}` endpoint moves to:

GET /api/temperature/{region}/sensors/{sensorId}

All request validation, response contract fields (`sensorId`, `region`, `temperature`, `humidity`, `unit`), error responses, and status codes remain identical to FEAT-001. Only the route path changes.

## Data Model

RegionSensorsResponse {
  region:    string    — canonical supported region code
  sensorIds: string[]  — alphabetically sorted sensor IDs discovered from mock files matching the region
}

No changes to `TemperatureReadingResponse`, `TemperatureMockArtifact`, or `LookupError` — those remain as defined in FEAT-001.

## Edge Cases & Error Handling

| Scenario | Expected behaviour |
|----------|--------------------|
| Caller supplies `EUS` or mixed-case region text for the sensor list endpoint | The endpoint normalizes the region to the canonical configured form before scanning mock files and returns `200` with the discovered sensor IDs. |
| Caller supplies a supported region that has no seeded mock artifacts | The endpoint returns `200 OK` with `sensorIds` as an empty array — an empty region is not an error. |
| Caller supplies an unsupported region for the sensor list endpoint | The endpoint returns `400` with `errorCode` `unsupported_region` and does not scan the dataset folder. |
| The mock dataset folder is missing or unreadable when the sensor list endpoint is called | The endpoint returns `500` with `errorCode` `dataset_unavailable` and logs the failure. |
| A file in the Mocks folder does not match the `{region}-{sensorId}.json` naming pattern | The file is silently skipped during sensor discovery — only files matching the expected pattern contribute sensor IDs. |
| Caller uses the old route `GET /api/temperature/{region}/{sensorId}` after the route change | The old route returns `404` — no redirect or backward-compatible alias is provided. |

## Preservation Constraints

- The temperature lookup response contract (`sensorId`, `region`, `temperature`, `humidity`, `unit` fields, all error shapes, and status codes) must not change — only the route path moves from `/api/temperature/{region}/{sensorId}` to `/api/temperature/{region}/sensors/{sensorId}`.
- The `ITemperatureLookupService.LookupAsync` method signature and behaviour must not change.
- The `ITemperatureMockStore.GetAsync` method signature must not change — the sensor list functionality uses the store's file-system access or a new method rather than modifying the existing one.
- Existing unit tests for the temperature lookup endpoint must continue to pass after adjusting only the route path in test setup.

## Out of Scope

- Pagination, filtering, or sorting options beyond alphabetical order for the sensor list.
- Adding or removing mock artifacts through the API — the dataset remains read-only and file-backed per ADR-0002.
- Returning sensor metadata (temperature values, humidity, unit) in the list response — callers use the individual lookup endpoint for full readings.

## Dependencies

- Requires: ADR-0001 (single Minimal API surface), ADR-0002 (file-backed mock dataset — sensor discovery scans the same `Mocks` folder)
- Requires: FEAT-001 (defines the temperature lookup contract that this feature preserves and re-routes)
- Requires: FEAT-002 (defines the mock dataset file format and naming convention used by sensor discovery)
