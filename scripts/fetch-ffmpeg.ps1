# Downloads the LGPL FFmpeg build (ffmpeg + ffprobe, with libopenh264 and the
# native aac encoder) that Connectors bundles as a Tauri sidecar, verifies its
# checksum, and installs it as src-tauri\binaries\{ffmpeg,ffprobe}-<triple>.exe.
#
#   pwsh scripts/fetch-ffmpeg.ps1                              # x86_64-pc-windows-msvc
#   pwsh scripts/fetch-ffmpeg.ps1 -Triple aarch64-pc-windows-msvc
#
# Source: https://github.com/BtbN/FFmpeg-Builds (LGPL-3.0-or-later builds).
param(
  [string]$Triple = "x86_64-pc-windows-msvc",
  [string]$Series = $(if ($env:FFMPEG_SERIES) { $env:FFMPEG_SERIES } else { "8.1" })
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$plat = switch ($Triple) {
  "x86_64-pc-windows-msvc"  { "win64" }
  "aarch64-pc-windows-msvc" { "winarm64" }
  default { throw "fetch-ffmpeg.ps1 handles Windows targets only (got $Triple). Use scripts/fetch-ffmpeg.sh." }
}

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "src-tauri\binaries"
$base = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest"
$asset = "ffmpeg-n$Series-latest-$plat-lgpl-$Series.zip"
$work = Join-Path ([IO.Path]::GetTempPath()) ("ffmpeg-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $work | Out-Null

try {
  Write-Host "Fetching $asset for $Triple"
  Invoke-WebRequest -Uri "$base/$asset" -OutFile "$work\$asset" -MaximumRetryCount 3
  Invoke-WebRequest -Uri "$base/checksums.sha256" -OutFile "$work\checksums.sha256" -MaximumRetryCount 3

  $line = Get-Content "$work\checksums.sha256" | Where-Object { ($_ -split '\s+')[1] -in @($asset, "*$asset") }
  if (-not $line) { throw "No checksum published for $asset" }
  $expected = ($line -split '\s+')[0]
  $actual = (Get-FileHash "$work\$asset" -Algorithm SHA256).Hash
  if ($actual -ne $expected.ToUpper()) { throw "Checksum mismatch for $asset" }

  Expand-Archive -Path "$work\$asset" -DestinationPath "$work\x"
  $bin = Get-ChildItem -Path "$work\x" -Recurse -Directory -Filter bin | Select-Object -First 1

  New-Item -ItemType Directory -Force -Path $out | Out-Null
  foreach ($tool in "ffmpeg", "ffprobe") {
    Copy-Item (Join-Path $bin.FullName "$tool.exe") (Join-Path $out "$tool-$Triple.exe") -Force
  }
  Write-Host "Installed to ${out}:"
  Get-ChildItem $out -Filter "*-$Triple.exe" | Format-Table Name, Length
}
finally {
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}
