# FEAT-002: File-Backed Mock Dataset

> **Version**: 1.0.1<br>
> **Created**: 2026-04-14<br>
> **Last Updated**: 2026-04-18<br>
> **Owner**: Dave Harding<br>
> **Project**: Temperature Sensor WebAPI Service<br>
> **Status**: Approved

## Goal

Define and deliver the seeded file-backed dataset that the service uses as its deterministic source of truth for temperature lookups. This feature supports PRD Goal 2 and Goal 3 by ensuring every supported lookup key maps to a human-reviewable JSON artifact that can be packaged with the service and reused across local and cloud dev runs.

## Motivation

This feature implements FR-003 and FR-006 while operationalizing ADR-0002. The PRD requires deterministic seeded data for repeated local test runs, and the architecture further constrains that data to come from JSON artifacts keyed by region and sensor ID rather than generated or remote content. Without this feature, the API contract in FEAT-001 would have no stable backing data source.

## User Stories

- As a **Service Developer**, I want **the service to read mock temperature data from curated JSON files** so that **I can inspect and update test fixtures without changing application code**.
- As a **Test Automation Engineer**, I want **the same lookup key to resolve to the same JSON artifact on every run** so that **integration tests remain deterministic across machines and environments**.

## Acceptance Criteria

- [x] The service reads seeded mock artifacts from the folder configured by `TemperatureSensor:MockDataPath`, defaulting to `Mocks`.
- [x] Each artifact file name is derived from the canonical region and sensor ID pair so one lookup key maps to one file without secondary indexes or external state.
- [x] Each valid artifact deserializes into a contract containing `sensorId`, `region`, `temperature`, `humidity`, and `unit`, and lookup results echo those values through the API response.
- [x] Startup validation fails clearly when the configured dataset path is missing, unreadable, or contains malformed JSON required for seeded lookups.
- [x] Runtime lookup never mutates dataset files and never falls back to generated data when a file is absent or invalid.

## API / Interface Definition

N/A - this feature defines the internal mock dataset contract and startup validation rules consumed by the HTTP API rather than introducing a separate caller-facing endpoint.

Internal interface expectation:
- `ITemperatureMockStore.GetAsync(region: string, sensorId: string, cancellationToken: CancellationToken) -> TemperatureMockArtifact?`
- Return value: seeded artifact when the file exists and is valid; `null` or an equivalent miss result when the lookup key has no file; configuration exception when the dataset cannot be read safely.

Lookup key convention:
- Path root: `{TemperatureSensor:MockDataPath}`
- File name pattern: `{region}-{sensorId}.json`
- Example: `Mocks/eus-A1B2C3D4.json`

Internal errors:
- `DatasetPathMissing` - configured root folder does not exist or is inaccessible
- `DatasetArtifactMalformed` - JSON cannot be deserialized into the required artifact schema
- `DatasetArtifactNotFound` - no file exists for the normalized lookup key

## Data Model

TemperatureMockArtifact {
  sensorId:    string   - required; 8-character alphanumeric identifier matching the lookup key
  region:      string   - required; canonical region code matching the lookup key
  temperature: decimal  - required; seeded temperature value
  humidity:    decimal  - required; seeded humidity value
  unit:        string   - required; temperature unit label
}

DatasetValidationResult {
  filePath:    string   - full or relative artifact path that was checked
  status:      enum     - valid | missing | malformed | unreadable
  message:     string   - validation detail for logs and readiness diagnostics
}

## Edge Cases & Error Handling

| Scenario | Expected behaviour |
|----------|--------------------|
| The configured `Mocks` folder does not exist at startup | Startup validation fails and the service does not report ready until the folder is restored or configuration is corrected. |
| A file named for a valid lookup key contains malformed JSON | The dataset provider reports a configuration error, the file is not used for responses, and the condition is surfaced through logs and readiness failure details. |
| A file exists but its internal `region` or `sensorId` does not match the lookup key encoded in the file name | Validation treats the artifact as invalid and reports a deterministic configuration failure rather than trusting the mismatched payload. |
| Two callers request the same lookup key concurrently | Both requests resolve the same artifact content without mutating shared state, and both responses return the same seeded values. |

## Out of Scope

- Editing, uploading, or deleting mock artifacts over HTTP.
- Scenario packs, environment-specific dataset switching, or time-varying generated mock data in v1.
- Any storage backend other than the local or mounted filesystem defined by ADR-0002.

## Dependencies

- Requires: ADR-0002
- Requires: ADR-0003 for the no-external-dependency runtime boundary
- Supports: FEAT-001 by providing the deterministic artifact source used during lookup
- Supports: FEAT-003 by enabling readiness checks against the configured dataset path

## Open Questions

- [ ] Should startup validation require every configured supported region to have at least one seeded artifact, or is validating artifact readability alone sufficient for v1?