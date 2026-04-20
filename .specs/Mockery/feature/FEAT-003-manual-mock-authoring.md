<!-- SPARK -->

# FEAT-003: Manual Mock Authoring

> **Version**: 1.8<br>
> **Created**: 2026-04-14<br>
> **Last Updated**: 2025-07-17<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Implemented

## Goal

Allow developers to create, edit, and delete mock artifacts directly in the mock store so that services can be exercised against hand-authored responses when an upstream dependency is unavailable or not yet built. Manual mocks follow the same schema and matching rules as recorded mocks and are served through the existing replay pipeline without any special-case logic.

## Motivation

This feature implements **PRD Goal 1** (reduce dependency startup time for service developers) and **PRD Goal 5** (persist recorded and manually authored mocks across runs).

It satisfies the following functional requirement:

- **FR-006**: The system shall allow a manually authored mock to satisfy a request when no recorded mock exists and the authored mock matches the request target and request shape.

The feature is grounded in **ADR-0005** (Human-Readable Storage Abstraction), which mandates that mock artifacts remain human-readable and inspectable, and **ADR-0003** (Request Target and Shape Matching), which requires the same fingerprint-based matching rules for both recorded and manual mocks.

## User Stories

- As a **Service Developer**, I want to author or edit a stored mock directly when an upstream is unavailable so that I can keep building before that dependency is ready.
- As a **Service Developer**, I want to edit a manual mock in place and have changes take effect on the next request without restarting Mockery so that iteration is fast.
- As a **Platform / Developer Experience Team member**, I want manual mocks to follow the same schema as recorded mocks so that tooling and review workflows do not need separate handling.
- As a **Security / Compliance Reviewer**, I want manual mock artifacts to be human-readable and stored in the same inspectable format as recorded mocks so that I can audit them using the same practices.

## Acceptance Criteria

- [x] A manually authored mock file placed in the mock store that conforms to the `MockArtifact` schema is matched and replayed when its fingerprint matches an incoming request, using the same matching rules as recorded mocks.
- [x] A manual mock can be edited in place and changes take effect on the next matching request without restarting Mockery.
- [x] The management API exposes endpoints to create, read, update, and delete manual mocks programmatically, all under the `/_mockery/mocks` route prefix.
- [x] Manual mocks are validated on load — a malformed mock produces a warning log entry identifying the file path and validation error, and the malformed mock is skipped (not served).
- [x] When the `Mockery:Storage:ReadOnly` configuration is `true`, create, update, and delete operations via the management API return HTTP 403 with a `ProblemDetails` response.
- [x] Deleting a mock that does not exist returns HTTP 404 with a `ProblemDetails` response.
- [x] Creating a mock with a fingerprint that conflicts with an existing mock returns HTTP 409 with a `ProblemDetails` response.

## API / Interface Definition

### Management Endpoints

All endpoints are served under the `/_mockery/mocks` route prefix.

Authentication: None — Mockery is a development-time proxy accessible only within the local workstation or cloud-dev sandbox trust boundary.

#### List Mocks

