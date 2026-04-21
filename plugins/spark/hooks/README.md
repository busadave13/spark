# Spark Hooks — Debug Logging

These hooks log Copilot agent session and tool activity to a per-session JSON file (`spark-{sessionId}-log.json`) in the current working directory.

## Hooks

| Event          | Script              | What it does                                                  |
|----------------|---------------------|---------------------------------------------------------------|
| `sessionStart` | `session-start.ps1` | Generates a session id and writes the first record            |
| `preToolUse`   | `pre-tool.ps1`      | Logs tool start with timestamp                                |
| `postToolUse`  | `post-tool.ps1`     | Logs tool result (duration, exit code)                        |
| `sessionEnd`   | `session-end.ps1`   | Writes session summary (duration, tool count); cleans state   |

## Prerequisites

- PowerShell 7+ (`pwsh`) must be on the PATH.
- The scripts must be installed at the paths referenced by `hooks.json`. Copy the contents of this folder's `scripts/` directory (including `debug-helper.psm1`) into `~/.copilot/hooks/scripts/` so that `$HOME/.copilot/hooks/scripts/{session-start,pre-tool,post-tool,session-end}.ps1` resolve.

## Output

After a session, look for `spark-{sessionId}-log.json` in the directory the Copilot agent was launched from. Each file is a JSON array of records, one per hook invocation, with timings and the raw event payload.

## Hook schema note

`hooks.json` uses a `"powershell"` key alongside `"type": "command"` to invoke the
PowerShell scripts. This relies on the Copilot CLI hook runner recognising the
`"powershell"` key as a Windows-friendly shorthand for spawning `pwsh`. If you are
running on a host where that shorthand is not honoured, replace each entry with a
standard `"command"` invocation, for example:

```json
{
  "type": "command",
  "command": "pwsh -NoProfile -File $HOME/.copilot/hooks/scripts/session-start.ps1",
  "timeoutSec": 30
}
```

The scripts themselves are pure PowerShell 7+ and run unchanged under either invocation
style.

