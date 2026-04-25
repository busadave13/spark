<!-- SPECIT -->
# FEAT-001: Region Sensor List

> **Version**: 1.2<br>
> **Created**: 2026-04-15<br>
> **Last Updated**: 2026-04-20<br>
> **Owner**: Dave Harding<br>
> **Project**: Pressure Sensor<br>
> **Status**: Draft

## Goal

Provide an endpoint that returns the list of available sensor IDs for a given region so that dependent services can discover which sensors are available before requesting individual pressure readings. This supports PRD Goal 1 (one stable pressure-data API) by giving callers a programmatic way to enumerate sensors without prior knowledge of the mock dataset.

## Motivation

Dependent services that consume pressure data need to know which sensor IDs exist for a region before calling the per-sensor pressure lookup endpoint (`GET /api/pressure/{region}/sensors/{sensorId}`). Without a discovery endpoint, callers must hard-code sensor IDs or inspect the mock dataset files directly, which couples them to the dataset layout and violates the principle of a self-contained API contract. This feature implements part of FR-002 (return mock barometric pressure for a known region) by enabling region-scoped sensor discovery, and supports FR-007 (make the seeded mock dataset human-readable to developers) by exposing dataset contents through the API.

## User Stories

- As a **Service Developer**, I want to **request a list of sensor IDs for a region** so that **I can discover available sensors and call the pressure lookup endpoint for each one without hard-coding sensor IDs**.
- As a **Test Automation Engineer**, I want to **programmatically enumerate sensors per region** so that **my automated test suites can dynamically iterate over all available pressure readings for a region**.

## Acceptance Criteria

- [ ] `GET /api/pressure/{region}/sensors` returns a `200 OK` JSON response containing an array of sensor ID strings for the requested region.
- [ ] The returned sensor IDs are derived by scanning the `Mocks/` directory for files matching the `{region}-{sensorId}.json` naming convention — no separate index or hardcoded list.
- [ ] Each sensor ID in the response corresponds to an existing mock artifact file that the per-sensor pressure lookup endpoint can resolve.
- [ ] If the region is not in the configured `SupportedRegions` list, the endpoint returns `400 Bad Request` with Problem Details containing `errorCode: unsupported_region`.
- [ ] If the region is supported but no mock files exist for it, the endpoint returns `200 OK` with an empty array.
- [ ] The endpoint normalizes the region parameter to lowercase before scanning, consistent with the existing pressure lookup endpoint behaviour.
- [ ] The response shape includes the region and sensor ID array: `{ "region": "eus", "sensorIds": ["A1B2C3D4", ...] }`.

## API / Interface Definition

```
GET /api/pressure/{region}/sensors

Path parameters:
  region: string — region identifier (required, validated against SupportedRegions)

Response [200 OK]:
{
  "region": "string — the normalized region identifier",
  "sensorIds": ["string — 8-character alphanumeric sensor IDs"]
}

Errors:
  400 {
    "type": "https://httpstatuses.com/400",
    "title": "Invalid lookup request",
    "status": 400,
    "detail": "Region '{region}' is not supported. Supported regions: {list}.",
    "errorCode": "unsupported_region"
  }

  500 {
    "type": "https://httpstatuses.com/500",
    "title": "Mock dataset unavailable",
    "status": 500,
    "detail": "The configured mock dataset could not be read.",
    "errorCode": "dataset_unavailable"
  }
```

## Data Model

```
RegionSensorsResponse {
  region:    string    — the normalized region identifier
  sensorIds: string[] — list of sensor IDs found in the Mocks/ directory for this region
}
```

The sensor IDs are extracted from existing `{region}-{sensorId}.json` filenames in the `Mocks/` directory. No new mock artifacts or data files are introduced — this feature reads the same file-backed dataset defined in ADR-0002.

## Edge Cases & Error Handling

| Scenario | Expected behaviour |
|---|---|
| Region is supported but no mock files exist for it | Return `200 OK` with `{ "region": "...", "sensorIds": [] }` |
| Region parameter contains mixed case (e.g., `EUS`) | Normalize to lowercase (`eus`) before scanning; return results for the normalized region |
| `Mocks/` directory is missing or unreadable at runtime | Return `500 Internal Server Error` with Problem Details (`errorCode: dataset_unavailable`) |
| Region is not in `SupportedRegions` configuration | Return `400 Bad Request` with Problem Details (`errorCode: unsupported_region`) |
| Mock file exists but does not match `{region}-{sensorId}.json` pattern | File is ignored; only files matching the convention are included in the sensor list |
| Multiple mock files exist for the same region (e.g., `eus-A1B2C3D4.json`, `eus-Z9Y8X7W6.json`) | All matching sensor IDs are returned in the array |

## Out of Scope

- Not included: Returning pressure reading data in the sensor list response — callers must use the per-sensor `GET /api/pressure/{region}/sensors/{sensorId}` endpoint to retrieve actual readings.
- Not included: Filtering or pagination of the sensor list — the mock dataset is small and static; all matching sensors are returned in a single response.
- Not included: Sensor metadata (name, location, status) — the response contains only sensor IDs, consistent with the minimal mock dataset contract.

## Dependencies

- Requires: [ADR-0002: File-Backed JSON Mock Dataset](../adr/ADR-0002-file-backed-json-mock-dataset.md) — sensor IDs are derived from the `{region}-{sensorId}.json` file naming convention in the `Mocks/` directory.
