# ADR-0002: Use a file-backed JSON mock dataset keyed by region and sensor ID

> **Version**: 1.0<br>
> **Created**: 2026-04-14<br>
> **Last Updated**: 2026-04-14<br>
> **Owner**: Dave Harding<br>
> **Project**: Temperature Sensor WebAPI Service<br>
> **Status**: Approved

---

## 1. Context

The service must return deterministic responses for supported region and sensor ID lookups, and those responses need to stay stable across repeated local and cloud dev runs. The user explicitly wants a `Mocks` folder containing JSON files whose file names encode the region and sensor ID used for lookup. Teams also need the seeded data to remain inspectable and easy to adjust without introducing a runtime dependency on a remote store or a code rebuild for every mock-data change. A storage decision was required before the lookup flow and response contract could be documented or implemented.

---

## 2. Decision

We will store seeded temperature responses as JSON files in a `Mocks` folder, keyed by region and sensor ID.

---

## 3. Rationale

File-backed JSON mocks satisfy the core requirement of deterministic behavior while keeping the dataset human-readable and easy to review in source control or packaged content. Keying artifacts by normalized region and sensor ID makes lookup behavior explicit and keeps the request flow simple for both developers and test automation. This avoids introducing a database, remote object store, or code-embedded dictionary for a service whose primary job is serving seeded data. The approach also aligns with the user's desired operating model of locating the correct response directly from API path segments and returning the stored payload.

---

## 4. Alternatives Considered

### Hard-coded in-memory dictionary
**Why rejected:** Embedding all seeded values in code would make the dataset harder to inspect and update, and every mock-data change would require a code change and rebuild.

### External database or blob storage
**Why rejected:** A remote data store would violate the no-external-dependency goal and would add availability, configuration, and local setup complexity to a deliberately simple test service.

---

## 5. Consequences

### Positive Consequences
- Mock data stays deterministic, human-readable, and easy to audit or update.
- Lookup logic remains simple because request route values map directly to a normalized file key.

### Trade-offs Accepted
- The dataset must be curated carefully because missing or malformed files become runtime configuration failures.
- The file naming and folder conventions become part of the architecture and must be kept consistent as the dataset grows.

---

## 6. Related Decisions

- [ADR-0001: Keep Temperature Sensor Service as a single ASP.NET Core Minimal API](ADR-0001-single-minimal-api-service.md) - the API host uses this dataset as its only response source
- [ADR-0003: Restrict runtime to self-contained local and cloud dev environments](ADR-0003-self-contained-dev-environment-runtime.md) - explains why the dataset must not depend on remote storage

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
