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
- **Months do not share a row at their boundary, confirmed via a follow-up close-up
  screenshot.** A month's own grid is entirely self-contained: its last row stops at its
  own last calendar day (trailing columns for the next month are simply blank — no
  number, no bars, not even grayed-out), and the next month's first row starts fresh,
  padded with blank leading columns up to whatever weekday its 1st falls on. There is no
  "adjacent-month overflow date" rendering at all (superseding the original open
  question about whether adjacent-month days show grayed numbers — they don't, they
  just aren't shown in either month's grid).
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
- Each event block has a **left-edge vertical color accent, rendered as an inset rounded
  capsule** (not a flush full-height border/bar) — inset a few px from the block's top,
  bottom, and left edges, rounded-full caps — plus a lighter tinted fill of the same hue
  for the rest of the block (two-part coloring: solid accent capsule + ~15–20%-opacity
  tint fill) — not a flat solid-color block, and not a flush edge-to-edge bar. Confirmed
  via a close-up follow-up screenshot.
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

## 3.5 Day view — long-press to move & resize an event (edit-on-grid)

Reference: a cropped close-up of the Day-view hour grid (roughly the 1 PM–3 PM window)
captured mid-gesture, while a recurring "Allergy Shots" event is being dragged to a new
time. This is a *different* editing affordance from the detail-sheet edit mode (§3.7):
that one edits fields inside a modal sheet; this one directly manipulates the block *in
place* on the grid. Both must exist. This resolves the two items previously flagged
"unconfirmed" in §6.2 ("long-press behavior on events" and "drag-to-resize/move on the
Day view hour grid") — see the updated §6.2.

### 3.5.1 What the reference image shows

- **Two copies of the same event are on screen at once.** The upper one — starting at
  ~1 PM — is a **faded "ghost"**: the normal Day-view tint block (§3.4), same blue
  left-accent capsule, same title/location/recurrence-icon content, but rendered at
  reduced opacity so it reads as a placeholder for where the event *currently still
  lives*. The lower one — starting at ~2 PM — is the **picked-up copy** under the finger:
  a fully **saturated solid-blue fill with white text** (title bold white, location line
  a lighter white, recurrence looped-arrow icon white in the top-right), i.e. the same
  inverted "solid" restyle already built for the detail sheet's mini day-preview (§3.6.5,
  `variant="solid"` on `EventBlock`).
- **Two circular white drag handles** sit on the picked-up copy: one on the **top-right
  corner**, one on the **bottom-left corner**. Small filled white discs with a soft
  shadow, straddling the block's edge.
- **A sub-hour marker "`:45`" has appeared in the left gutter** between the `1 PM` and
  `2 PM` hour labels, in the same gray gutter type style but minute-only (no AM/PM).
  It sits ~¾ of the way down the 1 PM→2 PM interval, i.e. aligned to the block edge the
  gesture is currently moving. This is the 15/30/45 tick the interaction exposes while
  dragging (see §3.5.5).
- **A soft green vertical accent runs down the extreme left edge** of the crop (left of
  the gutter numbers), with a faint green tint bleeding in at the very top-left.
  Ambiguous from this crop alone — most likely an unrelated green-calendar event sitting
  just above and cropped off, rather than a deliberate part of the edit affordance.
  Flag as an open question (§3.5.8) rather than building a green "edit is active" edge
  indicator off one partial frame.

### 3.5.2 The gesture / interaction model (as described)

