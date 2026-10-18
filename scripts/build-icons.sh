#!/usr/bin/env bash
# Regenerates every icon derived from branding/app-icon.svg. The outputs are
# committed, so CI never runs this. Needs: rsvg-convert, ffmpeg (PNG -> BMP
# for the NSIS images) and the Tauri CLI from node_modules.
#
#   scripts/build-icons.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/branding/app-icon.svg"
ICONS="$ROOT/src-tauri/icons"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

BG="#0B1020"

# Inner markup of the source icon without the <svg> wrapper and the embedded
# C2PA metadata, so it can be placed inside other SVGs.
art() {
  sed -e 's/<metadata>.*<\/metadata>//' "$SRC" | tr '\n' ' ' |
    sed -e 's/^.*<svg[^>]*>//' -e 's/<\/svg>.*$//'
}

# Transparent, metadata-free copies for the web UI and the favicon.
clean="<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\" width=\"512\" height=\"512\">$(art)</svg>"
printf '%s\n' "$clean" > "$ROOT/app-icon.svg"
printf '%s\n' "$clean" > "$ROOT/public/favicon.svg"
printf '%s\n' "$clean" > "$ROOT/src/assets/app-icon.svg"

# OS icon: the mark on a solid dark rounded square, so it reads on any
# taskbar, dock or desktop background.
cat > "$WORK/os.svg" <<EOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1024" height="1024">
  <rect width="512" height="512" rx="112" fill="$BG"/>
  $(art)
</svg>
EOF
rsvg-convert -w 1024 -h 1024 "$WORK/os.svg" -o "$WORK/os-1024.png"
(cd "$ROOT" && npx tauri icon "$WORK/os-1024.png" -o "$ICONS" >/dev/null)
# Desktop-only app: drop the mobile icon sets the CLI also emits.
rm -rf "$ICONS/android" "$ICONS/ios"

# Tray: simplified mark (no ring, no glow, chunkier shapes) cropped tight so
# it stays legible at 16-32 px. Transparent background.
cat > "$WORK/tray.svg" <<EOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="66 60 380 380" width="64" height="64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#38BDF8"/><stop offset="1" stop-color="#34D399"/>
    </linearGradient>
  </defs>
  <g stroke="url(#g)" stroke-width="22" stroke-linecap="round">
    <line x1="256" y1="256" x2="256" y2="106"/><line x1="256" y1="256" x2="398.66" y2="209.65"/>
    <line x1="256" y1="256" x2="344.17" y2="377.35"/><line x1="256" y1="256" x2="167.83" y2="377.35"/>
    <line x1="256" y1="256" x2="113.34" y2="209.65"/>
  </g>
  <g fill="url(#g)">
    <circle cx="256" cy="106" r="44"/><circle cx="398.66" cy="209.65" r="44"/>
    <circle cx="344.17" cy="377.35" r="44"/><circle cx="167.83" cy="377.35" r="44"/>
    <circle cx="113.34" cy="209.65" r="44"/><circle cx="256" cy="256" r="96"/>
  </g>
  <path d="M232 206 L232 306 L316 256 Z" fill="$BG"/>
</svg>
EOF
rsvg-convert -w 64 -h 64 "$WORK/tray.svg" -o "$ICONS/tray.png"

# NSIS installer artwork (24-bit BMP): header 150x57, welcome/finish sidebar 164x314.
mkdir -p "$ICONS/installer"
cat > "$WORK/header.svg" <<EOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 57" width="150" height="57">
  <rect width="150" height="57" fill="$BG"/>
  <svg x="96" y="3" width="51" height="51" viewBox="0 0 512 512">$(art)</svg>
</svg>
EOF
cat > "$WORK/sidebar.svg" <<EOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 164 314" width="164" height="314">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#38BDF8" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#34D399" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#38BDF8"/><stop offset="1" stop-color="#34D399"/>
    </linearGradient>
  </defs>
  <rect width="164" height="314" fill="$BG"/>
  <rect width="164" height="314" fill="url(#fade)"/>
  <svg x="17" y="56" width="130" height="130" viewBox="0 0 512 512">$(art)</svg>
  <rect x="42" y="214" width="80" height="3" rx="1.5" fill="url(#bar)"/>
</svg>
EOF
for name in header sidebar; do
  rsvg-convert "$WORK/$name.svg" -o "$WORK/$name.png"
  ffmpeg -v error -y -i "$WORK/$name.png" -pix_fmt bgr24 "$ICONS/installer/$name.bmp"
done

echo "Icons written to $ICONS"
