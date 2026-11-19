import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiGet, apiPatch, apiPost, ApiError, onUnauthorized } from "@/lib/api-client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("onUnauthorized", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    onUnauthorized(null);
    vi.unstubAllGlobals();
  });

  it("notifies the registered listener on a 401", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(401, { error: { code: "UNAUTHENTICATED", message: "Session expired" } }),
    );
    const listener = vi.fn();
    onUnauthorized(listener);

    await expect(apiGet("/api/v1/auth/me")).rejects.toThrow(ApiError);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify the listener on a non-401 error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(403, { error: { code: "FORBIDDEN", message: "Not allowed" } }),
    );
    const listener = vi.fn();
    onUnauthorized(listener);

    await expect(apiPost("/api/v1/users", {})).rejects.toThrow(ApiError);

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not notify the listener on success", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: { ok: true } }));
    const listener = vi.fn();
    onUnauthorized(listener);

    await apiPatch("/api/v1/users/1", { name: "New name" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying once unregistered", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(401, { error: { code: "UNAUTHENTICATED", message: "Session expired" } }),
    );
    const listener = vi.fn();
    onUnauthorized(listener);
    onUnauthorized(null);

    await expect(apiGet("/api/v1/auth/me")).rejects.toThrow(ApiError);

    expect(listener).not.toHaveBeenCalled();
  });
});
