<!-- SPECIT -->
# ADR-0002: Use a File-Backed JSON Mock Dataset

> **Version**: 1.0<br>
> **Created**: 2026-04-15<br>
> **Last Updated**: 2026-04-15<br>
> **Owner**: Dave Harding<br>
> **Project**: Pressure Sensor<br>
> **Status**: Approved

---

## 1. Context

Pressure Sensor Service must return deterministic barometric pressure readings for known region and sensor ID combinations. The PRD requires that mock data be human-readable and inspectable by developers, that responses be identical across repeated runs, and that the service operate without external data sources. The data storage approach directly affects inspectability, determinism, development workflow simplicity, and the ability for developers to understand what seeded data backs each test scenario.

---

## 2. Decision

> We will store mock pressure data as individual JSON files in a `Mocks/` directory within the project, using a `{region}-{sensorId}.json` naming convention as the lookup key. Files are copied to the build output and read from disk at runtime.

---

## 3. Rationale

Individual JSON files per region-sensor combination make each test scenario independently inspectable — a developer can open a single file to see exactly what the service will return for that input. The `{region}-{sensorId}.json` naming convention eliminates the need for a registry, index, or database lookup; the file path is derived directly from the request parameters. This approach is identical to the TemperatureSensor sibling project, maintaining consistency across the test service portfolio. Files are committed to source control, making the dataset versioned, diffable, and reviewable alongside code changes.

---

## 4. Alternatives Considered

### In-Memory Dictionary
**Why rejected:** Hard-coded data in a dictionary would be deterministic but not inspectable without reading the source code. Developers could not browse the mock dataset independently of the service implementation. Adding or modifying test scenarios would require code changes and recompilation rather than editing a JSON file.

### SQLite or Embedded Database
**Why rejected:** An embedded database would add a dependency, require schema management, and obscure the mock data behind query logic. The PRD explicitly requires human-readable, inspectable data — a database file is opaque compared to individual JSON files. The added complexity is unjustified for a dataset that is small, static, and read-only.

### Azure Blob Storage (Emulated)
**Why rejected:** Blob storage would introduce an external dependency (even if emulated) and require configuration, connection strings, and SDK packages. The sibling Mockery project uses blob storage because its scope requires it, but Pressure Sensor Service is explicitly self-contained. Adding blob storage would violate the no-external-dependencies constraint in the PRD.

---

## 5. Consequences

### Positive Consequences
- Each mock scenario is a standalone, human-readable JSON file that can be inspected, edited, and reviewed independently.
- Deterministic responses are guaranteed — the same file always produces the same response, with no randomness or state mutation.
- Adding a new test scenario requires only creating a new JSON file with the correct naming convention; no code changes or recompilation needed.
- The dataset is version-controlled alongside the source code, providing full change history and code review for data modifications.

### Trade-offs Accepted
- Adding a large number of region-sensor combinations creates many small files in the `Mocks/` directory. This is acceptable because the expected dataset size for v1 is small (a handful of regions and sensors).
- There is no query capability — lookups are exact-match by region and sensor ID only. Filtering, searching, or aggregating across the dataset is not supported. This is acceptable because the PRD scope requires only single-key lookups.

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