- **Entry: long-press on an event block** in Day view puts that event into a
  direct-manipulation edit state on the grid (distinct from tapping, which opens the
  detail sheet §3.6, and distinct from the sheet's "Edit" button). iOS convention pairs
  this with a haptic "pop" on pickup — approximate per §6.2's haptics note.
- **Drag the body to reschedule**: moving the picked-up block up/down retimes the event,
  keeping its duration fixed. (Whether horizontal drag can move it across days is not
  shown in this single-day crop — treat cross-day drag as an open question, §3.5.8.)
- **Resize via the two handles**: the **top-right handle adjusts the start time** (drags
  the top edge), the **bottom-left handle adjusts the end time** (drags the bottom edge),
  each independently, with the opposite edge pinned. Enforce the same
  `MIN_EVENT_HEIGHT_PX` floor the renderer already uses so a block can't be resized to
  zero/negative duration.

### 3.5.3 Ghost vs. picked-up copy — the two states

- The **ghost** is the event at its *original, un-committed* start/end, held in place and
  dimmed, so the user can see how far they've moved from where it was. It is not
  interactive during the drag.
- The **picked-up copy** tracks the gesture live and is drawn in the solid/white-text
  variant so it clearly reads as "selected/active," pops above neighbors, and doesn't get
  visually lost against same-color tint blocks. It should sit above everything (including
  the current-time line and any overlapping columns) while dragging.
- On **commit** (finger up / gesture end) the ghost disappears and the event snaps to the
  new time in its normal tint style. On **cancel** the picked-up copy returns to the
  ghost's position. Exact commit-vs-cancel triggers (does releasing always commit? is
  there an explicit confirm?) aren't provable from a still — assume release-commits per
  iOS convention and flag in §3.5.8.

### 3.5.4 Drag handles — details

- Rendered only while the event is in the on-grid edit state — normal (non-editing)
  blocks show no handles.
- Handle hit-target must be larger than the visible disc (finger-sized), and should
  extend slightly outside the block bounds (the discs straddle the corner in the
  reference), so grabbing an edge is forgiving.
- Top-right = start edge, bottom-left = end edge. Don't put both handles on the same side
  or mirror them — the reference is specifically diagonal (top-right / bottom-left).

### 3.5.5 Sub-hour gutter markers (15/30/45)

- While dragging or resizing, the left gutter gains **intermediate minute ticks at :15,
  :30, :45** *under* the hour labels — normally the gutter shows whole hours only (§3.3).
  In the reference only `:45` is visible because the crop is tight and/or only the ticks
  near the active edge are shown.
- Open question (§3.5.8): are all three (:15/:30/:45) shown for every hour across the
  whole visible grid for the duration of the gesture, or only the tick(s) nearest the
  edge being moved? The single frame can't decide this — the safe default is to reveal
  the quarter-hour ticks across the grid while a drag/resize is active and hide them again
  on release.
- These ticks strongly imply a **15-minute snap increment** for both move and resize
  (matching standard iOS Calendar). Treat 15 min as the working snap granularity until a
  motion reference proves otherwise.
- Styling: same gray gutter type as the hour labels, but minute-only (`:15`/`:30`/`:45`,
  no AM/PM), lighter/secondary weight so hour labels stay dominant.

### 3.5.6 Where this goes in the repo (implementation surface)

> **Status: implemented.** A first pass of this interaction now ships. What
> landed, and where:
> - `src/lib/day-grid.ts` — `SNAP_MINUTES`/`MIN_EVENT_DURATION_MIN`/`LONG_PRESS_MS`
>   constants plus `pxToMinutes`, `snapMinutes`, `clamp`, and `minutesToLocalIso`.
> - `src/components/day/EventBlock.tsx` — `ghost`, `editing`, and `zIndexOverride`
>   props; the two diagonal resize handles (rendered outside the fill's
>   `overflow-hidden` so they can straddle the edge); pointer hooks.
> - `src/components/day/HourGrid.tsx` — owns the edit state machine: long-press to
>   enter, body-drag to move, handle-drag to resize, snapped to 15 min, with the
>   ghost/picked-up copies and the drag-gated quarter-hour gutter ticks. A
>   tap-away backdrop exits edit mode.
> - `CalendarApp` → `DayView` → `DayContentPane` thread a single
>   `onUpdateEventTimes(id, startIso, endIso)` action that writes the new
>   start/end back into event state (the same path the detail-sheet edit will use).
>
> Deferred from this pass (still open): cross-day drag, live neighbor re-layout
> during a drag, the recurring "this / all future events" prompt on commit, and
> the pickup/snap-back *motion* polish (§3.5.7). Handles show for mouse/touch;
> haptics are a best-effort `navigator.vibrate`.

