Import-Module "$PSScriptRoot/debug-helper.psm1" -DisableNameChecking

try {
    $raw       = [Console]::In.ReadToEnd()
    $event     = $raw | ConvertFrom-Json
    $startMs   = Get-NowMs
    $sessionId = New-SessionId
    $logFile   = Get-DebugFilePath -SessionId $sessionId

    $stateFile = Get-StatePath -Suffix "session"
    @{ sessionId = $sessionId; startMs = $startMs; toolCount = 0; logFile = $logFile } |
        ConvertTo-Json | Set-Content $stateFile

    Write-DebugEvent -FilePath $logFile -Record @{
        hook      = "sessionStart"
        localTime = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffK")
        event     = $event
    }
} catch {
    Write-Warning "[debug] session-start failed: $_"
}