// Centralized API utility for backend communication
// Decide API base dynamically:
// - If VITE_API_BASE is provided, use it.
// - If app runs under /isbar (backend-served), use '/isbar/api'.
// - Otherwise (Vite dev), use '/api'.
function resolveApiBase() {
  const configured = (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
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
