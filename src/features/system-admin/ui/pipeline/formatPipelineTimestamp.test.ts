import { describe, expect, it } from "vitest";

import { formatPipelineTimestamp } from "./formatPipelineTimestamp";

describe("formatPipelineTimestamp", () => {
  it("formats ISO timestamps", () => {
    const formatted = formatPipelineTimestamp("2026-03-06T18:10:00.000Z");
    expect(formatted).not.toBe("\u2014");
    expect(formatted).not.toContain("Invalid Date");
  });

  it("formats epoch seconds strings", () => {
    const formatted = formatPipelineTimestamp("1772811000");
    expect(formatted).not.toBe("\u2014");
    expect(formatted).not.toContain("Invalid Date");
  });

  it("formats SQL-style timestamps with comma milliseconds", () => {
    const formatted = formatPipelineTimestamp("2026-03-06 10:40:52,120");
    expect(formatted).not.toBe("\u2014");
    expect(formatted).not.toContain("Invalid Date");
  });

  it("returns fallback for invalid values", () => {
    expect(formatPipelineTimestamp("not-a-date")).toBe("\u2014");
    expect(formatPipelineTimestamp("")).toBe("\u2014");
    expect(formatPipelineTimestamp(null)).toBe("\u2014");
  });
});
