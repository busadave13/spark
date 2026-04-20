Import-Module "$PSScriptRoot/debug-helper.psm1" -DisableNameChecking

try {
    $raw       = [Console]::In.ReadToEnd()
    $eventData = $raw | ConvertFrom-Json
    $endMs     = Get-NowMs

    $stateFile = Get-StatePath -Suffix "session"
    if (-not (Test-Path $stateFile)) { return }
    $state = Get-Content $stateFile | ConvertFrom-Json

    Write-DebugEvent -FilePath $state.logFile -Record @{
        hook              = "sessionEnd"
        localTime         = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffK")
        event             = $eventData
        sessionDurationMs = $endMs - $state.startMs
        toolCount         = $state.toolCount ?? 0
    }

    # Clean up state files
    Remove-Item $stateFile -ErrorAction SilentlyContinue
    $tmp = [System.IO.Path]::GetTempPath()
    $key = Get-SessionKey
    Get-ChildItem (Join-Path $tmp "spark-debug-tool-*-$key.json") -ErrorAction SilentlyContinue |
        Remove-Item -ErrorAction SilentlyContinue
} catch {
    Write-Warning "[debug] session-end failed: $_"
}