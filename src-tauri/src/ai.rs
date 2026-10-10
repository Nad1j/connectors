//! Caption / title / hashtag generation. Calls the Claude Messages API with a
//! JSON-schema output format when an API key is available; otherwise returns
//! a deterministic offline suggestion so the UI stays usable.

use crate::{
    auth::token_store::TokenStore,
    error::{AppError, AppResult},
    platform::Platform,
};
use serde::{Deserialize, Serialize};
use serde_json::json;

const MODEL: &str = "claude-opus-5-5";
const API_URL: &str = "https://api.anthropic.com/v1/messages";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRequest {
    pub brief: String,
    pub platforms: Vec<Platform>,
    pub tone: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSuggestion {
    pub titles: Vec<String>,
    pub caption: String,
    pub hashtags: Vec<String>,
    pub source: String,
}

const SYSTEM: &str = "You write publishing copy for short and long-form video creators. \
Titles must be under 70 characters and front-load the hook. Captions should read naturally \
for every listed platform, end with one clear call to action, and avoid clickbait claims the \
video can't back up. Hashtags: 8-15, lowercase, no '#', mixing broad and niche tags.";

fn schema() -> serde_json::Value {
    json!({
        "type": "object",
        "properties": {
            "titles": { "type": "array", "items": { "type": "string" } },
            "caption": { "type": "string" },
            "hashtags": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["titles", "caption", "hashtags"],
        "additionalProperties": false
    })
}

fn api_key() -> Option<String> {
    std::env::var("ANTHROPIC_API_KEY")
        .ok()
        .filter(|k| !k.is_empty())
        .or_else(|| TokenStore::load_secret("anthropic_api_key"))
}

pub async fn generate(req: AiRequest) -> AppResult<AiSuggestion> {
    let Some(key) = api_key() else {
        return Ok(offline(&req));
    };
    let platforms: Vec<&str> = req.platforms.iter().map(|p| p.id()).collect();
    let prompt = format!(
        "Platforms: {}\nTone: {}\nVideo brief:\n{}\n\nGive 3 title options, one caption, and hashtags.",
        platforms.join(", "),
        req.tone.as_deref().unwrap_or("confident, conversational"),
        req.brief
    );

    let body = json!({
        "model": MODEL,
        "max_tokens": 4096,
        "system": SYSTEM,
        "output_config": { "effort": "low", "format": { "type": "json_schema", "schema": schema() } },
        "fallbacks": "default",
        "messages": [{ "role": "user", "content": prompt }]
    });

    let res = reqwest::Client::new()
        .post(API_URL)
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .header("anthropic-beta", "server-side-fallback-2026-07-01")
        .json(&body)
        .send()
        .await?;
    let status = res.status();
    let value: serde_json::Value = res.json().await?;
    if !status.is_success() {
        let msg = value["error"]["message"].as_str().unwrap_or("unknown error");
        return Err(AppError::Other(format!("Claude API {status}: {msg}")));
    }
    if value["stop_reason"] == "refusal" {
        return Err(AppError::Other("The model declined this brief. Rephrase it and try again.".into()));
    }
    let text = value["content"]
        .as_array()
        .and_then(|blocks| blocks.iter().find(|b| b["type"] == "text"))
        .and_then(|b| b["text"].as_str())
        .ok_or_else(|| AppError::Other("Claude returned no text".into()))?;

    #[derive(Deserialize)]
    struct Raw {
        titles: Vec<String>,
        caption: String,
        hashtags: Vec<String>,
    }
    let raw: Raw = serde_json::from_str(text)?;
    Ok(AiSuggestion {
        titles: raw.titles,
        caption: raw.caption,
        hashtags: raw.hashtags.into_iter().map(|h| h.trim_start_matches('#').to_lowercase()).collect(),
        source: MODEL.into(),
    })
}

fn offline(req: &AiRequest) -> AiSuggestion {
    let words: Vec<String> = req
        .brief
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.len() > 3)
        .map(|w| w.to_lowercase())
        .collect();
    let topic = words.first().cloned().unwrap_or_else(|| "this".into());
    let mut tags: Vec<String> = words.iter().take(6).cloned().collect();
    tags.extend(["creator", "fyp", "howto", "behindthescenes"].map(String::from));
    tags.dedup();
    AiSuggestion {
        titles: vec![
            format!("I tried {topic} for 30 days — here's what changed"),
            format!("The {topic} mistake almost everyone makes"),
            format!("{} in 60 seconds", capitalize(&topic)),
        ],
        caption: format!(
            "{}\n\nSave this for later and tell me in the comments what you'd try first.",
            req.brief.trim()
        ),
        hashtags: tags,
        source: "offline".into(),
    }
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    c.next().map(|f| f.to_uppercase().collect::<String>() + c.as_str()).unwrap_or_default()
}
