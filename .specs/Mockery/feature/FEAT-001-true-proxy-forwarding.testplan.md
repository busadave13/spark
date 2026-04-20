<!-- SPARK -->
> **Feature**: FEAT-001: True-Proxy Forwarding<br>
> **Spec**: /Users/daveharding/source/repos/Test/.specs/Mockery/feature/FEAT-001-true-proxy-forwarding.md<br>
> **Test file**: src/Test/Mockery/Mockery.UnitTests/TrueProxyForwardingTests.cs<br>
> **Test runner**: xUnit<br>
> **Approved**: 2026-04-18<br>
> **Completed**: 2025-07-25<br>
> **Status**: Implemented

## Test plan — FEAT-001: True-Proxy Forwarding

8 ACs · 25 test cases total

### AC-01: Mockery accepts an HTTP request whose URL has been rewritten by the Mockery.Shared MockPolicyPropagationHandler to target the Mockery proxy, with the original upstream hostname carried in the X-Forwarded-Host header, and forwards it to the real upstream destination without requiring any prior registration of that upstream host.

| Category | Test name |
|---|---|
| happy | rewritten_request_with_forwarded_host_is_forwarded_to_original_upstream |
| failure | missing_forwarded_host_returns_400_problem_details |
| failure | invalid_forwarded_host_returns_400_problem_details |

### AC-02: When no stored mock matches the incoming request fingerprint, Mockery forwards the request to the real upstream and returns the upstream's response (status code, headers, body) unmodified to the caller.

| Category | Test name |
|---|---|
| happy | replay_miss_returns_upstream_status_body_and_content_type |
| happy | replay_miss_forwards_method_path_query_and_body_to_upstream |
| edge | replay_miss_preserves_forwardable_custom_response_headers |

### AC-03: When a forwarded upstream call returns a successful response (2xx) and the request includes a valid X-Mockery-Mock header (mocking active; record on replay miss), Mockery persists the response as a human-readable JSON mock artifact in the configured storage location before returning the response to the caller.

| Category | Test name |
|---|---|
| happy | mock_enabled_successful_replay_miss_persists_recorded_artifact |
| failure | request_without_mock_header_does_not_record_successful_response |
| edge | recorded_artifact_is_written_as_human_readable_json |
| edge | recorded_artifact_uses_forwarded_host_method_and_fingerprint_path_segments |
| edge | recorded_artifact_includes_request_response_and_capture_metadata |

### AC-04: A newly added HTTP dependency (a host Mockery has never seen) works through the proxy on the first request, and a single running Mockery instance can forward requests to two different previously unseen upstream hosts sequentially without any configuration change, restart, or redeployment of Mockery.

| Category | Test name |
|---|---|
| happy | first_request_to_unseen_host_forwards_without_registration |
| happy | same_proxy_instance_forwards_second_unseen_host_without_reconfiguration |
| edge | unseen_hosts_with_distinct_ports_forward_sequentially_without_restart |

### AC-05: If the real upstream is unreachable (connection refused, DNS resolution failure, or TCP timeout), Mockery returns HTTP 502 Bad Gateway with ProblemDetails and does not hang or return a misleading success.

| Category | Test name |
|---|---|
| failure | connection_refused_maps_to_502_problem_details_without_recording |
| failure | dns_failure_maps_to_502_problem_details_without_recording |
| failure | timeout_failure_maps_to_502_problem_details_without_recording |

### AC-06: If the upstream returns a non-2xx response and the request includes a valid X-Mockery-Mock header (mocking active; record on replay miss), Mockery returns the upstream response to the caller but does not persist a mock artifact for that interaction.

| Category | Test name |
|---|---|
| happy | non_success_upstream_response_is_returned_without_recording |
| edge | non_success_response_preserves_forwardable_custom_headers_and_body |
| failure | mock_enabled_500_response_does_not_create_artifact |

### AC-07: Requests to hosts listed in Mockery:Capture:ExcludedHosts are forwarded to the upstream but never recorded, regardless of whether a valid X-Mockery-Mock header is present.

| Category | Test name |
|---|---|
| happy | excluded_host_is_forwarded_without_recording_even_when_mock_header_is_present |
| edge | wildcard_excluded_host_is_forwarded_without_recording |
| edge | excluded_host_passthrough_keeps_real_upstream_response_intact |

### AC-08: The existing OpenAPI mapping in Program.cs continues to function unchanged after proxy transport is added, verified by WebApplicationFactory<Program> bootstrapping the app successfully and GET /openapi/v1.json returning 200 OK in the Development environment.

| Category | Test name |
|---|---|
| happy | web_application_factory_bootstraps_program_in_development |
| happy | development_openapi_document_returns_200_ok |

## Coverage gaps

None

## Resolved ambiguities

- AC-02 — "response unmodified" means status code, body, content type, and forwardable custom headers only; hop-by-hop and transport-filtered headers remain subject to ASP.NET Core and HttpClient behavior.
- AC-03 — "recording active" means a valid X-Mockery-Mock header is present, mocking is active for the request, and the proxy is in record-on-miss flow.
- AC-05 — "does not hang" is verified by deterministic unreachable-upstream failures mapping to 502 ProblemDetails without retry loops, not by a wall-clock SLA.
- AC-07 — excluded hosts are never recorded even when a valid X-Mockery-Mock header is present.