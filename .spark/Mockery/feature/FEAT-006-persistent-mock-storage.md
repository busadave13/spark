<!-- SPARK -->

# FEAT-006: Persistent Mock Storage

> **Version**: 1.12<br>
> **Created**: 2026-04-14<br>
> **Last Updated**: 2026-04-21<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved<br>
> **Type**: FEATURE

## Goal

Implement persistent, human-readable storage of captured and manually authored mocks so they survive Mockery restarts, can be inspected or edited in place, and are isolated per development environment. This gives developers and reviewers a predictable location and format for retained mock data across both local and cloud-hosted development workflows. The implementation uses a `BlobMockStore` that persists mocks as human-readable JSON blobs in Azure Blob Storage, with Azurite emulator used locally for development and an Azure Storage account in cloud environments.

## Motivation

This feature delivers **PRD Goal 5** — persist recorded and manually authored mocks across runs in supported development environments. It satisfies **FR-011** (read/write to the environment's selected persistent mock store), **FR-012** (mocks available after restart or new session), and **FR-013** (human-readable form for inspection and editing). The design follows **Architecture Principle 3** (Azure Blob Storage) and implements **ADR-0005** (human-readable storage abstraction per environment) and **ADR-0007** (Azure Blob Storage as sole backend). **PRD User Story 7** requires that Security / Compliance Reviewers can assess retained data in a known, readable storage location.

## User Stories

- As a **Service Developer**, I want my recorded and manual mocks to persist across Mockery restarts so that I don't have to re-record upstream interactions every session.
- As a **Service Developer**, I want mocks stored as human-readable JSON blobs so that I can inspect, edit, and author mocks directly.
- As a **Platform / Developer Experience Team** member, I want an Azure Blob Storage backend so that persistence works seamlessly in both local development (via Azurite) and cloud environments.
- As a **Security / Compliance Reviewer**, I want captured mocks to persist in a known blob container as readable JSON so that I can assess what data is being retained and govern its lifecycle.

## Acceptance Criteria

- [x] Mocks are persisted as human-readable, indented JSON blobs in Azure Blob Storage under the configured `Mockery:Storage:ContainerName`.
- [x] The `IMockStore` interface in the Mockery Core layer defines the storage abstraction; `BlobMockStore` in the Infrastructure layer implements it using the `Azure.Storage.Blobs` SDK.
- [x] `BlobMockStore` is the sole `IMockStore` implementation. No provider selection — Azure Blob Storage is the only backend.
- [x] Connection to Azure Blob Storage is configured through Azure SDK configuration (locally Azurite, cloud via Azure Storage account).
- [x] Mocks written in a previous Mockery process are available for replay when Mockery restarts.
- [x] When `Mockery:Storage:ReadOnly` is `true`, the store returns existing mocks but rejects writes with `MockStoreReadOnlyException`.
- [x] Mock blobs are organized: recorded/stored artifacts at `{ContainerName}/{NormalizedHost}/{HttpMethod}/{FingerprintHash}.json`, manual mock index at `{ContainerName}/manual-index/{id}.json`. Legacy blob paths (`recorded/`, `manual/` prefixes) are searched on read for backward compatibility.
- [x] The storage adapter validates JSON on read; malformed blobs are skipped with a warning log.
- [x] `BlobMockStore` emits `mockery.mock.hit_count` (OTel counter) when `GetAsync` returns a matching artifact, and `mockery.mock.miss_count` when `GetAsync` returns `null`.

## API / Interface Definition

N/A — this feature adds no external-facing API surface. The contracts below are internal Core and Infrastructure interfaces included for implementation context only.

### `IMockStore` (Core — Mockery proxy)

```csharp
/// <summary>
/// Abstraction for reading and writing mock artifacts to persistent storage.
/// Defined in the Mockery proxy's Core layer; implemented by Infrastructure adapters.
/// </summary>
public interface IMockStore
{
    /// <summary>
    /// Retrieves a stored mock artifact matching the given request fingerprint, or null if none exists.
    /// </summary>
    Task<StoredMockArtifact?> GetAsync(RequestFingerprint fingerprint, CancellationToken cancellationToken = default);

    /// <summary>
    /// Persists a mock artifact keyed by the given request fingerprint.
    /// Throws <see cref="MockStoreReadOnlyException"/> when the store is in read-only mode.
    /// </summary>
    Task SaveAsync(RequestFingerprint fingerprint, StoredMockArtifact artifact, CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks whether the store is reachable and writable (unless read-only).
    /// </summary>
    Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default);
}
```

### `BlobMockStore` (Infrastructure — `Mockery`)

```csharp
/// <summary>
/// Persists mock artifacts as human-readable JSON blobs in Azure Blob Storage.
/// Locally backed by Azurite; uses Azure Storage account in cloud.
/// Emits mockery.mock.hit_count on GetAsync match and mockery.mock.miss_count on GetAsync null.
/// Internal visibility — consumers interact through IMockStore and IManualMockStore.
/// </summary>
internal sealed class BlobMockStore(
    IBlobMockContainerClient containerClient,
    IOptions<MockStorageOptions> options,
    MockArtifactDocumentReader documentReader,
    TimeProvider timeProvider,
    IMeterFactory meterFactory,
    ILogger<BlobMockStore> logger) : IMockStore, IManualMockStore
{
    // BlobServiceClient is wrapped by the internal IBlobMockContainerClient abstraction
    // which isolates blob operations (upload, download, list, delete, exists) for testability.
    // MockArtifactDocumentReader handles JSON deserialization, schema validation, and
    // fingerprint computation for manual mock artifacts.

    // Resolves blob path:
    //   Recorded/stored: {NormalizedHost}/{HttpMethod}/{FingerprintHash}.json
    //   Manual index:    manual-index/{id}.json
    // Downloads and deserializes JSON; returns null on blob-not-found.
    // Logs warning and returns null on malformed JSON or unsupported schema version.
    // Emits mockery.mock.hit_count on match, mockery.mock.miss_count on null.
    public Task<StoredMockArtifact?> GetAsync(RequestFingerprint fingerprint, CancellationToken cancellationToken = default);

    // Serializes artifact as indented JSON and uploads to blob storage.
    // Throws MockStoreReadOnlyException when ReadOnly is true.
    // Creates the container if it does not exist.
    public Task SaveAsync(RequestFingerprint fingerprint, StoredMockArtifact artifact, CancellationToken cancellationToken = default);

    // Verifies connectivity to blob storage and that the container is accessible.
    public Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default);
}
```

### `MockStorageOptions`

```csharp
/// <summary>
/// Configuration options bound from "Mockery:Storage" section.
/// </summary>
public sealed class MockStorageOptions
{
    /// <summary>Azure Blob Storage container name for mock artifacts. Default: "mocks".</summary>
    public string ContainerName { get; set; } = "mocks";

    /// <summary>When true, replay works but new writes are rejected.</summary>
    public bool ReadOnly { get; set; } = false;
}
```

### `MockStoreReadOnlyException`

```csharp
/// <summary>
/// Thrown when a write operation is attempted against a read-only mock store.
/// </summary>
public sealed class MockStoreReadOnlyException : InvalidOperationException
{
    public MockStoreReadOnlyException()
        : base("The mock store is configured as read-only. New recordings cannot be persisted.") { }
}
```

### DI Registration

```csharp
// In Program.cs or a ServiceCollectionExtensions method:
services.Configure<MockStorageOptions>(configuration.GetSection("Mockery:Storage"));
services.AddSingleton<MockArtifactDocumentReader>();
services.AddSingleton<IBlobMockContainerClient, AzureBlobMockContainerClient>();
services.AddSingleton<BlobMockStore>();
services.AddSingleton<IMockStore>(sp => sp.GetRequiredService<BlobMockStore>());
services.AddSingleton<IManualMockStore>(sp => sp.GetRequiredService<BlobMockStore>());
// BlobServiceClient is resolved through Azure SDK configuration
// IBlobMockContainerClient wraps BlobServiceClient for testability
```

## Data Model

### `StoredMockArtifact`

```csharp
/// <summary>
/// The persisted representation of a mock — request fingerprint inputs plus the stored response.
/// </summary>
public sealed record StoredMockArtifact
{
    public const int CurrentSchemaVersion = 1;

    public int SchemaVersion { get; init; } = CurrentSchemaVersion;
    public required string FingerprintHash { get; init; }
    public required string HttpMethod { get; init; }
    public required string RequestUri { get; init; }
    public required Dictionary<string, string[]> RequestHeaders { get; init; }
    public required string? RequestBodyNormalized { get; init; }
    public required int ResponseStatusCode { get; init; }
    public required Dictionary<string, string[]> ResponseHeaders { get; init; }
    public required string? ResponseBody { get; init; }
    public required string Source { get; init; }           // "Recorded" | "Manual"
    public required DateTimeOffset CapturedAtUtc { get; init; }
    public string? Description { get; init; }               // Optional human note
}
```

| Property | Type | Description |
|---|---|---|
| `SchemaVersion` | `int` | Schema version for forward-compatibility of persisted blobs. Defaults to `CurrentSchemaVersion` (1). Blobs with an unsupported schema version are skipped on read with a warning log. |
| `FingerprintHash` | `string` | SHA-256 hex digest used as the storage key for this artifact. |
| `HttpMethod` | `string` | HTTP method captured for the stored interaction. |
| `RequestUri` | `string` | Fully qualified upstream request URI represented by the artifact. |
| `RequestHeaders` | `Dictionary<string, string[]>` | Request headers preserved with the stored interaction in a replayable form. |
| `RequestBodyNormalized` | `string?` | Normalized request body content used for inspection and replay when present. |
| `ResponseStatusCode` | `int` | Upstream HTTP status code returned when the artifact was captured. |
| `ResponseHeaders` | `Dictionary<string, string[]>` | Response headers replayed when the artifact is served. |
| `ResponseBody` | `string?` | Response body payload replayed when the artifact is served. |
| `Source` | `string` | Origin of the artifact (`Recorded` or `Manual`). |
| `CapturedAtUtc` | `DateTimeOffset` | UTC timestamp showing when the artifact was persisted. |
| `Description` | `string?` | Optional human-readable note describing why the artifact exists. |

### `RequestFingerprint`

```csharp
/// <summary>
/// Deterministic key computed from request target and materially relevant request shape.
/// Used to look up and key stored mock artifacts.
/// </summary>
public sealed record RequestFingerprint
{
    public required string HttpMethod { get; init; }
    public required string NormalizedHost { get; init; }
    public required string Path { get; init; }
    public required string? NormalizedQuery { get; init; }
    public required Dictionary<string, string[]> RelevantHeaders { get; init; }
    public required string? NormalizedBodyHash { get; init; }

    /// <summary>
    /// SHA-256 hex digest of the canonical fingerprint string.
    /// </summary>
    public required string Hash { get; init; }
}
```

| Property | Type | Description |
|---|---|---|
| `HttpMethod` | `string` | Canonical HTTP method included in the deterministic fingerprint input. |
| `NormalizedHost` | `string` | Normalized upstream host and port used to scope stored mocks per destination. |
| `Path` | `string` | Canonical request path used when matching or keying artifacts. |
| `NormalizedQuery` | `string?` | Canonical query-string representation used when matching requests. |
| `RelevantHeaders` | `Dictionary<string, string[]>` | Header values that materially affect fingerprint calculation. |
| `NormalizedBodyHash` | `string?` | Canonical hash of the normalized request body when body content matters. |
| `Hash` | `string` | Final SHA-256 hex digest of the canonical fingerprint string. |

### Blob Path Convention

Blob names are relative within the Azure Blob Storage container configured by `Mockery:Storage:ContainerName` (default: `"mocks"`).

Recorded and stored mock artifacts:

```
{NormalizedHost}/            # e.g., "api.example.com_443"
  {HttpMethod}/              # e.g., "GET", "POST"
    {FingerprintHash}.json   # SHA-256 hex, e.g., "a1b2c3…f0.json"
```

Manual mock artifacts (indexed by ID):

```
manual-index/
  {id}.json                  # Store-assigned ID, e.g., "a1b2c3d4.json"
```

Legacy blob paths (`recorded/` and `manual/` prefixes) are also searched on read for backward compatibility but are not used for new writes.

### Example Persisted JSON

```json
{
  "schemaVersion": 1,
  "fingerprintHash": "a1b2c3d4e5f6…",
  "httpMethod": "GET",
  "requestUri": "https://api.example.com/v1/users/42",
  "requestHeaders": {
    "Accept": ["application/json"],
    "Content-Type": ["application/json"]
  },
  "requestBodyNormalized": null,
  "responseStatusCode": 200,
  "responseHeaders": {
    "Content-Type": ["application/json"]
  },
  "responseBody": "{\"id\":42,\"name\":\"Jane Doe\"}",
  "source": "Recorded",
  "capturedAtUtc": "2026-04-14T10:30:00Z",
  "description": null
}
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|---|---|
| Container does not exist on startup | `BlobMockStore` creates the container if missing on first write or health check. |
| Blob contains malformed or unparseable JSON | `GetAsync` logs a structured warning with the blob path and error detail, returns `null` (no replay). |
| Blob exists but has an unexpected schema version or missing required fields | `GetAsync` treats it as malformed — logs warning with blob path and schema version, returns `null`. Blobs with `schemaVersion` higher than `StoredMockArtifact.CurrentSchemaVersion` are skipped to prevent misinterpreting future formats. |
| `Mockery:Storage:ReadOnly` is `true` and a record attempt occurs | `SaveAsync` throws `MockStoreReadOnlyException`. The calling core layer catches this and returns a clear error to the transport boundary (`409 Conflict` ProblemDetails with `errorCode = MOCKERY_STORE_READONLY`). |
| Concurrent writes to same fingerprint | Last-write-wins; Azure Blob atomic put ensures no corrupt state. |
| Blob storage unavailable (network failure, auth failure) | Storage adapter throws; transport boundary returns `503 ProblemDetails` per architecture error-path contract. |

## Preservation Constraints

- The existing `IMockStore` interface contract must be preserved. If the interface does not yet exist in the codebase, introduce it in the Mockery Core layer with the signature defined above. If it already exists, extend (do not break) its contract.

## Out of Scope

- **Cross-environment mock sharing or synchronization** — mocks are environment-local per ADR-0005; no sync or replication mechanism is included.
- **Mock versioning, history, or promotion workflows** — overwriting on re-record is the only write semantic; no history tracking or environment-promotion pipeline is provided in v1.
- **Automatic cleanup or expiration of stale mocks** — no TTL, LRU eviction, or scheduled cleanup is implemented; mock lifecycle is manual.

## Dependencies

| Dependency | Type | Notes |
|---|---|---|
| `RequestFingerprint` (from FEAT for request matching) | Internal | The fingerprint record must be defined and computed before storage can key artifacts. Depends on the matching/fingerprinting feature. |
| Mockery proxy Core layer | Internal | Houses `IMockStore`, `StoredMockArtifact`, `RequestFingerprint`, `MockStorageOptions`, and `MockStoreReadOnlyException`. The Mockery proxy does not depend on Mockery.Shared — they maintain independent implementations. |
| `Azure.Storage.Blobs` | NuGet | Azure Blob Storage SDK for blob read/write operations. |
| Azure Blob Storage SDK configuration | Runtime | Resolves connection to Azure Blob Storage (locally Azurite, cloud via Azure Storage account). |
| `System.Text.Json` | NuGet / Runtime | JSON serialization with `JsonSerializerOptions { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase }`. |
| `Microsoft.Extensions.Options` | NuGet / Runtime | Options-pattern binding for `MockStorageOptions`. |
| `Microsoft.Extensions.Logging` | NuGet / Runtime | Structured logging for health, read-warnings, and write-failures. |
