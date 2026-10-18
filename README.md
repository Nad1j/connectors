<p align="center"><img src="branding/logo-horizontal.svg" alt="Connectors: one video, every platform" width="560"></p>

<p align="center">
  <a href="https://github.com/Nad1j/connectors/releases/latest"><img alt="Download for Windows" src="https://img.shields.io/badge/Download-for%20Windows-38BDF8?style=for-the-badge&labelColor=0B1020"></a>
</p>

## Download

**[Download the `-setup.exe`](https://github.com/Nad1j/connectors/releases/latest), run it, done.** No admin rights, Node, Rust or FFmpeg needed. FFmpeg is included. If the PC lacks the WebView2 runtime (Windows 10/11 normally have it), the installer downloads it.

Test builds (versions like `v0.1.0-rc1`) are marked *pre-release* and only appear on the [Releases page](https://github.com/Nad1j/connectors/releases), not behind the "latest" link.

**If Windows shows a blue "Windows protected your PC" (SmartScreen) warning:** click **More info → Run anyway**. The app isn't code-signed yet, so Windows doesn't recognise the publisher.

**To sign in to YouTube or TikTok**, the app needs each platform's OAuth keys. Builds made with the CI secrets below already include the client IDs; otherwise ask the person who shared the app for a keys file and use **Settings → Platform keys → Import keys**:

```json
{
  "google": { "clientId": "123-abc.apps.googleusercontent.com", "clientSecret": "GOCSPX-..." },
  "tiktok": { "clientKey": "aw...", "clientSecret": "..." }
}
```

Either entry can be left out. The client JSON Google Cloud Console downloads (`{"installed": {"client_id": ..., "client_secret": ...}}`) also works for YouTube. Keys go into the system keychain (Windows Credential Manager) and are never shown again. Send the file privately and delete it after importing: it contains secrets. `connectors-keys*.json` is git-ignored for that reason.

To uninstall: **Settings → Apps → Installed apps → Connectors → Uninstall**. Tick "Delete the application data" to remove settings too. Saved sign-ins and keys stay in Windows Credential Manager under `app.connectors.desktop` until you remove them there or disconnect the accounts in the app first.

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

## Releasing a new version

Releases are built by GitHub Actions (`.github/workflows/release.yml`), so you can cut one from any machine with git, including a headless server:

1. Bump the version in **`package.json`**, **`src-tauri/tauri.conf.json`** and **`src-tauri/Cargo.toml`** (all three must match; `node scripts/check-version.mjs` checks).
2. Commit, merge to `main`, and push.
3. Tag and push the tag:
   ```bash
   git tag v0.2.0          # or v0.2.0-rc1 for a test build
   git push --tags
   ```
4. Watch it with `gh run watch`. The workflow checks the tag matches the app version, builds the Windows installer (plus macOS/Linux when `BUILD_MACOS` / `BUILD_LINUX` are `"true"` in the workflow, or ticked when run by hand), uploads it and publishes the release with generated notes. Tags with a hyphen (`v0.2.0-rc1`) are published as **pre-releases** and never become "latest".

The suffix after the hyphen only marks a pre-release: `v0.2.0-rc1` and `v0.2.0` both build app version 0.2.0.

**Repository secrets** (Settings → Secrets and variables → Actions), all optional:

| Secret | Used for |
| --- | --- |
| `YOUTUBE_CLIENT_ID` | Google OAuth client ID, embedded at build time |
| `TIKTOK_CLIENT_KEY` | TikTok client key, embedded at build time |

Client **secrets** are never embedded; users import them in Settings. Without these secrets the build still succeeds and users enter both values in Settings. Code signing isn't set up; the workflow marks where its env vars go.

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
