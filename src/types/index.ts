export type PlatformId = "youtube" | "tiktok" | "instagram" | "facebook" | "x";

export type FitStrategy = "auto" | "crop" | "blur-pad" | "letterbox";

export type ViewId = "dashboard" | "publisher" | "calendar" | "analytics" | "inbox" | "accounts" | "settings";

export interface Account {
  platform: PlatformId;
  handle: string;
  displayName: string;
  followers: number;
  connected: boolean;
  /** Token present but past expiry and refresh failed: user must sign in again. */
  needsReauth: boolean;
  /** OAuth client id configured for this platform. */
  configured: boolean;
}

export interface VideoAsset {
  name: string;
  /** Absolute path on disk (Tauri) — undefined in a plain browser. */
  path?: string;
  objectUrl: string;
  width: number;
  height: number;
  durationS: number;
  sizeBytes: number;
}

export type Stage =
  | "queued"
  | "processing"
  | "uploading"
  | "finalizing"
  | "published"
  | "scheduled"
  | "failed"
  | "cancelled";

export interface PlatformJobState {
  platform: PlatformId;
  stage: Stage;
  progress: number;
  message: string;
  postUrl?: string;
}

export interface PublishJob {
  id: string;
  title: string;
  createdAt: number;
  platforms: Record<string, PlatformJobState>;
}

export interface ProgressEvent {
  jobId: string;
  platform: PlatformId;
  stage: Stage;
  progress: number;
  message: string;
  postUrl?: string | null;
}

export interface AiSuggestion {
  titles: string[];
  caption: string;
  hashtags: string[];
  source: string;
}

export interface ScheduledPost {
  id: string;
  title: string;
  platforms: PlatformId[];
  /** ISO date-time */
  at: string;
}
