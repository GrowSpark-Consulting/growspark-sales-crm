import { describe, expect, it } from "vitest";
import { buildExportHref } from "@/lib/export";

describe("buildExportHref", () => {
  it("returns the bare path when every param is empty/undefined", () => {
    expect(buildExportHref("/api/v1/leads/export", { q: "", status: undefined })).toBe(
      "/api/v1/leads/export",
    );
  });

  it("includes only the params that have a real value", () => {
    const href = buildExportHref("/api/v1/leads/export", {
      q: "asha",
      status: "NEW",
      sourceId: undefined,
      archived: false,
    });
    expect(href).toBe("/api/v1/leads/export?q=asha&status=NEW");
  });

  it("includes a true boolean flag but omits a false one", () => {
    const href = buildExportHref("/api/v1/leads/export", { archived: true });
    expect(href).toBe("/api/v1/leads/export?archived=true");
  });

  it("stringifies a number", () => {
    const href = buildExportHref("/api/v1/leads/export", { page: 2 });
    expect(href).toBe("/api/v1/leads/export?page=2");
  });

  it("URL-encodes special characters in a value", () => {
    const href = buildExportHref("/api/v1/leads/export", { q: "a b&c" });
    expect(href).toBe("/api/v1/leads/export?q=a+b%26c");
  });
});
