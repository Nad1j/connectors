import { invoke as tauriInvoke, isTauri } from "@tauri-apps/api/core";
import { listen as tauriListen, type UnlistenFn } from "@tauri-apps/api/event";

/** True inside the desktop shell; false when the UI runs in a plain browser (vite dev). */
export const inTauri = isTauri();

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return tauriInvoke<T>(cmd, args);
}

export async function listen<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  if (!inTauri) return () => {};
  return tauriListen<T>(event, (e) => handler(e.payload));
}
