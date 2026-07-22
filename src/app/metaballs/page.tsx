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
          <h1 className="text-2xl font-semibold tracking-tight">Mitosis toolbar</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/55">
            One liquid-glass toolbar holding three icons. Tap it and the leftmost
            icon melts away while a fresh button <em>mitosises</em> out of the left
            side — the goo bridge stretches, thins, then pinches into a separate
            circle beside the remaining search + plus pill. Tap the bud (or the
            backdrop) to fuse it back. The goo surface is a reusable{" "}
            <code>&lt;LiquidContainer&gt;</code>; this page just controls which
            buttons live inside it.
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

        <section className="mt-2 flex flex-col gap-3 border-t border-white/10 pt-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight">Liquid chips</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-white/55">
              The same <code>&lt;LiquidContainer&gt;</code> holding an arbitrary,
              changing set of blobs — including pill-shaped <em>text</em> buttons.
              Tap a chip to drop it (it melts back into the row); tap the{" "}
              <span className="text-white/80">+</span> to grow the next one in. The
              row re-packs and re-centres itself as the set changes.
            </p>
          </div>
          <LiquidChips theme={theme} showOutlines={showOutlines} />
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Second demo: an arbitrary, changing set of pill/text buttons.
 *
 * This is the same container as above; the only difference is the items —
 * text pills instead of icon circles, and a count that the user drives up
 * and down. Nothing about the container is toolbar- or chip-specific.
 * ------------------------------------------------------------------ */

const CHIP_POOL: { id: string; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "someday", label: "Someday" },
  { id: "flagged", label: "Flagged" },
];

