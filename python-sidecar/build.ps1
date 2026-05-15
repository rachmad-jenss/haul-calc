# Build the haul-pave bridge sidecar as a single-file Windows executable.
# Output is dropped into ../src-tauri/binaries with the triple-suffixed name
# Tauri expects for `bundle.externalBin`.
#
# Usage (from repo root):
#   pwsh python-sidecar/build.ps1
#
# Prerequisites:
#   - Python 3.10+ on PATH
#   - Run once: python -m venv .venv ; .venv/Scripts/Activate.ps1 ; pip install -r requirements.txt

$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

if (-not (Test-Path .venv)) {
    Write-Host "[bootstrap] creating venv"
    python -m venv .venv
}

# Activate venv (PowerShell)
. .venv/Scripts/Activate.ps1

Write-Host "[bootstrap] installing requirements"
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

# Detect rustc target triple so we can name the output the way Tauri wants.
# Tauri looks for: <name>-<triple>(.exe)
$triple = (rustc -vV | Select-String "host:").ToString().Split(":")[1].Trim()
if (-not $triple) { $triple = "x86_64-pc-windows-msvc" }

$binDir = Join-Path $here "..\src-tauri\binaries"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

Write-Host "[build] running PyInstaller for triple=$triple"
pyinstaller `
  --noconfirm `
  --onefile `
  --console `
  --name "haulpave-bridge" `
  --collect-data haulpave `
  --distpath "$binDir" `
  --workpath "build" `
  --specpath "build" `
  bridge.py

# Rename to the triple-suffixed form Tauri expects.
$src = Join-Path $binDir "haulpave-bridge.exe"
$dst = Join-Path $binDir "haulpave-bridge-$triple.exe"
if (Test-Path $src) {
    Move-Item -Force $src $dst
    Write-Host "[done] $dst"
} else {
    Write-Error "PyInstaller did not produce $src"
    exit 1
}