Original plan (for reference) — landing this touches:

- **`src/components/day/HourGrid.tsx`** — owns the timed-event layer and the gutter, so it
  hosts the new edit state: which event (if any) is being edited, its live (dragged)
  start/end vs. its committed start/end, and the pointer handlers. Today it only maps
  events → `EventBlock` with a static layout and an `onSelectEvent` tap; it needs a
  long-press → enter-edit path and pointer-move math that converts drag delta (px) → time
  delta (minutes) using `PX_PER_MINUTE` from `day-grid.ts`, snapped to the 15-min grid.
- **`src/components/day/EventBlock.tsx`** — already supports `variant="solid"` (the
  white-text fill) and reads start/end from the event; it needs (a) an "editing" affordance
  that renders the two corner handles, and (b) to accept a live start/end override (or a
  pixel top/height override) so the picked-up copy can be positioned by the drag instead
  of only by `event.start`/`event.end`. The **ghost** is just a second `EventBlock` of the
  same event at reduced opacity in the normal tint variant.
- **`src/components/day/HourGrid.tsx` gutter (or a small new sub-component)** — the
  quarter-hour markers. The existing hour loop uses `formatHourParts` from
  `date-utils.ts`; the sub-hour ticks are a parallel, drag-gated layer (`:15`/`:30`/`:45`
  labels at `hour*HOUR_HEIGHT_PX + {15,30,45}*PX_PER_MINUTE`), only mounted while a
  drag/resize is active.
- **`src/lib/day-grid.ts`** — home for the new constants/helpers: a `SNAP_MINUTES = 15`,
  px→minutes and minutes→snapped-time conversions, and the min-duration clamp reusing
  `MIN_EVENT_HEIGHT_PX`. Keep the math here (pure, testable) rather than inline in the
  component.
- **State ownership / persistence** — `mock-data.ts` events are currently static. A real
  move/resize has to write back the event's new `start`/`end`. Decide where mutable event
  state lives (lift into `CalendarApp.tsx` / a store) since the detail-sheet edit mode
  (§3.7) will need the same mutation path — build one shared "update event times" action,
  not two.

### 3.5.7 Open questions

- The **green left-edge accent** — real edit indicator or a cropped adjacent event? (§3.5.1)
- **Cross-day drag**: can the block be dragged to another day, and if so how (auto-scroll?
  the mini week-strip? not possible in Day view at all)? Not shown in a single-day crop.
- **Snap increment**: 15 min assumed from the tick labels — confirm against the real app;
  iOS sometimes uses finer snapping with a magnifier/haptic detent.
- **Which markers show**: all quarter-hours across the grid vs. only near the active edge
  (§3.5.5).
- **Commit vs. cancel** triggers and whether a **recurring** event (this one recurs) prompts
  "this event / all future events" on commit, the way the detail-sheet edit does in iOS.
- **Live overlap re-layout**: as the dragged block moves over other events, do the
  neighbors re-flow their columns live (§3.4 collision layout), or does re-layout only
  happen on commit? Not provable from the still.
- Entry/exit **motion** (pop-on-pickup scale, ghost fade-in, snap-back easing, haptics) —
  unconfirmed per §6.2 until we have a screen recording.

---

## 3.6 Event Detail Sheet

Reference: a screenshot of the "Flight: AA 1913 from ORD to IAH" event opened from Day
view. Shared across Month/Day (tapping any event opens this, regardless of which view
you tapped it from) — documented here as its own top-level surface, not nested under Day.

### 3.6.1 Presentation

