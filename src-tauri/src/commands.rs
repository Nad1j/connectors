use crate::{
    ai::{self, AiRequest, AiSuggestion},
    auth::{oauth, providers, token_store::TokenStore, ConnectionStatus},
    error::{AppError, AppResult},
    media::{ffmpeg, plan::{ExportQuality, FitStrategy, FormatPlan}},
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
                configured: providers::for_platform(p).is_some_and(|c| c.is_configured()),
                account_id: tokens.and_then(|t| t.account_id),
            }
        })
        .collect()
}

#[tauri::command]
pub fn settings_save_secret(name: String, value: String) -> AppResult<()> {
    TokenStore::save_secret(&name, &value)
}

/// What Settings shows per platform: where each credential comes from.
/// Values are never sent to the webview.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformKeysStatus {
    platform: Platform,
    client_id_source: Option<providers::KeySource>,
    client_secret_source: Option<providers::KeySource>,
}

#[tauri::command]
pub fn settings_platform_keys() -> Vec<PlatformKeysStatus> {
    ALL.iter()
        .filter_map(|&p| providers::for_platform(p))
        .map(|c| PlatformKeysStatus {
            platform: c.platform,
            client_id_source: c.client_id_with_source().map(|(_, s)| s),
            client_secret_source: c.client_secret_with_source().map(|(_, s)| s),
        })
        .collect()
}

/// Stores a platform's OAuth client ID and/or secret in the keychain. Empty
/// or missing values leave the stored one untouched.
#[tauri::command]
pub fn settings_save_platform_keys(
    platform: Platform,
    client_id: Option<String>,
    client_secret: Option<String>,
) -> AppResult<()> {
    let cfg = providers::for_platform(platform)
        .ok_or_else(|| AppError::Other(format!("{} sign-in isn't available yet", platform.name())))?;
    for (slot, value) in [(cfg.client_id_slot(), client_id), (cfg.client_secret_slot(), client_secret)] {
        if let Some(v) = value.map(|v| v.trim().to_string()).filter(|v| !v.is_empty()) {
            TokenStore::save_secret(&slot, &v)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn settings_clear_platform_keys(platform: Platform) -> AppResult<()> {
    let cfg = providers::for_platform(platform)
        .ok_or_else(|| AppError::Other(format!("{} sign-in isn't available yet", platform.name())))?;
    TokenStore::delete_secret(&cfg.client_id_slot())?;
    TokenStore::delete_secret(&cfg.client_secret_slot())
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
    quality: Option<ExportQuality>,
) -> AppResult<FormatPlan> {
    let info = ffmpeg::probe(&path).await?;
    let target = FormatTarget::for_platform(platform, short_form);
    Ok(ffmpeg::plan_for(&info, "<output>.mp4", target, strategy, quality.unwrap_or_default()))
}

#[tauri::command]
pub async fn media_ffmpeg_info() -> ffmpeg::FfmpegInfo {
    ffmpeg::info().await
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
