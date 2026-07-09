// Centralized API client - provides typed fetch helpers for all backend endpoints
// Decide API base dynamically:
function resolveApiBase() {
  const configured = (import.meta as any)?.env?.VITE_API_URL || (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
  if (configured) {
    return configured.startsWith('http')
      ? configured
      : configured.startsWith('/')
        ? configured
        : `/${configured}`;
  }
  if (typeof window !== 'undefined' && window.location?.pathname?.startsWith('/isbar')) {
    return '/isbar/api';
  }
  return '/api';
}

const API_BASE = resolveApiBase();

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('isbar_user');
    if (!raw) return {};
    const user = JSON.parse(raw);
    if (user?.token) return { Authorization: `Bearer ${user.token}` };
  } catch { /* ignore */ }
  return {};
}

export function getMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path; // Already absolute
  
  let host = API_BASE;
  if (host.endsWith('/api')) {
    host = host.slice(0, -4);
  } else if (host.endsWith('/isbar/api')) {
    host = host.slice(0, -10);
  }
  
  if (host === '' && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    host = 'http://localhost:4000';
  }

  if (host.endsWith('/') && path.startsWith('/')) {
    return `${host}${path.slice(1)}`;
  }
  return `${host}${path}`;
}

export async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || `GET ${path} failed`);
    (err as any).status = res.status;
    (err as any).statusText = res.statusText;
    throw err;
  }
  return res.json();
}

export async function apiPost(path: string, data: any) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || `POST ${path} failed`);
    (err as any).status = res.status;
    (err as any).statusText = res.statusText;
    throw err;
  }
  return res.json();
}

export async function apiPut(path: string, data: any) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || `PUT ${path} failed`);
    (err as any).status = res.status;
    (err as any).statusText = res.statusText;
    throw err;
  }
  return res.json();
}

export async function apiPatch(path: string, data?: any) {
  const options: RequestInit = {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
  };
  if (data) {
    options.body = JSON.stringify(data);
  }
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || `PATCH ${path} failed`);
    (err as any).status = res.status;
    (err as any).statusText = res.statusText;
    throw err;
  }
  return res.json();
}

export async function apiDelete(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || `DELETE ${path} failed`);
    (err as any).status = res.status;
    (err as any).statusText = res.statusText;
    throw err;
  }
  return res.json();
}

// Global fetch interceptor - injects Authorization header into ALL /api requests
// so that raw fetch() calls throughout the codebase don't need manual token handling.
(function installGlobalAuthInterceptor() {
  const originalFetch = window.fetch;
  (window as any).fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/')) {
      const headers = new Headers(init?.headers);
      if (!headers.has('Authorization')) {
        const token = authHeaders().Authorization;
        if (token) headers.set('Authorization', token);
      }
      return originalFetch(input, { ...init, headers });
    }
    return originalFetch(input, init);
  };
})();
