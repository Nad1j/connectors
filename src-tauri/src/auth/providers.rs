use super::pkce::ChallengeEncoding;
use crate::platform::Platform;

/// Static description of a platform's OAuth endpoints. Client credentials are
/// read from the environment at runtime so nothing secret is compiled in.
pub struct ProviderConfig {
    pub platform: Platform,
    pub auth_url: &'static str,
    pub token_url: &'static str,
    pub scopes: &'static [&'static str],
    pub scope_separator: &'static str,
    /// Query/body key for the client identifier ("client_id" vs TikTok's "client_key").
    pub client_id_param: &'static str,
    pub client_id_env: &'static str,
    pub client_secret_env: Option<&'static str>,
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
    client_secret_env: Some("YOUTUBE_CLIENT_SECRET"),
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
    client_secret_env: Some("TIKTOK_CLIENT_SECRET"),
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

impl ProviderConfig {
    pub fn client_id(&self) -> Option<String> {
        std::env::var(self.client_id_env).ok().filter(|v| !v.is_empty())
    }

    pub fn client_secret(&self) -> Option<String> {
        self.client_secret_env
            .and_then(|k| std::env::var(k).ok())
            .filter(|v| !v.is_empty())
    }
}
