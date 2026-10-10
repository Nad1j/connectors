use super::{uploader, PlatformTarget, ProgressEvent, PublishRequest, Stage, PROGRESS_EVENT};
use crate::{
    media::ffmpeg,
    platform::{FormatTarget, Platform},
};
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::Semaphore;

/// Processing is CPU-bound, uploads are network-bound; cap both so a five-way
/// publish doesn't spawn five concurrent x264 encodes.
const MAX_CONCURRENT_ENCODES: usize = 2;
const MAX_CONCURRENT_UPLOADS: usize = 4;

/// Share of the per-platform progress bar spent on processing vs uploading.
const PROCESS_WEIGHT: f64 = 0.35;

pub struct PublishQueue {
    encode_slots: Arc<Semaphore>,
    upload_slots: Arc<Semaphore>,
    cancel_flags: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl Default for PublishQueue {
    fn default() -> Self {
        Self {
            encode_slots: Arc::new(Semaphore::new(MAX_CONCURRENT_ENCODES)),
            upload_slots: Arc::new(Semaphore::new(MAX_CONCURRENT_UPLOADS)),
            cancel_flags: Mutex::new(HashMap::new()),
        }
    }
}

struct Reporter {
    app: AppHandle,
    job_id: String,
    platform: Platform,
}

impl Reporter {
    fn emit(&self, stage: Stage, progress: f64, message: impl Into<String>, post_url: Option<String>) {
        let _ = self.app.emit(
            PROGRESS_EVENT,
            ProgressEvent {
                job_id: self.job_id.clone(),
                platform: self.platform,
                stage,
                progress,
                message: message.into(),
                post_url,
            },
        );
    }
}

impl PublishQueue {
    /// Enqueues one job per target platform and returns the job id at once;
    /// progress streams back over `publish://progress`.
    pub fn submit(&self, app: AppHandle, req: PublishRequest) -> String {
        let job_id = uuid::Uuid::new_v4().to_string();
        let cancelled = Arc::new(AtomicBool::new(false));
        self.cancel_flags.lock().unwrap().insert(job_id.clone(), cancelled.clone());

        let req = Arc::new(req);
        for target in req.targets.clone() {
            let reporter = Reporter { app: app.clone(), job_id: job_id.clone(), platform: target.platform };
            reporter.emit(Stage::Queued, 0.0, "Waiting for a slot", None);
            let (enc, up, req, cancelled) =
                (self.encode_slots.clone(), self.upload_slots.clone(), req.clone(), cancelled.clone());
            tauri::async_runtime::spawn(async move {
                run_target(reporter, target, req, enc, up, cancelled).await;
            });
        }
        job_id
    }

    pub fn cancel(&self, job_id: &str) -> bool {
        match self.cancel_flags.lock().unwrap().get(job_id) {
            Some(flag) => {
                flag.store(true, Ordering::Relaxed);
                true
            }
            None => false,
        }
    }
}

async fn run_target(
    r: Reporter,
    target: PlatformTarget,
    req: Arc<PublishRequest>,
    encode_slots: Arc<Semaphore>,
    upload_slots: Arc<Semaphore>,
    cancelled: Arc<AtomicBool>,
) {
    if let Some(at) = &req.schedule_at {
        // Scheduling persists the job; the scheduler re-submits at `at`.
        r.emit(Stage::Scheduled, 0.0, format!("Scheduled for {at}"), None);
        return;
    }

    // ---- Processing --------------------------------------------------------
    let format = FormatTarget::for_platform(target.platform, target.short_form);
    let processed_path = {
        let _permit = encode_slots.acquire().await.expect("semaphore open");
        if cancelled.load(Ordering::Relaxed) {
            return r.emit(Stage::Cancelled, 0.0, "Cancelled", None);
        }
        r.emit(Stage::Processing, 0.0, format!("Adapting to {}×{}", format.width, format.height), None);
        match process(&r, &req.video_path, format, target).await {
            Ok(p) => p,
            Err(e) => return r.emit(Stage::Failed, 0.0, e, None),
        }
    };

    // ---- Upload ------------------------------------------------------------
    let _permit = upload_slots.acquire().await.expect("semaphore open");
    r.emit(Stage::Uploading, PROCESS_WEIGHT, "Uploading", None);
    let up = uploader::for_platform(target.platform);
    let report = |f: f64| {
        r.emit(Stage::Uploading, PROCESS_WEIGHT + f * (1.0 - PROCESS_WEIGHT) * 0.96, format!("Uploading {:.0}%", f * 100.0), None)
    };
    let input = uploader::UploadInput {
        file_path: &processed_path,
        title: &req.title,
        caption: &req.caption,
        hashtags: &req.hashtags,
    };
    match up.upload(input, cancelled.clone(), &report).await {
        Ok(url) => {
            r.emit(Stage::Finalizing, 0.98, "Platform is processing the video", None);
            tokio::time::sleep(Duration::from_millis(600)).await;
            r.emit(Stage::Published, 1.0, "Published", Some(url));
        }
        Err(_) if cancelled.load(Ordering::Relaxed) => r.emit(Stage::Cancelled, 0.0, "Cancelled", None),
        Err(e) => r.emit(Stage::Failed, 0.0, e.to_string(), None),
    }
}

/// Real FFmpeg pass when the file and binary exist; otherwise a short
/// simulated pass so the pipeline is demoable without media on disk.
async fn process(r: &Reporter, input: &str, format: FormatTarget, target: PlatformTarget) -> Result<String, String> {
    if Path::new(input).exists() && ffmpeg::available().await {
        let info = ffmpeg::probe(input).await.map_err(|e| e.to_string())?;
        let out = std::env::temp_dir().join(format!(
            "connectors-{}-{}x{}-{}.mp4",
            target.platform.id(),
            format.width,
            format.height,
            uuid::Uuid::new_v4().simple()
        ));
        let out = out.to_string_lossy().to_string();
        let plan = ffmpeg::plan_for(&info, &out, format, target.strategy);
        let label = format!("{:?}", plan.strategy).to_lowercase();
        ffmpeg::run(&plan, info.duration_s, |f| {
            r.emit(Stage::Processing, f * PROCESS_WEIGHT, format!("Encoding ({label}) {:.0}%", f * 100.0), None)
        })
        .await
        .map_err(|e| e.to_string())?;
        Ok(out)
    } else {
        for i in 1..=10 {
            tokio::time::sleep(Duration::from_millis(120)).await;
            r.emit(Stage::Processing, i as f64 / 10.0 * PROCESS_WEIGHT, format!("Encoding {}%", i * 10), None);
        }
        Ok(input.to_string())
    }
}
