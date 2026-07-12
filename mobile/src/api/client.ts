import { Platform } from "react-native";
import Constants from "expo-constants";

/** Resolve API base URL for simulator / emulator / Expo Go on device */
export function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "");
  }
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:3000`;
    }
  }
  if (Platform.OS === "android") return "http://10.0.2.2:3000";
  return "http://localhost:3000";
}

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string; details?: unknown };
export type ApiResult<T> = ApiOk<T> | ApiErr;

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type TokenGetter = () => string | null;
type OnUnauthorized = () => void;

let getToken: TokenGetter = () => null;
let onUnauthorized: OnUnauthorized = () => {};

export function configureApi(opts: {
  getToken: TokenGetter;
  onUnauthorized: OnUnauthorized;
}) {
  getToken = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

export async function api<T>(
  path: string,
  options: RequestInit & { formData?: FormData } = {}
): Promise<T> {
  const { formData, headers: extraHeaders, ...rest } = options;
  const headers: Record<string, string> = {
    ...(extraHeaders as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!formData) headers["Content-Type"] = "application/json";

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    headers,
    body: formData ?? rest.body,
  });

  let json: ApiResult<T> | null = null;
  try {
    json = (await res.json()) as ApiResult<T>;
  } catch {
    throw new ApiError("Something went wrong", res.status);
  }

  if (res.status === 401) {
    onUnauthorized();
    throw new ApiError(json && !json.ok ? json.error : "Session expired", 401);
  }

  if (!json.ok) {
    throw new ApiError(json.error || "Request failed", res.status, json.details);
  }
  return json.data;
}
