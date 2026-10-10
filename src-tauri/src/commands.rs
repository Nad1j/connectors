use crate::{
    ai::{self, AiRequest, AiSuggestion},
    auth::{oauth, providers, token_store::TokenStore, ConnectionStatus},
    error::{AppError, AppResult},
    media::{ffmpeg, plan::{FitStrategy, FormatPlan}},
    platform::{FormatTarget, Platform},
    publish::{queue::PublishQueue, PublishRequest},
};
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

const ALL: [Platform; 5] = [Platform::Youtube, Platform::Tiktok, Platform::Instagram, Platform::Facebook, Platform::X];

// ---- Auth ------------------------------------------------------------------

#[tauri::command]
pub async fn auth_connect(app: AppHandle, platform: Platform) -> AppResult<ConnectionStatus> {
    let cfg = providers::for_platform(platform)
        .ok_or_else(|| AppError::Other(format!("{} sign-in isn't available yet", platform.id())))?;
    let tokens = oauth::authorize(cfg, |url| {
        app.opener()
            .open_url(url, None::<&str>)
            .map_err(|e| AppError::Other(format!("Couldn't open the browser: {e}")))
    })
    .await?;
    Ok(ConnectionStatus {
        platform,
        connected: true,
        expired: false,
        configured: true,
        account_id: tokens.account_id,
    })
}

#[tauri::command]
pub async fn auth_refresh(platform: Platform) -> AppResult<()> {
    let cfg = providers::for_platform(platform).ok_or_else(|| AppError::Other("Unsupported platform".into()))?;
    let current = TokenStore::load(platform)?.ok_or_else(|| AppError::OAuth("Not connected".into()))?;
    oauth::refresh(cfg, &current).await?;
    Ok(())
}

#[tauri::command]
pub fn auth_disconnect(platform: Platform) -> AppResult<()> {
    TokenStore::delete(platform)
}

#[tauri::command]
pub fn auth_status() -> Vec<ConnectionStatus> {
    ALL.iter()
        .map(|&p| {
            let tokens = TokenStore::load(p).ok().flatten();
            ConnectionStatus {
                platform: p,
                connected: tokens.is_some(),
                expired: tokens.as_ref().map(|t| t.is_expired()).unwrap_or(false),
                configured: providers::for_platform(p).and_then(|c| c.client_id()).is_some(),
                account_id: tokens.and_then(|t| t.account_id),
            }
        })
        .collect()
}

#[tauri::command]
pub fn settings_save_secret(name: String, value: String) -> AppResult<()> {
    TokenStore::save_secret(&name, &value)
}

// ---- Media -----------------------------------------------------------------

#[tauri::command]
pub async fn media_probe(path: String) -> AppResult<ffmpeg::VideoInfo> {
    ffmpeg::probe(&path).await
}

#[tauri::command]
pub async fn media_plan(
    path: String,
    platform: Platform,
    short_form: bool,
    strategy: FitStrategy,
) -> AppResult<FormatPlan> {
    let info = ffmpeg::probe(&path).await?;
    let target = FormatTarget::for_platform(platform, short_form);
    Ok(ffmpeg::plan_for(&info, "<output>.mp4", target, strategy))
}

#[tauri::command]
pub async fn media_ffmpeg_available() -> bool {
    ffmpeg::available().await
}

// ---- Publishing ------------------------------------------------------------

#[tauri::command]
pub fn publish_submit(app: AppHandle, queue: State<'_, PublishQueue>, request: PublishRequest) -> String {
    queue.submit(app, request)
}

#[tauri::command]
pub fn publish_cancel(queue: State<'_, PublishQueue>, job_id: String) -> bool {
    queue.cancel(&job_id)
}

// ---- AI --------------------------------------------------------------------

#[tauri::command]
pub async fn ai_generate(request: AiRequest) -> AppResult<AiSuggestion> {
    ai::generate(request).await
}
