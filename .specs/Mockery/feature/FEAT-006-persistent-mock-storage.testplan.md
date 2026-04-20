<!-- SPARK -->
> **Feature**: FEAT-006: Persistent Mock Storage<br>
> **Spec**: .specs/Mockery/feature/FEAT-006-persistent-mock-storage.md<br>
> **Test file**: Mockery.UnitTests/BlobMockStoreTests.cs<br>
> **Test runner**: xUnit<br>
> **Approved**: 2025-07-14<br>
> **Status**: Implemented

## Test plan — FEAT-006: Persistent Mock Storage

9 ACs · 15 test cases total

### AC-01: Mocks persisted as human-readable indented JSON blobs in Azure Blob Storage

| Category | Test name |
|---|---|
| happy | save_async_persists_artifact_as_indented_camel_case_json |

### AC-02: IMockStore interface + BlobMockStore implementation

Structural — verified by compilation. BlobMockStore implements IMockStore. Covered by all other AC tests.

### AC-03: BlobMockStore is the sole IMockStore implementation

Structural — verified by DI registration. No separate behavioral test.

### AC-04: Connection via Aspire service discovery

Integration concern — no unit test. Flagged for integration test suite.

### AC-05: Mocks available after restart (save→get round trip)

| Category | Test name |
|---|---|
| happy | get_async_returns_previously_saved_artifact |
| failure | get_async_returns_null_when_no_blob_exists |

### AC-06: ReadOnly mode rejects writes with MockStoreReadOnlyException

| Category | Test name |
|---|---|
| happy | get_async_returns_artifact_when_store_is_read_only |
| failure | save_async_throws_read_only_exception_when_store_is_read_only |
| edge | is_healthy_async_succeeds_when_store_is_read_only |

### AC-07: Blob path organization + legacy fallback

| Category | Test name |
|---|---|
| happy | save_async_writes_blob_at_host_method_hash_path |
| edge | get_async_falls_back_to_legacy_recorded_prefix_path |

### AC-08: JSON validation on read; malformed blobs skipped with warning

| Category | Test name |
|---|---|
| failure | get_async_returns_null_for_malformed_json_blob |
| failure | get_async_returns_null_for_unsupported_future_schema_version |
| edge | get_async_logs_warning_with_blob_path_for_malformed_json |

### AC-09: OTel counters on GetAsync

| Category | Test name |
|---|---|
| happy | get_async_increments_hit_count_on_match |
| happy | get_async_increments_miss_count_when_blob_not_found |

### Edge cases (from spec error handling table)

| Category | Test name |
|---|---|
| edge | save_async_creates_container_if_not_exists |
| failure | is_healthy_async_returns_false_when_container_unreachable |

### Coverage gaps

- AC-02: Structural — verified by compilation, no behavioral test.
- AC-03: Structural — verified by DI registration, no behavioral test.
- AC-04: Integration concern — requires Aspire AppHost + Azurite. Flagged for integration test suite.
