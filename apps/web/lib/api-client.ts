export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, details?: unknown, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

type UnauthorizedListener = () => void;
let unauthorizedListener: UnauthorizedListener | null = null;

/**
 * Registered once (by SessionExpiryHandler) so apiFetch can react to a 401
 * from ANY request — not just ones TanStack Query itself tracks, like a
 * mutation fired directly from a button handler (apiPost/apiPatch calls in
 * the users dialogs aren't wrapped in useMutation). This module has no
 * access to the query client or router itself, so it just notifies.
 */
export function onUnauthorized(listener: UnauthorizedListener | null): void {
  unauthorizedListener = listener;
}

/**
 * Same-origin, credentials-included fetch wrapper. The web app only ever
 * talks to its own origin (Next's /api/* rewrite proxies to the API), so
 * cookies are always first-party — no CORS, no cross-site credential
 * concerns.
 */
async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401) {
      unauthorizedListener?.();
    }

    const errorBody = body as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      errorBody?.error?.code ?? "UNKNOWN",
      errorBody?.error?.message ?? "Something went wrong. Please try again.",
      errorBody?.error?.details,
      errorBody?.error?.requestId,
    );
  }

  return body as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

export function apiPost<T>(path: string, data?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
}

export function apiPatch<T>(path: string, data: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(data) });
}

/** Package 3.3: the deal-contacts endpoint is the first PUT route in this app. */
export function apiPut<T>(path: string, data: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "PUT", body: JSON.stringify(data) });
}

/** Day 6a (D93): the first DELETE route this frontend calls (removing an unused pipeline stage). */
export function apiDelete<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "DELETE" });
}