```
GET /_mockery/mocks
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `method` | `string` | No | Filter by HTTP method (e.g. `GET`, `POST`). |
| `destination` | `string` | No | Filter by destination host. |
| `path` | `string` | No | Filter by request path prefix. |

**Response:** `200 OK`

```json
[
  {
    "id": "a1b2c3d4",
    "fingerprint": "sha256:...",
    "source": "manual",
    "request": { "method": "GET", "destination": "api.example.com", "path": "/v1/items", "query": "", "headers": {}, "bodyHash": null },
    "response": { "statusCode": 200, "headers": { "Content-Type": "application/json" }, "body": "..." },
    "metadata": { "createdAt": "2026-04-14T10:00:00Z", "updatedAt": "2026-04-14T10:00:00Z", "description": "Items list stub" }
  }
]
```

#### Get Mock by ID

```
GET /_mockery/mocks/{id}
```

**Response:** `200 OK` with a single `ManualMockArtifact` JSON object whose fields match the `ManualMockArtifact` schema in the Data Model section, or `404 Not Found` with `ProblemDetails` (`errorCode = MOCKERY_MOCK_NOT_FOUND`).

#### Create Mock

```
POST /_mockery/mocks
Content-Type: application/json
```

**Request Body:** A `ManualMockArtifact` JSON object (without `id`, `fingerprint`, `metadata.createdAt`, or `metadata.updatedAt` — these are server-assigned).

**Response:** `201 Created` with `Location` header pointing to `/_mockery/mocks/{id}` and the full `ManualMockArtifact` in the body.

**Error Responses:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Request body fails schema validation. `ProblemDetails` with error code `MOCKERY_MOCK_INVALID`. |
| `403 Forbidden` | `Mockery:Storage:ReadOnly` is `true`. `ProblemDetails` with error code `MOCKERY_STORE_READONLY`. |
| `409 Conflict` | A mock with the same computed fingerprint already exists. `ProblemDetails` with error code `MOCKERY_MOCK_CONFLICT`. |
| `503 Service Unavailable` | Storage is unavailable and the operation cannot complete. `ProblemDetails` with error code `MOCKERY_STORE_UNAVAILABLE`. |

#### Update Mock

```
PUT /_mockery/mocks/{id}
Content-Type: application/json
```

**Request Body:** A full `ManualMockArtifact` JSON object (server recomputes fingerprint from request fields).

**Response:** `200 OK` with the updated `ManualMockArtifact`.

**Error Responses:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Request body fails schema validation. `ProblemDetails` with error code `MOCKERY_MOCK_INVALID`. |
| `403 Forbidden` | `Mockery:Storage:ReadOnly` is `true`. `ProblemDetails` with error code `MOCKERY_STORE_READONLY`. |
| `404 Not Found` | No mock exists with the given ID. `ProblemDetails` with error code `MOCKERY_MOCK_NOT_FOUND`. |
| `409 Conflict` | Updated fingerprint conflicts with a different existing mock. `ProblemDetails` with error code `MOCKERY_MOCK_CONFLICT`. |
| `503 Service Unavailable` | Storage is unavailable and the operation cannot complete. `ProblemDetails` with error code `MOCKERY_STORE_UNAVAILABLE`. |

#### Delete Mock

```
DELETE /_mockery/mocks/{id}
```

**Response:** `204 No Content` on success.

**Error Responses:**

| Status | Condition |
|---|---|
| `403 Forbidden` | `Mockery:Storage:ReadOnly` is `true`. `ProblemDetails` with error code `MOCKERY_STORE_READONLY`. |
| `404 Not Found` | No mock exists with the given ID. `ProblemDetails` with error code `MOCKERY_MOCK_NOT_FOUND`. |
| `503 Service Unavailable` | Storage is unavailable and the operation cannot complete. `ProblemDetails` with error code `MOCKERY_STORE_UNAVAILABLE`. |

### ProblemDetails Error Codes

| Error Code | Condition |
|---|---|
| `MOCKERY_MOCK_INVALID` | Mock artifact fails schema validation (missing required fields, invalid types, etc.). |
| `MOCKERY_MOCK_CONFLICT` | A mock with the same computed fingerprint already exists under a different ID. |
| `MOCKERY_MOCK_NOT_FOUND` | The requested mock ID does not exist in persistent storage. |
| `MOCKERY_STORE_READONLY` | A write operation was attempted while `Mockery:Storage:ReadOnly` is `true`. |
| `MOCKERY_STORE_UNAVAILABLE` | Azure Blob Storage is unavailable and the operation cannot complete safely. |

### Storage Interface Extension

The existing `IMockStore` interface is extended with manual mock management operations. These are added as a new interface to avoid breaking the existing contract. Both `IMockStore` and `IManualMockStore` are defined in the Mockery proxy's **Core** layer; `BlobMockStore` implements both interfaces in the proxy's **Infrastructure** layer. These types are part of the proxy service — they do not reside in Mockery.Shared, which is an independent client-side library with no dependency on the proxy. The `IManualMockStore` interface operates on `ManualMockArtifact`, a type defined in Mockery.Shared.

```csharp
/// <summary>
/// Extends mock storage with manual mock management operations.
/// </summary>
public interface IManualMockStore
{
    /// <summary>Returns all manual mocks, optionally filtered.</summary>
    Task<IReadOnlyList<ManualMockArtifact>> ListAsync(MockFilter? filter = null, CancellationToken ct = default);

