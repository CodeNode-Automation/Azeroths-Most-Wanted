$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path

Set-Location $RepoRoot

$PythonExe = Join-Path $RepoRoot "venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host "== $Title =="
    & $Command
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

Invoke-Step -Title "Install Dependencies" -Command {
    & $PythonExe -m pip install -r requirements.txt
}

Invoke-Step -Title "Compile Check" -Command {
    & $PythonExe -m compileall -q main.py wow render tests
}

Invoke-Step -Title "Run Tests" -Command {
    & $PythonExe -m unittest discover
}

Invoke-Step -Title "Git Status" -Command {
    $status = & git status --short --untracked-files=all
    if ($status) {
        $status | ForEach-Object { Write-Host $_ }
    }

    if ($status -match '(^|\r?\n)(.. )?(asset/|index\.html)') {
        Write-Host ""
        Write-Warning "Tracked site outputs are present in git status. Review them before committing."
    }
}
