#!/usr/bin/env bash
# Downloads the LGPL FFmpeg build (ffmpeg + ffprobe, with libopenh264 and the
# native aac encoder) that Connectors bundles as a Tauri sidecar, verifies its
# checksum, and installs it as src-tauri/binaries/{ffmpeg,ffprobe}-<triple>.
#
#   scripts/fetch-ffmpeg.sh                         # for this machine's Rust host triple
#   scripts/fetch-ffmpeg.sh x86_64-pc-windows-msvc  # for another target
#
# Source: https://github.com/BtbN/FFmpeg-Builds (LGPL-3.0-or-later builds).
# Override the release series with FFMPEG_SERIES (default 8.1).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/src-tauri/binaries"
SERIES="${FFMPEG_SERIES:-8.1}"
BASE="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest"

TRIPLE="${1:-$(rustc -vV | sed -n 's/^host: //p')}"
case "$TRIPLE" in
  x86_64-pc-windows-msvc)    PLAT=win64;      EXT=zip;    EXE=.exe ;;
  aarch64-pc-windows-msvc)   PLAT=winarm64;   EXT=zip;    EXE=.exe ;;
  x86_64-unknown-linux-gnu)  PLAT=linux64;    EXT=tar.xz; EXE= ;;
  aarch64-unknown-linux-gnu) PLAT=linuxarm64; EXT=tar.xz; EXE= ;;
  *-apple-darwin)
    echo "No LGPL FFmpeg build with libopenh264 is published for macOS." >&2
    echo "Build one (--enable-libopenh264, no --enable-gpl) and copy it to:" >&2
    echo "  $OUT/ffmpeg-$TRIPLE and $OUT/ffprobe-$TRIPLE" >&2
    exit 1 ;;
  *) echo "Unsupported target triple: $TRIPLE" >&2; exit 1 ;;
esac

ASSET="ffmpeg-n${SERIES}-latest-${PLAT}-lgpl-${SERIES}.${EXT}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Fetching $ASSET for $TRIPLE"
curl -fsSL --retry 3 -o "$WORK/$ASSET" "$BASE/$ASSET"
curl -fsSL --retry 3 -o "$WORK/checksums.sha256" "$BASE/checksums.sha256"

expected="$(awk -v f="$ASSET" '$2 == f || $2 == "*"f { print $1 }' "$WORK/checksums.sha256")"
[ -n "$expected" ] || { echo "No checksum published for $ASSET" >&2; exit 1; }
if command -v sha256sum >/dev/null; then
  actual="$(sha256sum "$WORK/$ASSET" | awk '{print $1}')"
else
  actual="$(shasum -a 256 "$WORK/$ASSET" | awk '{print $1}')"
fi
[ "$expected" = "$actual" ] || { echo "Checksum mismatch for $ASSET" >&2; exit 1; }

mkdir -p "$WORK/x"
if [ "$EXT" = zip ]; then unzip -q "$WORK/$ASSET" -d "$WORK/x"; else tar -xJf "$WORK/$ASSET" -C "$WORK/x"; fi
BIN="$(find "$WORK/x" -type d -name bin | head -n1)"

mkdir -p "$OUT"
for tool in ffmpeg ffprobe; do
  install -m 0755 "$BIN/$tool$EXE" "$OUT/$tool-$TRIPLE$EXE"
done
echo "Installed to $OUT:"
ls -l "$OUT" | grep -- "-$TRIPLE"
