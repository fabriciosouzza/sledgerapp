# Design notes — UI direction after the first build

Status: backlog agreed on 2026-09-12, to start next session. The reference is a
FinTrack-style finance app mockup (dark, lime accent, five phones). We keep our
own palette and the rules in `PROMPT.md`; what we take from the reference is
**information hierarchy, the add button, and more dashboards**.

Read `PROMPT.md` first: nothing here overrides §5 (money rules) or §7 (screens).
Where an idea would deviate, it is flagged and needs a decision.

## Keep as is

- The palette (neutral dark with the lime accent) and dark-first look.
- Bottom nav with five items: Today · Add · Month · Portfolio · More (§7).
- English UI, pt-BR formatting.

## Theme

Light mode already exists: `next-themes` follows the system preference (§8),
and every screen renders in both. Missing: a **manual toggle** (system / light /
dark) — the reference has a moon icon in the header. Put it in the app header
on mobile and in the sidebar footer on desktop, and in `/settings` → Profile.
Review the light palette once the toggle exists (contrast of the lime accent
on white, chart colours, the red/green of amounts).

## Ideas from the reference, mapped

### 1. Floating add button in the nav (high priority, small)

Reference: the bottom bar has four icons with a raised, round, accent-coloured
"+" in the centre.

Ours today: "Add" is a regular fifth tab.

Proposal: keep five destinations but render the middle one as the raised FAB
(56px circle, accent background, overlapping the bar). Tapping it opens `/add`.
Long-press or a second tap could later open a mini sheet with the four kinds
(expense / income / transfer / contribution) to skip the segmented control.
Sidebar on desktop keeps a normal "Add" item. Touch target stays ≥ 44px (§8).

Files: `components/layout/bottom-nav.tsx`, `nav-items.ts`.

### 2. Today: stronger hierarchy (high priority, medium)

Reference: greeting + avatar row; one hero number ("Balance"); an insight card
("Well done — spending down 2% vs last month", with a progress ring); a
horizontal strip of account tiles; a row of quick actions; then the list.

Ours today: four equal stat tiles, overdue block, upcoming list, card strip,
sparkline.

Proposal, top to bottom:

1. **Header row**: date + theme toggle + a small avatar/initial (no
   notification bell — nothing to notify yet).
2. **Hero**: *cash on hand* as the single big number, with "as of <snapshot
   month>" under it. We never invent a live balance: with no snapshot the hero
   shows `—` and a "Take a snapshot" link (§5.9, "never pretend to know a
   number it does not have").
3. **Insight card**: one sentence computed from the month metrics, e.g.
   "Spending down 12% vs last month" or "Savings rate 62% · 69% ex-benefits",
   with a ring for savings rate. Pure function in `lib/domain/insights.ts`
   with unit tests (which sentence wins, thresholds, null when data is missing).
4. **Account strip**: horizontal scroll of tiles — cash accounts with their
   snapshot balance (or `—`), then each card with open statement and days to
   due (already built as `CardTile`). Replaces the separate card strip.
5. **Quick actions**: Add expense · Add income · Transfer · Settle all due
   today · Generate month (only when the month has missing recurrences).
6. **Overdue** block (unchanged, stays prominent) and **Next 7 days**.
7. Net-worth sparkline moves to the bottom or into the hero as a small line.

### 3. Entries / transaction history (medium, small)

Reference: search field on top, tabs All · Spending · Income, day headers,
"See all" link from the home preview.

Ours today: filters form (month, search, kind, status, account, category).

Proposal: keep the month input and search, and turn *kind* into three tabs
(All · Spending · Income) above the list; the other filters stay behind the
"Filters" disclosure. Today shows the first few entries of the month with
"See all" → `/entries`. No "AI search": search stays a plain substring on the
description (§1 is explicit that chat bots are out of scope).

### 4. Period tabs on Month (medium, medium)

Reference: Daily · Weekly · Monthly · Yearly with a line chart per period.

Ours today: `/month` is one calendar month with a picker.

Proposal: add a **spending line** to `/month` (daily cumulative spend for the
month, with last month as a faded second line), and a **Yearly** view:
`/month?view=year` with income / expense / contributions per month as bars,
savings rate as a line, and the same summary numbers for the year. Daily and
weekly views are not worth a screen for a once-a-week user; the daily line on
the month view covers it. All computed in `lib/domain/metrics.ts` from the
period's rows (§4.5: a year is at most ~12 × a few hundred rows — fine, but
fetch by period and aggregate month by month).

