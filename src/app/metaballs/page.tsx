"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

/* ------------------------------------------------------------------ *
 * Metaball playground
 *
 * The "blurred SVG trick": render solid shapes, blur them heavily with
 * feGaussianBlur so their soft edges bleed into each other, then run the
 * result through an feColorMatrix that cranks the alpha channel's contrast.
 * The blur turns two nearby circles into one continuous smear of
 * translucent alpha; the color matrix re-hardens that smear back into a
 * crisp silhouette. Where the blurs overlapped you get a smooth "goo"
 * bridge — a metaball. Pull the shapes apart and the bridge thins until
 * the alpha in the gap drops below the matrix threshold and it snaps.
 * ------------------------------------------------------------------ */

type Ball = { id: number; x: number; y: number; r: number };

type Theme = { name: string; from: string; to: string; glow: string };

const THEMES: Theme[] = [
  { name: "Sunset", from: "#ff8a3d", to: "#ff2d78", glow: "#ff5c7a" },
  { name: "Ocean", from: "#3dd6ff", to: "#4d7cff", glow: "#5aa8ff" },
  { name: "Lime", from: "#c6ff4d", to: "#18d47a", glow: "#7bff8a" },
  { name: "Grape", from: "#b06bff", to: "#5b3dff", glow: "#a07bff" },
];

const W = 760;
const H = 460;

let nextId = 100;
const makeId = () => ++nextId;

/* ------------------------------------------------------------------ */

