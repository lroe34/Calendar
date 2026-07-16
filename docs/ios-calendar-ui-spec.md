# iOS Calendar — UI/Interaction Spec (Reference Doc)

Source: two reference screenshots (Month view of July 2026, Day view of Wed Jul 15 2026)
from an iPhone running the redesigned "Liquid Glass"-era Calendar app. This doc catalogs
every element and behavior visible or implied, plus the details that are easy to skip or
half-implement. This is the spec to build against — nothing gets built until this is
agreed on.

Status bar contents (Dynamic Island flight live-activity, battery, clock) are the OS
chrome, not the app — ignored below except where they affect safe-area layout.

---

## 0. Navigation hierarchy

- Three (visible) zoom levels: **Year → Month → Day**. Possibly Week as an intermediate,
  not shown in these screenshots but implied by the view-switcher icon changing shape
  between Month and Day contexts — treat as an open question (see §6).
- The back button top-left is a **breadcrumb, not a static "back" label**:
  - In Month view it reads `‹ 2026` (the year it belongs to).
  - In Day view it reads `‹ July` (the month it belongs to).
  - This means the label is computed from the current view's parent context, not hardcoded.
- Tapping a date cell in Month view navigates directly into Day view for that date
  (no separate "selected but not navigated" state persists in the month grid).
- Day view has its own mini week-strip (see §4.2) that lets you jump to another day
  within the same displayed week without leaving Day view.

---

## 1. Global chrome (shared between Month and Day)

### 1.1 Top nav bar
- Floating, pill-shaped (capsule) buttons on a blurred/frosted translucent background —
  content scrolls underneath and is visibly blurred through it, not an opaque bar.
- Left: back capsule — `‹ <parent context>` (chevron + label), light gray fill, fully rounded.
- Right: a single capsule grouping **three icons**: view-switcher, search (magnifying
  glass), add (`+`). All three share one pill container.
  - The view-switcher icon's glyph changes depending on current view (stacked-bars glyph
    in Month view vs. a column/list glyph in Day view) — it's likely a menu button that
    also visually indicates current mode, not a fixed icon. Confirm exact behavior (tap
    target: does it open a picker sheet for Day/Week/Month/Year, or cycle?) — flagged as
    open question in §6.
  - `+` opens event/reminder creation (not detailed in these screenshots — new event
    modal design TBD).

### 1.2 Bottom floating bar
- **Not one bar** — two independent floating pill elements, both frosted/blurred,
  both float above scrollable content (colored event bars are visibly blurred through
  the bottom-left "Today" pill in the month screenshot — confirms true material blur,
  not a solid-color bar).
  - Bottom-left: **"Today"** pill button — jumps current view to today (month containing
    today, or today in day view) and re-selects today's date.
  - Bottom-right: a second pill containing two icons — a small calendar-grid glyph
    (view/calendar picker) and an inbox/tray glyph (likely pending invitations/Inbox,
    a real iOS Calendar feature). Present in both Month and Day view, unchanged.

### 1.3 Materials & safe area
- Nav bar sits below the status bar/Dynamic Island with proper top safe-area padding —
  do not let content render under the island.
- Both top and bottom bars use real backdrop blur + translucency (`backdrop-filter:
  blur(...)` equivalent), with content scrolling underneath at full opacity.

---

## 2. Month view

### 2.1 Header
- Large bold month title ("July"), left-aligned, big/heavy weight (~34–40pt equivalent).
- Weekday-of-week row directly under title: single-letter labels `S M T W T F S`,
  small, gray, centered per column.
- **The current day-of-week column header is highlighted** even in month view — the
  "W" letter (Wednesday, since today is Wed) has a soft red/pink rounded-pill background
  behind it. This is easy to miss: the today-indicator isn't just the date-circle, it
  also tints the matching weekday-column header.

### 2.2 Grid structure
- **Continuous vertical scroll across month boundaries**, not a horizontally paged/swiped
  carousel. Scrolling past July 31 reveals an inline "Aug" section header and August's
  weeks directly below, in the same scroll — like a table view with sticky/inline section
  headers per month. Do not implement month view as swipeable discrete pages; it's one
  continuous scrollable list of weeks, with month-label headers injected between months.
- **ISO/ordinal week-number gutter**: small gray numbers (27, 28, 29, 30, 31, 32, 33) run
  down the left margin, one per week row, sitting roughly at each row's top divider.
- Thin horizontal divider lines separate week rows. No strong vertical gridlines between
  day columns (separation is by spacing only).
