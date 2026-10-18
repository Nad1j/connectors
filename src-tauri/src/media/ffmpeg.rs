use super::plan::{self, FitStrategy, FormatPlan};
use crate::{
    error::{AppError, AppResult},
    platform::FormatTarget,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoInfo {
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub duration_s: f64,
    pub fps: f64,
    pub codec: String,
    pub has_audio: bool,
    pub size_bytes: u64,
}

/// FFMPEG_PATH env > binary bundled next to the app > PATH.
fn binary(name: &str) -> PathBuf {
    let env_key = format!("{}_PATH", name.to_uppercase());
    if let Ok(p) = std::env::var(&env_key) {
        return PathBuf::from(p);
    }
    if let Some(dir) = std::env::current_exe().ok().and_then(|e| e.parent().map(PathBuf::from)) {
        let bundled = dir.join(if cfg!(windows) { format!("{name}.exe") } else { name.to_string() });
        if bundled.exists() {
            return bundled;
        }
    }
    PathBuf::from(name)
}

pub async fn available() -> bool {
    Command::new(binary("ffmpeg"))
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false)
}

#[derive(Deserialize)]
struct ProbeOutput {
    streams: Vec<ProbeStream>,
    format: ProbeFormat,
}

#[derive(Deserialize)]
struct ProbeStream {
    codec_type: String,
    codec_name: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    avg_frame_rate: Option<String>,
    #[serde(default)]
    side_data_list: Vec<serde_json::Value>,
    #[serde(default)]
    tags: std::collections::HashMap<String, String>,
}

#[derive(Deserialize)]
struct ProbeFormat {
    duration: Option<String>,
    size: Option<String>,
}

pub async fn probe(path: &str) -> AppResult<VideoInfo> {
    let out = Command::new(binary("ffprobe"))
        .args(["-v", "error", "-print_format", "json", "-show_streams", "-show_format", path])
        .output()
        .await
        .map_err(|e| AppError::Ffmpeg(format!("ffprobe not runnable: {e}")))?;
    if !out.status.success() {
        return Err(AppError::Ffmpeg(String::from_utf8_lossy(&out.stderr).trim().to_string()));
    }
    let parsed: ProbeOutput = serde_json::from_slice(&out.stdout)?;
    let video = parsed
        .streams
        .iter()
        .find(|s| s.codec_type == "video")
        .ok_or_else(|| AppError::Ffmpeg("No video stream found".into()))?;

    let (mut w, mut h) = (video.width.unwrap_or(0), video.height.unwrap_or(0));
    // Phones record portrait as landscape + a rotation flag; report display size.
    let rotation = video
        .side_data_list
        .iter()
        .find_map(|d| d.get("rotation").and_then(|r| r.as_f64()))
        .or_else(|| video.tags.get("rotate").and_then(|r| r.parse().ok()))
        .unwrap_or(0.0);
    if (rotation.abs() as i64) % 180 == 90 {
        std::mem::swap(&mut w, &mut h);
    }

    let fps = video
        .avg_frame_rate
        .as_deref()
        .and_then(|r| r.split_once('/'))
        .and_then(|(n, d)| Some(n.parse::<f64>().ok()? / d.parse::<f64>().ok().filter(|d| *d > 0.0)?))
        .unwrap_or(0.0);

    Ok(VideoInfo {
        path: path.to_string(),
        width: w,
        height: h,
        duration_s: parsed.format.duration.and_then(|d| d.parse().ok()).unwrap_or(0.0),
        fps,
        codec: video.codec_name.clone().unwrap_or_default(),
        has_audio: parsed.streams.iter().any(|s| s.codec_type == "audio"),
        size_bytes: parsed.format.size.and_then(|s| s.parse().ok()).unwrap_or(0),
    })
}

pub fn plan_for(info: &VideoInfo, output: &str, target: FormatTarget, strategy: FitStrategy) -> FormatPlan {
    plan::build(&info.path, output, info.width, info.height, info.duration_s, target, strategy)
}

/// Runs an FFmpeg plan, reporting progress in [0, 1] from `-progress pipe:1`.
pub async fn run<F>(plan: &FormatPlan, total_s: f64, mut on_progress: F) -> AppResult<()>
where
    F: FnMut(f64),
{
    let mut child = Command::new(binary("ffmpeg"))
        .args(&plan.args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| AppError::Ffmpeg(format!("ffmpeg not runnable: {e}")))?;

    let total_us = (plan.trim_to_s.unwrap_or(total_s).max(0.001)) * 1_000_000.0;
    let stdout = child.stdout.take().expect("stdout piped");
    let mut lines = BufReader::new(stdout).lines();
    while let Some(line) = lines.next_line().await? {
        // `out_time_ms` is (despite its name) microseconds, same as out_time_us.
        if let Some(v) = line.strip_prefix("out_time_us=").or_else(|| line.strip_prefix("out_time_ms=")) {
            if let Ok(us) = v.trim().parse::<f64>() {
                on_progress((us / total_us).clamp(0.0, 1.0));
            }
        }
    }

    let output = child.wait_with_output().await?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let tail: Vec<&str> = stderr.lines().rev().take(4).collect();
        return Err(AppError::Ffmpeg(tail.into_iter().rev().collect::<Vec<_>>().join("\n")));
    }
    on_progress(1.0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::platform::{FormatTarget, Platform};

    /// End-to-end: render a landscape test clip, adapt it to a vertical Short
    /// with a blurred fill and check the output. Skips when FFmpeg is absent
    /// (CI installs it, so it always runs there).
    #[tokio::test]
    async fn landscape_clip_becomes_vertical_blur_pad() {
        if !available().await {
            eprintln!("skipping: ffmpeg not found");
            return;
        }
        let dir = std::env::temp_dir().join(format!("connectors-test-{}", uuid::Uuid::new_v4().simple()));
        std::fs::create_dir_all(&dir).unwrap();
        let src = dir.join("in.mp4").to_string_lossy().to_string();
        let out = dir.join("out.mp4").to_string_lossy().to_string();

        let status = Command::new(binary("ffmpeg"))
            .args(["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=2"])
            .args(["-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-shortest"])
            .args(["-pix_fmt", "yuv420p", &src])
            .status()
            .await
            .unwrap();
        assert!(status.success(), "could not render the test clip");

        let info = probe(&src).await.unwrap();
        assert_eq!((info.width, info.height), (1920, 1080));
        let plan = plan_for(&info, &out, FormatTarget::for_platform(Platform::Youtube, true), FitStrategy::Auto);
        assert_eq!(plan.strategy, plan::ResolvedStrategy::BlurPad);

        let mut last = 0.0;
        run(&plan, info.duration_s, |f| last = f).await.unwrap();
        assert_eq!(last, 1.0);

        let result = probe(&out).await.unwrap();
        assert_eq!((result.width, result.height), (1080, 1920));
        assert!(result.has_audio);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