function LiquidChips({
  theme,
  showOutlines,
}: {
  theme: LiquidTheme;
  showOutlines: boolean;
}) {
  const [active, setActive] = useState<string[]>(["today", "week", "month"]);

  const items = useMemo<LiquidItem[]>(() => {
    const inactive = CHIP_POOL.filter((c) => !active.includes(c.id));
    const chips: LiquidItem[] = active.map((id) => {
      const chip = CHIP_POOL.find((c) => c.id === id)!;
      return {
        id: chip.id,
        text: chip.label,
        onClick: () => setActive((a) => a.filter((x) => x !== id)),
      };
    });
    // A circular "+" that grows the next inactive chip into the row.
    if (inactive.length > 0) {
      chips.push({
        id: "add",
        icon: () => <PlusIcon />,
        onClick: () => setActive((a) => [...a, inactive[0].id]),
      });
    }
    return chips;
  }, [active]);

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
          radius={28}
          // Wide rest gap keeps settled chips as separate pills; the extra
          // swell + the travel of a growing/melting chip still bridges the goo
          // mid-transition.
          gap={40}
          blur={10}
          contrast={22}
          threshold={9}
          swell={0.26}
          width={760}
          height={150}
          showOutlines={showOutlines}
          className="w-full touch-none select-none rounded-2xl"
          style={{
            background:
              "radial-gradient(120% 120% at 50% 0%, #12131c 0%, #05060a 70%)",
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          onClick={() => setActive(CHIP_POOL.map((c) => c.id))}
          className="rounded-lg bg-white/[0.07] px-3 py-1.5 font-medium text-white/80 transition hover:bg-white/[0.12]"
        >
          Fill all
        </button>
        <button
          onClick={() => setActive([])}
          className="rounded-lg bg-white/[0.07] px-3 py-1.5 font-medium text-white/80 transition hover:bg-white/[0.12]"
        >
          Clear
        </button>
        <span className="text-white/40">
          {active.length} of {CHIP_POOL.length} chips
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The mitosis demo, expressed purely as "which items are present".
 *
 * Merged  → [ list-circle ][ search + plus pill ]  — hugging with a tiny gap,
 *           so the goo fuses them into one continuous toolbar of three icons.
 * Split   → [ stack-circle ]      [ search + plus pill ]  — a wide gap, so the
 *           bridge pinches and the left cell buds off on its own.
 *
 * The "search + plus" pill (id "tools") lives in *both* sets, so it just slides
 * and stays put. The left cell swaps identity — the "list" blob dies (melting
 * back toward centre) while a new "menu" blob is born from the same spot — which
 * the goo renders as one dividing cell.
 * ------------------------------------------------------------------ */

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
  const [split, setSplit] = useState(false);

  const items = useMemo<LiquidItem[]>(() => {
    // The right-hand pill is identical in both states, so it persists.
    const tools: LiquidItem = {
      id: "tools",
      width: 150,
      icon: () => (
        <g>
          <g transform="translate(-30, 0)">
            <SearchIcon />
          </g>
          <g transform="translate(30, 0)">
            <ToolbarPlusIcon />
          </g>
        </g>
      ),
      onClick: () => setSplit((s) => !s),
    };

    if (!split) {
      // Three icons fused into one bar: list-circle hugging the tools pill.
      return [
        {
          id: "list",
          icon: () => <SidebarIcon />,
          onClick: () => setSplit(true),
        },
        tools,
      ];
    }

    // The bud has separated: its own circle, then the tools pill.
    return [
      {
        id: "menu",
        icon: () => <StackIcon />,
        onClick: () => setSplit(false),
      },
      tools,
    ];
  }, [split]);

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
          radius={40}
          // Overlap the pair while merged so they fuse into one seamless bar
          // (no pinched waist); pull them wide apart once split so the bud
          // clears the pill.
          gap={split ? 44 : -26}
          blur={blur}
          contrast={contrast}
          threshold={threshold}
          showOutlines={showOutlines}
          height={200}
          onBackdrop={split ? () => setSplit(false) : undefined}
          className="w-full touch-none select-none rounded-2xl"
          style={{
            background:
              "radial-gradient(120% 120% at 50% 0%, #12131c 0%, #05060a 70%)",
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          onClick={() => setSplit((s) => !s)}
          className="rounded-lg bg-white/[0.07] px-3 py-1.5 font-medium text-white/80 transition hover:bg-white/[0.12]"
        >
          {split ? "Merge back" : "Split ▸"}
        </button>
        <span className="text-white/40">
          {split
            ? "The bud has split off — tap it or the backdrop to fuse back."
            : "Tap the toolbar to bud a button off the left."}
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

/* A slimmer "+" for inside the tools pill (the page-level PlusIcon is used by
 * the chips demo, so keep it untouched). */
function ToolbarPlusIcon() {
  return (
    <g stroke="#ffffff" strokeWidth={2.6} strokeLinecap="round">
      <line x1={-9} y1={0} x2={9} y2={0} />
      <line x1={0} y1={-9} x2={0} y2={9} />
    </g>
  );
}

function SearchIcon() {
  return (
    <g fill="none" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round">
      <circle cx={-2} cy={-2} r={8} />
      <line x1={4} y1={4} x2={10} y2={10} />
    </g>
  );
}

/* Leftmost glyph while merged: a sidebar / list-detail panel (matches the
 * three-icon toolbar in the reference). */
function SidebarIcon() {
  return (
    <g
      fill="none"
      stroke="#ffffff"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x={-12} y={-11} width={24} height={22} rx={5} />
      <line x1={-3} y1={-11} x2={-3} y2={11} />
      <g stroke="none" fill="#ffffff">
        <circle cx={-8} cy={-5} r={1.4} />
        <circle cx={-8} cy={0} r={1.4} />
        <circle cx={-8} cy={5} r={1.4} />
      </g>
    </g>
  );
}

/* The daughter that buds off: two stacked rounded bars. */
function StackIcon() {
  return (
    <g fill="none" stroke="#ffffff" strokeWidth={2.4} strokeLinejoin="round">
      <rect x={-11} y={-9} width={22} height={7} rx={3.5} />
      <rect x={-11} y={2} width={22} height={7} rx={3.5} />
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
