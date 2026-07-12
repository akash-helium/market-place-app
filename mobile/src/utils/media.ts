import { getApiBaseUrl } from "../api/client";

/** Rewrite localhost media URLs so Android emulator / device can load them */
export function mediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const base = getApiBaseUrl();
  return url
    .replace("http://localhost:3000", base)
    .replace("http://127.0.0.1:3000", base);
}
