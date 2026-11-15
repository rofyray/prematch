/** Pack dated cards into staggered lanes, leaving the meeting endpoint clear. */
export function layoutTimeline(
  dates: string[],
  start: number,
  end: number,
  width: number,
) {
  const inset = 8,
    reserve = 72,
    gap = 28,
    cardHeight = 100,
    rowHeight = 124;
  const available = Math.max(140, width - reserve - inset);
  const columns = Math.max(1, Math.floor((available + gap) / 208));
  const cardWidth = Math.min(188, (available - gap * (columns - 1)) / columns);
  const pitch =
    columns > 1 ? (available - cardWidth) / (columns - 1) : cardWidth + gap;
  const rows = Math.max(1, Math.ceil(dates.length / columns));
  const above = Math.ceil(rows / 2),
    below = Math.floor(rows / 2);
  const axis = above * rowHeight + 45;
  const occupied = new Set<string>();
  const items = dates.map((date) => {
    const parsed = Date.parse(date);
    const ratio = Number.isFinite(parsed)
      ? Math.max(0, Math.min(1, (parsed - start) / Math.max(1, end - start)))
      : 0;
    const dot = inset + ratio * (width - reserve - inset);
    let lane = 0,
      column = 0;
    const choices = Array.from({ length: columns }, (_, i) => i).sort(
      (a, b) =>
        Math.abs(inset + a * pitch + cardWidth / 2 - dot) -
        Math.abs(inset + b * pitch + cardWidth / 2 - dot),
    );
    while (true) {
      const free = choices.find((c) => !occupied.has(`${lane}:${c}`));
      if (free !== undefined) {
        column = free;
        break;
      }
      lane++;
    }
    occupied.add(`${lane}:${column}`);
    const upper = lane % 2 === 0;
    const depth = Math.floor(lane / 2);
    const x = inset + column * pitch;
    const y = upper
      ? axis - 48 - cardHeight - depth * rowHeight
      : axis + 48 + depth * rowHeight;
    const gutter = x + cardWidth + 10 + (depth % 2) * 4;
    const channel = axis + (upper ? -1 : 1) * (18 + column * 3);
    return {
      x,
      y,
      dot,
      cardWidth,
      cardHeight,
      path: `M ${x + cardWidth} ${y + cardHeight / 2} H ${gutter} V ${channel} H ${dot} V ${axis}`,
    };
  });
  return {
    items,
    axis,
    height: axis + (below ? below * rowHeight + 40 : 54),
    flagX: width - 34,
  };
}
