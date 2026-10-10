use crate::{error::AppResult, platform::Platform};
use async_trait::async_trait;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

// Fields are read by the real uploaders; the mock ignores them.
#[allow(dead_code)]
pub struct UploadInput<'a> {
    pub file_path: &'a str,
    pub title: &'a str,
    pub caption: &'a str,
    pub hashtags: &'a [String],
}

/// One implementation per platform API. Real uploaders use resumable /
/// chunked endpoints (YouTube resumable upload, TikTok FILE_UPLOAD, Meta
/// Reels upload sessions, X chunked media upload) and report bytes sent.
#[async_trait]
pub trait Uploader: Send + Sync {
    async fn upload(
        &self,
        input: UploadInput<'_>,
        cancelled: Arc<AtomicBool>,
        on_progress: &(dyn Fn(f64) + Send + Sync),
    ) -> AppResult<String>;
}

/// Simulates a chunked upload with per-platform throughput so the UI shows
/// realistic, staggered progress without touching live APIs.
pub struct MockUploader {
    pub platform: Platform,
}

#[async_trait]
impl Uploader for MockUploader {
    async fn upload(
        &self,
        _input: UploadInput<'_>,
        cancelled: Arc<AtomicBool>,
        on_progress: &(dyn Fn(f64) + Send + Sync),
    ) -> AppResult<String> {
        let (chunks, tick_ms) = match self.platform {
            Platform::Youtube => (40, 110),
            Platform::Tiktok => (24, 90),
            Platform::Instagram => (30, 100),
            Platform::Facebook => (32, 120),
            Platform::X => (16, 140),
        };
        for i in 1..=chunks {
            if cancelled.load(Ordering::Relaxed) {
                return Err(crate::error::AppError::Other("Cancelled".into()));
            }
            tokio::time::sleep(Duration::from_millis(tick_ms)).await;
            on_progress(i as f64 / chunks as f64);
        }
        let id = uuid::Uuid::new_v4().simple().to_string();
        Ok(match self.platform {
            Platform::Youtube => format!("https://youtube.com/watch?v={}", &id[..11]),
            Platform::Tiktok => format!("https://www.tiktok.com/@me/video/{}", &id[..19]),
            Platform::Instagram => format!("https://www.instagram.com/reel/{}", &id[..11]),
            Platform::Facebook => format!("https://www.facebook.com/reel/{}", &id[..15]),
            Platform::X => format!("https://x.com/i/status/{}", &id[..19]),
        })
    }
}

pub fn for_platform(platform: Platform) -> Box<dyn Uploader> {
    Box::new(MockUploader { platform })
}
