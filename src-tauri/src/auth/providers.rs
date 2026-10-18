use super::{pkce::ChallengeEncoding, token_store::TokenStore};
use crate::platform::Platform;
use serde::Serialize;

/// Static description of a platform's OAuth endpoints.
///
/// Client credentials resolve in this order: environment variable (dev
/// `.env`), then the keychain (Settings → Platform keys), then — for the
/// client ID only — a value embedded at build time from CI secrets. Client
/// secrets are never compiled in.
pub struct ProviderConfig {
    pub platform: Platform,
    pub auth_url: &'static str,
    pub token_url: &'static str,
    pub scopes: &'static [&'static str],
    pub scope_separator: &'static str,
    /// Query/body key for the client identifier ("client_id" vs TikTok's "client_key").
    pub client_id_param: &'static str,
    pub client_id_env: &'static str,
    pub client_secret_env: &'static str,
    /// Client ID embedded at build time (`option_env!`), if CI provided one.
    pub client_id_builtin: Option<&'static str>,
    pub challenge: ChallengeEncoding,
    pub extra_auth_params: &'static [(&'static str, &'static str)],
}

pub const YOUTUBE: ProviderConfig = ProviderConfig {
    platform: Platform::Youtube,
    auth_url: "https://accounts.google.com/o/oauth2/v2/auth",
    token_url: "https://oauth2.googleapis.com/token",
    scopes: &[
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/youtube.force-ssl",
    ],
    scope_separator: " ",
    client_id_param: "client_id",
    client_id_env: "YOUTUBE_CLIENT_ID",
    // Google "Desktop app" clients issue a secret that is not confidential;
    // it is still required by the token endpoint.
    client_secret_env: "YOUTUBE_CLIENT_SECRET",
    client_id_builtin: option_env!("YOUTUBE_CLIENT_ID"),
    challenge: ChallengeEncoding::Base64Url,
    // offline + consent guarantees a refresh_token on every connect.
    extra_auth_params: &[("access_type", "offline"), ("prompt", "consent")],
};

pub const TIKTOK: ProviderConfig = ProviderConfig {
    platform: Platform::Tiktok,
    auth_url: "https://www.tiktok.com/v2/auth/authorize/",
    token_url: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: &["user.info.basic", "user.info.stats", "video.upload", "video.publish", "video.list"],
    scope_separator: ",",
    client_id_param: "client_key",
    client_id_env: "TIKTOK_CLIENT_KEY",
    client_secret_env: "TIKTOK_CLIENT_SECRET",
    client_id_builtin: option_env!("TIKTOK_CLIENT_KEY"),
    challenge: ChallengeEncoding::Hex,
    extra_auth_params: &[],
};

pub fn for_platform(p: Platform) -> Option<&'static ProviderConfig> {
    match p {
        Platform::Youtube => Some(&YOUTUBE),
        Platform::Tiktok => Some(&TIKTOK),
        // Meta Graph API and X API v2 follow the same flow; add configs here.
        _ => None,
    }
}

/// Where a credential came from; shown in Settings (values never are).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum KeySource {
    Env,
    Settings,
    Builtin,
}

fn non_empty(v: Option<String>) -> Option<String> {
    v.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

impl ProviderConfig {
    /// Keychain slot names used by Settings and the key import.
    pub fn client_id_slot(&self) -> String {
        format!("{}_client_id", self.platform.id())
    }

    pub fn client_secret_slot(&self) -> String {
        format!("{}_client_secret", self.platform.id())
    }

    pub fn client_id_with_source(&self) -> Option<(String, KeySource)> {
        non_empty(std::env::var(self.client_id_env).ok())
            .map(|v| (v, KeySource::Env))
            .or_else(|| non_empty(TokenStore::load_secret(&self.client_id_slot())).map(|v| (v, KeySource::Settings)))
            .or_else(|| non_empty(self.client_id_builtin.map(String::from)).map(|v| (v, KeySource::Builtin)))
    }

    pub fn client_secret_with_source(&self) -> Option<(String, KeySource)> {
        non_empty(std::env::var(self.client_secret_env).ok())
            .map(|v| (v, KeySource::Env))
            .or_else(|| non_empty(TokenStore::load_secret(&self.client_secret_slot())).map(|v| (v, KeySource::Settings)))
    }

    pub fn client_id(&self) -> Option<String> {
        self.client_id_with_source().map(|(v, _)| v)
    }

    pub fn client_secret(&self) -> Option<String> {
        self.client_secret_with_source().map(|(v, _)| v)
    }

    /// Both values the token endpoint needs are available.
    pub fn is_configured(&self) -> bool {
        self.client_id().is_some() && self.client_secret().is_some()
    }
}
