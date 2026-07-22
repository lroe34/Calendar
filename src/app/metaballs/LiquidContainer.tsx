"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* ------------------------------------------------------------------ *
 * <LiquidContainer> — a reusable "goo" surface.
 *
 * The "blurred SVG trick": every child blob is rendered as a solid circle
 * inside one <g filter>. feGaussianBlur bleeds neighbouring circles into a
 * single smear of translucent alpha; an feColorMatrix then re-hardens that
 * smear back into a crisp silhouette. Where two blurs overlapped you get a
 * smooth metaball bridge; pull the circles apart and the bridge thins until
 * the alpha in the gap drops below threshold and it snaps.
 *
 * You don't position or animate the blobs yourself. You hand the container a
 * list of `items` (the buttons you want present *right now*) and it tweens
 * them: new items grow out of the centre and slide to their slot, removed
 * items shrink back into the centre and merge away — so adding a second item
 * looks like cell mitosis, and removing it looks like the cells fusing.
 * ------------------------------------------------------------------ */

export type LiquidTheme = { from: string; to: string; glow: string };

export type LiquidItem = {
  /** Stable identity. Presence is diffed by id, so keep it stable across
   *  renders for the same conceptual button. */
  id: string;
  /** Fires when this blob is tapped. Omit for a non-interactive blob. */
  onClick?: () => void;
  /** Crisp glyph drawn centred on the blob. `progress` runs 0→1 as the blob
   *  grows in, so you can fade / scale the icon with it. Draw around (0, 0). */
  icon?: (progress: number) => ReactNode;
  /** Text drawn *inside* the blob. Its presence turns the blob into a
   *  pill/capsule: the body widens to fit the text (height stays 2·radius,
   *  corners fully rounded), while an icon-only or empty blob stays circular. */
  text?: string;
  /** Force a pill body this wide (full width, px) instead of measuring `text`.
   *  Ignored for circular blobs. */
  width?: number;
  /** Caption shown *under* the blob. */
  label?: string;
  /** Per-blob fill override (any SVG paint). Defaults to the theme gradient. */
  fill?: string;
};

