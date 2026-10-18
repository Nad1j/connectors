fn main() {
    // OAuth client IDs (not secrets) can be embedded from CI secrets via
    // option_env!; rebuild when they change.
    for key in ["YOUTUBE_CLIENT_ID", "TIKTOK_CLIENT_KEY"] {
        println!("cargo:rerun-if-env-changed={key}");
    }
    tauri_build::build()
}
