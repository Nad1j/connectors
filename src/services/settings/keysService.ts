import { inTauri, invoke } from "@/lib/tauri";
import type { PlatformId } from "@/types";

export type KeySource = "env" | "settings" | "builtin";

export interface PlatformKeysStatus {
  platform: PlatformId;
  clientIdSource: KeySource | null;
  clientSecretSource: KeySource | null;
}

export interface PlatformKeys {
  platform: PlatformId;
  clientId?: string;
  clientSecret?: string;
}

// Browser preview keeps only *whether* something was saved, never the value.
let fakeStatus: PlatformKeysStatus[] = [
  { platform: "youtube", clientIdSource: null, clientSecretSource: null },
  { platform: "tiktok", clientIdSource: null, clientSecretSource: null },
];

export async function status(): Promise<PlatformKeysStatus[]> {
  if (inTauri) return invoke<PlatformKeysStatus[]>("settings_platform_keys");
  return fakeStatus;
}

export async function save({ platform, clientId, clientSecret }: PlatformKeys) {
  if (inTauri) return invoke<void>("settings_save_platform_keys", { platform, clientId, clientSecret });
  fakeStatus = fakeStatus.map((s) =>
    s.platform !== platform
      ? s
      : {
          ...s,
          clientIdSource: clientId?.trim() ? "settings" : s.clientIdSource,
          clientSecretSource: clientSecret?.trim() ? "settings" : s.clientSecretSource,
        },
  );
}

export async function clear(platform: PlatformId) {
  if (inTauri) return invoke<void>("settings_clear_platform_keys", { platform });
  fakeStatus = fakeStatus.map((s) => (s.platform === platform ? { ...s, clientIdSource: null, clientSecretSource: null } : s));
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/**
 * Parses a keys file. Accepted shapes:
 *   { "google": { "clientId", "clientSecret" }, "tiktok": { "clientKey", "clientSecret" } }
 * and, for YouTube, the client JSON Google Cloud Console downloads
 *   { "installed": { "client_id", "client_secret", ... } }
 */
export function parseKeysFile(text: string): PlatformKeys[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!data || typeof data !== "object") throw new Error("That file doesn't contain any keys.");
  const d = data as Record<string, Record<string, unknown> | undefined>;

  const out: PlatformKeys[] = [];
  const google = d.google ?? d.youtube;
  const installed = d.installed;
  if (google) out.push({ platform: "youtube", clientId: str(google.clientId), clientSecret: str(google.clientSecret) });
  else if (installed) out.push({ platform: "youtube", clientId: str(installed.client_id), clientSecret: str(installed.client_secret) });
  if (d.tiktok) {
    out.push({
      platform: "tiktok",
      clientId: str(d.tiktok.clientKey) ?? str(d.tiktok.clientId),
      clientSecret: str(d.tiktok.clientSecret),
    });
  }

  const usable = out.filter((k) => k.clientId || k.clientSecret);
  if (!usable.length) throw new Error('No keys found. Expected "google" and/or "tiktok" entries.');
  return usable;
}

export async function importFile(file: File): Promise<PlatformId[]> {
  const keys = parseKeysFile(await file.text());
  for (const k of keys) await save(k);
  return keys.map((k) => k.platform);
}
