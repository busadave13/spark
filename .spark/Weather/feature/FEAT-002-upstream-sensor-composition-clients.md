<!-- SPARK -->

# FEAT-002: Upstream Sensor Composition Clients

> **Version**: 1.0<br>
> **Created**: 2026-04-20<br>
> **Last Updated**: 2026-04-20<br>
> **Owner**: Dave Harding<br>
> **Project**: Weather<br>
> **Status**: Draft

## Goal

Provide the typed HTTP client layer that retrieves the required deterministic temperature, humidity, and pressure inputs for a canonical region while keeping sibling service integration details behind Weather's internal boundary.

## Motivation

This feature implements FR-002 and FR-003, operationalizes ADR-0002, and gives Weather one explicit infrastructure boundary for sibling-service composition. The approved architecture requires Weather to use HTTP calls to Temperature Sensor Service and Pressure Sensor Service rather than shared files, shared libraries, or direct dataset access. Because the sibling services expose region-scoped sensor discovery and per-sensor lookup APIs, Weather needs a deterministic internal client flow that can resolve a region to one stable sensor reading from each dependency.

## User Stories

- As a **Service Developer**, I want **Weather Service to hide Temperature Sensor and Pressure Sensor integration details** so that **my consumer code depends on one weather boundary instead of multiple sibling contracts**.
- As a **Platform / Developer Experience Team** member, I want **Weather to use explicit typed dependency clients and configured base URLs** so that **repo-local and cloud-dev composition stays aligned with the approved architecture and is easy to diagnose**.

## Acceptance Criteria

- [ ] Weather registers one typed HTTP client for Temperature Sensor Service and one typed HTTP client for Pressure Sensor Service, using `Weather:TemperatureSensorBaseUrl`, `Weather:PressureSensorBaseUrl`, and the shared timeout budget defined by `Weather:RequestTimeoutSeconds`.
- [ ] The temperature client resolves a canonical region by calling `GET /api/temperature/{region}/sensors`, selecting the first sensor ID in alphabetical order from the returned `sensorIds` array, and then calling `GET /api/temperature/{region}/sensors/{sensorId}` to retrieve temperature and humidity for that region.
- [ ] The pressure client resolves a canonical region by calling `GET /api/pressure/{region}/sensors`, selecting the first sensor ID in alphabetical order from the returned `sensorIds` array, and then calling `GET /api/pressure/{region}/sensors/{sensorId}` to retrieve pressure for that region.
- [ ] If a sibling discovery call returns a supported-region success with an empty `sensorIds` array, the client returns a typed dependency miss result rather than fabricating fallback data.
- [ ] Clients deserialize only the required upstream response fields into explicit internal models, and they return typed outcomes for success, upstream `404`, upstream `5xx`, timeout, invalid JSON, or contract-shape validation failure.
- [ ] No Weather component reads sibling mock files, shares sibling storage, or bypasses the typed client boundary during lookup processing.

## API / Interface Definition

Internal dependency interfaces:
- `ITemperatureSensorClient.GetRegionReadingAsync(region: string, cancellationToken: CancellationToken) -> TemperatureDependencyResult`
- `IPressureSensorClient.GetRegionReadingAsync(region: string, cancellationToken: CancellationToken) -> PressureDependencyResult`

Outbound calls to Temperature Sensor Service:
- `GET /api/temperature/{region}/sensors`
- `GET /api/temperature/{region}/sensors/{sensorId}`

Expected discovery response:
```json
{
  "region": "eus",
  "sensorIds": ["A1B2C3D4", "B1C2D3E4"]
}
```

Expected temperature reading response:
```json
{
  "sensorId": "A1B2C3D4",
  "region": "eus",
  "temperature": 21.5,
  "humidity": 45.0,
  "unit": "C"
}
```

Outbound calls to Pressure Sensor Service:
- `GET /api/pressure/{region}/sensors`
- `GET /api/pressure/{region}/sensors/{sensorId}`

Expected pressure reading response:
```json
{
  "sensorId": "P1Q2R3S4",
  "region": "eus",
  "pressure": 1013.2,
  "unit": "hPa"
}
```

Client result contract expectations:
- Success: normalized reading fields and the selected upstream sensor ID
- Failure: dependency name, failure class, optional upstream status code, and diagnostic detail suitable for FEAT-003 error mapping

## Data Model

RegionSensorDiscoveryResult {
  region:      string    - canonical region echoed by the sibling service
  sensorIds:   string[]  - discovered sensor IDs sorted alphabetically by the sibling service or by the Weather client before selection
}

TemperatureDependencyResult {
  dependency:  string    - fixed value `TemperatureSensor`
  region:      string    - canonical region requested from the dependency
  sensorId:    string?   - selected sensor ID when discovery succeeds
  temperature: decimal?  - normalized temperature value on success
  humidity:    decimal?  - normalized humidity value on success
  unit:        string?   - temperature unit label on success
  outcome:     string    - success | not_found | timeout | upstream_error | invalid_payload | empty_region | transport_error
  statusCode:  int?      - raw upstream HTTP status when available
  detail:      string?   - client diagnostic detail for aggregation and logs
}

PressureDependencyResult {
  dependency:  string    - fixed value `PressureSensor`
  region:      string    - canonical region requested from the dependency
  sensorId:    string?   - selected sensor ID when discovery succeeds
  pressure:    decimal?  - normalized pressure value on success
  unit:        string?   - pressure unit label on success
  outcome:     string    - success | not_found | timeout | upstream_error | invalid_payload | empty_region | transport_error
  statusCode:  int?      - raw upstream HTTP status when available
  detail:      string?   - client diagnostic detail for aggregation and logs
}

## Edge Cases & Error Handling

| Scenario | Expected behaviour |
|----------|--------------------|
| Discovery endpoint returns `200` with an empty `sensorIds` array | The client returns `outcome = empty_region` for the dependency, and aggregation treats the lookup as incomplete rather than successful. |
| Discovery endpoint returns duplicate sensor IDs | The client de-duplicates the set, sorts alphabetically, and uses the first stable sensor ID to preserve deterministic behavior. |
| Lookup endpoint returns a payload whose `region` does not match the requested canonical region | The client returns `outcome = invalid_payload` and does not pass the mismatched values to aggregation. |
| Sibling endpoint times out within the configured Weather timeout budget | The client returns `outcome = timeout` with dependency context and no retry in v1. |
| Sibling endpoint returns malformed JSON or omits required fields | The client returns `outcome = invalid_payload` so FEAT-003 can classify the lookup as a dependency failure. |

## Preservation Constraints

- Weather must consume sibling services over HTTP only; it must not read sibling file-backed datasets directly.
- Base URLs and timeout budgets remain configuration-driven; no dependency address is hard-coded in the client implementation.
- Client interfaces return typed results rather than ASP.NET transport types so the core aggregation layer stays independent from HTTP plumbing.

## Out of Scope

- Retry policies, caching, circuit breakers, or background refresh behavior.
- Selecting multiple sensors or averaging across multiple upstream readings in v1.
- Exposing sibling sensor IDs to Weather callers.

## Dependencies

- Requires: ADR-0002 for HTTP-based sibling-service composition
- Requires: FEAT-001 of Temperature Sensor for the temperature reading contract
- Requires: FEAT-004 of Temperature Sensor for the temperature region sensor discovery contract
- Requires: FEAT-001 of Pressure Sensor architecture contract for `GET /api/pressure/{region}/sensors/{sensorId}`
- Requires: FEAT-001 of Pressure Sensor feature set for the pressure region sensor discovery contract
- Supports: FEAT-003 by returning typed dependency outcomes for aggregation and error classification
