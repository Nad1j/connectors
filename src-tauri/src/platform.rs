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
}

/// Output format a platform expects for a given post type.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct FormatTarget {
    pub width: u32,
    pub height: u32,
    pub max_duration_s: u32,
}

impl FormatTarget {
    pub fn for_platform(p: Platform, short_form: bool) -> Self {
        match (p, short_form) {
            (Platform::Youtube, false) => Self { width: 1920, height: 1080, max_duration_s: 43_200 },
            (Platform::Youtube, true) => Self { width: 1080, height: 1920, max_duration_s: 180 },
            (Platform::Tiktok, _) => Self { width: 1080, height: 1920, max_duration_s: 600 },
            (Platform::Instagram, _) => Self { width: 1080, height: 1920, max_duration_s: 900 },
            (Platform::Facebook, true) => Self { width: 1080, height: 1920, max_duration_s: 90 },
            (Platform::Facebook, false) => Self { width: 1920, height: 1080, max_duration_s: 14_400 },
            (Platform::X, _) => Self { width: 1280, height: 720, max_duration_s: 140 },
        }
    }
}
