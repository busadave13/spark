<!-- SPARK -->

# ADR-0003: Fail whole weather lookups when required upstream inputs are missing or invalid

> **Version**: 1.0<br>
> **Created**: 2026-04-20<br>
> **Last Updated**: 2026-04-21<br>
> **Owner**: Dave Harding<br>
> **Project**: Weather<br>
> **Status**: Approved

---

## 1. Context

The PRD explicitly states that Weather Service must not return a successful response when required temperature, humidity, or pressure data is missing, unavailable, or incomplete for the requested region. Because the service aggregates multiple upstream inputs, it needs an explicit rule for how to handle dependency failures and inconsistent payloads. Without a clear decision, implementations could drift toward returning ambiguous partial data that consumers might mistakenly treat as complete weather information.

---

## 2. Decision

We will return success only when all required upstream weather inputs are present and valid for the requested region; otherwise, Weather Service returns a dependency or validation failure response.

---

## 3. Rationale

This rule protects consumers from building business logic around incomplete or misleading weather payloads. It also keeps the public contract simple because callers only have to handle two broad outcomes: a complete aggregated success or a clear failure they can classify and retry or surface. The decision aligns directly with the PRD's deterministic behavior and explicit dependency failure goals, while making contract validation a first-class part of the aggregation layer.

---

## 4. Alternatives Considered

### Return partial payloads with missing fields set to null
**Why rejected:** Null-filled successes would force every caller to implement additional defensive logic and would blur the distinction between valid weather data and dependency failure.

### Return best-effort success with warnings
**Why rejected:** Warning-based success responses are easy for consumers to ignore and would undermine the PRD's requirement to avoid ambiguous partial weather data.

---

## 5. Consequences

### Positive Consequences
- Consumers can trust that any successful weather response is complete for the v1 contract.
- Dependency failures become explicit and testable rather than being hidden inside partial payload semantics.

### Trade-offs Accepted
- Temporary upstream instability causes entire weather lookups to fail rather than degrade gracefully.
- The aggregation layer must validate more conditions, including required fields and consistent region identity across upstream payloads.

---

## 6. Related Decisions

- [ADR-0001: Implement Weather as a single ASP.NET Core Minimal API aggregator](ADR-0001-single-minimal-api-aggregator.md) - the aggregation host enforces this rule at the single inbound boundary
- [ADR-0002: Compose weather data through HTTP calls to sibling sensor services](ADR-0002-http-based-aggregation-over-sibling-sensor-services.md) - this rule governs how the HTTP-based composition model handles upstream failure or invalid payloads