- Adjacent-month overflow dates (e.g. June 27–30 in July's first row) render in light
  gray, distinct from current-month dates in black. First row of July 2026 starts on
  Wednesday, so S/M/T cells in that row are empty (no leading-month numerals shown in the
  screenshot for that row — verify whether adjacent-month days are ever shown numerically
  in-grid or left blank; the partial "27" visible at the very top of the screenshot is the
  tail of the previous (June) row scrolled mostly off-screen, not a leading-days label in
  July's own row).
- **Row height is NOT fixed/uniform** — each week row auto-sizes to fit however many event
  bars + overflow text that week needs. A week with 2 bars + a "+N" line is taller than a
  lighter week. Do not hardcode a uniform 6-row grid height.

### 2.3 Today indicator
- Solid red filled circle behind the day number, white bold numeral. Applies only to
  the actual current date (not a generic "selected date" state — month view has no
  separate persistent selection highlight for non-today dates).

### 2.4 Event indicators (the part most likely to get half-assed)
- Events render as **thin horizontal colored bar/pill segments** stacked under the date
  number — not dots. (Older iOS Calendar used dots for timed events in month view; this
  redesign uses uniform pill bars for everything — timed events, all-day events, and
  multi-day spans all look like colored bars at this zoom level.)
- **Max 2 bars are rendered per day cell.** If a day has more than 2 events, show the
  first 2 bars and then a small gray `+N` count text below them for the remainder
  (e.g., a day with 5 events shows 2 bars + "+3"). Get this exact cutoff right — it's a
  precise, easy-to-guess-wrong number.
- **Multi-day / recurring-span events visually connect across adjacent day cells** — a
  bar of the same color in the same vertical slot on consecutive days reads as one
  continuous event bar spanning those days (e.g. a blue bar running through July 10–11,
  a lavender bar spanning July 17–18). The rendering needs to align same-event bars into
  the same vertical row position across the days they span so they visually connect,
  rather than each day independently stacking its own events top-to-bottom in arbitrary
  order (that would break the "spanning bar" illusion).
- **Two visual weights of bar exist**: solid/saturated (e.g. solid blue) vs. pale/pastel
  (e.g. light green, light gray, light tan). This likely encodes something semantic —
  candidates: all-day/background vs. timed/busy events, tentative vs. confirmed, or just
  distinct calendars with different opacity conventions. **This is ambiguous from the
  screenshot alone — flag as an open question (§6)** rather than guessing a specific
  mapping.
- Calendar color palette observed: green, blue, gray, tan/brown, purple/lavender, dark
  slate-blue. These map to distinct calendars in the data model.

---

## 3. Day view

### 3.1 Header stack
- Same top nav bar as month view, back button reads `‹ July`.
- **Mini week-strip**: a horizontal row of the current week's 7 dates (S M T W T F S
  labels above, date numbers below), with today's date shown in the same red-circle
  style as month view. This strip is its own control — tapping another date in it jumps
  Day view to that date; it likely also supports horizontal swipe to move to adjacent
  weeks. Keep this in sync with whatever date Day view is currently showing.
- Below the strip: a thin divider, then a row with the **ISO week number** ("W29") at
  left and a bold **"Wednesday – Jul 15, 2026"** date heading, roughly centered.

### 3.2 All-day lane
- Labeled "all-day" in small gray text, left-aligned in the hour gutter's column.
- All-day items render as **rounded pill chips** in a horizontal row (not full-width
  bars): e.g. a green pill "OOO" with a small calendar glyph inside, and a second pill
  "Send Bahrulla blogs" that uses an outlined circle glyph and lighter/grayer text —
  this second one reads as a **Reminder/task with a due date**, not a Calendar event,
  surfaced inline in the all-day lane. Distinguish event-vs-reminder styling (filled
  calendar icon + saturated color vs. outline circle + muted text) if reminders are in
  scope for the data model; otherwise explicitly scope them out rather than silently
  dropping the distinction.

### 3.3 Hour grid
- Left gutter: hour labels (`10 AM`, `11 AM`, `Noon`, `1 PM` … `9 PM`), small gray text,
  right-aligned against the gutter, one per hour line, with full-width faint horizontal
  gridlines at each hour across the event column.
- **Current-time indicator**: a red horizontal line spanning the full width of the grid
  at the current time, with a red pill/badge at the left end showing the current time
  (`6:42`) — this badge **overlaps and replaces** the nearest hour label in the gutter
  rather than coexisting alongside it. The red line is drawn on top of any event block it
  crosses (visible cutting through the flight event in the screenshot).
- Events are positioned by **continuous time offset, not snapped to the hour grid** — the
  "Hinge Health Exercise Therapy Session" block starts mid-hour (~4:30ish) proportionally
  between the 4 PM and 5 PM lines, not aligned to a line.

### 3.4 Event blocks
- Each event block has a **left-edge vertical color accent bar** (~3px) plus a lighter
  tinted fill of the same hue for the rest of the block (two-part coloring: solid accent
  + ~15–20%-opacity tint fill) — not a flat solid-color block.
- **Recurring events show a small looped-arrow icon** in the top-right of the block.
  One-time events (e.g. Hinge Health, the flight) do not have this icon. Don't drop this
  glyph — it's a distinct semantic marker from the color/shape.
- **Overlapping events lay out side-by-side in columns**, splitting the available width
  (visible with "Luke and Nathan…" + two "[EXTERN…]" events occupying the same ~10–11 AM
  slot as 3 equal-width columns). This requires real interval-overlap column-assignment
  logic (like calendar-collision algorithms), not naive full-width stacking. Narrow
  columns truncate titles with ellipsis (`[EXTERN...`).
- **Progressive disclosure by block height**: short-duration blocks show title text only
  (single or truncated line). Sufficiently tall blocks (long-duration events, e.g. the
  ~2h47m flight) reveal extra detail lines inside the block: a location line with a pin
  icon, and a time-range line with a clock icon. This is a height/duration-based
  threshold, not a fixed template — don't hardcode every event to always show 3 lines or
  always show 1 line.
- Block corner radius: rounded rect, consistent across all blocks regardless of size.

---

## 4. Shared components / cross-cutting concerns

| Component | Notes |
|---|---|
| Today red circle | Same visual token used in Month grid dates and Day view's mini week-strip. Keep as one shared component. |
| Calendar color | Per-calendar color assignment (green/blue/gray/tan/purple/slate) must be a data-model property, not hardcoded per view. |
| Recurring icon | Looped-arrow glyph, appears in Day view event blocks; verify whether Month view bars also need any recurrence marker (not clearly visible at that zoom level — likely no, since bars carry no icons). |
| Blur materials | Nav bar, bottom bars — both views, both need real translucency + blur with content scrolling beneath. |
| Truncation | Ellipsis truncation for both month "+N" overflow and narrow day-view overlapping columns. |

---

## 5. Data model implications (ICS-driven)

Given the ICS-style backing model (VEVENT-like), a few things this UI needs that a naive
ICS→UI mapping might miss:
- **Per-calendar color** (VCALENDAR-level or an `X-APPLE-CALENDAR-COLOR`-style property),
  independent of individual VEVENTs.
- **Event category distinguishing timed vs. all-day vs. multi-day** (DTSTART/DTEND with
  vs. without time components, and multi-day spans) — the month-view bar rendering and
  day-view all-day lane both depend on this classification.
- **RRULE presence** → drives the recurring-icon glyph in Day view.
- **A "reminder/task" concept separate from VEVENT** — confirmed in scope. The "Send
  Bahrulla blogs" item is a due-dated reminder (closer to VTODO than VEVENT): needs its
  own entity with due date + completion state, rendered with the outline-circle/muted-text
  treatment distinct from calendar events, and integrated into the all-day lane (and
  possibly Month view bars — unconfirmed, see §6 item 4 analog).
- **Overlap/collision data** needs to be computed at render time from start/end times per
  visible day — not something stored in the model, but the layout algorithm needs exact
  start/end (not just date) to do interval-graph column assignment.
- **Status/confidence field** if the pale-vs-solid bar distinction in Month view turns out
  to encode tentative/confirmed or busy/free (§6 open question) — would need a field for
  that if so.

---

## 6. Open questions — resolved

1. **Pale vs. solid event bars in Month view**: purely per-calendar color, not a status
   encoding. The user has two calendars whose assigned colors happen to differ in
   saturation — no busy/free or tentative/confirmed semantics to model. Bar
   color = calendar color, full stop.
2. **View-switcher icon**: cycles the Month view's density/rendering mode across four
   states — **Compact, Stacked, Detailed, List**. "Stacked" is what's shown in the
   reference screenshot (the default: up to 2 colored bars + "+N" overflow per day).
   The other three are new surface area to design (see §6.1 below) since no reference
   screenshot shows them yet.
3. **Reminders are in scope.** Due-dated reminders (VTODO-like, not VEVENT) surface
   inline in the Day view all-day lane (and presumably Month view bars) alongside
   Calendar events, visually distinguished by the outline-circle glyph + muted text
   treatment observed in §3.2. Data model needs a reminder/task entity distinct from
   VEVENT, with its own due date and completion state.
4. **Leading/trailing adjacent-month days in Month view** — still unconfirmed whether
   they render event bars; treat as blank (numerals only, grayed) until we see a
   screenshot proving otherwise. Low risk either way, cheap to adjust later.
5. **New event/reminder creation flow** (`+` button target) — still no reference
   screenshot; will design when we get there or when one is provided.
6. **Week view** — still unconfirmed whether it exists as a distinct zoom level (vs.
   being one of the four Month-view density modes above). Treat as out of scope for v1
   unless it turns out "List" mode effectively covers the same need.

### 6.1 New surface area from the density-mode answer

Since Month view has 4 density modes, not 1, each needs its own row-rendering spec
before it's "done" (not just Stacked, which is the only one currently documented in
§2.4):
- **Compact** — likely the smallest/highest-density mode: probably shrinks to plain
  dots (one per calendar with an event that day) with no "+N" text, closer to the
  classic pre-redesign iOS Calendar month view. Needs its own reference before building,
  otherwise this will get guessed.
