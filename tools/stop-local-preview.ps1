[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..")).Path

$matches = Get-CimInstance Win32_Process |
    Where-Object {
        ($_.Name -in @('python.exe', 'pythonw.exe')) -and
        $_.CommandLine -and
        $_.CommandLine -match 'http\.server' -and
        $_.CommandLine -match 'amw-preview-'
    }

if (-not $matches) {
    Write-Host "No local preview servers found for $repoRoot."
    return
}

foreach ($process in $matches | Sort-Object ProcessId) {
    Write-Host ("Stopping PID {0}: {1}" -f $process.ProcessId, $process.CommandLine)
    try {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    } catch [System.Management.Automation.ActionPreferenceStopException] {
        Write-Host ("PID {0} already exited." -f $process.ProcessId)
    } catch {
        Write-Host ("PID {0} could not be stopped safely: {1}" -f $process.ProcessId, $_.Exception.Message)
    }
}
