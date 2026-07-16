export interface LayoutInput {
  id: string;
  start: Date;
  end: Date;
}

export interface LayoutResult {
  id: string;
  columnIndex: number;
  columnCount: number;
}

/**
 * Assigns side-by-side columns to overlapping events for the Day view hour
 * grid (interval-overlap column packing, same family of algorithm used by
 * most calendar UIs for concurrent events).
 */
export function layoutOverlappingEvents(events: LayoutInput[]): LayoutResult[] {
  const sorted = [...events].sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() ||
      b.end.getTime() - a.end.getTime(),
  );

  const results = new Map<string, { columnIndex: number }>();
  let cluster: LayoutInput[] = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const columnEnds: number[] = [];
    for (const ev of cluster) {
      let placed = false;
      for (let c = 0; c < columnEnds.length; c++) {
        if (columnEnds[c] <= ev.start.getTime()) {
          columnEnds[c] = ev.end.getTime();
          results.set(ev.id, { columnIndex: c });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columnEnds.push(ev.end.getTime());
        results.set(ev.id, { columnIndex: columnEnds.length - 1 });
      }
    }
    const columnCount = columnEnds.length;
    for (const ev of cluster) {
      const r = results.get(ev.id)!;
      (r as LayoutResult).columnCount = columnCount;
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

  return sorted.map((ev) => {
    const r = results.get(ev.id)! as LayoutResult;
    return { id: ev.id, columnIndex: r.columnIndex, columnCount: r.columnCount };
  });
}