- **Stacked** — documented in §2.4 (the screenshot we have).
- **Detailed** — likely shows event title text inside the month cell (not just color
  bars), meaning row height grows further and text truncation rules apply per event
  line. Needs its own reference.
- **List** — likely abandons the grid entirely for an agenda-style scrolling list of
  events grouped by date (this may be the same concept as "Week view" in question 6).
  Needs its own reference.

Do not silently implement only Stacked and call the view-switcher done — the switcher
should exist, be wired up, and at minimum degrade sensibly (e.g. Compact falls back to
dot-only rendering) even before all four are pixel-perfect.

---

## 6.2 Animations, gestures & micro-interactions

Everything above was derived from two static screenshots, which can prove layout and
color but cannot prove motion. Nothing in this section is "confirmed" the way §1–§5 are
— it's either an explicit unknown or a documented placeholder assumption (standard
iOS/UIKit convention) to implement now and correct once we can compare against the real
app in motion (ideally via screen recording).

**Unconfirmed — needs real reference before it can be called done:**
- Month-cell tap → Day view transition (cross-fade / push / morph-from-cell?).
- Day view horizontal swipe between adjacent days (finger-tracked live drag vs.
  animate-only-on-release).
- Month density-mode switch (Compact/Stacked/Detailed/List): hard cut or animated morph.
- Back-button pop direction/curve (Day→Month, Month→Year).
- Event-block tap → detail view presentation (sheet, push, or zoom-from-block).
- Drag-to-create and drag-to-resize/move on the Day view hour grid: snap increment,
  ghost/placeholder treatment, handle behavior.
