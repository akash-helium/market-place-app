const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const KEY_STORAGE = "hh_admin_key";

export function getAdminKey() {
  return localStorage.getItem(KEY_STORAGE) ?? "";
}

export function setAdminKey(key: string) {
  localStorage.setItem(KEY_STORAGE, key);
}

export async function adminApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": getAdminKey(),
      ...(init.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Request failed");
  return json.data as T;
}
