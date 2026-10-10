use super::{pkce, providers::ProviderConfig, token_store::TokenStore, TokenSet};
use crate::error::{AppError, AppResult};
use serde::Deserialize;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use url::Url;

const CALLBACK_PATH: &str = "/oauth/callback";
const LOGIN_TIMEOUT: Duration = Duration::from_secs(300);

const SUCCESS_PAGE: &str = "<!doctype html><meta charset=utf-8><title>Connected</title>\
<body style=\"font-family:system-ui;background:#0A1020;color:#E6EBFF;display:grid;place-items:center;height:100vh\">\
<p>Account connected. You can close this tab and return to Connectors.</p>";

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
    scope: Option<String>,
    open_id: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

impl TokenResponse {
    fn into_token_set(self, previous_refresh: Option<String>) -> AppResult<TokenSet> {
        if let Some(err) = self.error {
            return Err(AppError::OAuth(format!(
                "{err}: {}",
                self.error_description.unwrap_or_default()
            )));
        }
        Ok(TokenSet {
            access_token: self.access_token,
            // Google omits refresh_token on refresh responses; keep the old one.
            refresh_token: self.refresh_token.or(previous_refresh),
            expires_at: self.expires_in.map(|s| chrono::Utc::now().timestamp() + s),
            scope: self.scope,
            account_id: self.open_id,
        })
    }
}

pub fn build_authorize_url(
    cfg: &ProviderConfig,
    client_id: &str,
    redirect_uri: &str,
    state: &str,
    challenge: &str,
) -> AppResult<Url> {
    let mut url = Url::parse(cfg.auth_url).map_err(|e| AppError::OAuth(e.to_string()))?;
    {
        let mut q = url.query_pairs_mut();
        q.append_pair(cfg.client_id_param, client_id)
            .append_pair("response_type", "code")
            .append_pair("redirect_uri", redirect_uri)
            .append_pair("scope", &cfg.scopes.join(cfg.scope_separator))
            .append_pair("state", state)
            .append_pair("code_challenge", challenge)
            .append_pair("code_challenge_method", "S256");
        for (k, v) in cfg.extra_auth_params {
            q.append_pair(k, v);
        }
    }
    Ok(url)
}

/// Full interactive login: bind a loopback port, open the system browser,
/// wait for the redirect, exchange the code, persist tokens to the keychain.
pub async fn authorize<F>(cfg: &ProviderConfig, open_browser: F) -> AppResult<TokenSet>
where
    F: FnOnce(&str) -> AppResult<()>,
{
    let client_id = cfg
        .client_id()
        .ok_or(AppError::NotConfigured(cfg.platform.id(), cfg.client_id_env))?;

    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}{CALLBACK_PATH}");

    let pkce = pkce::generate(cfg.challenge);
    let state = pkce::random_string(32);
    let url = build_authorize_url(cfg, &client_id, &redirect_uri, &state, &pkce.challenge)?;
    open_browser(url.as_str())?;

    let code = tokio::time::timeout(LOGIN_TIMEOUT, wait_for_code(&listener, &state))
        .await
        .map_err(|_| AppError::OAuth("Sign-in timed out after 5 minutes".into()))??;

    let tokens = exchange_code(cfg, &client_id, &code, &redirect_uri, &pkce.verifier).await?;
    TokenStore::save(cfg.platform, &tokens)?;
    Ok(tokens)
}

async fn wait_for_code(listener: &TcpListener, expected_state: &str) -> AppResult<String> {
    loop {
        let (mut stream, _) = listener.accept().await?;
        let mut buf = vec![0u8; 8192];
        let n = stream.read(&mut buf).await?;
        let request = String::from_utf8_lossy(&buf[..n]);
        let Some(target) = request.lines().next().and_then(|l| l.split_whitespace().nth(1)) else {
            continue;
        };
        // Browsers also probe /favicon.ico — ignore anything but the callback.
        if !target.starts_with(CALLBACK_PATH) {
            let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n").await;
            continue;
        }
        let url = Url::parse(&format!("http://127.0.0.1{target}"))
            .map_err(|e| AppError::OAuth(e.to_string()))?;
        let param = |k: &str| url.query_pairs().find(|(key, _)| key == k).map(|(_, v)| v.into_owned());

        let body = SUCCESS_PAGE;
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        let _ = stream.write_all(response.as_bytes()).await;

        if let Some(err) = param("error") {
            return Err(AppError::OAuth(format!(
                "{err}: {}",
                param("error_description").unwrap_or_default()
            )));
        }
        if param("state").as_deref() != Some(expected_state) {
            return Err(AppError::OAuth("State mismatch — possible CSRF, sign-in aborted".into()));
        }
        return param("code").ok_or_else(|| AppError::OAuth("Redirect had no code".into()));
    }
}

