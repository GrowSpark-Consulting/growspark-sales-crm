import { describe, expect, it } from "vitest";
import { formatINR, formatINRCompact, formatDate, formatTime } from "@/lib/format";

describe("formatINR", () => {
  it("groups by the Indian numbering system", () => {
    expect(formatINR(482000)).toBe("₹ 4,82,000");
  });

  it("groups a value under one thousand with no separators", () => {
    expect(formatINR(820)).toBe("₹ 820");
  });

  it("formats a negative amount with a leading minus before the symbol", () => {
    expect(formatINR(-482000)).toBe("-₹ 4,82,000");
  });

  it("rounds to the nearest rupee", () => {
    expect(formatINR(482000.6)).toBe("₹ 4,82,001");
  });
});

describe("formatINRCompact", () => {
  it("formats lakhs with one decimal place", () => {
    expect(formatINRCompact(4_820_000)).toBe("₹ 48.2 L");
  });

  it("formats crores with one decimal place", () => {
    expect(formatINRCompact(12_000_000)).toBe("₹ 1.2 Cr");
  });

  it("falls back to full grouping below one lakh", () => {
    expect(formatINRCompact(82_000)).toBe("₹ 82,000");
  });

  it("formats a negative compact amount with a leading minus", () => {
    expect(formatINRCompact(-4_820_000)).toBe("-₹ 48.2 L");
  });
});

describe("formatDate", () => {
  it("formats as day month(short) year", () => {
    expect(formatDate("2026-11-19T00:00:00")).toBe("19 Nov 2026");
  });

  it("accepts a Date instance", () => {
    expect(formatDate(new Date(2026, 10, 19))).toBe("19 Nov 2026");
  });
});

describe("formatTime", () => {
  it("formats as 12-hour clock with AM/PM", () => {
    expect(formatTime("2026-11-19T14:30:00")).toBe("2:30 PM");
  });

  it("formats midnight as 12:00 AM", () => {
    expect(formatTime("2026-11-19T00:00:00")).toBe("12:00 AM");
  });
});
