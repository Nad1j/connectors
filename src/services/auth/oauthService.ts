import { inTauri, invoke } from "@/lib/tauri";
import type { PlatformId } from "@/types";

/**
 * Thin client over the Rust OAuth service. The authorization-code + PKCE flow,
 * loopback redirect, token exchange and keychain storage all happen in Rust —
 * tokens never enter the webview.
 */

export interface ConnectionStatus {
  platform: PlatformId;
  connected: boolean;
  expired: boolean;
  configured: boolean;
  accountId: string | null;
}

/** Platforms whose OAuth provider config ships in this build. */
export const OAUTH_READY: PlatformId[] = ["youtube", "tiktok"];

export async function connect(platform: PlatformId): Promise<ConnectionStatus> {
  if (!inTauri) {
    // Browser preview: simulate the round-trip to the consent screen.
    await new Promise((r) => setTimeout(r, 1400));
    return { platform, connected: true, expired: false, configured: true, accountId: "demo" };
  }
  return invoke<ConnectionStatus>("auth_connect", { platform });
}

export async function refresh(platform: PlatformId): Promise<void> {
  if (!inTauri) return;
  await invoke("auth_refresh", { platform });
}

export async function disconnect(platform: PlatformId): Promise<void> {
  if (!inTauri) return;
  await invoke("auth_disconnect", { platform });
}

export async function status(): Promise<ConnectionStatus[] | null> {
  if (!inTauri) return null;
  return invoke<ConnectionStatus[]>("auth_status");
}
