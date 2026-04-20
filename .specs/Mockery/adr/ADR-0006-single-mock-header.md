<!-- SPARK -->

# ADR-0006: Simplify per-request mock control to a single X-Mockery-Mock header

> **Version**: 1.2<br>
> **Created**: 2025-07-25<br>
> **Last Updated**: 2026-04-18<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved

---

## 1. Context

The original Mockery header contract used four headers to control per-request mock behavior: `X-Mockery-Mode` activated mock evaluation, `X-Mockery-Passthrough` listed hosts that should bypass mocking, `X-Mockery-Propagated` marked multi-hop propagation state, and `X-Forwarded-Host` carried the original upstream hostname. A subsequent simplification replaced those with `X-Mockery-Mock` (using string values like `All` or comma-delimited host lists) and a separate `X-Mockery-MaxHops` header for propagation depth. However, even the two-header scheme split related concerns across multiple headers, created edge cases when `X-Mockery-MaxHops` was present without `X-Mockery-Mock`, and required parsing two different value formats. A single header with a structured JSON value that carries activation, host exclusions, and propagation depth would further simplify the contract and eliminate these edge cases.

---

## 2. Decision

> We will use a single `X-Mockery-Mock` header whose raw JSON value carries all mock policy fields, replacing the prior multi-header and string-based formats with one structured contract.

---

## 3. Rationale

A single header with a JSON value `{"maxHops": N, "excludeHosts": [...]}` captures all mock policy semantics — activation, host exclusions, and propagation depth — in one self-describing value. Presence of the header activates mocking; absence means full passthrough, preserving the explicit opt-in model. `excludeHosts` defaults to `[]` (mock all hosts) and `maxHops` defaults to `0` (don't propagate downstream). An empty JSON object `{}` means "mock everything, don't propagate." Propagation across downstream hops re-serializes one JSON value with `maxHops` decremented instead of copying multiple headers, which eliminates partial-propagation bugs and the edge case of `X-Mockery-MaxHops` being present without `X-Mockery-Mock`. The `X-Forwarded-Host` header is retained because it is a standard HTTP mechanism, not a Mockery-specific invention. The configuration surface shrinks to one config key (`MockHeader`), and the separate `Mockery:Policy:MaxHopsHeader` config key is removed entirely.

---

## 4. Alternatives Considered

### Keep the multi-header scheme (X-Mockery-Mode, X-Mockery-Passthrough, X-Mockery-Propagated)
**Why rejected:** Three custom headers forced clients to understand and correctly set multiple values per request. Propagation logic had to copy and validate each header independently, increasing the surface for partial-propagation bugs. The added granularity of separate headers provided no practical benefit because the two pieces of information — "is mocking on?" and "which hosts are excluded?" — are always consumed together in the same policy evaluation step.

### String-based value format (All / comma-delimited hosts) with separate X-Mockery-MaxHops
**Why rejected:** The two-header approach split related concerns (`X-Mockery-Mock` for activation/exclusions, `X-Mockery-MaxHops` for propagation depth) and introduced edge cases — e.g., `X-Mockery-MaxHops` present without `X-Mockery-Mock`. Two different value formats (string-based and integer) required separate parsing logic. A single JSON value is self-describing, extensible, and keeps all mock policy fields in one place.

### Use query parameters instead of headers
**Why rejected:** Query parameters are visible in URL-based caching layers, CDN logs, and browser history, which leaks mock control metadata into infrastructure that should be unaware of it. They also alter the request URI, which would change request fingerprints and break replay matching unless the fingerprinting logic explicitly stripped them — adding complexity rather than reducing it.

---

## 5. Consequences

### Positive Consequences
- Client integration is maximally simple: one header with a JSON value that is self-describing and extensible.
- All mock policy fields (`maxHops`, `excludeHosts`) live in one place, eliminating edge cases around mismatched or partially-present headers.
- Propagation across downstream HTTP hops re-serializes one JSON value (decrementing `maxHops`), reducing the risk of partial propagation bugs.
- Configuration surface is one config key (`Mockery:Policy:MockHeader`); the separate `Mockery:Policy:MaxHopsHeader` key is removed.

### Trade-offs Accepted
- The header value requires JSON parsing, which is slightly more complex than reading a plain string, but well-supported by all target platforms.
- Existing clients or documentation referencing the old string-based format (`All`, comma-delimited hosts) or the separate `X-Mockery-MaxHops` header must be updated; there is no backward-compatible transition period because those formats are removed entirely.

---

## 6. Related Decisions

- [ADR-0004: Propagate request-scoped mock policy across downstream HTTP hops](ADR-0004-propagated-request-scoped-mock-policy.md) — this ADR supersedes the multi-header propagation mechanism described in ADR-0004; the propagation concept remains but the carrier is now a single header with a JSON value.
- [ADR-0002: Use true-proxy forwarding as the default integration model](ADR-0002-true-proxy-forwarding-default.md) — the simplified header contract reduces the friction of integrating with the transparent proxy model.
- [ADR-0008: Control multi-hop propagation depth via maxHops in X-Mockery-Mock JSON value](ADR-0008-controlled-propagation-depth-via-max-hops.md) — maxHops is now a field in the JSON value defined by this ADR, replacing the separate X-Mockery-MaxHops header.

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
