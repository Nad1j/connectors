mod ai;
mod auth;
mod commands;
mod error;
mod media;
mod platform;
mod publish;

use publish::queue::PublishQueue;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = dotenvy::dotenv();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(PublishQueue::default())
        .invoke_handler(tauri::generate_handler![
            commands::auth_connect,
            commands::auth_refresh,
            commands::auth_disconnect,
            commands::auth_status,
            commands::settings_save_secret,
            commands::media_probe,
            commands::media_plan,
            commands::media_ffmpeg_available,
            commands::publish_submit,
            commands::publish_cancel,
            commands::ai_generate,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Connectors");
}
