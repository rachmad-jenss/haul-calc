param(
    [string]$Tag,
    [string]$Repo
)

# Use GITHUB_WORKSPACE for absolute path, fallback to current dir
$workspace = if ($env:GITHUB_WORKSPACE) { $env:GITHUB_WORKSPACE } else { (Get-Location).Path }
$nsisDir   = Join-Path $workspace "src-tauri\target\release\bundle\nsis"
$version   = $Tag.TrimStart('v')

Write-Host "Workspace: $workspace"
Write-Host "NSIS dir: $nsisDir"
if (Test-Path $nsisDir) {
    Write-Host "NSIS dir contents:"
    Get-ChildItem $nsisDir | ForEach-Object { Write-Host "  $($_.Name)" }
} else {
    Write-Host "NSIS dir does not exist"
    exit 0
}

$zipFile = Get-ChildItem "$nsisDir\*.nsis.zip" -ErrorAction SilentlyContinue | Select-Object -First 1
$sigFile = Get-ChildItem "$nsisDir\*.nsis.zip.sig" -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $zipFile) { Write-Host "No .nsis.zip found - skipping"; exit 0 }
if (-not $sigFile) { Write-Host "No .nsis.zip.sig found - skipping"; exit 0 }

$sig     = (Get-Content $sigFile.FullName -Raw -Encoding UTF8).Trim()
$zipName = $zipFile.Name
$dlUrl   = "https://github.com/$Repo/releases/download/$Tag/" + [Uri]::EscapeDataString($zipName)
$pubDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

Write-Host "Uploading $zipName to release $Tag..."
gh release upload $Tag $zipFile.FullName --clobber
if ($LASTEXITCODE -ne 0) { Write-Error "gh release upload nsis.zip failed"; exit 1 }

$json = [ordered]@{
    version   = $version
    notes     = "See the assets to download and install this version."
    pub_date  = $pubDate
    platforms = [ordered]@{
        "windows-x86_64" = [ordered]@{
            signature = $sig
            url       = $dlUrl
        }
    }
} | ConvertTo-Json -Depth 5 -Compress

$jsonPath = Join-Path $env:TEMP "latest.json"
[System.IO.File]::WriteAllText($jsonPath, $json, [System.Text.Encoding]::UTF8)
Write-Host "latest.json: $json"

Write-Host "Uploading latest.json to release $Tag..."
gh release upload $Tag $jsonPath --clobber
if ($LASTEXITCODE -ne 0) { Write-Error "gh release upload latest.json failed"; exit 1 }

Write-Host "Done - latest.json uploaded successfully."