- **Modal sheet, not full-screen.** The background (status bar, the flight live-activity
  island, profile photo, battery) stays visible but dimmed behind the sheet — this is the
  standard iOS partial-height sheet presentation, not a full-screen cover and not a push.
  Confirms one of §6.2's open animation questions (sheet vs. push vs. zoom-morph) as
  "sheet" — but the *entrance/exit animation itself* (slide up? grow from the tapped
  block?) still isn't provable from a still image; treat that motion as still unconfirmed.
  **Implementation note:** built with the `vaul` drawer library rather than a hand-rolled
  overlay — it provides real drag-to-dismiss physics, snap-back, and open/close spring
  animation out of the box, closer to native feel than we'd get hand-rolling it without a
  motion reference. `dismissible` is set to `false` while in edit mode, so a stray
  swipe/backdrop-tap can't discard an in-progress edit — confirmed via an automated
  drag-gesture test (swipe-down dismisses in view mode, is a no-op in edit mode).
- **Rounded top corners** on the sheet, standard iOS sheet radius.
- **No visible drag grabber** (the small gray pill some iOS sheets show top-center) in
  this screenshot — the sheet relies on its own X button instead. Don't add a grabber
  unless a future reference shows one.
- Sheet content area background is light gray; individual content groups render as white
  rounded-rect "cards" on top of it — the standard iOS grouped/inset-list convention (same
  visual language as Settings.app), reused for `Location` and `Options` groups here.

### 3.6.2 Top bar

- Top-left: a plain circular **X (close) button**, white fill, black X — no label, no
  surrounding nav bar, just floats at the sheet's top-left.
- Top-right: an **"Edit" pill button** (light gray capsule, black text) — presumably
  switches the sheet into an editable form. No reference yet for what edit mode looks
  like.

### 3.6.3 Title block

- A **vertical rounded-capsule accent bar** to the left of the title (same visual
  language as the Day-view event-block accent, §3.4, just taller — spans the full height
  of the title+date+time text block), colored to match the event's calendar color.
- Title: large bold black text, wraps to multiple lines (2 lines here).
- Below title: the date as a full written-out line ("Wednesday, July 15, 2026").
- Below that: the time range ("6:27 PM – 9:14 PM"), same weight/size as the date line.
- No calendar name or icon appears in this block — that's lower down in `Options`.

### 3.6.4 Location section

Header label "Location" (gray, small, standard grouped-section header style), followed
by **two separate cards**:

1. A **"Mail" source-link card**: blue rounded-square Mail app icon, "Mail" label, and on
   the right an **"Open" pill button** (mint/light-green fill) plus a circular
   share/export icon button. This is almost certainly flight/travel-specific — this event
   was likely auto-parsed from a confirmation email, and this card is a shortcut back to
   that source email in Mail.app. **Don't assume every event has this** — it's plausibly
   conditional on the event having a linked source message, which a plain manually-created
   event (e.g. "Hinge Health Exercise Therapy Session") would not have.
