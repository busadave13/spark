<!-- SPARK -->
> **Feature**: FEAT-005: Multi-Hop Interception<br>
> **Spec**: .specs/Mockery/feature/FEAT-005-multi-hop-interception.md<br>
> **Test file**: Mockery.UnitTests/MockPolicyPropagationHandlerTests.cs<br>
> **Test runner**: xUnit<br>
> **Approved**: 2026-04-18<br>
> **Status**: Implemented
> **Completed**: 2026-04-18

## Test plan — FEAT-005: Multi-Hop Interception

11 ACs · 24 test cases total

### AC-01: Handler rewrites URL to proxy, sets X-Forwarded-Host, forwards X-Mockery-Mock unchanged when maxHops > 0

| Category | Test name |
|---|---|
| happy | handler_rewrites_url_to_proxy_base_uri_when_policy_active |
| happy | handler_sets_forwarded_host_to_original_upstream_hostname |
| happy | handler_forwards_mock_header_value_unchanged_for_current_hop |
| edge | handler_preserves_original_path_and_query_in_rewritten_url |

### AC-02: Proxy re-serializes JSON with maxHops: N-1 on downstream forwarding

| Category | Test name |
|---|---|
| happy | proxy_forwards_with_decremented_max_hops_in_mock_header |
| edge | proxy_forwards_with_max_hops_zero_when_original_was_one |

### AC-03: maxHops absent or 0 — no X-Mockery-Mock forwarded downstream

| Category | Test name |
|---|---|
| happy | handler_does_not_inject_mock_header_when_max_hops_is_zero |
| happy | proxy_does_not_forward_mock_header_when_max_hops_is_zero |

### AC-04: maxHops does not affect whether current service uses mocking

| Category | Test name |
|---|---|
| happy | policy_is_active_for_current_service_regardless_of_max_hops_value |

### AC-05: Downstream parses propagated header identically

| Category | Test name |
|---|---|
| happy | re_serialized_policy_is_parseable_identically_by_downstream |

### AC-06: W3C trace context preserved across hops

| Category | Test name |
|---|---|
| happy | handler_preserves_traceparent_header_on_outbound_request |
| happy | handler_preserves_tracestate_header_on_outbound_request |

### AC-07: DelegatingHandler automatically rewrites URL and injects header without caller intervention

| Category | Test name |
|---|---|
| happy | handler_intercepts_typed_http_client_call_transparently |

### AC-08: excludeHosts forwarded verbatim across hops

| Category | Test name |
|---|---|
| happy | exclude_hosts_forwarded_verbatim_in_mock_header |
| happy | proxy_preserves_exclude_hosts_in_decremented_header |

### AC-09: Propagation handler honours CancellationToken

| Category | Test name |
|---|---|
| happy | handler_propagates_cancellation_token_to_inner_handler |
| failure | cancelled_token_throws_operation_cancelled_exception |

### AC-10: No X-Mockery-Mock header — handler still rewrites URL and sets X-Forwarded-Host

| Category | Test name |
|---|---|
| happy | handler_rewrites_url_and_sets_forwarded_host_when_no_policy |
| happy | handler_does_not_inject_mock_header_when_policy_is_null |
| edge | handler_uses_request_options_policy_when_accessor_returns_null |

### AC-11: Invalid JSON X-Mockery-Mock returns 400 ProblemDetails with MOCKERY_POLICY_INVALID_JSON

| Category | Test name |
|---|---|
| happy | invalid_json_propagated_header_returns_400_with_policy_invalid_json |
| edge | empty_string_propagated_header_returns_400_with_invalid_header_error |

## Coverage gaps

None

## Resolved ambiguities

- AC-01 — MockeryProxyOptions.BaseUri is treated as required; tests inject http://mockery-proxy:5226
- AC-02 — Re-serialization produces only known fields (maxHops, excludeHosts); unknown fields dropped
- AC-06 — Trace headers preserved by not stripping them (default HttpClient behavior)
- AC-11 — Invalid JSON handling already exists from FEAT-004 middleware; verified via test
- Architecture — MockeryPolicyOptions moved to Mockery.Shared per approved default
