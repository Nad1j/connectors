pub mod queue;
pub mod uploader;

use crate::{media::plan::FitStrategy, platform::Platform};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformTarget {
    pub platform: Platform,
    pub short_form: bool,
    pub strategy: FitStrategy,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishRequest {
    pub video_path: String,
    pub targets: Vec<PlatformTarget>,
    pub title: String,
    pub caption: String,
    pub hashtags: Vec<String>,
    /// RFC 3339; `None` publishes now.
    pub schedule_at: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Stage {
    Queued,
    Processing,
    Uploading,
    Finalizing,
    Published,
    Scheduled,
    Failed,
    Cancelled,
}

/// Emitted on the `publish://progress` channel for every state change.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub job_id: String,
    pub platform: Platform,
    pub stage: Stage,
    /// Overall progress for this platform in [0, 1].
    pub progress: f64,
    pub message: String,
    pub post_url: Option<String>,
}

pub const PROGRESS_EVENT: &str = "publish://progress";
