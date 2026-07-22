"use client";

import { useMemo, useState } from "react";
import LiquidContainer, {
  type LiquidItem,
  type LiquidTheme,
} from "./LiquidContainer";

/* ------------------------------------------------------------------ *
 * Liquid-glass mitosis button
 *
 * The goo effect itself now lives in <LiquidContainer>: hand it the list of
 * buttons that should be present and it fuses/splits them with the blurred-
 * SVG metaball trick. This page is just a consumer — it decides *which*
 * blobs exist (one "+" when closed; Event + Reminder when open) and the
 * container animates the transition between those sets.
 * ------------------------------------------------------------------ */

type NamedTheme = LiquidTheme & { name: string };

const THEMES: NamedTheme[] = [
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
            The goo surface is a reusable <code>&lt;LiquidContainer&gt;</code>; this
            page just controls which buttons live inside it.
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
 * The mitosis demo, expressed purely as "which items are present".
 * ------------------------------------------------------------------ */

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
  theme: LiquidTheme;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);

  const select = (kind: Choice) => {
    setChoice(kind);
    setOpen(false);
  };

  // Closed → one "+" cell. Open → two daughter cells. Swapping the array is
  // all it takes; the container tweens the split/merge.
  const items = useMemo<LiquidItem[]>(() => {
    if (!open) {
      return [
        {
          id: "seed",
          icon: () => <PlusIcon />,
          onClick: () => {
            setChoice(null);
            setOpen(true);
          },
        },
      ];
    }
    return [
      {
        id: "event",
        icon: () => <CalendarIcon />,
        label: "Event",
        onClick: () => select("event"),
      },
      {
        id: "reminder",
        icon: () => <ClockIcon />,
        label: "Reminder",
        onClick: () => select("reminder"),
      },
    ];
  }, [open]);

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-2xl p-px"
        style={{
          background:
            "linear-gradient(160deg, rgba(255,255,255,0.16), rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.08))",
        }}
      >
        <LiquidContainer
          items={items}
          theme={theme}
          blur={blur}
          contrast={contrast}
          threshold={threshold}
          showOutlines={showOutlines}
          onBackdrop={open ? () => setOpen(false) : undefined}
          className="w-full touch-none select-none rounded-2xl"
          style={{
            background:
              "radial-gradient(120% 120% at 50% 0%, #12131c 0%, #05060a 70%)",
          }}
        />
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
