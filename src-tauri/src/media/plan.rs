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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatPlan {
    pub strategy: ResolvedStrategy,
    pub target: FormatTarget,
    /// Crop rectangle in source pixels (x, y, w, h) when cropping.
    pub crop: Option<[u32; 4]>,
    pub trim_to_s: Option<f64>,
    pub args: Vec<String>,
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

pub fn build(
    input: &str,
    output: &str,
    src_w: u32,
    src_h: u32,
    duration_s: f64,
    target: FormatTarget,
    strategy: FitStrategy,
) -> FormatPlan {
    let resolved = resolve(src_w, src_h, target, strategy);
    let (tw, th) = (target.width, target.height);
    let trim_to_s = (duration_s > target.max_duration_s as f64).then_some(target.max_duration_s as f64);

    let mut args: Vec<String> = vec!["-hide_banner".into(), "-y".into(), "-i".into(), input.into()];
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

    if resolved == ResolvedStrategy::Passthrough && trim_to_s.is_none() {
        args.extend(["-c".into(), "copy".into()]);
    } else {
        args.extend(
            [
                "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
            ]
            .map(String::from),
        );
    }
    args.extend(["-movflags", "+faststart", "-progress", "pipe:1", "-nostats"].map(String::from));
    args.push(output.into());

    FormatPlan { strategy: resolved, target, crop, trim_to_s, args }
}

#[cfg(test)]
mod tests {
    use super::*;

    const VERTICAL: FormatTarget = FormatTarget { width: 1080, height: 1920, max_duration_s: 60 };
    const LANDSCAPE: FormatTarget = FormatTarget { width: 1920, height: 1080, max_duration_s: 43_200 };

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
        let p = build("in.mp4", "out.mp4", 1080, 1920, 95.0, VERTICAL, FitStrategy::Auto);
        assert_eq!(p.trim_to_s, Some(60.0));
        assert!(p.args.windows(2).any(|w| w[0] == "-t" && w[1] == "60"));
        assert!(p.args.contains(&"libx264".to_string()));
    }
}
