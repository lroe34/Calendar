export interface LayoutInput {
  id: string;
  start: Date;
  end: Date;
}

export interface LayoutResult {
  id: string;
  leftPct: number;
  widthPct: number;
  /** True when this event is fully contained within another event's time
   * range and is rendered as an inset card over it, rather than sharing a
   * side-by-side column with it. */
  nested: boolean;
}

const GAP_PCT = 1.5;
/** How far a nested event is inset from its container's left edge, as a
 * fraction of the container's own width — leaves a strip of the container
 * (and its left accent line) visible instead of fully covering it. */
const NESTED_INDENT_FRACTION = 0.12;

/** Single full-width slot, for callers that only ever render one event at a time. */
export const SOLO_LAYOUT = { leftPct: GAP_PCT / 2, widthPct: 100 - GAP_PCT };

function fullyContains(a: LayoutInput, b: LayoutInput): boolean {
  return (
    a.start.getTime() <= b.start.getTime() &&
    a.end.getTime() >= b.end.getTime() &&
    (a.start.getTime() !== b.start.getTime() || a.end.getTime() !== b.end.getTime())
  );
}

/**
 * Interval-overlap column packing (same family of algorithm used by most
 * calendar UIs for concurrent events), scoped to whatever subset of events
 * is passed in.
 */
function packColumns(events: LayoutInput[]): Map<string, { columnIndex: number; columnCount: number }> {
  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime(),
  );

  const results = new Map<string, { columnIndex: number; columnCount: number }>();
  let cluster: LayoutInput[] = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const columnEnds: number[] = [];
    const columnByEventId = new Map<string, number>();
    for (const ev of cluster) {
      let placed = false;
      for (let c = 0; c < columnEnds.length; c++) {
        if (columnEnds[c] <= ev.start.getTime()) {
          columnEnds[c] = ev.end.getTime();
          columnByEventId.set(ev.id, c);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columnEnds.push(ev.end.getTime());
        columnByEventId.set(ev.id, columnEnds.length - 1);
      }
    }
    const columnCount = columnEnds.length;
    for (const ev of cluster) {
      results.set(ev.id, { columnIndex: columnByEventId.get(ev.id)!, columnCount });
    }
    cluster = [];
  };

  for (const ev of sorted) {
    if (cluster.length > 0 && ev.start.getTime() >= clusterEnd) {
      flushCluster();
      clusterEnd = -Infinity;
    }
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.end.getTime());
  }
  flushCluster();

  return results;
}

/**
 * Lays out the Day view hour grid's events: side-by-side columns for events
 * that merely overlap, but an inset "card over a backdrop" treatment for an
 * event whose time range is fully contained within another's — so a short
 * meeting inside an all-day "Work" block doesn't squeeze it down to a
 * shared half-width column.
 */
export function layoutOverlappingEvents(events: LayoutInput[]): LayoutResult[] {
  // Top-level events are never fully contained by another event in the set.
  const topLevel: LayoutInput[] = [];
  for (const ev of events) {
    const hasContainer = events.some((other) => other.id !== ev.id && fullyContains(other, ev));
    if (!hasContainer) topLevel.push(ev);
  }
  const topLevelIds = new Set(topLevel.map((e) => e.id));

  // Every non-top-level event nests under the tightest (shortest-duration)
  // top-level event that contains it — containment is transitive, so a
  // top-level ancestor always exists.
  const parentByEventId = new Map<string, LayoutInput>();
  for (const ev of events) {
    if (topLevelIds.has(ev.id)) continue;
    const candidates = topLevel
      .filter((c) => fullyContains(c, ev))
      .sort((a, b) => a.end.getTime() - a.start.getTime() - (b.end.getTime() - b.start.getTime()));
    if (candidates.length > 0) {
      parentByEventId.set(ev.id, candidates[0]);
    } else {
      // Defensive fallback; shouldn't happen given the transitivity above.
      topLevel.push(ev);
      topLevelIds.add(ev.id);
    }
  }

  const results: LayoutResult[] = [];
  const containerRectById = new Map<string, { leftPct: number; widthPct: number }>();

  const topLevelColumns = packColumns(topLevel);
  for (const ev of topLevel) {
    const { columnIndex, columnCount } = topLevelColumns.get(ev.id)!;
    const widthPct = 100 / columnCount - GAP_PCT;
    const leftPct = columnIndex * (100 / columnCount) + GAP_PCT / 2;
    containerRectById.set(ev.id, { leftPct, widthPct });
    results.push({ id: ev.id, leftPct, widthPct, nested: false });
  }

  const childrenByParentId = new Map<string, LayoutInput[]>();
  for (const ev of events) {
    const parent = parentByEventId.get(ev.id);
    if (!parent) continue;
    if (!childrenByParentId.has(parent.id)) childrenByParentId.set(parent.id, []);
    childrenByParentId.get(parent.id)!.push(ev);
  }

  for (const [parentId, children] of childrenByParentId) {
    const containerRect = containerRectById.get(parentId);
    if (!containerRect) continue;
    const insetLeft = containerRect.leftPct + containerRect.widthPct * NESTED_INDENT_FRACTION;
    const insetWidth = containerRect.widthPct * (1 - NESTED_INDENT_FRACTION);
    const childColumns = packColumns(children);
    for (const child of children) {
      const { columnIndex, columnCount } = childColumns.get(child.id)!;
      const slotWidth = insetWidth / columnCount;
      results.push({
        id: child.id,
        leftPct: insetLeft + columnIndex * slotWidth + GAP_PCT / 2,
        widthPct: slotWidth - GAP_PCT,
        nested: true,
      });
    }
  }

  return results;
}