    /// <summary>Returns a single mock by its store-assigned identifier.</summary>
    Task<ManualMockArtifact?> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>Persists a new manual mock and returns it with server-assigned fields populated.</summary>
    Task<ManualMockArtifact> CreateAsync(ManualMockArtifact artifact, CancellationToken ct = default);

    /// <summary>Replaces an existing manual mock by ID and returns the updated artifact.</summary>
    Task<ManualMockArtifact> UpdateAsync(string id, ManualMockArtifact artifact, CancellationToken ct = default);

    /// <summary>Removes a manual mock by ID. Returns true if the mock existed.</summary>
    Task<bool> DeleteAsync(string id, CancellationToken ct = default);

    /// <summary>Returns true if a mock with the given fingerprint already exists.</summary>
    Task<bool> ExistsByFingerprintAsync(string fingerprint, CancellationToken ct = default);
}
```

```csharp
/// <summary>
/// Filter criteria for listing mocks.
/// </summary>
public sealed record MockFilter
{
    public string? Method { get; init; }
    public string? Destination { get; init; }
    public string? PathPrefix { get; init; }
}
```

## Data Model

### `ManualMockArtifact` (root document)

The manual mock artifact is the unit of persistence for developer-authored mocks. This type lives in **Mockery.Shared** so consuming services and the proxy can share the same contract. Artifacts are stored as individual JSON blobs in the mock store.

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes (server-assigned) | Unique identifier for the artifact, generated by the store. |
| `fingerprint` | `string` | Yes (server-computed) | Deterministic hash of the request fields, computed using the same algorithm as recorded mocks. Format: `sha256:<hex>`. |
| `source` | `MockSource` | Yes | Indicates whether the mock was `Manual` or `Recorded`. |
| `request` | `MockRequest` | Yes | The request shape this mock matches against. |
| `response` | `MockResponse` | Yes | The response to replay when the mock is matched. |
| `metadata` | `MockMetadata` | Yes | Audit and descriptive metadata. |

### `MockSource` (enum)

| Value | Meaning |
|---|---|
| `Manual` | Created or edited by a developer through the API or direct file authoring. |
| `Recorded` | Captured automatically from a real upstream interaction. |

### `MockRequest`

| Property | Type | Required | Description |
|---|---|---|---|
| `method` | `string` | Yes | HTTP method (e.g. `GET`, `POST`). |
| `destination` | `string` | Yes | Target host or authority (e.g. `api.example.com`). |
| `path` | `string` | Yes | Request path (e.g. `/v1/items`). |
| `query` | `string` | No | Query string without leading `?`. Empty string if absent. |
| `headers` | `Dictionary<string, string>` | No | Fingerprint-relevant headers only (as configured by `Mockery:Matching:RelevantHeaders`). Empty dictionary if none. |
| `bodyHash` | `string?` | No | Normalized hash of the request body when body is relevant. `null` for bodiless methods. |

### `MockResponse`

| Property | Type | Required | Description |
|---|---|---|---|
| `statusCode` | `int` | Yes | HTTP status code to replay. |
| `headers` | `Dictionary<string, string>` | No | Response headers to include in the replayed response. |
| `body` | `string?` | No | Response body as a string. `null` for empty responses. |

### `MockMetadata`

| Property | Type | Required | Description |
|---|---|---|---|
| `createdAt` | `DateTimeOffset` | Yes (server-assigned) | Timestamp when the artifact was first persisted. |
| `updatedAt` | `DateTimeOffset` | Yes (server-assigned) | Timestamp of the last modification. |
| `description` | `string?` | No | Optional human-readable note describing the mock's purpose. |

### File Layout

Mock artifacts are stored as individual JSON blobs in the Azure Blob Storage container configured by `Mockery:Storage:ContainerName`. The blob name is derived from the artifact's fingerprint, consistent with recorded mocks:

```
{ContainerName}/
  {normalized-host}/              ← e.g., "api.example.com"
    {fingerprint-hash}.json       ← one blob per mock (manual or recorded)
