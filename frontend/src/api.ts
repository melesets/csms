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

export function getMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path; // Already absolute
  
  // Strip '/api' or '/isbar/api' from the end of the base URL to get the root host
  let host = API_BASE;
  if (host.endsWith('/api')) {
    host = host.slice(0, -4);
  } else if (host.endsWith('/isbar/api')) {
    host = host.slice(0, -10);
  }
  
  // If host is empty string, we are in typical Vite Dev Proxy environment where API_BASE was '/api'.
  // We point directly to backend port 4000 for uploads to bypass Vite dev proxy restart requirement
  if (host === '' && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    host = 'http://localhost:4000';
  }

  // Ensure we don't duplicate slashes
  if (host.endsWith('/') && path.startsWith('/')) {
    return `${host}${path.slice(1)}`;
  }
  return `${host}${path}`;
}

export async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || `DELETE ${path} failed`);
    (err as any).status = res.status;
    (err as any).statusText = res.statusText;
    throw err;
  }
  return res.json();
}
