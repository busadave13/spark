<!-- SPARK -->
> **Feature**: FEAT-004: Per-Request Mock Control<br>
> **Spec**: .specs/Mockery/feature/FEAT-004-per-request-mock-control.md<br>
> **Test files**: src/Test/Mockery/Mockery.UnitTests/Core/MockPolicyTests.cs, src/Test/Mockery/Mockery.UnitTests/Core/PolicyResolutionServiceTests.cs, src/Test/Mockery/Mockery.UnitTests/MockPolicyMiddlewareTests.cs<br>
> **Test runner**: xUnit<br>
> **Approved**: 2025-07-17<br>
> **Status**: Implemented
> **Completed**: 2025-07-17

## Test plan — FEAT-004: Per-Request Mock Control

10 ACs · 38 test cases total

### AC-01: Valid JSON activates mocking for non-excluded hosts

| Category | Test name |
|---|---|
| happy | resolve_valid_json_with_all_fields_returns_active_policy |
| edge | resolve_empty_json_object_returns_active_policy_with_defaults |

### AC-02: excludeHosts causes passthrough for listed hosts

| Category | Test name |
|---|---|
| happy | should_passthrough_returns_true_for_exact_host_match |
| edge | should_passthrough_returns_true_for_wildcard_match |
| failure | should_passthrough_returns_false_when_host_not_excluded |
| edge | should_passthrough_is_case_insensitive |

### AC-03: Empty/omitted excludeHosts means mock everything

| Category | Test name |
|---|---|
| happy | resolve_json_with_empty_exclude_hosts_returns_empty_set |
| edge | resolve_json_without_exclude_hosts_field_returns_empty_set |

### AC-04: No header means full passthrough

| Category | Test name |
|---|---|
| happy | missing_mock_header_sets_inactive_policy_and_continues |

### AC-05: Config excluded hosts always passthrough

| Category | Test name |
|---|---|
| happy | resolve_merges_config_excluded_hosts_into_policy |
| edge | resolve_deduplicates_overlapping_header_and_config_hosts |

### AC-06: Malformed JSON returns 400 ProblemDetails

| Category | Test name |
|---|---|
| failure | empty_header_value_returns_400_with_invalid_header_value_error_code |
| failure | whitespace_only_header_returns_400_with_invalid_header_value_error_code |
| failure | invalid_json_header_returns_400_with_invalid_json_error_code |
| failure | non_json_string_header_returns_400_with_invalid_json_error_code |
| edge | error_response_contains_problem_details_type_and_title |

### AC-07: Defaults for omitted fields, {} is valid

| Category | Test name |
|---|---|
| happy | resolve_omitted_max_hops_defaults_to_zero |
| edge | resolve_null_max_hops_treated_as_default_zero |
| edge | resolve_null_exclude_hosts_treated_as_default_empty |
| edge | resolve_unknown_json_fields_are_ignored |

### AC-08: Immutable request-scoped context

| Category | Test name |
|---|---|
| happy | inactive_policy_has_expected_default_values |
| happy | valid_header_stores_policy_in_http_context_features |

### AC-09: Propagation data model (forwarding is FEAT-005)

| Category | Test name |
|---|---|
| happy | should_propagate_is_true_when_active_and_max_hops_positive |
| failure | should_propagate_is_false_when_max_hops_is_zero |
| happy | decrement_max_hops_reduces_value_by_one |
| edge | decrement_max_hops_at_zero_stays_at_zero |
| edge | decrement_max_hops_clears_header_value |
| edge | decrement_on_inactive_policy_returns_inactive |

### AC-10: maxHops parsed as non-negative integer

| Category | Test name |
|---|---|
| happy | resolve_positive_max_hops_is_captured_correctly |
| failure | resolve_negative_max_hops_throws_validation_error |
| failure | resolve_string_max_hops_throws_validation_error |
| failure | resolve_float_max_hops_throws_validation_error |
| failure | resolve_non_string_exclude_hosts_element_throws_validation_error |
| failure | resolve_non_array_exclude_hosts_throws_validation_error |

### Middleware edge cases (cross-AC)

| Category | Test name |
|---|---|
| edge | multiple_mock_headers_uses_first_value |
| edge | header_value_with_whitespace_is_trimmed_before_parsing |
| edge | configurable_header_name_is_used_from_options |
| edge | middleware_skips_mockery_management_paths |

## Coverage gaps

None

## Resolved ambiguities

AC-06 — ProblemDetails `extensions.errorCode` in spec sample — using ASP.NET Core standard serialization where extension properties appear at root level per RFC 9457, consistent with existing ProxyEndpoints pattern.
AC-09 — "Full propagation behavior is specified in FEAT-005" — implementing data model only (ShouldPropagate, DecrementMaxHops, MaxHops), not forwarding logic.
AC-08 — Middleware scope — middleware skips `/_mockery/` management paths since spec says "every reverse-proxied request."
AC-08 — ProxyEndpoints refactor — endpoint reads from IMockPolicyFeature instead of inline parsing; behaviour-preserving change.
AC-10 — Float maxHops — using TryGetInt32() which rejects non-integer JSON numbers like 1.5.
