use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Youtube,
    Tiktok,
    Instagram,
    Facebook,
    X,
}

impl Platform {
    pub fn id(self) -> &'static str {
        match self {
            Platform::Youtube => "youtube",
            Platform::Tiktok => "tiktok",
            Platform::Instagram => "instagram",
            Platform::Facebook => "facebook",
            Platform::X => "x",
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Platform::Youtube => "YouTube",
            Platform::Tiktok => "TikTok",
            Platform::Instagram => "Instagram",
            Platform::Facebook => "Facebook",
            Platform::X => "X",
        }
    }
}

/// Output format a platform expects for a given post type.
///
/// Size and duration limits come from each platform's upload docs (checked
/// 2026-10): YouTube 256 GB / 12 h; TikTok Content Posting API 4 GB / 10 min;
/// Instagram Reels 300 MB / 15 min; Facebook Reels 90 s (no size published,
/// 1 GB assumed) and Page videos 1.75 GB via resumable upload; X posts 8 GB /
/// 20 min for default accounts.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatTarget {
    pub width: u32,
    pub height: u32,
    pub max_duration_s: u32,
    pub max_bytes: u64,
    /// AAC bitrate the platform recommends.
    pub audio_kbps: u32,
}

const MB: u64 = 1_000_000;
const GB: u64 = 1_000_000_000;

impl FormatTarget {
    pub const fn new(width: u32, height: u32, max_duration_s: u32, max_bytes: u64, audio_kbps: u32) -> Self {
        Self { width, height, max_duration_s, max_bytes, audio_kbps }
    }

    pub fn for_platform(p: Platform, short_form: bool) -> Self {
        match (p, short_form) {
            (Platform::Youtube, false) => Self::new(1920, 1080, 43_200, 256 * GB, 192),
            (Platform::Youtube, true) => Self::new(1080, 1920, 180, 256 * GB, 192),
            (Platform::Tiktok, _) => Self::new(1080, 1920, 600, 4 * GB, 160),
            (Platform::Instagram, _) => Self::new(1080, 1920, 900, 300 * MB, 128),
            (Platform::Facebook, true) => Self::new(1080, 1920, 90, GB, 128),
            (Platform::Facebook, false) => Self::new(1920, 1080, 14_400, 1_750 * MB, 160),
            (Platform::X, _) => Self::new(1280, 720, 1_200, 8 * GB, 128),
        }
    }

    /// Short side in pixels: 1080 for 1080p either orientation, 720 for 720p.
    pub fn short_side(&self) -> u32 {
        self.width.min(self.height)
    }
}
