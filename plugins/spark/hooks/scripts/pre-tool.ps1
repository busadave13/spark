Import-Module "$PSScriptRoot/debug-helper.psm1" -DisableNameChecking

try {
    $raw      = [Console]::In.ReadToEnd()
    $event    = $raw | ConvertFrom-Json
    $toolName = $event.toolName ?? "unknown"
    $startMs  = Get-NowMs

    $stateFile = Get-StatePath -Suffix "session"
    if (-not (Test-Path $stateFile)) { return }
    $state = Get-Content $stateFile | ConvertFrom-Json

    $toolId = "$toolName-$(Get-Random -Maximum 999999)"
    $toolStateFile = Get-StatePath -Suffix "tool-$toolId"

    @{ toolName = $toolName; startMs = $startMs } |
        ConvertTo-Json | Set-Content $toolStateFile

    Write-DebugEvent -FilePath $state.logFile -Record @{
        hook      = "preToolUse"
        localTime = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffK")
        event     = $event
    }
} catch {
    Write-Warning "[debug] pre-tool failed: $_"
}