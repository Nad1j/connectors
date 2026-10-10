use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0} is not configured: set {1} in .env")]
    NotConfigured(&'static str, &'static str),
    #[error("OAuth error: {0}")]
    OAuth(String),
    #[error("Keychain error: {0}")]
    Keychain(#[from] keyring::Error),
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("FFmpeg error: {0}")]
    Ffmpeg(String),
    #[error("{0}")]
    Other(String),
}

// Commands return errors to the webview as plain strings.
impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
