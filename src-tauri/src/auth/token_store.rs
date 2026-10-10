use super::TokenSet;
use crate::{error::AppResult, platform::Platform};
use keyring::Entry;

const SERVICE: &str = "app.connectors.desktop";

/// Tokens live in the OS credential store (macOS Keychain, Windows Credential
/// Manager, Secret Service on Linux) — never on disk or in webview storage.
pub struct TokenStore;

impl TokenStore {
    fn entry(p: Platform) -> AppResult<Entry> {
        Ok(Entry::new(SERVICE, &format!("oauth:{}", p.id()))?)
    }

    pub fn save(p: Platform, tokens: &TokenSet) -> AppResult<()> {
        Self::entry(p)?.set_password(&serde_json::to_string(tokens)?)?;
        Ok(())
    }

    pub fn load(p: Platform) -> AppResult<Option<TokenSet>> {
        match Self::entry(p)?.get_password() {
            Ok(raw) => Ok(Some(serde_json::from_str(&raw)?)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn delete(p: Platform) -> AppResult<()> {
        match Self::entry(p)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.into()),
        }
    }

    /// Generic secret slot (e.g. the user's LLM API key from Settings).
    pub fn save_secret(name: &str, value: &str) -> AppResult<()> {
        Entry::new(SERVICE, &format!("secret:{name}"))?.set_password(value)?;
        Ok(())
    }

    pub fn load_secret(name: &str) -> Option<String> {
        Entry::new(SERVICE, &format!("secret:{name}"))
            .ok()?
            .get_password()
            .ok()
    }
}
