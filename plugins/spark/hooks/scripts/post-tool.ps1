Import-Module "$PSScriptRoot/debug-helper.psm1" -DisableNameChecking

try {
    $raw       = [Console]::In.ReadToEnd()
    $eventData = $raw | ConvertFrom-Json
    $toolName  = $eventData.toolName ?? "unknown"
    $endMs     = Get-NowMs

    $stateFile = Get-StatePath -Suffix "session"
    if (-not (Test-Path $stateFile)) { return }
    $state = Get-Content $stateFile | ConvertFrom-Json

    $record = @{
        hook      = "postToolUse"
        localTime = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffK")
        event     = $eventData
    }

    # Find the most recent tool state file for this tool name
    $tmp = [System.IO.Path]::GetTempPath()
    $key = Get-SessionKey
    $toolStateFile = Get-ChildItem (Join-Path $tmp "spark-debug-tool-$toolName-*-$key.json") -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName

    if ($toolStateFile -and (Test-Path $toolStateFile)) {
        $toolState = Get-Content $toolStateFile | ConvertFrom-Json
        $record.durationMs = $endMs - $toolState.startMs

        $state.toolCount = ($state.toolCount ?? 0) + 1
        $state | ConvertTo-Json | Set-Content $stateFile

        Remove-Item $toolStateFile -ErrorAction SilentlyContinue
    }

    Write-DebugEvent -FilePath $state.logFile -Record $record
} catch {
    Write-Warning "[debug] post-tool failed: $_"
}