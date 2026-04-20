# debug-helper.psm1 — Write per-session JSON debug logs

function Get-SessionKey {
    # Parent PID scopes state to the Copilot session that spawned this hook
    try { return (Get-Process -Id $PID).Parent.Id.ToString() }
    catch { return "default" }
}

function New-SessionId {
    $bytes = [byte[]]::new(4)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
}

function Get-StatePath {
    param([string] $Suffix = "session")
    $key = Get-SessionKey
    $tmp = [System.IO.Path]::GetTempPath()
    Join-Path $tmp "spark-debug-$Suffix-$key.json"
}

function Get-DebugFilePath {
    param([string] $SessionId)
    Join-Path (Get-Location) "spark-$SessionId-log.json"
}

function Write-DebugEvent {
    param([string] $FilePath, [hashtable] $Record)
    try {
        # Read existing array (or start empty), append, write back as valid JSON array
        $records = @()
        if (Test-Path $FilePath) {
            $existing = Get-Content $FilePath -Raw -ErrorAction SilentlyContinue
            if ($existing -and $existing.Trim()) {
                $records = @(ConvertFrom-Json $existing -ErrorAction Stop)
            }
        }
        $records += $Record
        ConvertTo-Json -InputObject @($records) -Depth 10 |
            Set-Content $FilePath -Encoding utf8
    } catch {
        Write-Warning "[debug] write failed: $_"
    }
}

function Get-NowMs { [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }