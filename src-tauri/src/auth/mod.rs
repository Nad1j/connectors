//! OAuth 2.0 (Authorization Code + PKCE, RFC 7636) for installed apps using a
//! loopback redirect (RFC 8252 §7.3), plus OS-keychain token storage.

pub mod oauth;
pub mod pkce;
pub mod providers;
pub mod token_store;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenSet {
    pub access_token: String,
    pub refresh_token: Option<String>,
    /// Unix seconds.
    pub expires_at: Option<i64>,
    pub scope: Option<String>,
    /// Platform-side account id (TikTok `open_id`, YouTube channel id, ...).
    pub account_id: Option<String>,
}

impl TokenSet {
    /// Treat tokens as expired 60s early so in-flight uploads don't race the clock.
    pub fn is_expired(&self) -> bool {
        self.expires_at
            .map(|t| chrono::Utc::now().timestamp() >= t - 60)
            .unwrap_or(false)
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionStatus {
    pub platform: crate::platform::Platform,
    pub connected: bool,
    pub expired: bool,
    pub configured: bool,
    pub account_id: Option<String>,
}
