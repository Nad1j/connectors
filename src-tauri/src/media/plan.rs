//! Pure functions that decide *how* to adapt a video to a target frame and
//! build the FFmpeg argument list. Kept free of I/O so it can be unit tested.

use crate::platform::FormatTarget;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FitStrategy {
    /// Pick per video: crop when aspect ratios are close, blur-pad otherwise.
    Auto,
    /// Center crop to fill the frame (loses edges).
    Crop,
    /// Fit inside the frame over a blurred, zoomed copy of itself.
    BlurPad,
    /// Fit inside the frame with black bars.
    Letterbox,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ResolvedStrategy {
    Passthrough,
    Scale,
    Crop,
    BlurPad,
    Letterbox,
}

/// User-facing export quality; scales the per-resolution bitrates.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportQuality {
    Low,
    #[default]
    Medium,
    High,
}

impl ExportQuality {
    fn factor(self) -> f64 {
        match self {
            ExportQuality::Low => 0.6,
            ExportQuality::Medium => 1.0,
            ExportQuality::High => 1.5,
        }
    }
}

/// Encoders the plans rely on. The bundled LGPL FFmpeg build has both; the
/// Settings check fails if a custom FFmpeg lacks either.
pub const VIDEO_ENCODER: &str = "libopenh264";
pub const AUDIO_ENCODER: &str = "aac";

/// What the planner needs to know about the source file.
pub struct Source<'a> {
    pub path: &'a str,
    pub width: u32,
    pub height: u32,
    pub duration_s: f64,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatPlan {
    pub strategy: ResolvedStrategy,
    pub target: FormatTarget,
    /// Crop rectangle in source pixels (x, y, w, h) when cropping.
    pub crop: Option<[u32; 4]>,
    pub trim_to_s: Option<f64>,
    /// H.264 bitrate when re-encoding; `None` for a stream copy.
    pub video_kbps: Option<u32>,
    pub estimated_bytes: u64,
    /// False when the clip is so long that staying under the platform's file
    /// size limit would need a bitrate below the acceptable floor.
    pub fits: bool,
    pub args: Vec<String>,
}

/// Leave headroom for container overhead and rate-control overshoot.
const SIZE_HEADROOM: f64 = 0.92;

/// Medium-quality H.264 bitrate for a frame, following YouTube's SDR upload
/// recommendations (8 Mb/s at 1080p, 5 Mb/s at 720p, 30 fps).
pub fn base_video_kbps(target: FormatTarget) -> u32 {
    match target.short_side() {
        s if s >= 1080 => 8_000,
        s if s >= 720 => 5_000,
        _ => 2_500,
    }
}

/// Lowest bitrate we accept before refusing the export as too long.
fn floor_video_kbps(target: FormatTarget) -> u32 {
    base_video_kbps(target) / 4
}

/// Picks the video bitrate: the quality-scaled base, capped so the file stays
/// under the platform's size limit. Returns (kbps, fits).
pub fn choose_video_kbps(target: FormatTarget, duration_s: f64, quality: ExportQuality) -> (u32, bool) {
    let desired = (base_video_kbps(target) as f64 * quality.factor()).round() as u32;
    let budget_total = target.max_bytes as f64 * SIZE_HEADROOM * 8.0 / 1000.0 / duration_s.max(1.0);
    let budget_video = (budget_total - target.audio_kbps as f64).max(0.0) as u32;
    let kbps = desired.min(budget_video);
    (kbps, kbps >= floor_video_kbps(target))
}

fn estimate_bytes(video_kbps: u32, audio_kbps: u32, duration_s: f64) -> u64 {
    ((video_kbps + audio_kbps) as f64 * 1000.0 / 8.0 * duration_s) as u64
}

/// Aspect ratios within this relative distance are cropped rather than padded.
const CROP_TOLERANCE: f64 = 0.20;

pub fn resolve(src_w: u32, src_h: u32, target: FormatTarget, strategy: FitStrategy) -> ResolvedStrategy {
    let src_ar = src_w as f64 / src_h as f64;
    let dst_ar = target.width as f64 / target.height as f64;
    let same_ar = (src_ar - dst_ar).abs() / dst_ar < 0.01;

    if same_ar {
        return if src_w == target.width && src_h == target.height {
            ResolvedStrategy::Passthrough
        } else {
            ResolvedStrategy::Scale
        };
    }
    match strategy {
        FitStrategy::Crop => ResolvedStrategy::Crop,
        FitStrategy::BlurPad => ResolvedStrategy::BlurPad,
        FitStrategy::Letterbox => ResolvedStrategy::Letterbox,
        FitStrategy::Auto if (src_ar - dst_ar).abs() / dst_ar <= CROP_TOLERANCE => ResolvedStrategy::Crop,
        FitStrategy::Auto => ResolvedStrategy::BlurPad,
    }
}

