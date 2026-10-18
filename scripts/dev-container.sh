#!/usr/bin/env bash
# Runs the Rust checks (clippy + tests) inside an Ubuntu 24.04 container that
# has Tauri's Linux dependencies. Useful on hosts that lack webkit2gtk-4.1
# (e.g. Enterprise Linux 9). Works with rootless podman or docker.
#
#   scripts/dev-container.sh                 # clippy -D warnings + tests
#   scripts/dev-container.sh cargo check     # any command, run in src-tauri/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="${CONTAINER_ENGINE:-$(command -v podman || command -v docker)}"
IMAGE="connectors-rust-ci:24.04"

if ! "$ENGINE" image exists "$IMAGE" 2>/dev/null && ! "$ENGINE" image inspect "$IMAGE" >/dev/null 2>&1; then
  "$ENGINE" build -t "$IMAGE" -f - "$ROOT/scripts" <<'EOF'
FROM docker.io/library/ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential curl wget file pkg-config ca-certificates ffmpeg \
      libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*
ENV RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo PATH=/usr/local/cargo/bin:$PATH
RUN curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --component clippy
EOF
fi

if [ "$#" -eq 0 ]; then
  set -- bash -c "cargo clippy --all-targets -- -D warnings && cargo test"
fi

# Use the LGPL FFmpeg from scripts/fetch-ffmpeg.sh when present, so the
# end-to-end test runs against what the installer bundles.
FFMPEG_ENV=()
TRIPLE="$(uname -m)-unknown-linux-gnu"
if [ -x "$ROOT/src-tauri/binaries/ffmpeg-$TRIPLE" ]; then
  FFMPEG_ENV=(-e "FFMPEG_PATH=/work/src-tauri/binaries/ffmpeg-$TRIPLE"
              -e "FFPROBE_PATH=/work/src-tauri/binaries/ffprobe-$TRIPLE")
fi

# Named volumes keep the registry and target dir warm between runs; the
# container target dir is separate from the host's to avoid mixing toolchains.
exec "$ENGINE" run --rm \
  -v "$ROOT:/work:z" \
  -v connectors-cargo-registry:/usr/local/cargo/registry \
  -v connectors-target:/work/src-tauri/target-container \
  -e CARGO_TARGET_DIR=/work/src-tauri/target-container \
  "${FFMPEG_ENV[@]}" \
  -w /work/src-tauri \
  "$IMAGE" "$@"