- `+` button → creation sheet presentation style.
- Long-press behavior on dates/events (context menu / peek preview?).
- Current-time red line: continuous smooth creep vs. periodic re-render tick.

**Placeholder assumptions to build against now** (standard iOS platform conventions,
explicitly flagged as guesses, not spec):
- Scroll physics: native momentum + deceleration + rubber-band overscroll, approximated
  with normal browser scroll (no custom physics unless it feels wrong later).
- Transitions: short (~250–300ms) ease-out for view changes, spring-like (approximated
  via `cubic-bezier` or a spring lib) for anything that feels "alive" — to be tuned by
  feel, not by a number derived from a still image.
- "Today" button: animated scroll-to rather than instant jump.
- Haptics: real iOS fires haptic taps at drag-snap points, selection changes, and
  swipe-threshold crossings. A web app can only crudely approximate this (Vibration API,
  installed-PWA + supporting browser only) — treat haptic parity as inherently
  lower-fidelity, not a bug if it's absent in the browser.

Action item: a short screen recording (tap a month date, swipe between days, drag to
create/resize an event) would convert the "unconfirmed" list above into real spec. Until
then, those interactions get built to the placeholder/best-guess standard and are
expected to need correction.

## 7. Explicit "don't half-ass this" checklist

Concrete list of things that are easy to skip, approximate, or get subtly wrong:

- [ ] Month grid row heights are dynamic per-week, not fixed.
- [ ] Month view scrolls continuously across month boundaries (inline month headers),
      it is not a swipeable paged carousel.
- [ ] Exactly 2 event bars per day cell before switching to "+N" overflow text.
- [ ] Multi-day event bars align to the same vertical slot across the days they span so
      they visually connect as one bar.
- [ ] Today indicator also tints the matching weekday column header letter in Month view,
      not just the date circle.
- [ ] Week-number gutter column down the left side of Month view.
- [ ] Back button label is dynamic (parent context: year in Month view, month in Day view).
- [ ] Bottom bar is two separate floating pills, not one bar; both are real blurred
      material, not solid color.
- [ ] Current-time badge in Day view replaces/overlaps the nearest hour label rather than
      sitting beside it.
- [ ] Event positioning in Day view is continuous-time-based, not snapped to the hour grid.
- [ ] Overlapping Day-view events use real column-splitting layout (interval overlap
      algorithm), not naive vertical stacking or fixed 2-column assumptions.
- [ ] Recurring-event icon on Day view blocks, correctly present/absent per RRULE.
- [ ] Progressive detail disclosure inside event blocks based on rendered height/duration
      (title-only vs. title+location+time), not a fixed template per event.
- [ ] Two-part event block coloring: solid left accent bar + separate lighter tint fill.
- [ ] Mini week-strip in Day view is interactive/independent, not a static label row.
- [ ] All bars/blocks use per-calendar color pulled from the data model, never hardcoded
      per screen.
