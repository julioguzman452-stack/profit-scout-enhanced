// Minimal fetch client. Reads token from secure storage and attaches Authorization header.
import { storage } from "@/src/utils/storage";

const TOKEN_KEY = "auth_token";

const BASE_URL = "https://profit-scout-enhanced.onrender.com";
export const getStoredToken = async (): Promise<string | null> => {
  return (await storage.secureGet(TOKEN_KEY, "")) || null;
};
export const setStoredToken = (token: string) => storage.secureSet(TOKEN_KEY, token);
export const clearStoredToken = () => storage.secureRemove(TOKEN_KEY);

type ReqOpts = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: any;
  headers?: Record<string, string>;
  isForm?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail || `HTTP ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

export async function api<T = any>(path: string, opts: ReqOpts = {}): Promise<T> {
  const token = await getStoredToken();
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (!opts.isForm) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Merge caller signal with internal timeout signal
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const timeoutCtrl = new AbortController();
  const timer = setTimeout(() => timeoutCtrl.abort(), timeoutMs);
  const signal = opts.signal
    ? anySignal([opts.signal, timeoutCtrl.signal])
    : timeoutCtrl.signal;

  try {
    const res = await fetch(`${BASE_URL}/api${path}`, {
      method: opts.method || (opts.body ? "POST" : "GET"),
      headers,
      body: opts.isForm ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
      signal,
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const detail = (data && (data.detail || data.message)) || text || `HTTP ${res.status}`;
      const msg = typeof detail === "string" ? detail : JSON.stringify(detail);
      throw new ApiError(res.status, msg);
    }
    return data as T;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new ApiError(0, "Request timed out. Please check your connection and try again.");
    }
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, e?.message || "Network error");
  } finally {
    clearTimeout(timer);
  }
}

// Small helper: combine multiple AbortSignals into one
function anySignal(signals: AbortSignal[]): AbortSignal {
  const ctrl = new AbortController();
  const onAbort = (s: AbortSignal) => () => ctrl.abort(s.reason);
  for (const s of signals) {
    if (s.aborted) {
      ctrl.abort(s.reason);
      break;
    }
    s.addEventListener("abort", onAbort(s), { once: true });
  }
  return ctrl.signal;
}

export const apiBaseUrl = BASE_URL;