export type LiquidContainerProps = {
  /** The buttons that should be present. Add/remove entries to split/merge. */
  items: LiquidItem[];
  theme: LiquidTheme;
  /** Goo-filter knobs. */
  blur?: number;
  contrast?: number;
  threshold?: number;
  /** Blob half-height at rest (the pill radius), and the edge gap between
   *  adjacent blobs. */
  radius?: number;
  gap?: number;
  /** How much a blob swells while it is in motion (0 = no swell). */
  swell?: number;
  width?: number;
  height?: number;
  /** Fired when the empty backdrop (outside every blob) is tapped. */
  onBackdrop?: () => void;
  /** Debug: dashed outlines of the true blob geometry. */
  showOutlines?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/* Overshoots past 1 mid-flight so blobs fling apart, then settle. */
const easeOutBack = (p: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
const easeInOutCubic = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/* Rest half-width of a blob. A circle is just a pill whose half-width equals
 * its radius, so everything renders as one rounded rect. Text blobs widen to
 * fit their glyphs (rough advance-width estimate — no DOM measuring needed). */
const PILL_FONT = 14.5;
const PILL_PAD_X = 20;
const halfWidthOf = (item: LiquidItem, R: number) => {
  if (item.width != null) return Math.max(R, item.width / 2);
  if (!item.text) return R; // circular
  const textW = item.text.length * PILL_FONT * 0.58;
  return Math.max(R, textW / 2 + PILL_PAD_X);
};

/* A blob's live animation state. Positions/scales are tweened imperatively
 * from (px, ps) toward (tx, ts) over `dur` ms starting at `start`. */
type Blob = {
  id: string;
  item: LiquidItem;
  hw: number; // rest half-width (R for circles, wider for pills)
  x: number; // current centre x
  s: number; // current scale (1 = full size)
  p: number; // current tween progress 0..1
  px: number; // tween-from x
  ps: number; // tween-from scale
  tx: number; // tween-to x
  ts: number; // tween-to scale (0 while dying)
  start: number;
  dur: number;
  ease: (p: number) => number;
  dying: boolean; // leaving — cull once its tween completes
};

export default function LiquidContainer({
  items,
  theme,
  blur = 15,
  contrast = 22,
  threshold = 9,
  radius = 46,
  gap = 40,
  swell = 0.2,
  width = 460,
  height = 280,
  onBackdrop,
  showOutlines = false,
  className,
  style,
}: LiquidContainerProps) {
  const uid = useId().replace(/[:]/g, "");
  const gooId = `goo-${uid}`;
  const gradId = `grad-${uid}`;
  const sheenId = `sheen-${uid}`;

  const CX = width / 2;
  const CY = height / 2 - 4;
  const R = radius;

  // Mutable animation store. Only ever touched inside effects / rAF — never
  // read or written during render (React 19 forbids ref access in render).
  const blobsRef = useRef<Map<string, Blob>>(new Map());
  const prevCountRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Latest items, kept fresh for effects (which run after render). Reconcile
  // reads this so it can key off the id-set alone without depending on the
  // array identity, which changes every render.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });

  // Render reads this snapshot (plain state), so nothing pulls from a ref
  // during render. The rAF loop republishes it each frame.
  const [view, setView] = useState<Blob[]>([]);
  const publish = useCallback(
    (map: Map<string, Blob>) => setView(Array.from(map.values())),
    [],
  );

  // Advance one blob to `now`; returns true while still animating.
  const advance = useCallback((b: Blob, now: number) => {
    const p = b.dur > 0 ? clamp01((now - b.start) / b.dur) : 1;
    const e = b.ease(p);
    b.p = p;
    b.x = b.px + (b.tx - b.px) * e;
    b.s = b.ps + (b.ts - b.ps) * e;
    return p < 1;
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) return;
    const step = (now: number) => {
      let active = false;
      const map = blobsRef.current;
      map.forEach((b, id) => {
        if (advance(b, now)) active = true;
        else if (b.dying) map.delete(id); // finished leaving → drop it
      });
      publish(map);
      if (active) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [advance, publish]);

  // Reconcile the requested items against what's on screen. Keyed by the set
  // of ids so it only re-runs when a blob actually appears or disappears.
  const idsKey = items.map((i) => i.id).join("|");
  useEffect(() => {
    const now = performance.now();
    const map = blobsRef.current;
    const current = new Map(itemsRef.current.map((i) => [i.id, i]));
    const live = Array.from(current.values());
    const N = live.length;
    const opening = N > prevCountRef.current;
    const ease = opening ? easeOutBack : easeInOutCubic;
    const dur = opening ? 640 : 440;

    // Width-aware, centre-justified row: pack the live blobs edge to edge with
    // `gap` between them, then centre the whole run on CX. Uniform circles
    // reduce to the old evenly-spaced layout; pills claim the width they need.
    const widths = live.map((item) => halfWidthOf(item, R));
    const rowWidth =
      widths.reduce((sum, hw) => sum + 2 * hw, 0) + gap * Math.max(0, N - 1);
    let cursor = CX - rowWidth / 2;

    live.forEach((item, i) => {
      const hw = widths[i];
      const targetX = cursor + hw;
      cursor += 2 * hw + gap;
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, {
          id: item.id,
          item,
          hw,
          x: CX,
          s: 0,
          p: 0,
          px: CX,
          ps: 0,
          tx: targetX,
          ts: 1,
          start: now,
          dur,
          ease,
          dying: false,
        });
      } else {
        existing.item = item;
        existing.hw = hw;
        // Only restart the tween if the target actually moved, so settled
        // blobs don't pulse when an unrelated sibling is added/removed.
        if (existing.tx !== targetX || existing.ts !== 1 || existing.dying) {
          existing.px = existing.x;
          existing.ps = existing.s;
          existing.tx = targetX;
          existing.ts = 1;
          existing.start = now;
          existing.dur = dur;
          existing.ease = ease;
          existing.dying = false;
        }
      }
    });

    // Anything no longer requested collapses back to the centre and merges.
    map.forEach((b) => {
      if (!current.has(b.id) && !b.dying) {
        b.px = b.x;
        b.ps = b.s;
        b.tx = CX;
        b.ts = 0;
        b.start = now;
        b.dur = 440;
        b.ease = easeInOutCubic;
        b.dying = true;
      }
    });

    prevCountRef.current = N;
    publish(map); // show the reconciled set right away, then animate it
    startLoop();
  }, [idsKey, CX, R, gap, publish, startLoop]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const blobs = view;
  // Live half-dimensions of a blob: scaled by its growth and swollen while
  // moving. `rad` is the half-height (and the fully-rounded corner radius);
  // `halfW` is the half-width — equal to `rad` for circles, larger for pills.
  const sizeOf = (b: Blob) => {
    const f = b.s * (1 + swell * Math.sin(Math.PI * b.p));
    return { rad: R * f, halfW: b.hw * f };
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor={theme.from} />
          <stop offset="100%" stopColor={theme.to} />
        </linearGradient>
        <radialGradient id={sheenId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </radialGradient>
        <filter id={gooId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${contrast} ${-threshold}`}
            result="goo"
          />
          {/* Paint the crisp source back on top so centres stay saturated. */}
          <feComposite in="SourceGraphic" in2="goo" operator="atop" result="sharp" />
          {/* Soft coloured halo — the "glass" glow. */}
          <feDropShadow
            in="sharp"
            dx="0"
            dy="0"
            stdDeviation="7"
            floodColor={theme.glow}
            floodOpacity={0.5}
          />
        </filter>
      </defs>

      {/* Backdrop — tap outside any blob. */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
        onPointerDown={onBackdrop ? () => onBackdrop() : undefined}
      />

      {/* The gooey body: every blob fused by the filter. A circle is just a
          pill whose width equals its height, so all blobs are rounded rects. */}
      <g filter={`url(#${gooId})`}>
        {blobs.map((b) => {
          const { rad, halfW } = sizeOf(b);
          return (
            <rect
              key={b.id}
              x={b.x - halfW}
              y={CY - rad}
              width={2 * halfW}
              height={2 * rad}
              rx={rad}
              ry={rad}
              fill={b.item.fill ?? `url(#${gradId})`}
            />
          );
        })}
      </g>

      {/* Crisp glass sheen, on top so the blur doesn't smear it. */}
      <g pointerEvents="none">
        {blobs.map((b) => {
          const { rad, halfW } = sizeOf(b);
          return (
            <ellipse
              key={b.id}
              cx={b.x}
              cy={CY - rad * 0.42}
              rx={halfW * 0.6}
              ry={rad * 0.3}
              fill={`url(#${sheenId})`}
              opacity={0.55 * clamp01(b.s)}
            />
          );
        })}
      </g>

      {/* Icons, inner pill text, and captions — crisp on top. */}
      <g pointerEvents="none">
        {blobs.map((b) => {
          const item = items.find((i) => i.id === b.id) ?? b.item;
          const { rad } = sizeOf(b);
          const s = clamp01(b.s);
          return (
            <g key={b.id}>
              {item.icon && (
                <g
                  transform={`translate(${b.x}, ${CY}) scale(${0.6 + 0.4 * s})`}
                  opacity={s}
                >
                  {item.icon(s)}
                </g>
              )}
              {item.text && (
                <text
                  x={b.x}
                  y={CY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  // Fade the label in only once the pill is mostly grown, so it
                  // doesn't overflow the still-small body mid-transition.
                  opacity={clamp01((b.s - 0.45) / 0.55)}
                  fontSize={PILL_FONT}
                  fontWeight={600}
                >
                  {item.text}
                </text>
              )}
              {item.label && (
                <text
                  x={b.x}
                  y={CY + rad + 26}
                  textAnchor="middle"
                  fill="#ffffff"
                  opacity={s * 0.75}
                  fontSize={13}
                  fontWeight={500}
                >
                  {item.label}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* True geometry overlay for debugging the pinch point. */}
      {showOutlines && (
        <g fill="none" stroke={theme.glow} strokeOpacity={0.6} strokeDasharray="4 4">
          {blobs.map((b) => {
            const { rad, halfW } = sizeOf(b);
            return (
              <rect
                key={b.id}
                x={b.x - halfW}
                y={CY - rad}
                width={2 * halfW}
                height={2 * rad}
                rx={rad}
                ry={rad}
              />
            );
          })}
        </g>
      )}

      {/* Hit targets, crisp and on top so taps land precisely. */}
      <g>
        {blobs.map((b) => {
          const item = items.find((i) => i.id === b.id);
          if (!item?.onClick || b.dying) return null;
          const onClick = item.onClick;
          const { rad, halfW } = sizeOf(b);
          return (
            <rect
              key={b.id}
              x={b.x - halfW}
              y={CY - rad}
              width={2 * halfW}
              height={2 * rad}
              rx={rad}
              ry={rad}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onClick();
              }}
            />
          );
        })}
      </g>
    </svg>
  );
}
