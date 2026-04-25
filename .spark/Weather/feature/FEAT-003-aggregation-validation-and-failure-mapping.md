<!-- SPARK -->

# FEAT-003: Aggregation Validation and Failure Mapping

> **Version**: 1.0<br>
> **Created**: 2026-04-20<br>
> **Last Updated**: 2026-04-20<br>
> **Owner**: Dave Harding<br>
> **Project**: Weather<br>
> **Status**: Draft

## Goal

Define the core aggregation rules that combine normalized upstream dependency results into one complete weather payload and enforce the approved all-or-nothing failure behavior when any required upstream input is missing, invalid, or inconsistent.

## Motivation

This feature implements FR-004, FR-008, FR-009, and FR-010 while directly carrying ADR-0003 into the Weather core layer. The PRD is explicit that a successful weather response is trustworthy only when temperature, humidity, and pressure are all available and valid for the same canonical region. Weather therefore needs one aggregation service that validates upstream completeness, rejects ambiguous partial data, and maps failures to a small set of machine-readable error responses that callers can test and diagnose consistently.

## User Stories

- As a **Service Developer**, I want **Weather to fail clearly when any required upstream weather input is unavailable or invalid** so that **my service can distinguish bad input from dependency failure without parsing multiple upstream contracts**.
- As a **Test Automation Engineer**, I want **the aggregation rules and dependency failure codes to be deterministic** so that **my scenarios can assert complete success or a specific failure class rather than tolerate ambiguous partial payloads**.

## Acceptance Criteria

- [ ] The aggregation service returns success only when Temperature Sensor data includes `temperature`, `humidity`, and temperature `unit`, Pressure Sensor data includes `pressure` and pressure `unit`, and both dependency results refer to the same canonical region as the request.
- [ ] If either dependency result is a timeout, transport error, upstream `5xx`, upstream `404`, empty-region discovery result, or invalid payload, the service returns a failure outcome and does not emit a partial success response.
- [ ] Weather maps dependency failures to `502 Bad Gateway` `application/problem+json` responses with machine-readable `errorCode` values from this set: `temperature_dependency_failed`, `pressure_dependency_failed`, `dependency_incomplete`, and `dependency_region_mismatch`.
- [ ] Dependency failure responses include a `dependency` field naming `TemperatureSensor`, `PressureSensor`, or `MultipleDependencies`, and the `detail` field identifies which required input was unavailable, invalid, or inconsistent.
- [ ] Successful aggregation preserves deterministic behavior by using the exact normalized upstream values for the selected region without averaging, rounding, or synthesizing fallback values.

## API / Interface Definition

Internal aggregation interface:
- `IWeatherAggregationService.GetAsync(region: string, cancellationToken: CancellationToken) -> WeatherAggregationResult`

Successful internal result:
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

Failure response examples:
- `502` `application/problem+json`
```json
{
  "type": "https://httpstatuses.com/502",
  "title": "Weather dependency failure",
  "status": 502,
  "detail": "Temperature data could not be retrieved for region 'eus'.",
  "errorCode": "temperature_dependency_failed",
  "dependency": "TemperatureSensor"
}
```

- `502` `application/problem+json`
```json
{
  "type": "https://httpstatuses.com/502",
  "title": "Weather dependency failure",
  "status": 502,
  "detail": "Temperature Sensor returned region 'wus2' while Pressure Sensor returned region 'eus'.",
  "errorCode": "dependency_region_mismatch",
  "dependency": "MultipleDependencies"
}
```

Aggregation behavior contract:
- The aggregation layer receives typed dependency results from FEAT-002 and never parses raw HTTP responses directly.
- The aggregation layer returns either a complete `WeatherResponse` or a single failure object; it never returns null-valued success payloads.

## Data Model

WeatherAggregationResult {
  isSuccess:    bool                 - true only when a complete weather payload is available
  response:     WeatherResponse?     - populated for complete success only
  failure:      WeatherFailure?      - populated for failure only
}

WeatherFailure {
  status:       int                  - caller-facing HTTP status code, `502` for dependency failures in v1
  errorCode:    string               - machine-readable failure code
  dependency:   string               - `TemperatureSensor`, `PressureSensor`, or `MultipleDependencies`
  detail:       string               - stable diagnostic detail for logs and callers
}

ValidatedWeatherInputs {
  region:            string          - canonical region confirmed across all required inputs
  temperature:       decimal         - required normalized temperature value
  humidity:          decimal         - required normalized humidity value
  pressure:          decimal         - required normalized pressure value
  temperatureUnit:   string          - required temperature unit label
  pressureUnit:      string          - required pressure unit label
}

## Edge Cases & Error Handling

| Scenario | Expected behaviour |
|----------|--------------------|
| Temperature Sensor returns valid temperature and humidity but Pressure Sensor lookup fails | Weather returns `502` with `errorCode` `pressure_dependency_failed` and no success body. |
| Pressure Sensor returns a valid reading but Temperature Sensor discovery is empty for the requested region | Weather returns `502` with `errorCode` `dependency_incomplete` and `dependency` `TemperatureSensor`. |
| Both dependencies fail independently on the same request | Weather returns one `502` failure with `dependency` `MultipleDependencies`; the `detail` names both failed dependencies. |
| One dependency returns the requested region while the other returns a different canonical region | Weather returns `502` with `errorCode` `dependency_region_mismatch`. |
| An upstream payload omits a required unit field | Weather treats the dependency as incomplete and returns `502`; it does not assume a default unit. |

## Preservation Constraints

- No partial success response shape is introduced in v1.
- Failure mapping stays dependency-oriented and machine-readable; callers do not need raw upstream payloads to classify the error.
- The aggregation layer remains transport-agnostic and does not depend on `IResult`, `HttpContext`, or other ASP.NET Core endpoint types.

## Out of Scope

- Best-effort success with warnings, null fields, or soft-degradation behavior.
- Automatic retries, cached fallback data, or synthetic replacement readings.
- Rich dependency history or multi-error payload arrays.

## Dependencies

- Requires: ADR-0003 for the all-or-nothing success rule
- Requires: FEAT-002 for typed dependency results from sibling service calls
- Supports: FEAT-001 by supplying the complete success payload or caller-facing dependency failure result used by the endpoint
