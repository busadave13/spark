<!-- SPARK -->
> **Feature**: FEAT-002: Correct Replay Matching<br>
> **Spec**: .specs/Mockery/feature/FEAT-002-correct-replay-matching.md<br>
> **Test file**: src/Test/Mockery/Mockery.UnitTests/Core/Matching/RequestFingerprintComputerTests.cs<br>
> **Test runner**: xUnit<br>
> **Approved**: 2026-04-18<br>
> **Completed**: 2026-04-18<br>
> **Status**: Implemented

## Test plan — FEAT-002: Correct Replay Matching

8 ACs · 27 test cases total

### AC-01: A request fingerprint is computed deterministically from method, scheme+authority, path, query, configured relevant headers, and normalized body content — identical inputs always produce the same fingerprint string.

| Category | Test name |
|---|---|
| happy | SameInput_ProducesSameFingerprint |
| happy | Fingerprint_Is64CharLowercaseHex |
| edge | EmptyRelevantHeaders_ProducesDeterministicFingerprint |
| edge | CancellationToken_DoesNotAffectResult |

### AC-02: A stored mock is replayed only when the incoming request fingerprint exactly matches a stored fingerprint; no partial or fuzzy matching is applied.

| Category | Test name |
|---|---|
| happy | GoldenHash_SimpleGetWithHeaders |
| happy | GoldenHash_PostWithBody |
| happy | GoldenHash_QuerySorting |
| edge | GoldenHash_EmptyFields_NoThrow |

### AC-03: A change in method, destination (scheme+authority), path, query, any configured relevant header value, or body content produces a different fingerprint (non-match), causing a store miss.

| Category | Test name |
|---|---|
| happy | DifferentMethod_ProducesDifferentFingerprint |
| happy | DifferentSchemeAndAuthority_ProducesDifferentFingerprint |
| happy | DifferentPath_ProducesDifferentFingerprint |
| happy | DifferentQuery_ProducesDifferentFingerprint |
| happy | DifferentRelevantHeader_ProducesDifferentFingerprint |
| happy | DifferentBody_ProducesDifferentFingerprint |
| edge | MethodCasing_IsNormalized |
| edge | SchemeAndAuthorityCasing_IsNormalized |
| edge | QueryParams_AreSortedByKey |
| edge | DuplicateQueryKeys_PreservedAfterSorting |
| edge | QueryKeysAreLowercased |

### AC-04: Body content beyond `Mockery:Matching:MaxBodyBytes` (default 262144) is truncated before fingerprinting; only the first `MaxBodyBytes` bytes are considered.

| Category | Test name |
|---|---|
| happy | EmptyBody_UsesEmptyByteSha256 |
| happy | BodyHashOverride_UsedWhenNonNull |
| edge | BodyHashOverride_IsUsedDirectly |

### AC-05: Fingerprint computation resides in the Core layer (the Mockery Core namespace) and does not reference `HttpContext`, `HttpRequest`, or any ASP.NET Core transport type.

Structural constraint validated at compile time. The test file imports only `Mockery.Core.Matching` and the implementation compiles without ASP.NET Core HTTP references. No runtime assertion is required.

### AC-06: The fingerprinting service is registered via .NET dependency injection and can be resolved by consuming Core services without modifying existing DI registrations.

Integration concern validated by application startup and service resolution. The `AddMockeryMatching` extension method is tested implicitly through the application host bootstrap. Not covered by this unit test file.

### AC-07: When relevant headers are absent from a request, the fingerprint treats them as absent (empty string value) rather than omitting them, ensuring two requests — one with and one without a relevant header — produce different fingerprints.

| Category | Test name |
|---|---|
| happy | AbsentHeader_DiffersFromPresentHeader |
| happy | HeaderWithValue_DiffersFromEmptyValue |
| edge | HeaderValueIsTrimmed |

### AC-08: If a `RequestDescriptor` is constructed with a null or empty `Method` or `SchemeAndAuthority`, the fingerprint computer still produces a deterministic hash without throwing — callers are responsible for providing valid input, and the Core layer does not impose transport-level validation.

| Category | Test name |
|---|---|
| happy | NullMethod_DoesNotThrow |
| happy | NullSchemeAndAuthority_DoesNotThrow |

## Coverage gaps

- **AC-05**: Structural/compile-time constraint — the implementation resides in `Mockery.Core.Matching` and does not reference ASP.NET Core transport types. Validated by the fact that the unit test project compiles and runs against only Core types. No runtime unit test is needed.
- **AC-06**: DI registration is an integration concern. The `AddMockeryMatching` extension method registers `IRequestFingerprintComputer` additively. Validated by application startup via the Aspire AppHost, not by this unit test file.

## Resolved ambiguities

- AC-02 — "exactly matches" is validated by golden hash tests that pin the SHA-256 output of known canonical inputs, proving the algorithm produces a specific, stable value rather than an approximate match.
- AC-04 — Body truncation occurs before `RequestDescriptor` construction (per spec: "pre-truncated to MaxBodyBytes"). The fingerprint computer tests validate body hashing behavior (empty body hash, hash override) which is the computer's role in the truncation pipeline. Truncation enforcement is a transport/handler responsibility.
