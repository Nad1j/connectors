<p align="center"><img src="branding/logo-horizontal.svg" alt="Connectors: one video, every platform" width="560"></p>

# Connectors

A desktop command center for video creators: upload one video, adapt it for YouTube, TikTok, Instagram, Facebook and X, write the copy with AI, publish or schedule, then follow analytics and comments in one place.

Built with **Tauri 2** (Rust) and **React 18 + TypeScript + Tailwind + Framer Motion**.

## Status

| Area | State |
| --- | --- |
| Publisher UI (dropzone, platform chips, per-platform previews, AI panel, queue) | Done |
| OAuth 2.0 + PKCE for YouTube and TikTok, tokens in the OS keychain | Done (Meta and X: add a `ProviderConfig`) |
| FFmpeg probing and auto-fit (crop / blurred fill / black bars / trim) | Done, tested against real FFmpeg |
| Publish queue (concurrent jobs, live progress events, cancel) | Done. Uploads are **mocked** behind the `Uploader` trait |
| AI captions, titles, hashtags (Claude, JSON-schema output) | Done, falls back to offline suggestions without a key |
| Calendar (drag to reschedule, suggested times), Analytics, Inbox | UI on seed data. Platform API fetchers are next |

## Run it

Prerequisites: Node 20+, Rust (stable), [Tauri's system dependencies](https://v2.tauri.app/start/prerequisites/). For FFmpeg, run `scripts/fetch-ffmpeg.sh` (or `scripts/fetch-ffmpeg.ps1` on Windows) once, or put an FFmpeg with `libopenh264` and `aac` on `PATH`.

```bash
npm install
cp src-tauri/.env.example src-tauri/.env   # add OAuth client IDs
npm run tauri dev                           # desktop app
npm run dev                                 # UI only, in a browser, with mocked backend
```

Rust tests: `cargo test --manifest-path src-tauri/Cargo.toml`

No webkit2gtk-4.1 on your Linux host (e.g. Enterprise Linux 9)? `scripts/dev-container.sh` runs `cargo clippy` and `cargo test` in an Ubuntu 24.04 container with rootless podman or docker. CI (`.github/workflows/ci.yml`) runs the same checks on Ubuntu and Windows.

## FFmpeg and licensing

Connectors ships `ffmpeg` and `ffprobe` as [Tauri sidecars](https://v2.tauri.app/develop/sidecar/). They are not committed to git: `scripts/fetch-ffmpeg.sh [target-triple]` (Linux/macOS) and `scripts/fetch-ffmpeg.ps1` (Windows, used by CI) download the **LGPL** build from [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds), verify its SHA-256 and save it as `src-tauri/binaries/{ffmpeg,ffprobe}-<target-triple>[.exe]`. Installers are built with `tauri build --config src-tauri/tauri.bundle.conf.json`, which adds the sidecars, so plain `cargo` builds and `tauri dev` work without them.

The app looks for FFmpeg in this order: `FFMPEG_PATH` / `FFPROBE_PATH` → the bundled sidecar → `PATH`. Settings → Video engine shows which one is in use, its version, and whether the two encoders the app needs, `libopenh264` (H.264) and `aac`, are present. If either is missing, publishing is disabled with an explanation.

Re-encodes use OpenH264 in bitrate mode. Medium quality follows YouTube's SDR recommendations: 8 Mb/s at 1080p, 5 Mb/s at 720p. Low is ×0.6 and High is ×1.5. For long clips the bitrate is lowered so the file stays under the platform's size limit (see `src-tauri/src/platform.rs`). If that would take it below a quarter of the base bitrate, the job fails with a "trim the video" message.

**License notice.** The bundled FFmpeg is licensed under the LGPL v3 or later. It contains no GPL-only or non-free parts and includes OpenH264 (BSD 2-Clause, © Cisco Systems). Connectors runs it as a separate program and does not link to it. The notice and full license texts are in [`src-tauri/resources/licenses/`](src-tauri/resources/licenses/) and are installed with the app. FFmpeg source: <https://github.com/FFmpeg/FFmpeg> (release 8.1). Build scripts: <https://github.com/BtbN/FFmpeg-Builds>.

## Layout

```
src/                         React app
  components/
    layout/                  Sidebar, AccountsBar (connected-channel status + re-auth)
    publisher/               VideoDropzone, PlatformSelector, PreviewStage, AIAssistant,
                             Composer, PublishActions (+ schedule dialog), UploadQueue
    ui/  icons/              Glass panels, buttons, progress, platform glyphs
  views/                     Dashboard, Publisher, Calendar, Analytics, Inbox, Accounts, Settings
  services/
    auth/oauthService.ts     invokes Rust OAuth commands
    publish/pipeline.ts      submits jobs, folds `publish://progress` events into the store
    publish/bestTimes.ts     posting-time recommender
    media/videoService.ts    probe + fit-strategy mirror of the Rust planner
    ai/captionService.ts     invokes Rust AI command
  store/useAppStore.ts       Zustand store
  config/platforms.ts        per-platform formats, caption limits, peak hours

src-tauri/src/               Rust backend
  auth/                      oauth.rs (loopback redirect, code exchange, refresh),
                             pkce.rs, providers.rs (YouTube, TikTok), token_store.rs (keyring)
  media/                     ffmpeg.rs (ffprobe, run with progress), plan.rs (fit decisions + args)
  publish/                   queue.rs (semaphore-limited encode/upload workers), uploader.rs (trait + mock)
  ai.rs                      Claude Messages API with structured JSON output
  commands.rs                Tauri command surface
```

## How the pieces fit

**Sign-in.** `auth_connect` binds `127.0.0.1:<random port>`, opens the provider's consent page in the system browser with a PKCE challenge and `state`, waits for the redirect, checks `state`, exchanges the code and writes the token set to the OS keychain (macOS Keychain, Windows Credential Manager, Secret Service). Tokens never reach the webview. `oauth::valid_token` refreshes expired tokens before uploads. Register `http://127.0.0.1` as a redirect URI in the Google Cloud and TikTok developer consoles.

**Video fit.** `media::plan` compares source and target aspect ratios. Same ratio: resize or pass through. Within 20%: center crop. Further apart: blurred fill (the video scaled to fit over a blurred, zoomed copy of itself). Users can force crop, blurred fill or black bars per platform. Clips over a platform's limit are trimmed. The Preview panel uses the same rules, so what you see is what FFmpeg renders.

**Publishing.** `publish_submit` returns a job id right away and starts one task per platform. Encodes are limited to 2 at a time and uploads to 4. Every state change is emitted on `publish://progress` (`queued → processing → uploading → finalizing → published`). To go live, implement `Uploader` for each platform (YouTube resumable upload, TikTok Content Posting API, Meta Reels upload sessions, X chunked media upload) and return it from `uploader::for_platform`.

**AI copy.** `ai_generate` calls `claude-opus-5-5` with a JSON schema in `output_config.format`, so the response always parses into `{ titles, caption, hashtags }`. The API key comes from `ANTHROPIC_API_KEY` or from Settings, where it is stored in the keychain.
