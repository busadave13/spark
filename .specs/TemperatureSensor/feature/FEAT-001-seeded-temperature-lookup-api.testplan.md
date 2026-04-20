<!-- SPARK -->
> **Feature**: FEAT-001: Seeded Temperature Lookup API<br>
> **Spec**: /Users/daveharding/source/repos/xpci/Xbox.Xbet.Svc/src/Test/.specs/TemperatureSensor/feature/FEAT-001-seeded-temperature-lookup-api.md<br>
> **Test file**: /Users/daveharding/source/repos/xpci/Xbox.Xbet.Svc/src/Test/TemperatureSensor/TemperatureSensor.UnitTests/SeededTemperatureLookupApiTests.cs<br>
> **Test runner**: xUnit<br>
> **Approved**: 2026-04-18<br>
> **Status**: Active

## Test plan — FEAT-001: Seeded Temperature Lookup API

5 ACs · 15 test cases total

### AC-01: `GET /api/temperature/{region}/{sensorId}` returns `200 OK` with JSON containing `sensorId`, `region`, `temperature`, `humidity`, and `unit` when both route values are valid and a seeded mock exists.

| Category | Test name |
|---|---|
| happy | seeded_lookup_returns_200_with_seeded_payload |
| failure | unsupported_region_does_not_return_success_contract |
| edge | mixed_case_region_normalizes_to_canonical_lookup_key |

### AC-02: The endpoint accepts only supported canonical regions from configuration and only 8-character alphanumeric sensor IDs; invalid route values return `400 Bad Request` with `application/problem+json` describing the validation failure.

| Category | Test name |
|---|---|
| happy | wus2_route_value_is_accepted_as_supported_region |
| failure | unsupported_region_returns_400_problem_details_with_supported_regions |
| edge | short_sensor_id_returns_400_problem_details_without_store_access |

### AC-03: If the route values are syntactically valid but no seeded mock exists for the normalized lookup key, the endpoint returns `404 Not Found` with `application/problem+json` and a machine-readable error code.

| Category | Test name |
|---|---|
| happy | valid_but_missing_lookup_returns_404_problem_details |
| failure | malformed_sensor_id_is_rejected_as_400_not_404 |
| edge | mixed_case_missing_lookup_uses_normalized_key_in_detail |

### AC-04: All success and failure responses are JSON in v1 and expose one stable contract shape documented in this spec. Failure responses use the RFC 7807 fields `type`, `title`, `status`, and `detail` plus the machine-readable `errorCode`; v1 failure codes are `invalid_sensor_id`, `unsupported_region`, `mock_not_found`, and `dataset_unavailable`.

| Category | Test name |
|---|---|
| happy | success_response_uses_application_json_and_stable_fields |
| failure | dataset_unavailable_returns_500_problem_details_when_startup_validation_disabled |
| edge | problem_responses_use_application_problem_json_and_stable_fields |

### AC-05: The endpoint performs no external HTTP, database, or queue call while fulfilling a request.

| Category | Test name |
|---|---|
| happy | lookup_request_is_satisfied_from_configured_local_dataset_path |
| failure | unsupported_region_is_rejected_before_store_access |
| edge | invalid_sensor_id_is_rejected_before_store_access |

## Coverage gaps

None

## Resolved ambiguities

AC-01 — `unit` is echoed from the stored dataset artifact, and v1 seeded test data uses `C`.
AC-02 — all validation `400` responses use RFC 7807 with `title` = `Invalid lookup request`; `errorCode` distinguishes `invalid_sensor_id` and `unsupported_region`.
AC-04 — the runtime `500 dataset_unavailable` path is covered with `TemperatureSensor:ValidateDatasetOnStartup=false` so the dataset failure happens during request handling instead of startup.