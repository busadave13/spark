<!-- SPARK -->
> **Feature**: FEAT-001: Region Sensor List<br>
> **Spec**: .specs/PressureSensor/feature/FEAT-001-region-sensor-list.md<br>
> **Test file**: src/Test/PressureSensor/PressureSensor.UnitTests/RegionSensorListTests.cs<br>
> **Test runner**: xUnit<br>
> **Approved**: 2026-04-18<br>
> **Status**: Implemented

## Test plan — FEAT-001: Region Sensor List

Test runner: xUnit   Test file: src/Test/PressureSensor/PressureSensor.UnitTests/RegionSensorListTests.cs
7 ACs · 12 test cases total

### AC-01: `GET /api/pressure/{region}/sensors` returns a `200 OK` JSON response containing an array of sensor ID strings for the requested region.

| Category | Test name |
|---|---|
| happy | valid_region_with_mock_files_returns_200_with_all_matching_sensor_ids |

### AC-02: The returned sensor IDs are derived by scanning the `Mocks/` directory for files matching the `{region}-{sensorId}.json` naming convention — no separate index or hardcoded list.

| Category | Test name |
|---|---|
| happy | sensor_ids_extracted_from_region_sensorid_json_filenames |
| failure | files_not_matching_naming_convention_are_ignored |
| edge | sensor_ids_not_matching_configured_pattern_are_excluded |

### AC-03: Each sensor ID in the response corresponds to an existing mock artifact file that the per-sensor pressure lookup endpoint can resolve.

| Category | Test name |
|---|---|
| happy | returned_sensor_ids_correspond_to_existing_mock_filenames |

### AC-04: If the region is not in the configured `SupportedRegions` list, the endpoint returns `400 Bad Request` with Problem Details containing `errorCode: unsupported_region`.

| Category | Test name |
|---|---|
| failure | unsupported_region_returns_400_with_unsupported_region_error_code |
| failure | unsupported_region_problem_details_includes_supported_regions_in_detail |

### AC-05: If the region is supported but no mock files exist for it, the endpoint returns `200 OK` with an empty array.

| Category | Test name |
|---|---|
| happy | supported_region_with_no_mock_files_returns_200_with_empty_array |

### AC-06: The endpoint normalizes the region parameter to lowercase before scanning, consistent with the existing pressure lookup endpoint behaviour.

| Category | Test name |
|---|---|
| happy | mixed_case_region_normalized_to_lowercase_before_scanning |
| edge | uppercase_region_returns_same_results_as_lowercase |

### AC-07: The response shape includes the region and sensor ID array: `{ "region": "eus", "sensorIds": ["A1B2C3D4", ...] }`.

| Category | Test name |
|---|---|
| happy | response_json_contains_region_string_and_sensor_ids_array |

### Edge Cases (from error handling table)

| Category | Test name |
|---|---|
| failure | unreadable_mocks_directory_returns_500_with_dataset_unavailable_error_code |

## Coverage gaps

None

## Resolved ambiguities

- AC-02 — Extracted sensor IDs are validated against the configured `SensorIdPattern` regex. Files whose sensor ID portion does not match the pattern are excluded from results.
- AC-01/AC-07 — The `sensorIds` array order is not guaranteed. Tests use unordered collection comparison.
