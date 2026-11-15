import { describe, expect, it } from "vitest";
import { layoutTimeline } from "./timeline";
const start = Date.parse("2026-10-16"),
  end = Date.parse("2026-11-15");
describe("runway packing", () => {
  for (const width of [280, 390, 768, 1440]) {
    it(`keeps 24 crowded updates and the flag in bounds at ${width}px`, () => {
      const dates = Array.from(
        { length: 24 },
        (_, i) => `2026-11-${String(12 + (i % 3)).padStart(2, "0")}`,
      );
      const layout = layoutTimeline(dates, start, end, width);
      expect(layout.items).toHaveLength(dates.length);
      expect(layout.flagX + 30).toBeLessThanOrEqual(width);
      layout.items.forEach((item, i) => {
        expect(item.x).toBeGreaterThanOrEqual(0);
        expect(item.x + item.cardWidth).toBeLessThan(layout.flagX);
        expect(item.y).toBeGreaterThanOrEqual(0);
        expect(item.y + item.cardHeight).toBeLessThan(layout.height);
        expect(item.path).toMatch(
          /^M [\d.]+ [\d.]+ H [\d.]+ V [\d.]+ H [\d.]+ V [\d.]+$/,
        );
        for (const other of layout.items.slice(i + 1)) {
          expect(
            item.x + item.cardWidth <= other.x ||
              other.x + other.cardWidth <= item.x ||
              item.y + item.cardHeight <= other.y ||
              other.y + other.cardHeight <= item.y,
          ).toBe(true);
        }
      });
      expect(layout.items[0].dot).toBe(layout.items[3].dot);
    });
  }
  it("handles no updates, dates outside the window, and invalid dates", () => {
    expect(layoutTimeline([], start, end, 390).height).toBeGreaterThan(0);
    const { items } = layoutTimeline(
      ["2020-01-01", "2030-01-01", "unknown"],
      start,
      end,
      390,
    );
    expect(items[0].dot).toBe(8);
    expect(items[1].dot).toBe(318);
    expect(Number.isFinite(items[2].dot)).toBe(true);
  });
});