```

The connection to Azure Blob Storage is resolved via Aspire service discovery (resource name `mockstorage` — Azurite locally, Azure Storage account in cloud).

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|---|---|
| Manual mock file is malformed JSON or fails schema validation | Log a warning identifying the file path and validation error. Skip the mock — do not serve it or halt startup. |
| Two manual mock files on disk have the same computed fingerprint | Load the first file found (alphabetical order by filename). Log a warning identifying both files and the duplicate fingerprint. |
| Manual mock file is modified on disk while Mockery is running | The next request that evaluates mocks re-reads the artifact from storage. No restart required. |
| Azure Blob Storage container does not exist at startup | The container is provisioned by Aspire/deployment infrastructure. Blobs are created on write; no manual container creation is required at runtime. If the container or service is unreachable, management API operations return `503 ProblemDetails` with `errorCode = MOCKERY_STORE_UNAVAILABLE` and the failure is logged. |
| Request body exceeds `Mockery:Matching:MaxBodyBytes` during fingerprint computation for a manual mock | Truncate the body to `MaxBodyBytes` before hashing, consistent with recorded mock behaviour. |
| API create request is missing the `request` or `response` property | Return `400 ProblemDetails` with error code `MOCKERY_MOCK_INVALID` and a detail message listing the missing fields. |
| API update changes the `source` field from `Recorded` to `Manual` or vice versa | Reject with `400 ProblemDetails` with error code `MOCKERY_MOCK_INVALID`. The `source` field is immutable after creation. |
| Concurrent API writes to the same mock ID | The store uses last-write-wins semantics. The final persisted state reflects the last completed write. |

## Preservation Constraints

- The existing `IMockStore` interface contract (proxy Core layer) must be preserved. Manual mock management operations are introduced through the new `IManualMockStore` interface (also in the proxy Core layer), which is implemented by `BlobMockStore` (proxy Infrastructure layer) — the sole `IMockStore` implementation.
- The existing fingerprint computation and matching logic (per ADR-0003) must apply identically to manual and recorded mocks — no separate matching path.
- The `ManualMockArtifact` schema used by manual mocks shares the same blob path convention (`{Container}/{normalized-host}/{fingerprint-hash}.json`) as recorded mocks so that both types of artifacts coexist in the same storage layout.
- The existing configuration keys (`Mockery:Storage:ContainerName`, `Mockery:Storage:ReadOnly`) must retain their current semantics. Azure Blob Storage connection is resolved via Aspire service discovery.

## Out of Scope

- Mock templates or scaffolding tools for generating manual mocks.
- GUI or visual editor for mock authoring.
- Mock versioning, history, or approval workflows.
- Automatic generation of mocks from OpenAPI/Swagger specifications.

## Dependencies

- **ADR-0005**: Human-Readable Storage Abstraction — manual mocks are persisted through the same storage abstraction as recorded mocks.
- **ADR-0003**: Request Target and Shape Matching — manual mocks use the same fingerprint-based matching rules as recorded mocks.
- **ADR-0007**: Azure Blob Storage Persistence Backend — `BlobMockStore` in the proxy's Infrastructure layer implements both `IMockStore` and `IManualMockStore`.
- **`IMockStore` interface** (proxy Core layer): Manual mock management extends the existing storage contract without breaking it.
- **Fingerprint computation component** (proxy Core layer): Computes deterministic request fingerprints for manual mocks using the same algorithm as recorded mocks.
- **`Mockery:Storage:*` configuration**: Container name (`Mockery:Storage:ContainerName`, default `"mocks"`) and read-only flag govern manual mock persistence. Azure Blob Storage connection is resolved via Aspire service discovery (resource name `mockstorage`).