async fn exchange_code(
    cfg: &ProviderConfig,
    client_id: &str,
    code: &str,
    redirect_uri: &str,
    verifier: &str,
) -> AppResult<TokenSet> {
    let secret = cfg.client_secret();
    let mut form = vec![
        (cfg.client_id_param, client_id),
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", redirect_uri),
        ("code_verifier", verifier),
    ];
    if let Some(s) = secret.as_deref() {
        form.push(("client_secret", s));
    }
    post_token(cfg, &form, None).await
}

pub async fn refresh(cfg: &ProviderConfig, current: &TokenSet) -> AppResult<TokenSet> {
    let client_id = cfg
        .client_id()
        .ok_or(AppError::NotConfigured(cfg.platform.id(), cfg.client_id_env))?;
    let refresh_token = current
        .refresh_token
        .clone()
        .ok_or_else(|| AppError::OAuth("No refresh token stored; reconnect the account".into()))?;
    let secret = cfg.client_secret();
    let mut form = vec![
        (cfg.client_id_param, client_id.as_str()),
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token.as_str()),
    ];
    if let Some(s) = secret.as_deref() {
        form.push(("client_secret", s));
    }
    let mut next = post_token(cfg, &form, Some(refresh_token.clone())).await?;
    next.account_id = next.account_id.or_else(|| current.account_id.clone());
    TokenStore::save(cfg.platform, &next)?;
    Ok(next)
}

async fn post_token(
    cfg: &ProviderConfig,
    form: &[(&str, &str)],
    previous_refresh: Option<String>,
) -> AppResult<TokenSet> {
    let res = reqwest::Client::new()
        .post(cfg.token_url)
        .header("Cache-Control", "no-cache")
        .form(form)
        .send()
        .await?;
    let status = res.status();
    let text = res.text().await?;
    if !status.is_success() {
        return Err(AppError::OAuth(format!("Token endpoint returned {status}: {text}")));
    }
    serde_json::from_str::<TokenResponse>(&text)?.into_token_set(previous_refresh)
}

/// Returns a non-expired access token, refreshing transparently when needed.
/// Called by the real platform uploaders before each upload.
#[allow(dead_code)]
pub async fn valid_token(cfg: &ProviderConfig) -> AppResult<TokenSet> {
    let current = TokenStore::load(cfg.platform)?
        .ok_or_else(|| AppError::OAuth(format!("{} is not connected", cfg.platform.id())))?;
    if current.is_expired() {
        refresh(cfg, &current).await
    } else {
        Ok(current)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::providers::{TIKTOK, YOUTUBE};

    #[test]
    fn youtube_url_has_pkce_and_offline_access() {
        let url = build_authorize_url(&YOUTUBE, "cid", "http://127.0.0.1:5000/oauth/callback", "st", "ch").unwrap();
        let q: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
        assert_eq!(q["client_id"], "cid");
        assert_eq!(q["code_challenge_method"], "S256");
        assert_eq!(q["access_type"], "offline");
        assert!(q["scope"].contains("youtube.upload"));
    }

    #[test]
    fn tiktok_url_uses_client_key_and_comma_scopes() {
        let url = build_authorize_url(&TIKTOK, "ck", "http://127.0.0.1:5000/oauth/callback", "st", "ch").unwrap();
        let q: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
        assert_eq!(q["client_key"], "ck");
        assert!(!q.contains_key("client_id"));
        assert!(q["scope"].contains("video.upload,video.publish"));
    }
}