### 5. Budget vs spent over time (medium, small)

Reference: "Monthly Budget · Spend $3,050 / $5,000 · 61%" with a progress bar,
a budget-vs-spent line chart, and "Last 6 periods" bars coloured
within / risk / overspending.

Ours today: per-category caps with progress bars on `/month`; no overall
budget.

Proposal: the **sum of category caps** is the month's budget (no new column).
Show "Spent R$ X of R$ Y · Z%" at the top of the category table, and a
"Last 6 months" bar chart of spend vs that budget, each bar coloured within
(< 80%), at risk (80–100%), over (> 100%). If the user wants a budget that is
not the sum of caps, that is a schema change (`monthly_budget_cents` on a
settings row) — decide before building.

### 6. Expenses donut by category (medium, small)

Reference: donut with the total in the middle and a legend.

Proposal: on `/month`, above the category table: donut of settled expense by
root category, total in the centre. Reuse `ClassDonut` generalised to
`components/charts/donut.tsx`.

### 7. Income / expense delta tiles (low, small)

Reference: "Income +5%" / "Expenses −2%" tiles with arrows.

Proposal: on Today and Month, show the change vs the previous month under
income and expense (needs the previous period's rows: one extra `listByPeriod`).
`null` when the previous month is empty — render `—`, not `0%`.

### 8. Transaction row details (low, small)

Reference: rows with an icon per category, name, and amount; grouped by day.

Proposal: category `icon` and `color` columns already exist in the schema.
Expose them in the category form (a small icon picker from lucide + a colour
swatch) and show the icon in entry rows, the category table and the donut.

### 9. Bulk settle: the "Select" control is unclear (high priority, small)

Reported on Today's overdue block: a lone "Select" button floating above the
list says nothing about what it does, and once tapped it disappears — it turns
into "Cancel" + a disabled "Settle" pair, which reads as the control vanishing.

Proposal (`components/entries/entry-list.tsx`):

- Rename the entry point to what it does: **"Settle several…"** (icon
  `CheckCheck`), aligned with the list title instead of floating in a row of
  its own; hide it when there is a single planned entry (one tap already does
  the job).
- In select mode, keep the trigger visible but pressed, show the checkboxes,
  and put the actions in a **sticky bar at the bottom** (above the nav):
  "N selected · Settle" + "Cancel". Never a disabled "Settle" with no context.
- "Select all" in the bar for the visible planned entries.
- On Today, the overdue block gets no select mode at all: the block is small
  and the point is one-tap settle. `/entries` and `/month` keep it.
- Desktop: the list is narrow inside a wide main area; cap the list width or
  use the space for the sticky bar and filters rather than leaving it empty.

## Not taking from the reference

- **AI chat / "Super AI search"**: out of scope by `PROMPT.md` §1.
- **Notification bell**: nothing to notify; revisit if reminders arrive.
- **Live "Balance" as the hero**: we have no live balances; the hero is the
  snapshot cash with its date, or `—`.
- **Weekly / daily screens**: covered by the daily line on the month view.

## Suggested order for the next session

1. Bulk-settle control (item 9) — small and already confusing in use.
2. Theme toggle (system / light / dark) + light palette review.
3. FAB in the bottom nav.
4. Today hierarchy (hero, insight card, account strip, quick actions).
5. Month: spending line, donut, budget summary and last-6-months bars.
6. Entries: kind tabs; Today → "See all".
7. Yearly view.
8. Category icons/colours; delta tiles.

Each step ships on its own commit; 360px pass on every screen touched (§8).

## Open questions

- Budget = sum of caps, or a separate monthly budget number?
- Should the FAB open `/add` directly, or a kind picker first?
- Yearly view: calendar year only, or any rolling 12 months?
