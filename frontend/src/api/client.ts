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
};

export async function api<T = any>(path: string, opts: ReqOpts = {}): Promise<T> {
  const token = await getStoredToken();
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (!opts.isForm) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers,
    body: opts.isForm ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
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
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

export const apiBaseUrl = BASE_URL;