/// Largest centered rectangle of the target aspect ratio inside the source.
/// Dimensions are rounded down to even numbers (required by yuv420p).
pub fn center_crop(src_w: u32, src_h: u32, target: FormatTarget) -> [u32; 4] {
    let dst_ar = target.width as f64 / target.height as f64;
    let (w, h) = if (src_w as f64 / src_h as f64) > dst_ar {
        ((src_h as f64 * dst_ar) as u32, src_h)
    } else {
        (src_w, (src_w as f64 / dst_ar) as u32)
    };
    let (w, h) = (w & !1, h & !1);
    [(src_w - w) / 2, (src_h - h) / 2, w, h]
}

pub fn build(src: &Source, output: &str, target: FormatTarget, strategy: FitStrategy, quality: ExportQuality) -> FormatPlan {
    let (src_w, src_h) = (src.width, src.height);
    let mut resolved = resolve(src_w, src_h, target, strategy);
    let (tw, th) = (target.width, target.height);
    let trim_to_s = (src.duration_s > target.max_duration_s as f64).then_some(target.max_duration_s as f64);
    let out_duration = trim_to_s.unwrap_or(src.duration_s);

    // A stream copy keeps the source size; re-encode when that is over the limit.
    if resolved == ResolvedStrategy::Passthrough && src.size_bytes as f64 > target.max_bytes as f64 * SIZE_HEADROOM {
        resolved = ResolvedStrategy::Scale;
    }

    let mut args: Vec<String> = vec!["-hide_banner".into(), "-y".into(), "-i".into(), src.path.into()];
    let mut crop = None;

    match resolved {
        ResolvedStrategy::Passthrough => {}
        ResolvedStrategy::Scale => {
            args.extend(["-vf".into(), format!("scale={tw}:{th}:flags=lanczos,setsar=1")]);
        }
        ResolvedStrategy::Crop => {
            let [x, y, w, h] = center_crop(src_w, src_h, target);
            crop = Some([x, y, w, h]);
            args.extend(["-vf".into(), format!("crop={w}:{h}:{x}:{y},scale={tw}:{th}:flags=lanczos,setsar=1")]);
        }
        ResolvedStrategy::Letterbox => {
            args.extend([
                "-vf".into(),
                format!("scale={tw}:{th}:force_original_aspect_ratio=decrease,pad={tw}:{th}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"),
            ]);
        }
        ResolvedStrategy::BlurPad => {
            args.extend([
                "-filter_complex".into(),
                format!(
                    "[0:v]split=2[bg][fg];\
                     [bg]scale={tw}:{th}:force_original_aspect_ratio=increase,crop={tw}:{th},boxblur=24:4,eq=brightness=-0.08[bgb];\
                     [fg]scale={tw}:{th}:force_original_aspect_ratio=decrease[fgs];\
                     [bgb][fgs]overlay=(W-w)/2:(H-h)/2,setsar=1[v]"
                ),
                "-map".into(),
                "[v]".into(),
                "-map".into(),
                "0:a?".into(),
            ]);
        }
    }

    if let Some(t) = trim_to_s {
        args.extend(["-t".into(), format!("{t}")]);
    }

    let (video_kbps, estimated_bytes, fits) = if resolved == ResolvedStrategy::Passthrough && trim_to_s.is_none() {
        args.extend(["-c".into(), "copy".into()]);
        (None, src.size_bytes, true)
    } else {
        let (kbps, fits) = choose_video_kbps(target, out_duration, quality);
        // openh264 has no CRF mode; "bitrate" rate control tracks the target
        // closely without dropping frames. 2 s GOP at 30 fps.
        args.extend([
            "-c:v".into(), VIDEO_ENCODER.into(), "-profile:v".into(), "high".into(),
            "-rc_mode".into(), "bitrate".into(), "-b:v".into(), format!("{kbps}k"),
            "-maxrate".into(), format!("{}k", kbps * 3 / 2), "-g".into(), "60".into(),
            "-pix_fmt".into(), "yuv420p".into(),
            "-c:a".into(), AUDIO_ENCODER.into(), "-b:a".into(), format!("{}k", target.audio_kbps),
            "-ar".into(), "48000".into(),
        ]);
        (Some(kbps), estimate_bytes(kbps, target.audio_kbps, out_duration), fits)
    };
    args.extend(["-movflags", "+faststart", "-progress", "pipe:1", "-nostats"].map(String::from));
    args.push(output.into());

    FormatPlan { strategy: resolved, target, crop, trim_to_s, video_kbps, estimated_bytes, fits, args }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::platform::Platform;

    const VERTICAL: FormatTarget = FormatTarget::new(1080, 1920, 60, 4_000_000_000, 160);
    const LANDSCAPE: FormatTarget = FormatTarget::new(1920, 1080, 43_200, 256_000_000_000, 192);

    fn src(w: u32, h: u32, duration_s: f64, size_bytes: u64) -> Source<'static> {
        Source { path: "in.mp4", width: w, height: h, duration_s, size_bytes }
    }

    #[test]
    fn landscape_to_vertical_auto_blur_pads() {
        assert_eq!(resolve(1920, 1080, VERTICAL, FitStrategy::Auto), ResolvedStrategy::BlurPad);
    }

    #[test]
    fn near_aspect_auto_crops() {
        // 3:5 is ~7% away from 9:16, inside the crop tolerance.
        assert_eq!(resolve(1080, 1800, VERTICAL, FitStrategy::Auto), ResolvedStrategy::Crop);
    }

    #[test]
    fn identical_is_passthrough() {
        assert_eq!(resolve(1920, 1080, LANDSCAPE, FitStrategy::Crop), ResolvedStrategy::Passthrough);
        assert_eq!(resolve(3840, 2160, LANDSCAPE, FitStrategy::Crop), ResolvedStrategy::Scale);
    }

    #[test]
    fn center_crop_landscape_to_vertical() {
        assert_eq!(center_crop(1920, 1080, VERTICAL), [657, 0, 606, 1080]);
    }

    #[test]
    fn long_video_is_trimmed_for_shorts() {
        let p = build(&src(1080, 1920, 95.0, 50_000_000), "out.mp4", VERTICAL, FitStrategy::Auto, ExportQuality::Medium);
        assert_eq!(p.trim_to_s, Some(60.0));
        assert!(p.args.windows(2).any(|w| w[0] == "-t" && w[1] == "60"));
        assert!(p.args.windows(2).any(|w| w[0] == "-c:v" && w[1] == "libopenh264"));
        assert!(p.args.windows(2).any(|w| w[0] == "-c:a" && w[1] == "aac"));
    }

    #[test]
    fn bitrate_follows_resolution_and_quality() {
        let x = FormatTarget::for_platform(Platform::X, false);
        assert_eq!(choose_video_kbps(LANDSCAPE, 60.0, ExportQuality::Medium), (8_000, true));
        assert_eq!(choose_video_kbps(x, 60.0, ExportQuality::Medium), (5_000, true));
        assert_eq!(choose_video_kbps(LANDSCAPE, 60.0, ExportQuality::Low), (4_800, true));
        assert_eq!(choose_video_kbps(LANDSCAPE, 60.0, ExportQuality::High), (12_000, true));
    }

    #[test]
    fn every_platform_stays_under_its_size_limit_at_max_duration() {
        for p in [Platform::Youtube, Platform::Tiktok, Platform::Instagram, Platform::Facebook, Platform::X] {
            for short in [true, false] {
                let t = FormatTarget::for_platform(p, short);
                let plan = build(
                    &src(3840, 2160, t.max_duration_s as f64 + 30.0, 1),
                    "out.mp4",
                    t,
                    FitStrategy::Auto,
                    ExportQuality::High,
                );
                assert!(plan.estimated_bytes <= t.max_bytes, "{p:?} short={short} would exceed the size limit");
            }
        }
    }

    #[test]
    fn long_instagram_reel_is_capped_under_300_mb() {
        let t = FormatTarget::for_platform(Platform::Instagram, true);
        let plan = build(&src(1080, 1920, 900.0, 2_000_000_000), "out.mp4", t, FitStrategy::Auto, ExportQuality::Medium);
        assert!(plan.video_kbps.unwrap() < 8_000);
        assert!(plan.estimated_bytes < 300_000_000);
        assert!(plan.fits);
    }

    #[test]
    fn four_hour_facebook_video_does_not_fit() {
        let t = FormatTarget::for_platform(Platform::Facebook, false);
        let plan = build(&src(1920, 1080, 14_400.0, 1), "out.mp4", t, FitStrategy::Auto, ExportQuality::Medium);
        assert!(!plan.fits);
    }

    #[test]
    fn oversized_passthrough_is_re_encoded() {
        let t = FormatTarget::for_platform(Platform::Instagram, true);
        let small = build(&src(1080, 1920, 30.0, 20_000_000), "out.mp4", t, FitStrategy::Auto, ExportQuality::Medium);
        assert_eq!(small.strategy, ResolvedStrategy::Passthrough);
        assert!(small.args.contains(&"copy".to_string()));
        let big = build(&src(1080, 1920, 30.0, 400_000_000), "out.mp4", t, FitStrategy::Auto, ExportQuality::Medium);
        assert_eq!(big.strategy, ResolvedStrategy::Scale);
        assert_eq!(big.video_kbps, Some(8_000));
    }
}
