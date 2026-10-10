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

Prerequisites: Node 20+, Rust (stable), [Tauri's system dependencies](https://v2.tauri.app/start/prerequisites/), FFmpeg on `PATH` (or set `FFMPEG_PATH` / `FFPROBE_PATH`).

```bash
npm install
cp src-tauri/.env.example src-tauri/.env   # add OAuth client IDs
npm run tauri dev                           # desktop app
npm run dev                                 # UI only, in a browser, with mocked backend
```

Rust tests: `cargo test --manifest-path src-tauri/Cargo.toml`

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
