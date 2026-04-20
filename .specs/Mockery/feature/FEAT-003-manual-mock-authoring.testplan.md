<!-- SPARK -->
> **Feature**: FEAT-003: Manual Mock Authoring<br>
> **Spec**: .specs/Mockery/feature/FEAT-003-manual-mock-authoring.md<br>
> **Test file**: src/Test/Mockery/Mockery.UnitTests/ManualMockEndpointTests.cs<br>
> **Test runner**: xUnit<br>
> **Approved**: 2026-04-19<br>
> **Status**: Implemented
> **Completed**: 2026-04-19

## Test plan — FEAT-003: Manual Mock Authoring

7 ACs · 22 test cases total

### AC-01: A manually authored mock matched and replayed using same fingerprint rules

| Category | Test name |
|---|---|
| happy | create_mock_computes_fingerprint_using_core_fingerprint_computer |
| edge | create_mock_with_body_hash_null_for_bodiless_method_succeeds |

### AC-02: Edit-in-place — changes take effect without restart

| Category | Test name |
|---|---|
| happy | update_mock_returns_updated_artifact_with_new_response |
| edge | update_mock_recomputes_fingerprint_from_changed_request_fields |

### AC-03: Management API CRUD under /_mockery/mocks

| Category | Test name |
|---|---|
| happy | list_mocks_returns_all_stored_mocks |
| happy | list_mocks_with_method_filter_returns_only_matching |
| happy | get_mock_by_id_returns_matching_artifact |
| failure | get_nonexistent_mock_returns_404_problem_details |
| happy | create_mock_returns_201_with_location_header_and_artifact |
| happy | update_mock_returns_200_with_updated_artifact |
| happy | delete_mock_returns_204_on_success |

### AC-04: Validation on load with warning logs for malformed mocks

| Category | Test name |
|---|---|
| failure | create_mock_missing_request_returns_400_with_invalid_error_code |
| failure | create_mock_missing_response_returns_400_with_invalid_error_code |
| failure | create_mock_missing_required_request_fields_returns_400 |
| failure | update_mock_with_invalid_body_returns_400 |

### AC-05: ReadOnly mode returns 403 for write operations

| Category | Test name |
|---|---|
| failure | create_mock_in_readonly_mode_returns_403_with_readonly_error_code |
| failure | update_mock_in_readonly_mode_returns_403_with_readonly_error_code |
| failure | delete_mock_in_readonly_mode_returns_403_with_readonly_error_code |

### AC-06: Delete non-existent returns 404

| Category | Test name |
|---|---|
| failure | delete_nonexistent_mock_returns_404_with_not_found_error_code |

### AC-07: Create with conflicting fingerprint returns 409

| Category | Test name |
|---|---|
| failure | create_mock_with_duplicate_fingerprint_returns_409_conflict |
| edge | update_mock_fingerprint_conflict_with_different_mock_returns_409 |
| edge | update_mock_same_fingerprint_as_own_succeeds |

## Coverage gaps

None

## Resolved ambiguities

AC-04 — "malformed mock" — defined as: missing `request`, missing `response`, missing `request.method`, missing `request.destination`, missing `request.path`, or missing `response.statusCode`. Default from Data Model required fields.
AC-05 — ProblemDetails `detail` text — uses error code string `MOCKERY_STORE_READONLY` in the `detail` field, consistent with existing `ProxyEndpoints.ProblemResult` pattern.
AC-07 — Update fingerprint conflict — update that changes fingerprint to conflict with a *different* mock returns 409; updating to same-ID's own fingerprint succeeds. From spec's Update error table.
