<!-- SPECIT -->

# ADR-0003: Match replays using request target and materially relevant request shape

> **Version**: 1.1<br>
> **Created**: 2026-04-13<br>
> **Last Updated**: 2026-04-18<br>
> **Owner**: Dave Harding<br>
> **Project**: Mockery<br>
> **Status**: Approved

---

## 1. Context

Recorded responses are only useful if replayed calls are trustworthy enough for developers to debug against them. The PRD requires Mockery to treat changes in request method, destination, path, query, or materially relevant request inputs as non-matches rather than silently reusing a stored response. The team also wants human-editable mocks, which means replay behavior must stay predictable even when artifacts are reviewed or curated manually. Without a correctness-first matching rule, Mockery could return plausible but wrong responses and erode confidence in the tool.

---

## 2. Decision

> We will match replay candidates using request target plus materially relevant request shape, and we will treat meaningful differences as replay misses by default.

---

## 3. Rationale

Using destination, method, path, query, normalized body, and selected headers as the default fingerprint puts correctness ahead of maximizing replay hit rate. This approach maps directly to the product requirement that materially different requests must not silently reuse an earlier response. It also provides a stable contract for manual mock authors, because the same fingerprint rules apply to recorded and hand-authored artifacts. By choosing strict defaults now, the team can introduce future normalization rules intentionally rather than trying to recover from overly broad matching behavior later.

---

## 4. Alternatives Considered

### Host and path matching only
**Why rejected:** Matching only on destination and path would ignore meaningful differences in method, query, headers, or body shape and would make incorrect replay responses far too likely.

### Fully custom matching rules per upstream from day one
**Why rejected:** Making every service define custom normalization logic up front would add exactly the kind of per-upstream setup burden that Mockery is trying to eliminate for common development scenarios.

---

## 5. Consequences

### Positive Consequences
- Replay decisions remain explainable because developers can reason about why a request was a hit or miss from the same fingerprint inputs used by the system.
- Manual mock curation stays safer because editors can adjust artifacts without changing the core rule that materially different requests must not share one stored response.

### Trade-offs Accepted
- Highly variable payloads will produce more misses and more re-recording work, especially before any optional normalization features exist for exceptional cases.
- Fingerprint computation must inspect and normalize more request data, which adds implementation complexity to request parsing, hashing, and storage metadata.

---

## 6. Related Decisions

- [ADR-0002: Use true-proxy forwarding as the default integration model](ADR-0002-true-proxy-forwarding-default.md) — transparent proxying only works safely when replay matching is strict.
- [ADR-0005: Persist mocks via a human-readable storage abstraction per environment](ADR-0005-human-readable-storage-abstraction.md) — the storage format must preserve the fingerprint inputs that this matching model depends on.

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
