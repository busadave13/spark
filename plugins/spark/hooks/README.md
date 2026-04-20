# Spark Hooks — Debug Logging

These hooks log Copilot agent session and tool activity to `spark_debug.md` at the repo root.

## Hooks

| Event          | Script              | What it does                                      |
|----------------|---------------------|---------------------------------------------------|
| `sessionStart` | `session-start.ps1` | Clears/creates `spark_debug.md`, writes header   |
| `preToolUse`   | `pre-tool.ps1`      | Logs tool start with timestamp                    |
| `postToolUse`  | `post-tool.ps1`     | Logs tool result (duration, exit code)            |
| `sessionEnd`   | `session-end.ps1`   | Writes session summary (duration, tool count)     |

## Prerequisites

- PowerShell 7+ (`pwsh`) must be on the PATH

## Output

After a session, open `spark_debug.md` at the repo root to see a structured log of all tool invocations with timings and status.
