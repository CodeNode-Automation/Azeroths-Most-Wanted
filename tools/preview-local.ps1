[CmdletBinding()]
param(
    [switch]$NoServe
)

$ErrorActionPreference = "Stop"

function Get-AvailablePort {
    param(
        [int]$Preferred = 8000
    )

    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Preferred)
        $listener.Start()
        return $Preferred
    } catch {
        if ($listener) {
            $listener.Stop()
        }
    }

    $fallback = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    try {
        $fallback.Start()
        return [int]$fallback.LocalEndpoint.Port
    } finally {
        $fallback.Stop()
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
$previewRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("amw-preview-{0}" -f ([Guid]::NewGuid().ToString("N")))
New-Item -ItemType Directory -Path $previewRoot -Force | Out-Null

$pythonExe = Join-Path $repoRoot "venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    $pythonExe = "python"
}

Write-Host "== Build Temp Preview =="

$buildScript = @'
import json
import os
import shutil
import sys
from pathlib import Path

repo_root = Path(sys.argv[1])
preview_dir = Path(sys.argv[2])
assets_src = repo_root / "asset"
assets_dst = preview_dir / "asset"
shutil.copytree(assets_src, assets_dst, dirs_exist_ok=True)

def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default

roster = load_json(assets_src / "roster.json", [])
raw = load_json(assets_src / "raw_roster.json", [])
timeline = load_json(assets_src / "timeline.json", [])

sys.path.insert(0, str(repo_root))
os.chdir(preview_dir)

from render.html_dashboard import generate_html_dashboard

generate_html_dashboard(roster, {}, timeline, raw, {}, {}, {})
print(preview_dir)
'@

$buildScript | & $pythonExe - $repoRoot $previewRoot
if ($LASTEXITCODE -ne 0) {
    throw "Preview build failed."
}

$port = Get-AvailablePort

if ($NoServe) {
    Write-Host "Preview built without starting a server."
    Write-Host "Preview directory: $previewRoot"
    Write-Host "Manual server command:"
    Write-Host "  $pythonExe -m http.server $port --bind 127.0.0.1 --directory `"$previewRoot`""
    Write-Host "Open: http://127.0.0.1:$port/index.html"
    return
}

Start-Process -WindowStyle Hidden -FilePath $pythonExe -ArgumentList @(
    "-m",
    "http.server",
    $port,
    "--bind",
    "127.0.0.1",
    "--directory",
    $previewRoot
) -WorkingDirectory $previewRoot | Out-Null

Write-Host "Preview directory: $previewRoot"
Write-Host "Preview URL: http://127.0.0.1:$port/index.html"
Write-Host "Keep this shell open while you preview. The server is running in the background."
