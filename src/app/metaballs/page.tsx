"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

/* ------------------------------------------------------------------ *
 * Liquid-glass mitosis button
 *
 * The "blurred SVG trick": render solid shapes, blur them heavily with
 * feGaussianBlur so their soft edges bleed into each other, then run the
 * result through an feColorMatrix that cranks the alpha channel's contrast.
 * The blur turns two nearby circles into one continuous smear of
 * translucent alpha; the color matrix re-hardens that smear back into a
 * crisp silhouette. Where the blurs overlapped you get a smooth "goo"
 * bridge — a metaball. Pull the shapes apart and the bridge thins until
 * the alpha in the gap drops below the matrix threshold and it snaps.
 *
 * Here we drive that with a single interactive control: one circle that,
 * on tap, elongates and pinches into two circles of the *same* radius —
 * cell mitosis — each becoming its own button.
 * ------------------------------------------------------------------ */

type Theme = { name: string; from: string; to: string; glow: string };

const THEMES: Theme[] = [
  { name: "Sunset", from: "#ff8a3d", to: "#ff2d78", glow: "#ff5c7a" },
  { name: "Ocean", from: "#3dd6ff", to: "#4d7cff", glow: "#5aa8ff" },
  { name: "Lime", from: "#c6ff4d", to: "#18d47a", glow: "#7bff8a" },
  { name: "Grape", from: "#b06bff", to: "#5b3dff", glow: "#a07bff" },
];

/* ------------------------------------------------------------------ */

