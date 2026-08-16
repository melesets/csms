// Centralized API client - provides typed fetch helpers for all backend endpoints
function resolveApiBase() {
  const configured = (import.meta as any)?.env?.VITE_API_URL || (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
  if (configured) {
    return configured.startsWith('http')
      ? configured
      : configured.startsWith('/')
        ? configured
        : `/${configured}`;
  }
  if (typeof window !== 'undefined' && window.location?.pathname?.startsWith('/csms')) {
    return '/csms/api';
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

let isRedirectingToLogin = false;

function handle401() {
  if (isRedirectingToLogin) return;
  isRedirectingToLogin = true;

  localStorage.removeItem('isbar_user');
  localStorage.removeItem('isbar_active_operator');
  localStorage.removeItem('isbar_admin_impersonator');
  localStorage.removeItem('active_shift_session');

  window.location.href = '/csms/login';
  setTimeout(() => { isRedirectingToLogin = false; }, 3000);
}

export function getMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path === 'null' || path === 'undefined' || path.length < 5) return undefined;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/uploads/')) {
    const apiBase = resolveApiBase();
    const prefix = apiBase.replace('/api', '');
    return `${prefix}${path}`;
  }
  return path;
}

export async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (res.status === 401) {
    if (!path.includes('/login') && !path.includes('/logout')) {
      handle401();
    }
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || 'Session expired'), { status: 401 });
  }
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || `GET ${path} failed`);
    (err as any).status = res.status;
    (err as any).statusText = res.statusText;
    throw err;
  }
  return res.json();
}

export async function apiUpload(path: string, formData: FormData): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (res.status === 401) {
    handle401();
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || 'Session expired'), { status: 401 });
  }
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || `UPLOAD ${path} failed`);
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
  if (res.status === 401) {
    if (!path.includes('/login') && !path.includes('/logout')) {
      handle401();
    }
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || 'Session expired'), { status: 401 });
  }
  if (!res.ok) {
    let body: any;
    try { body = await res.json(); } catch { body = await res.text(); }
    const err = new Error(typeof body === 'string' ? body : body?.error || `POST ${path} failed`);
    (err as any).status = res.status;
    (err as any).statusText = res.statusText;
    if (typeof body === 'object' && body !== null) {
      Object.assign(err, body);
    }
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
  if (res.status === 401) {
    handle401();
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || 'Session expired'), { status: 401 });
  }
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
  if (res.status === 401) {
    handle401();
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || 'Session expired'), { status: 401 });
  }
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
  if (res.status === 401) {
    handle401();
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || 'Session expired'), { status: 401 });
  }
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || `DELETE ${path} failed`);
    (err as any).status = res.status;
    (err as any).statusText = res.statusText;
    throw err;
  }
  return res.json();
}

// Global fetch interceptor - rewrites /api/ URLs to use API_BASE and injects Authorization header
(function installGlobalAuthInterceptor() {
  const originalFetch = window.fetch;
  (window as any).fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/')) {
      let rewrittenUrl = url;
      if (API_BASE !== '/api' && !url.startsWith(API_BASE)) {
        const idx = url.indexOf('/api/');
        if (idx !== -1) {
          rewrittenUrl = API_BASE + url.slice(idx + 4);
        }
      }
      const headers = new Headers(init?.headers);
      if (!headers.has('Authorization')) {
        const token = authHeaders().Authorization;
        if (token) headers.set('Authorization', token);
      }
      let fetchInput: RequestInfo | URL;
      if (typeof input === 'string') {
        fetchInput = rewrittenUrl;
      } else if (input instanceof URL) {
        fetchInput = new URL(rewrittenUrl, input.origin);
      } else {
        fetchInput = new Request(rewrittenUrl, input);
      }
      return originalFetch(fetchInput, { ...init, headers }).then((res) => {
        if (res.status === 401 && !rewrittenUrl.includes('/login') && !rewrittenUrl.includes('/logout')) {
          handle401();
        }
        return res;
      });
    }
    return originalFetch(input, init);
  };
})();