export default function MetaballPlaygroundPage() {
  const [tab, setTab] = useState<"playground" | "capsule">("playground");

  // Shared goo-filter parameters, tuned live from the control panel.
  const [blur, setBlur] = useState(15);
  const [contrast, setContrast] = useState(22);
  const [threshold, setThreshold] = useState(9);
  const [showOutlines, setShowOutlines] = useState(false);
  const [themeIdx, setThemeIdx] = useState(0);
  const theme = THEMES[themeIdx];

  return (
    <div className="h-full overflow-y-auto bg-[#05060a] text-white">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-5 py-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Metaball playground</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/55">
            SVG metaballs via the blurred-shape trick: heavy Gaussian blur bleeds
            neighbouring circles together, then an alpha-contrast color matrix
            re-sharpens the silhouette. Drag the blobs, tune the goo, or split a
            capsule back into two circles.
          </p>
        </header>

        <div className="flex gap-1 rounded-xl bg-white/[0.06] p-1 text-sm font-medium w-fit">
          <TabButton active={tab === "playground"} onClick={() => setTab("playground")}>
            Playground
          </TabButton>
          <TabButton active={tab === "capsule"} onClick={() => setTab("capsule")}>
            Capsule split
          </TabButton>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0">
            {tab === "playground" ? (
              <Playground
                blur={blur}
                contrast={contrast}
                threshold={threshold}
                showOutlines={showOutlines}
                theme={theme}
              />
            ) : (
              <CapsuleSplit
                blur={blur}
                contrast={contrast}
                threshold={threshold}
                showOutlines={showOutlines}
                theme={theme}
              />
            )}
          </div>

          <ControlPanel
            blur={blur}
            setBlur={setBlur}
            contrast={contrast}
            setContrast={setContrast}
            threshold={threshold}
            setThreshold={setThreshold}
            showOutlines={showOutlines}
            setShowOutlines={setShowOutlines}
            themeIdx={themeIdx}
            setThemeIdx={setThemeIdx}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The goo <svg>. Reused by both tabs. Renders circles inside a
 * filtered group; an optional outline overlay shows the true geometry.
 * ------------------------------------------------------------------ */

type GooProps = {
  balls: Ball[];
  blur: number;
  contrast: number;
  threshold: number;
  showOutlines: boolean;
  theme: Theme;
  onBallDown?: (id: number, e: ReactPointerEvent<SVGCircleElement>) => void;
  onBackgroundDown?: (e: ReactPointerEvent<SVGRectElement>) => void;
  activeId?: number | null;
  svgRef?: React.Ref<SVGSVGElement>;
};

function GooCanvas({
  balls,
  blur,
  contrast,
  threshold,
  showOutlines,
  theme,
  onBallDown,
  onBackgroundDown,
  activeId,
  svgRef,
}: GooProps) {
  // useId keeps filter/gradient ids unique when two canvases share a page.
  const uid = useId().replace(/[:]/g, "");
  const gooId = `goo-${uid}`;
  const gradId = `grad-${uid}`;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-none select-none rounded-2xl"
      style={{ background: "radial-gradient(120% 120% at 50% 0%, #12131c 0%, #05060a 70%)" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={theme.from} />
          <stop offset="100%" stopColor={theme.to} />
        </linearGradient>
        <filter id={gooId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${contrast} ${-threshold}`}
            result="goo"
          />
          {/* Paint the crisp source back on top so centres stay saturated. */}
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>

      {/* Background hit target — pointer-down on empty space. */}
      <rect
        x={0}
        y={0}
        width={W}
        height={H}
        fill="transparent"
        onPointerDown={onBackgroundDown}
      />

      <g filter={`url(#${gooId})`}>
        {balls.map((b) => (
          <circle
            key={b.id}
            cx={b.x}
            cy={b.y}
            r={b.r}
            fill={`url(#${gradId})`}
            style={{ cursor: onBallDown ? "grab" : "default" }}
            onPointerDown={onBallDown ? (e) => onBallDown(b.id, e) : undefined}
          />
        ))}
      </g>

      {showOutlines && (
        <g fill="none" stroke="#ffffff" strokeOpacity={0.5} strokeDasharray="4 4">
          {balls.map((b) => (
            <circle
              key={b.id}
              cx={b.x}
              cy={b.y}
              r={b.r}
              stroke={b.id === activeId ? theme.glow : "#ffffff"}
              strokeOpacity={b.id === activeId ? 0.95 : 0.4}
            />
          ))}
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Tab 1: free-form playground — drag, add, resize, remove blobs.
 * ------------------------------------------------------------------ */

const PRESETS: Record<string, () => Ball[]> = {
  Capsule: () => [
    { id: makeId(), x: W / 2 - 55, y: H / 2, r: 60 },
    { id: makeId(), x: W / 2 + 55, y: H / 2, r: 60 },
  ],
  Cluster: () => [
    { id: makeId(), x: W / 2, y: H / 2, r: 70 },
    { id: makeId(), x: W / 2 - 80, y: H / 2 - 50, r: 42 },
    { id: makeId(), x: W / 2 + 80, y: H / 2 - 40, r: 48 },
    { id: makeId(), x: W / 2 + 40, y: H / 2 + 70, r: 40 },
  ],
  Chain: () =>
    [0, 1, 2, 3, 4].map((i) => ({
      id: makeId(),
      x: 150 + i * 115,
      y: H / 2 + (i % 2 ? 34 : -34),
      r: 46,
    })),
};

function Playground(props: {
  blur: number;
  contrast: number;
  threshold: number;
  showOutlines: boolean;
  theme: Theme;
}) {
  const [balls, setBalls] = useState<Ball[]>(() => PRESETS.Capsule());
  const [activeId, setActiveId] = useState<number | null>(null);
  const [newRadius, setNewRadius] = useState(52);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: number; dx: number; dy: number } | null>(null);

  // Map a pointer event into the svg's viewBox coordinate space.
  const toLocal = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }, []);

  const onBallDown = useCallback(
    (id: number, e: ReactPointerEvent<SVGCircleElement>) => {
      e.stopPropagation();
      const ball = balls.find((b) => b.id === id);
      if (!ball) return;
      const p = toLocal(e.clientX, e.clientY);
      dragRef.current = { id, dx: p.x - ball.x, dy: p.y - ball.y };
      setActiveId(id);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [balls, toLocal],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const p = toLocal(e.clientX, e.clientY);
      setBalls((prev) =>
        prev.map((b) =>
          b.id === drag.id
            ? {
                ...b,
                x: clamp(p.x - drag.dx, b.r, W - b.r),
                y: clamp(p.y - drag.dy, b.r, H - b.r),
              }
            : b,
        ),
      );
    },
    [toLocal],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onBackgroundDown = useCallback(
    (e: ReactPointerEvent<SVGRectElement>) => {
      const p = toLocal(e.clientX, e.clientY);
      const id = makeId();
      setBalls((prev) => [
        ...prev,
        {
          id,
          x: clamp(p.x, newRadius, W - newRadius),
          y: clamp(p.y, newRadius, H - newRadius),
          r: newRadius,
        },
      ]);
      setActiveId(id);
    },
    [newRadius, toLocal],
  );

  const removeActive = () => {
    if (activeId == null) return;
    setBalls((prev) => prev.filter((b) => b.id !== activeId));
    setActiveId(null);
  };

  const resizeActive = (r: number) => {
    setBalls((prev) =>
      prev.map((b) =>
        b.id === activeId
          ? { ...b, r, x: clamp(b.x, r, W - r), y: clamp(b.y, r, H - r) }
          : b,
      ),
    );
  };

  const active = balls.find((b) => b.id === activeId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <GooCanvas
          {...props}
          balls={balls}
          svgRef={svgRef}
          activeId={activeId}
          onBallDown={onBallDown}
          onBackgroundDown={onBackgroundDown}
        />
      </div>

      <p className="text-xs text-white/40">
        Click empty space to drop a blob · drag to move · select one to resize or delete.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {Object.keys(PRESETS).map((name) => (
          <button
            key={name}
            onClick={() => {
              setBalls(PRESETS[name]());
              setActiveId(null);
            }}
            className="rounded-lg bg-white/[0.07] px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.12]"
          >
            {name}
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-white/10" />
        <button
          onClick={removeActive}
          disabled={!active}
          className="rounded-lg bg-white/[0.07] px-3 py-1.5 text-sm font-medium text-white/80 transition enabled:hover:bg-rose-500/30 disabled:opacity-35"
        >
          Delete selected
        </button>
        <button
          onClick={() => {
            setBalls([]);
            setActiveId(null);
          }}
          className="rounded-lg bg-white/[0.07] px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.12]"
        >
          Clear
        </button>
      </div>

      <div className="rounded-xl bg-white/[0.04] p-3">
        <Slider
          label={active ? "Selected radius" : "New blob radius"}
          value={active ? active.r : newRadius}
          min={20}
          max={110}
          step={1}
          unit="px"
          onChange={(v) => (active ? resizeActive(v) : setNewRadius(v))}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Tab 2: the capsule split — two circles on a separation track.
 * At 0 gap they read as one capsule; drag them apart and the goo
 * bridge thins, then snaps into two independent circles.
 * ------------------------------------------------------------------ */

function CapsuleSplit(props: {
  blur: number;
  contrast: number;
  threshold: number;
  showOutlines: boolean;
  theme: Theme;
}) {
  const [radius, setRadius] = useState(62);
  const [separation, setSeparation] = useState(70);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Auto mode oscillates the separation for a hypnotic merge/split loop.
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const min = 40;
    const max = 320;
    const loop = (now: number) => {
      const t = (now - start) / 2600; // ~2.6s period
      const s = min + ((max - min) * (1 - Math.cos(t * Math.PI * 2))) / 2;
      setSeparation(Math.round(s));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  const balls: Ball[] = useMemo(
    () => [
      { id: 1, x: W / 2 - separation / 2, y: H / 2, r: radius },
      { id: 2, x: W / 2 + separation / 2, y: H / 2, r: radius },
    ],
    [separation, radius],
  );

  // Surface gap: negative = overlapping, positive = a real gap between edges.
  const surfaceGap = Math.round(separation - 2 * radius);
  const state =
    surfaceGap <= 0
      ? { label: "Capsule", tone: "text-emerald-300" }
      : surfaceGap < props.blur * 1.6
        ? { label: "Bridged", tone: "text-amber-300" }
        : { label: "Split", tone: "text-rose-300" };

  return (
    <div className="flex flex-col gap-3">
      <GooCanvas {...props} balls={balls} />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-white/50">State:</span>
        <span className={`font-semibold ${state.tone}`}>{state.label}</span>
        <span className="text-white/35">
          surface gap {surfaceGap > 0 ? `+${surfaceGap}` : surfaceGap}px
        </span>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="ml-auto rounded-lg bg-white/[0.07] px-3 py-1.5 font-medium text-white/80 transition hover:bg-white/[0.12]"
        >
          {playing ? "Pause" : "Auto split ▸"}
        </button>
      </div>

      <div className="rounded-xl bg-white/[0.04] p-3">
        <Slider
          label="Separation"
          value={separation}
          min={0}
          max={360}
          step={1}
          unit="px"
          onChange={(v) => {
            setPlaying(false);
            setSeparation(v);
          }}
        />
        <Slider
          label="Radius"
          value={radius}
          min={30}
          max={90}
          step={1}
          unit="px"
          onChange={setRadius}
        />
      </div>

      <p className="text-xs leading-relaxed text-white/40">
        The bridge survives while the blurred alpha across the gap still clears the
        color-matrix threshold — so a bigger <em>Blur</em> keeps the capsule joined
        over a wider gap, and a higher <em>Threshold</em> makes it snap sooner.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Shared controls for the goo filter parameters.
 * ------------------------------------------------------------------ */

function ControlPanel(props: {
  blur: number;
  setBlur: (v: number) => void;
  contrast: number;
  setContrast: (v: number) => void;
  threshold: number;
  setThreshold: (v: number) => void;
  showOutlines: boolean;
  setShowOutlines: (v: boolean) => void;
  themeIdx: number;
  setThemeIdx: (v: number) => void;
}) {
  return (
    <aside className="flex h-fit flex-col gap-4 rounded-2xl bg-white/[0.04] p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
        Goo filter
      </h2>

      <Slider
        label="Blur"
        hint="feGaussianBlur stdDeviation"
        value={props.blur}
        min={1}
        max={40}
        step={0.5}
        onChange={props.setBlur}
      />
      <Slider
        label="Contrast"
        hint="alpha multiplier"
        value={props.contrast}
        min={1}
        max={60}
        step={1}
        onChange={props.setContrast}
      />
      <Slider
        label="Threshold"
        hint="alpha offset"
        value={props.threshold}
        min={0}
        max={40}
        step={0.5}
        onChange={props.setThreshold}
      />

      <label className="flex items-center justify-between gap-2 text-sm text-white/70">
        <span>Show outlines</span>
        <input
          type="checkbox"
          checked={props.showOutlines}
          onChange={(e) => props.setShowOutlines(e.target.checked)}
          className="h-4 w-4 accent-white"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Theme
        </span>
        <div className="grid grid-cols-4 gap-2">
          {THEMES.map((t, i) => (
            <button
              key={t.name}
              title={t.name}
              onClick={() => props.setThemeIdx(i)}
              className={`h-8 rounded-lg ring-2 transition ${
                props.themeIdx === i ? "ring-white" : "ring-transparent"
              }`}
              style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
            />
          ))}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-white/35">
        Blur bleeds shapes together; contrast + threshold re-harden the merged
        alpha into a crisp metaball edge.
      </p>
    </aside>
  );
}

/* ------------------------------------------------------------------ *
 * Small primitives.
 * ------------------------------------------------------------------ */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3.5 py-1.5 transition ${
        active ? "bg-white text-black" : "text-white/60 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-sm text-white/70">
        <span>
          {label}
          {hint && <span className="ml-1.5 text-[11px] text-white/30">{hint}</span>}
        </span>
        <span className="tabular-nums text-white/50">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-white"
      />
    </label>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