export default function MetaballPage() {
  // Shared goo-filter parameters, tuned live from the control panel.
  const [blur, setBlur] = useState(15);
  const [contrast, setContrast] = useState(22);
  const [threshold, setThreshold] = useState(9);
  const [showOutlines, setShowOutlines] = useState(false);
  const [themeIdx, setThemeIdx] = useState(1);
  const theme = THEMES[themeIdx];

  return (
    <div className="h-full overflow-y-auto bg-[#05060a] text-white">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-5 py-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mitosis button</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/55">
            A single liquid-glass circle that splits into two of the same size —
            like a dividing cell. Tap it and the goo bridge stretches, thins, then
            snaps into two independent buttons. Tap either choice to merge back.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0">
            <MitosisButton
              blur={blur}
              contrast={contrast}
              threshold={threshold}
              showOutlines={showOutlines}
              theme={theme}
            />
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
 * The mitosis stage.
 *
 * Two circles of equal radius R sit on a shared horizontal axis. A single
 * progress value `t` in [0, 1] drives everything:
 *   t = 0  → both centres coincide → one circle (the parent cell).
 *   t = 1  → centres are SPLIT apart → two distinct circles (daughters).
 * The goo filter keeps them fused across the middle of that journey, so
 * the visible shape morphs peanut → dumbbell → pinch → two circles.
 * ------------------------------------------------------------------ */

const VB_W = 460;
const VB_H = 280;
const CX = VB_W / 2;
const CY = VB_H / 2 - 4;
const R = 46;
// Centre separation at full split: two radii plus a clean gap between edges.
const SPLIT = 2 * R + 40;

// Overshoots past 1 mid-flight so the daughters fling apart, then settle.
const easeOutBack = (p: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
const easeInOutCubic = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

type Choice = "event" | "reminder";

function MitosisButton({
  blur,
  contrast,
  threshold,
  showOutlines,
  theme,
}: {
  blur: number;
  contrast: number;
  threshold: number;
  showOutlines: boolean;
  theme: Theme;
}) {
  const uid = useId().replace(/[:]/g, "");
  const gooId = `goo-${uid}`;
  const gradId = `grad-${uid}`;
  const sheenId = `sheen-${uid}`;

  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);

  // `t` is animated imperatively; tRef holds the live value so a new
  // toggle can spring from wherever the last one left off.
  const [t, setT] = useState(0);
  const tRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const runTo = useCallback((to: number) => {
    const from = tRef.current;
    const opening = to > from;
    const start = performance.now();
    const dur = opening ? 640 : 440;
    const ease = opening ? easeOutBack : easeInOutCubic;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const v = from + (to - from) * ease(p);
      tRef.current = v;
      setT(v);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    runTo(open ? 1 : 0);
  }, [open, runTo]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const sep = SPLIT * Math.max(0, t);
  const leftX = CX - sep / 2;
  const rightX = CX + sep / 2;

  // Swell the cells mid-flight: a bump that's 0 at rest (t=0 and t=1) and
  // peaks around the pinch/merge point, so the buttons scale up while the
  // split or join is in motion, then settle back to their resting radius.
  const bump = Math.sin(Math.PI * clamp01(t));
  const Rr = R * (1 + 0.2 * bump);

  // Cross-fade the parent's "+" out as the daughters' icons fade in.
  const plusOpacity = clamp01(1 - t * 2.2);
  const optionOpacity = clamp01((t - 0.45) / 0.55);

  const select = (kind: Choice) => {
    setChoice(kind);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-2xl p-px"
        style={{
          background:
            "linear-gradient(160deg, rgba(255,255,255,0.16), rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.08))",
        }}
      >
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full touch-none select-none rounded-2xl"
          style={{
            background:
              "radial-gradient(120% 120% at 50% 0%, #12131c 0%, #05060a 70%)",
          }}
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

          {/* Background — tap outside an open button to merge back. */}
          <rect
            x={0}
            y={0}
            width={VB_W}
            height={VB_H}
            fill="transparent"
            onPointerDown={open ? () => setOpen(false) : undefined}
          />

          {/* The gooey body: two equal circles fused by the filter. */}
          <g filter={`url(#${gooId})`}>
            <circle cx={leftX} cy={CY} r={Rr} fill={`url(#${gradId})`} />
            <circle cx={rightX} cy={CY} r={Rr} fill={`url(#${gradId})`} />
          </g>

          {/* Crisp glass sheen, drawn on top so the blur doesn't smear it. */}
          <g pointerEvents="none">
            <ellipse
              cx={leftX}
              cy={CY - Rr * 0.42}
              rx={Rr * 0.52}
              ry={Rr * 0.3}
              fill={`url(#${sheenId})`}
              opacity={0.55}
            />
            <ellipse
              cx={rightX}
              cy={CY - Rr * 0.42}
              rx={Rr * 0.52}
              ry={Rr * 0.3}
              fill={`url(#${sheenId})`}
              opacity={0.55}
            />
          </g>

          {/* Icons. Parent "+" cross-fades into the two daughter glyphs. */}
          <g pointerEvents="none">
            <g
              transform={`translate(${CX}, ${CY}) rotate(${t * 45}) scale(${1 - t * 0.25})`}
              opacity={plusOpacity}
            >
              <PlusIcon />
            </g>

            <g
              transform={`translate(${leftX}, ${CY}) scale(${0.6 + 0.4 * optionOpacity})`}
              opacity={optionOpacity}
            >
              <CalendarIcon />
            </g>
            <g
              transform={`translate(${rightX}, ${CY}) scale(${0.6 + 0.4 * optionOpacity})`}
              opacity={optionOpacity}
            >
              <ClockIcon />
            </g>

            {/* Labels under the daughters. */}
            <text
              x={leftX}
              y={CY + Rr + 26}
              textAnchor="middle"
              fill="#ffffff"
              opacity={optionOpacity * 0.75}
              fontSize={13}
              fontWeight={500}
            >
              Event
            </text>
            <text
              x={rightX}
              y={CY + Rr + 26}
              textAnchor="middle"
              fill="#ffffff"
              opacity={optionOpacity * 0.75}
              fontSize={13}
              fontWeight={500}
            >
              Reminder
            </text>
          </g>

          {/* True geometry overlay for debugging the pinch point. */}
          {showOutlines && (
            <g fill="none" stroke={theme.glow} strokeOpacity={0.6} strokeDasharray="4 4">
              <circle cx={leftX} cy={CY} r={Rr} />
              <circle cx={rightX} cy={CY} r={Rr} />
            </g>
          )}

          {/* Hit targets, crisp and on top so taps land precisely. */}
          {open ? (
            <g>
              <circle
                cx={leftX}
                cy={CY}
                r={Rr}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  select("event");
                }}
              />
              <circle
                cx={rightX}
                cy={CY}
                r={Rr}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  select("reminder");
                }}
              />
            </g>
          ) : (
            <circle
              cx={CX}
              cy={CY}
              r={Rr}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                setChoice(null);
                setOpen(true);
              }}
            />
          )}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          onClick={() => (open ? setOpen(false) : (setChoice(null), setOpen(true)))}
          className="rounded-lg bg-white/[0.07] px-3 py-1.5 font-medium text-white/80 transition hover:bg-white/[0.12]"
        >
          {open ? "Merge back" : "Split ▸"}
        </button>
        <span className="text-white/40">
          {open
            ? "Pick a daughter — or tap the backdrop to merge."
            : choice
              ? `Created a ${choice}.`
              : "Tap the cell to divide."}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-white/40">
        The bridge survives while the blurred alpha across the gap still clears the
        color-matrix threshold — so a bigger <em>Blur</em> keeps the cell joined
        further into the split, and a higher <em>Threshold</em> makes it pinch off
        sooner.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Line icons, drawn centred on (0, 0) so a parent <g> can place them.
 * ------------------------------------------------------------------ */

function PlusIcon() {
  return (
    <g stroke="#ffffff" strokeWidth={3} strokeLinecap="round">
      <line x1={-12} y1={0} x2={12} y2={0} />
      <line x1={0} y1={-12} x2={0} y2={12} />
    </g>
  );
}

function CalendarIcon() {
  return (
    <g
      fill="none"
      stroke="#ffffff"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x={-12} y={-9} width={24} height={21} rx={3.5} />
      <line x1={-12} y1={-2} x2={12} y2={-2} />
      <line x1={-6} y1={-14} x2={-6} y2={-6} />
      <line x1={6} y1={-14} x2={6} y2={-6} />
    </g>
  );
}

function ClockIcon() {
  return (
    <g
      fill="none"
      stroke="#ffffff"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={0} cy={0} r={12} />
      <line x1={0} y1={0} x2={0} y2={-7} />
      <line x1={0} y1={0} x2={6} y2={3} />
    </g>
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
        <span>Show geometry</span>
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
        Blur bleeds the two cells together; contrast + threshold re-harden the
        merged alpha into a crisp metaball edge.
      </p>
    </aside>
  );
}

/* ------------------------------------------------------------------ *
 * Small primitives.
 * ------------------------------------------------------------------ */

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
