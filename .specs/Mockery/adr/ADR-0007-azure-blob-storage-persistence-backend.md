<!-- SPARK -->

# ADR-0007: Use Azure Blob Storage as the persistence backend for mock artifacts

> **Version**: 1.1<br>
> **Created**: 2026-04-14<br>
> **Last Updated**: 2026-04-18<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved

---

## 1. Context

Mockery needs durable, environment-scoped mock storage that works consistently across local developer workstations and cloud-hosted development sandboxes. The original implementation used direct filesystem storage, but this introduces portability issues: filesystem paths differ across operating systems, container environments require volume mounts, and the storage API diverges between local and cloud environments. Azure Blob Storage via the Aspire integration provides a consistent programmatic API across local development (Azurite emulator) and cloud (Azure Storage accounts) while keeping stored artifacts accessible for inspection. The Aspire AppHost can provision and manage the Azurite emulator lifecycle automatically, removing manual setup from the developer workflow. Mock artifacts remain human-readable JSON blobs, one per mock artifact, stored in a configurable blob container (default: `mocks`).

---

## 2. Decision

> We will use Azure Blob Storage as the sole persistence backend for all mock artifacts, with the Azurite emulator provisioned via Aspire AppHost (resource name: `mockstorage`) for local development and Azure Storage accounts for cloud and sandbox environments.

---

## 3. Rationale

Azure Blob Storage provides a single storage API that works identically whether the backing store is a local Azurite emulator or a cloud Azure Storage account. This eliminates the code-path divergence that filesystem storage creates between local and cloud environments — the same `BlobContainerClient` calls work in both contexts without conditional logic. Aspire's built-in Azurite resource support means local developers get a working blob store automatically when they start the AppHost, with no manual Docker or emulator setup. Blobs remain individually addressable and downloadable as human-readable JSON, preserving the inspectability requirement established in ADR-0005. The Azure SDK's retry, streaming, and concurrency features also provide more robust I/O semantics than raw filesystem operations.

---

## 4. Alternatives Considered

### Keep local filesystem storage
**Why rejected:** Filesystem storage does not transfer between environments, requires explicit volume mounts in containerized scenarios, and creates inconsistency between the local storage API (System.IO) and cloud storage API (Azure SDK). This divergence increases the testing surface and makes it harder to guarantee that behavior observed locally matches cloud behavior.

### Use a relational database (SQLite or PostgreSQL)
**Why rejected:** A relational database would make mock artifacts opaque — stored as rows rather than individually inspectable files — conflicting with the human-readable inspectability requirement from ADR-0005. It would also introduce schema management, migration tooling, and a heavier local dependency compared to Azurite, which the Aspire AppHost already supports natively.

---

## 5. Consequences

### Positive Consequences
- Consistent storage API across all environments eliminates conditional code paths for local versus cloud persistence.
- Aspire AppHost handles Azurite emulator lifecycle automatically, so developers do not need to install or manage storage emulators manually.
- Mock artifacts remain human-readable JSON blobs that can be downloaded, inspected, and edited through Azure Storage Explorer, `az storage blob`, or direct HTTP access to Azurite.
- No filesystem path management, platform-specific path separators, or volume mount configuration is needed.

### Trade-offs Accepted
- Local development requires Azurite (and therefore Docker or a standalone Azurite install) to be available, adding an infrastructure dependency that raw filesystem storage did not have.
- Azure Storage in cloud environments introduces a per-environment cost, though it is minimal for development workloads with small JSON blobs.
- Mock data now lives in an external service process rather than directly on the local filesystem, which may add minor latency and makes artifacts slightly less convenient to browse compared to opening a local folder — though Azure Storage Explorer and Azurite's REST API mitigate this.

---

## 6. Related Decisions

- [ADR-0005: Persist mocks via a human-readable storage abstraction per environment](ADR-0005-human-readable-storage-abstraction.md) — ADR-0007 implements the concrete backend for the storage abstraction defined in ADR-0005.
- [ADR-0001: Keep Mockery as a single ASP.NET Core Minimal API proxy service](ADR-0001-single-minimal-api-proxy-service.md) — the single service owns the blob storage client and decides when artifacts are written.

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
