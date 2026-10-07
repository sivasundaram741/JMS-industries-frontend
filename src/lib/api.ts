// API client for the KCERP API (apps/api). Every call sends the signed-in user's token; a 401 signs the user out.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const TOKEN_KEY = 'kcerp-token';
const TENANT_KEY = 'kcerp-tenant';

export const tokenStore = {
  get(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(t: string) {
    try { localStorage.setItem(TOKEN_KEY, t); } catch { /* private mode */ }
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
  },
};

// Stores the tenant slug so every API call is prefixed with /{slug}
export const tenantStore = {
  get(): string | null {
    try { return localStorage.getItem(TENANT_KEY); } catch { return null; }
  },
  set(slug: string) {
    try { localStorage.setItem(TENANT_KEY, slug); } catch {}
  },
  clear() {
    try { localStorage.removeItem(TENANT_KEY); } catch {}
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const token = tokenStore.get();
  // Prefer the tenant slug embedded in the current URL (window.location) over the stored value.
  // This prevents cross-tenant data leaks when a user navigates to a different org's URL mid-session.
  const urlSlug = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : null;
  const stored = tenantStore.get();
  const slug = (urlSlug && urlSlug !== 'login' && urlSlug !== 'platform' && !urlSlug.startsWith('_')) ? urlSlug : stored;
  const needsPrefix = slug && !path.startsWith('/platform') && !path.startsWith('/health');
  const fullPath = needsPrefix ? `/${slug}${path}` : path;
  let res: Response;
  try {
    res = await fetch(API_URL + fullPath, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the KCERP server · check that the API is running at ' + API_URL);
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.clear();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('kcerp:signed-out'));
    }
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data?.details);
  }
  return data as T;
}

export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body });
export const put = <T = any>(path: string, body: unknown = {}) => api<T>(path, { method: 'PUT', body });
export const patch = <T = any>(path: string, body: unknown = {}) => api<T>(path, { method: 'PATCH', body });
export const fetcher = (path: string) => api(path);

// '?a=1&b=x' from an object, skipping empty values
export function qs(params: Record<string, string | number | boolean | null | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? '?' + s : '';
}

export interface Page<T> { rows: T[]; total: number; page: number; pageSize: number }

// Upload a file with other form fields (multipart). The browser sets the multipart boundary itself.
export async function upload<T = any>(path: string, form: FormData): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(API_URL + path, { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: form });
  } catch {
    throw new ApiError(0, 'Cannot reach the KCERP server · check that the API is running at ' + API_URL);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error || `Upload failed (${res.status})`, data?.details);
  return data as T;
}

// Fetch a stored file with the user's token and return it as a blob (for preview or download)
export async function fetchBlob(path: string): Promise<Blob> {
  const token = tokenStore.get();
  const res = await fetch(API_URL + path, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data?.error || `Could not open the file (${res.status})`);
  }
  return res.blob();
}

// Save a blob as a file on the user's computer
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Download a document from Document Tracking
export async function downloadDocument(id: number, fileName: string) {
  saveBlob(await fetchBlob(`/documents/${id}/file`), fileName);
}

// Rows → CSV text (Excel opens it); values with commas, quotes or line breaks are quoted
export function toCsv(columns: Array<{ key: string; label: string }>, rows: Array<Record<string, any>>) {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(','))].join('\r\n');
}