2. An **address card**: bold location name ("O'Hare International Airport"), gray address
   text below (street/city/state/zip/country, wrapping to 2 lines), and a small square
   **static map thumbnail** on the right (stylized tan/cream map with grid lines and a
   pin/marker icon — here a plane-in-pin glyph since it's an airport).

Both "Open" (deep-links to Mail.app) and the map thumbnail (presumably deep-links to
Maps.app) are **cross-app navigation that a web app cannot replicate** — flag as
out-of-scope/needs-a-graceful-fallback rather than silently faking it.

### 3.6.5 Embedded mini day-preview

A separate white rounded card containing a **cropped, read-only preview of the Day view
hour grid** around the event's time (6 PM–9 PM here), same hour gridlines/labels as the
real Day view, with the event block rendered **inverted from its normal Day-view style**:
solid saturated fill (not the pale ~15–20%-opacity tint) with **white text**, including
the same title/location-pin/clock-time detail lines as the normal expanded block. This
is effectively a "focused/selected" restyle of the same `EventBlock` component already
built for Day view, cropped to a short time window and reused inside this sheet. Unknown
whether this mini-grid is itself interactive (e.g., tap to jump to full Day view) or
purely decorative — no reference either way.

### 3.6.6 Options section

Header label "Options", then grouped rows:

- **Calendar row**: small calendar-grid icon + "Calendar" label on the left; on the
  right, a colored dot (matching the assigned calendar's color) + the calendar's name +
  an up/down disclosure chevron — implies tapping opens a picker to reassign which
  calendar the event belongs to.
- **Show As row**: a hand-raised icon + "Show As" label on the left; "Busy" + the same
  disclosure chevron on the right — a busy/free/tentative availability picker.
- No "Repeat" row appears here, but this event has no recurrence — a recurring event's
  sheet almost certainly needs one; unconfirmed since no recurring-event sheet screenshot
  exists yet.

### 3.6.7 Delete Event

A **red "Delete Event" pill button**, floating and appearing to overlap/sit above the
last Options row in this screenshot — most plausibly a persistent floating button pinned
at the bottom of the sheet's scrollable content (same floating-pill pattern as the
"Today" button elsewhere in this app), rather than a plain list row. Almost certainly
requires an iOS-standard destructive confirmation (action sheet or alert: "Delete this
event?") before actually deleting — not provable from this screenshot, but a strong
platform-convention assumption.

### 3.6.8 Open questions specific to this sheet — resolved / remaining

- **Resolved — Mail card**: it's shown *only* when the event was parsed from an email;
  manually-created events show nothing in its place (no fallback UI, no placeholder
  card). Generalized for the web: the data model gets an optional **source** field (not
  literally "Mail" — a generic "this event came from X" indicator), rendered as that same
  card style when present and omitted entirely when absent.
- **Resolved — the map thumbnail**: it's a real (MapKit-style) map render that simply
  hadn't finished loading tiles in the reference screenshot (hence the plain tan/gray
  grid look) — not a deliberate "unloaded" placeholder design. The intended look is a
  proper muted-color simplified map with roads and a pin. We have no real mapping API in
  scope here, so build a stylized decorative map (light muted background, a few road
  lines, pin + label) rather than literally integrating MapKit/Mapbox/Google
  Maps — visually representative, not a functional interactive map.
- **Resolved — edit-mode layout**: see new §3.7 below.
- Still open: Calendar/Show-As picker interaction style (inline dropdown vs. separate
  sheet) — not shown in either reference.
- Still open: Delete confirmation's exact copy/style.
- Still open: whether a recurring event's edit mode prompts "this event / all future
  events" like standard iOS Calendar (this event has no recurrence).

---

## 3.7 Event Detail Sheet — Edit Mode

Reference: the same flight event, opened via the view mode's "Edit" button.

### 3.7.1 Top bar

- Top-left: same circular **X button** as view mode — presumably cancels the edit
  (discards changes) rather than saving, though not provable from a still image; the
  standard iOS convention is X-cancels/checkmark-saves, which this layout matches.
- Top-right: a circular **checkmark button** (replaces the "Edit" pill) — saves/commits
  changes and returns to view mode.

### 3.7.2 Title & schedule card group

- The title is now inside its own white rounded card, rendered as a **single-line,
  truncated-with-ellipsis editable text field** ("Flight: AA 1913 from ORD t...") —
  unlike view mode's multi-line wrapped display. Confirms the title becomes a real inline
  text input, not a wrapped label, while editing.
- The same tall blue accent capsule from view mode still runs alongside this card group
  (spanning both the title card and the schedule card below it as one continuous accent,
  even though they're visually two separate white card blocks with a gap between).
- A second card below groups four rows:
  - **Starts**: label + two separate gray capsule/pill fields — a date pill ("Jul 15,
    2026") and a time pill ("6:27 PM") — each independently tappable (presumably opening
    a date picker / time picker).
  - **Ends**: identical structure ("Jul 15, 2026" / "9:14 PM").
  - **All-day**: small calendar icon + label, with a standard iOS **toggle switch** on
    the right (off/gray here, since this event is timed). Toggling this presumably hides
    the time pills and keeps just the date pills, mirroring standard iOS Calendar
    behavior — not provable from this screenshot since it's off, but a safe platform
    convention to assume.
  - **Repeat**: looped-arrow icon + label, value "Never" + disclosure chevron (same
    picker-row style as Calendar/Show-As in view mode's Options section).
  - Each row separated by a thin full-width divider within the same card.

### 3.7.3 Location (edit mode)

- **No Mail/source card here** — only the address+map card is shown, confirming the
  source indicator is a view-mode-only affordance, not something exposed for inline
  editing.
- The map thumbnail now shows a **pin + text label directly on the map** ("O'Hare
  International Airport", styled like a real Maps app annotation) — richer than view
  mode's plain unlabeled thumbnail.
- A small circular **X (remove) button** overlays the top-right corner of the map, to
  clear the location.
- Below the location row (same card, separated by a divider, no new section header): an
  **add-affordance row** — a circled "+" icon and gray placeholder text **"Video Call or
  Conference"** — a field not shown at all in view mode (since it's unset), revealing
  that edit mode surfaces optional not-yet-set fields as tappable "add" rows.

### 3.7.4 Invitees

- New section (header "Invitees") not present anywhere in view mode — because view mode
  conditionally omits sections with no data, and this event has none. Edit mode instead
  shows an **empty add-affordance row**: a two-person icon + gray placeholder text
  "Invitees", implying tap-to-add.

### 3.7.5 Options (edit mode)

- Screenshot cuts off here (only the "Options" section header and the top edge of its
  first row are visible) — presumably the same Calendar/Show-As rows as view mode, likely
  still with Delete Event below, but not confirmed from this reference.

### 3.7.6 Pattern this confirms generally

Edit mode's defining behavior: **every field becomes inline-editable in place** (pills,
toggles, disclosure pickers, text fields) rather than navigating to a separate editor
screen per field, and **optional/unset fields that view mode hides entirely reappear as
tappable "add" rows** (Video Call, Invitees) once editing. Build the sheet around one
shared data shape with two render modes (view/edit) rather than two independent
components that could drift apart.

---

## 4. Shared components / cross-cutting concerns

| Component | Notes |
|---|---|
| Today red circle | Same visual token used in Month grid dates and Day view's mini week-strip. Keep as one shared component. |
| Calendar color | Per-calendar color assignment (green/blue/gray/tan/purple/slate) must be a data-model property, not hardcoded per view. |
| Recurring icon | Looped-arrow glyph, appears in Day view event blocks; verify whether Month view bars also need any recurrence marker (not clearly visible at that zoom level — likely no, since bars carry no icons). |
| Blur materials | Nav bar, bottom bars — both views, both need real translucency + blur with content scrolling beneath. |
| Truncation | Ellipsis truncation for both month "+N" overflow and narrow day-view overlapping columns. |
| Event accent capsule | The inset rounded-capsule left accent (§3.4) is reused, taller, in the detail sheet's title block (§3.6.3) — one shared visual token, two sizes. |
| EventBlock (solid variant) | The detail sheet's mini day-preview (§3.6.5) needs a solid-fill/white-text variant of the same Day-view `EventBlock` component, not a separate one-off. |

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
- **Availability ("Show As")** — Busy/Free/Tentative-style field, confirmed by the detail
  sheet's Options section (§3.6.6). Standard `TRANSP`/`STATUS`-adjacent ICS concept.
  Distinct from the (resolved-as-not-real) "status/confidence" bar-color question above.
- **Structured location** — the detail sheet needs more than a plain string: a location
  *name* ("O'Hare International Airport") separate from its *address* (street/city/
  state/zip/country) for the address card (§3.6.4), plus coordinates if we ever want a
  real map thumbnail. Closest ICS analog is `LOCATION` + `GEO`, though ICS's `LOCATION`
  is normally just one string — this model needs it split out.
- **Optional source field** — confirmed: shown only when the event was parsed from an
  email (or, generalized for the web, any external source); manually-created events carry
  no source and render nothing in its place, no fallback UI. Model as
  `source?: { label: string; ... }` on `CalendarEvent` — genuinely optional, not literally
  "Mail" (that's just what iOS calls it since it parsed from an email there).
- **Calendar display name + color together** — the Options "Calendar" row (§3.6.6) shows
  both, confirming `CalendarSource` (already modeled as `{id, name, color}`) is the right
  shape; the detail sheet just needs to surface it as a reassignable field on the event.
- **Video call / conference link** — optional field (§3.7.3), shown as a set value when
  present or an "add" affordance in edit mode when absent; omitted entirely in view mode
  when unset (same conditional-section pattern as Location/source).
- **Invitees** — optional list of attendees (ICS `ATTENDEE` lines), same conditional
  pattern: omitted in view mode when empty, shown as an "add" row in edit mode.

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
4. **Resolved via follow-up screenshot**: months don't share a row at their boundary at
   all. See the updated §2.2 — each month's grid is self-contained, with blank
   (numberless, barless) leading/trailing cells rather than grayed adjacent-month
   numbers. The month-label header sits inline (not sticky) positioned horizontally
   above whatever column the 1st falls on; the single pinned title in the nav chrome is
   what increments as you scroll past each month.
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
- Drag-to-**create** on an empty part of the Day view hour grid: snap increment and
  placeholder treatment. (Drag-to-**resize/move** an *existing* event is now specified —
  see §3.5 — but its entry/exit *motion* is still unconfirmed; and drag-to-create from
  empty space has no reference yet.)
- `+` button → creation sheet presentation style.
- Long-press on a **date** (context menu / peek preview?). Long-press on an **event** is
  now specified as "enter on-grid move/resize edit" — see §3.5 — though its pickup motion
  and haptics remain unconfirmed.
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
- [ ] Two-part event block coloring: inset rounded-capsule left accent (not a flush
      border) + separate lighter tint fill.
- [ ] Mini week-strip in Day view is interactive/independent, not a static label row.
- [x] Long-pressing a Day-view event enters on-grid edit: the original stays as a dimmed
      ghost at its old time while a solid-fill/white-text copy tracks the drag (§3.5) —
      it's a separate affordance from the detail-sheet edit mode, not a replacement for it.
- [x] The move/resize copy reuses `EventBlock` `variant="solid"`, and the ghost reuses the
      normal tint variant at reduced opacity — no third one-off block renderer.
- [x] Two diagonal drag handles: top-right adjusts start, bottom-left adjusts end; handles
      only appear while editing; resize clamps to the min-duration floor.
- [x] Quarter-hour (:15/:30/:45) gutter ticks appear only during a drag/resize and imply a
      15-min snap; the gutter shows whole hours only at rest.
- [x] Move/resize writes the event's new start/end through one shared "update event times"
      action reused by the detail-sheet edit mode — mock data can't stay static.
- [ ] All bars/blocks use per-calendar color pulled from the data model, never hardcoded
      per screen.
- [ ] Event detail sheet is a true modal sheet (dimmed background peeking through, rounded
      top corners), not a full-screen page/route.
- [ ] `Location` section is conditional — don't render it (or its Mail sub-card) for
      events that have no location / no linked source message.
- [ ] Delete Event is a floating pinned pill at the bottom of the sheet, not a plain list
      row, and needs a destructive confirmation step before it actually deletes.
- [ ] The mini day-preview inside the detail sheet reuses the real `EventBlock` component
      in a solid-fill/white-text variant — don't build a second one-off event-block renderer.
- [ ] Calendar/Show-As rows show a value **and** a disclosure chevron — they're pickers,
      not static labels.
- [ ] Source card (Mail-equivalent) renders only when the event actually has a source —
      no fallback/placeholder card for manually-created events.
- [ ] Edit mode uses real inline-editable controls per field (text input, date/time
      pills, toggle, disclosure pickers) — it is not a separate "form page" navigated to.
- [ ] Optional unset fields (Video Call, Invitees) are hidden entirely in view mode but
      appear as tappable "add" rows in edit mode — don't render empty sections in view
      mode, and don't skip the add-affordance in edit mode.
- [ ] The map thumbnail is a stylized decorative map (muted colors, roads, pin) — not a
      literal tan/gray unloaded-tile look, and not a functional real map (no mapping API
      in scope).
- [ ] View and edit modes share one underlying data shape/component tree rather than
      being built as two independently-drifting UIs.
