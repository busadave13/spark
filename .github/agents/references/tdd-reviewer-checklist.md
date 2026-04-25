# TDD Reviewer Checklist

This file is the normative source for `tdd-reviewer` checks. Evaluate only the
checks listed here. Apply each FAIL condition and severity mechanically.

| ID | Severity | FAIL condition |
| --- | --- | --- |
| T01 | BLOCK | Test suite cannot be executed (import error, syntax error, missing dependency). |
| T02 | BLOCK | Any test is currently failing. |
| T03 | BLOCK | Test file does not begin with a `// FEAT-NNN: ... AC coverage map:` comment block. |
| T04 | BLOCK | Any AC ID from the feature spec is absent from the coverage map. |
| T05 | BLOCK | Any test name listed in the coverage map does not match an actual `it()` / `test()` (or equivalent) in the file. |
| T06 | WARN | Any `it()` / `test()` call has no inline `/* AC-NNN */` comment. |
| T07 | WARN | Any `/* AC-NNN */` tag references an AC ID not present in the feature spec. |
| T08 | WARN | Any test name uses camelCase, `test_N`, or a non-descriptive name with fewer than 3 words. |
| T09 | WARN | Any test asserts on private method return values, internal state, or non-exported symbols. |
| T10 | WARN | No `beforeEach` or `afterEach` teardown is present in a test file that uses db, mailer, clock, or other stateful helpers. |
| T11 | WARN | Any time-based test uses `setTimeout`, `Date.now()`, or `new Date()` directly instead of an injectable clock helper. |
| T12 | WARN | Any AC has no test describing the main success behavior. |
| T13 | WARN | Any AC has no test describing an error, rejection, or missing-input condition. |
| T14 | BLOCK | Any implementation file still contains a `NotImplemented` / `not implemented` throw that would cause tests to fail. |
| T15 | WARN | Any `it()` / `test()` call has no AC tag; this is potential scope creep. |
| T16 | BLOCK | No `.testplan.md` file exists at `{docs-root}/testplan/FEAT-NNN-*.testplan.md`. |
| T17 | BLOCK | Any test name in the coverage map is absent from the `.testplan.md`, or any test name in the `.testplan.md` is absent from the coverage map. |
| T18 | BLOCK | Feature/testplan status pair is not one of: (`Draft`,`Draft`), (`Approved`,`Draft`), (`Approved`,`Approved`), (`Implemented`,`Approved`), (`Implemented`,`Implemented`). |
| T20 | BLOCK | The testplan `**Plan baseline**` field is missing, or the live passing-test count differs from the case count in that field. The body total and `**Plan baseline**` must agree. |
| T21 | BLOCK | The testplan file does not begin with `<!-- SPARK -->`, contains more than one `<!-- SPARK -->` marker, or contains any `<!-- SPECIT -->` marker. |
| T22 | BLOCK | Any `*.testplan.md` file is found inside `{docs-root}/feature/`. |
| T23 | BLOCK | The testplan header `**Type**` field is missing, blank, or not exactly `TESTPLAN`. |
| C01 | BLOCK | Any implementation file for the feature lacks a `// FEAT-NNN: ... AC coverage map:` comment block near the top. |
| C02 | BLOCK | Any AC ID from the feature spec is absent from all implementation coverage map headers. |
| C04 | BLOCK | The set of AC IDs in the implementation coverage map headers differs from the AC set in the `.testplan.md`. |
| C06 | WARN | Any implementation coverage map header references the wrong spec path or feature name. |

## Gate rule

- `gate = PASS` iff no BLOCK findings remain.
- `gate = FAIL` iff one or more BLOCK findings remain.
- WARN findings never block `Implemented`, but they must be surfaced in the final
  summary.
