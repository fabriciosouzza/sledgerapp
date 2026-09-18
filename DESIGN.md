# Design notes — UI direction after the first build

Status: backlog agreed on 2026-09-12; items 1–11 shipped on 2026-09-13 (see
"Done" at the end). Left open: the desktop width note in item 9 and a light
palette review after the toggle. The reference is a
FinTrack-style finance app mockup (dark, lime accent, five phones). We keep our
own palette and the rules in `PROMPT.md`; what we take from the reference is
**information hierarchy, the add button, and more dashboards**.

Read `PROMPT.md` first: nothing here overrides §5 (money rules) or §7 (screens).
Where an idea would deviate, it is flagged and needs a decision.

## Keep as is

- The palette (neutral dark, monochrome: no brand accent, decided 2026-09-14) and dark-first look.
- Bottom nav with five items: Today · Review · Add · Net worth · More (§7; Portfolio moved under More on 2026-09-18).
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

Ours today: `/review` is one calendar month with a picker.

Proposal: add a **spending line** to `/review` (daily cumulative spend for the
month, with last month as a faded second line), and a **Yearly** view:
`/review?view=year` with income / expense / contributions per month as bars,
savings rate as a line, and the same summary numbers for the year. Daily and
weekly views are not worth a screen for a once-a-week user; the daily line on
the month view covers it. All computed in `lib/domain/metrics.ts` from the
period's rows (§4.5: a year is at most ~12 × a few hundred rows — fine, but
fetch by period and aggregate month by month).

### 5. Budget vs spent over time (medium, small)

Reference: "Monthly Budget · Spend $3,050 / $5,000 · 61%" with a progress bar,
a budget-vs-spent line chart, and "Last 6 periods" bars coloured
within / risk / overspending.

Ours today: per-category caps with progress bars on `/review`; no overall
budget.

Proposal: the **sum of category caps** is the month's budget (no new column).
Show "Spent R$ X of R$ Y · Z%" at the top of the category table, and a
"Last 6 months" bar chart of spend vs that budget, each bar coloured within
(< 80%), at risk (80–100%), over (> 100%). If the user wants a budget that is
not the sum of caps, that is a schema change (`monthly_budget_cents` on a
settings row) — decide before building.

### 6. Expenses donut by category (medium, small)

Reference: donut with the total in the middle and a legend.

Proposal: on `/review`, above the category table: donut of settled expense by
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
  and the point is one-tap settle. `/entries` and `/review` keep it.
- Desktop: the list is narrow inside a wide main area; cap the list width or
  use the space for the sticky bar and filters rather than leaving it empty.

### 10. Date and month pickers (high priority, medium)

Reported: the native `<input type="month">` popup (Chrome's grey grid) looks
foreign next to the rest of the app. The same goes for `<input type="date">`
on the entry, recurrence and pay-statement forms.

What the shadcn registry offers for our style (`base-nova`), checked on
2026-09-12: `calendar` (react-day-picker + date-fns, `captionLayout="dropdown"`
for month/year navigation), `popover`, `drawer` (bottom sheet built on Base
UI — no extra dependency), `sheet`.

Proposal:

- **`MonthPicker`** (our own, no library): a trigger showing "September 2026"
  with ‹ › arrows; tapping the label opens a picker with the year and a 3×4
  grid of months, "This month" and the current one highlighted. Used on
  `/review`, `/entries`, `/recurrences`, `/net-worth`. Keep the arrows for the
  one-handed case.
- **`DatePicker`**: `calendar` inside a `popover` on desktop and inside a
  `drawer` on mobile; pt-BR labels (`date-fns/locale/pt-BR`), week starting on
  Sunday, "Today" shortcut; the value stays an ISO date in a hidden input so
  the schemas do not change. Used for entry date, "paid on", recurrence
  start/end, movement date, statement payment date.
- Keyboard and the native picker remain reachable (the trigger is a button;
  typing a date is possible in the popover's input on desktop).

### 11. Bottom sheets on mobile, dialogs on desktop (high priority, medium)

Everything is a page today. That is right for the long forms; for short
actions it costs a navigation and loses context. Proposal: one responsive
primitive, **`Sheet`** = `drawer` (bottom, with a grab handle, drag to close)
below `md`, `dialog` at `md` and up — the "responsive dialog" pattern from the
shadcn docs (`useMediaQuery`), implemented once in `components/ui/responsive-sheet.tsx`.

Move into sheets (short, contextual, no navigation):

- Settle with a date other than today (tap-and-hold on the settle circle).
- Pay statement (already a dialog → becomes the sheet).
- Delete confirmations (already dialogs → sheet).
- Filters on `/entries` (the disclosure becomes a sheet with Apply/Clear).
- The month and date pickers above, on mobile.
- Add movement from an asset page.
- The kind picker if the FAB gets one (item 1).
- Snapshot for the current month from Today's "Take a snapshot" link.

Stay as pages: `/add` (fast entry, keyboard up, the most used form), entry
edit, recurrence form, settings CRUD, snapshot form on `/net-worth`.

References: iOS Wallet / Health sheets (half-height, handle, one primary
action), shadcn "Drawer" and "Responsive dialog" examples, Vaul's
snap-point sheets. Rules: a sheet never contains a second sheet; the primary
action is a full-width button at the bottom; Escape and the backdrop close it;
focus returns to the trigger; ≥ 44px targets (§8).

## Not taking from the reference

- **AI chat / "Super AI search"**: out of scope by `PROMPT.md` §1.
- **Notification bell**: nothing to notify; revisit if reminders arrive.
- **Live "Balance" as the hero**: we have no live balances; the hero is the
  snapshot cash with its date, or `—`.
- **Weekly / daily screens**: covered by the daily line on the month view.

## Suggested order for the next session

1. Bulk-settle control (item 9) — small and already confusing in use.
2. Responsive sheet primitive (item 11) and the month/date pickers (item 10);
   migrate the existing dialogs to it.
3. Theme toggle (system / light / dark) + light palette review.
4. FAB in the bottom nav.
5. Today hierarchy (hero, insight card, account strip, quick actions).
6. Month: spending line, donut, budget summary and last-6-months bars.
7. Entries: kind tabs and the filters sheet; Today → "See all".
8. Yearly view.
9. Category icons/colours; delta tiles.

Each step ships on its own commit; 360px pass on every screen touched (§8).

## Decisions (2026-09-13)

- Budget = sum of category caps (no new column).
- The FAB opens a kind picker sheet, then `/add?kind=…`.
- Yearly view offers both a calendar year and the last 12 months.
- The review screen is called Review and lives at `/review` (`/month` redirects).
- **Balances are derived, snapshots are gone** (deviation from `PROMPT.md`
  §5.9, decided by the owner). A cash account has `opening_balance_cents` on
  `opening_on`; its balance is that plus every settled entry since. Net worth
  for any month = Σ cash balances + investments − card debt at that month's
  end (open statements included for what was bought by then). A forgotten
  expense is recorded as an entry, not through a correction table or an
  automatic category. A "fix balance" helper (type the bank's number, get
  the difference as an entry) was discussed and left out for now.
- Recurring entries are applied from Review (with per-month amounts);
  `/recurrences` only reports where each month stands.

## Decisions (2026-09-14)

After a design critique of the signed-in app:

- **What needs you comes first on Today** (reopens "overdue below the
  fold"). Closed card statements and overdue entries open the screen above
  cash on hand, and head the left column on desktop. With nothing due, Today
  opens on the cash as before. Both blocks always sit in that slot, so a row
  settled from it stays on screen (and undoable) after the refresh.
- The month insight is a line under cash on hand (headline, then its detail)
  linking to Review, not a card with a ring. Quick actions follow Next 7 days.
- Review lists "Still planned" oldest first, so what is overdue leads.
- **The budget measures what it caps.** Its %, status and the "Last 6 months"
  bars compare the caps with settled spending in capped categories; spending
  in categories without a cap is shown beside it, not counted against it.
- Red is for what is overdue, over a cap or below zero (a signed leftover or
  rate); amber for at risk; green for money in and a positive signed value.
  Amounts in lists are plain, with a true minus: in a list of expenses the
  sign carries no news (reopened the same day, after the second critique).
  Totals whose label already says the direction are plain too. The colours
  are the `positive`, `negative` and `caution` tokens in `globals.css` (700
  shades in light mode for contrast).
- **Add confirms the kind instead of asking again** (deviation from `PROMPT.md`
  §7, decided by the owner). Opened from the + sheet, the form is titled "New
  expense" with a Change button that brings the segmented control back;
  `/add` without a kind still opens on the control.
- The entry form (add and edit) keeps Save in a bar pinned above the bottom
  nav, and a failed save shows its error in that bar. On those two screens
  the raised + lies flat as an "Add" tab so it does not sit on Save. Fields
  run amount → description → category | account → already paid → date |
  paid on; installments, repeat monthly and notes sit behind a disclosure
  that names what is switched on.
- Settling is hard to trigger by accident: a swipe counts only once it is
  clearly sideways (a diagonal scroll never settles), and a second tap right
  after settling does not undo it. The Settled toast sits at the bottom,
  above the nav, with Undo and Other day (the date sheet, no press-and-hold
  needed). Focus scrolls stop above the nav and pinned bars, and every link
  and control without a ring of its own gets a 2px outline.
- Today's due tile reads "Due by dd/MM" and counts everything to pay by then,
  overdue entries included (they were left out while overdue statements were
  in). A category without an icon shows its initial, not "…"; the seed gives
  the default categories icons, and no colours.
- Polish of 2026-09-14: the open card statement is no longer a card inside a
  card, and past statements are one compact row each with an icon to undo a
  payment. Captions are 12px (nav labels stay 11px). Contributions are
  visible in the year chart. Rates read the same everywhere: one decimal
  below 100%, no trailing ".0".
- After the second critique (28/40): a card purchase follows its statement.
  It is late only once the statement's due date passes, has no settle circle
  (a link to the statement instead) and never joins bulk settle. Cards opens
  on "To pay" (closed statements not yet paid, full-width Pay); the open
  statement is a summary with its purchases one tap away; paid ones are
  "History".
- §8 in practice: the settle circle, Pay and inline links are 44px; page
  headers wrap their actions under the title on narrow screens; under large
  text an entry row puts the amount under the description and hides the
  category disc.
- Review leads with the month's verdict (savings rate, leftover, budget) and
  what is still planned; the other numbers and every chart follow, and the
  formulas live in the guide ("The numbers"). (Since 2026-09-18 the verdict
  and the other numbers are one grid of cards, before "Still planned".)
- After the third critique (29/40): totals show settled and planned apart
  (Entries as on Review), and "Due by" says what it includes. Saves, bulk
  settles and statement payments say what and how much, with Undo (a save
  also offers Edit). Settle buttons read the amount, a skip link leads to the
  nav, and the settle hint can be dismissed. Capped categories say "over by"
  or "left" in words. The donut sorts largest first in six greys at ≥3:1 and
  labels slices of 10% or more; categories still get no colours. Entries
  opens on what happened, with the days after today folded into one row.
- After the fourth critique (30/40): the headlines count blown caps. Today's
  sentence leads with a category over its cap, and Review's verdict reads
  "2 caps over" in red. Today lists the week before the account strip
  (reopens the §2 order); on wide screens the left column stays in view.
  With nothing remembered, Add starts on "Pick a category" (required), and a
  save, a bulk settle or "settle due today" says what, how much and where,
  with Undo. A card purchase shows a card icon and its statement month,
  announced as "On the … statement, due …". Entries shows In / Out / Moved
  as a small grid beside the count; filters, donut legend and list headers
  reflow under large text; switches have a 44px hit area.
- **No brand accent.** The palette stays neutral monochrome and colour
  carries meaning only; the lime from the reference is not coming.

## Decisions (2026-09-16)

Contributions, assets and the "brokerage account", after the owner asked how
the three relate (the spec now says this in §5.2, §5.5, §5.7, §5.8):

- **A contribution has one side in cash and the other in the portfolio.**
  The brokerage account type is gone: it held no balance (investments come
  from asset movements) and existed only to be the contribution's counter
  account. Where an asset is held is its `broker`. The seed no longer
  creates `Corretora`.
- **A planned contribution has no asset; a settled one always does.** The
  amount is planned; the destination is decided when the money moves.
  Settling opens an allocation sheet (one row per asset, "still to place"
  until the parts add up); each part becomes a paired movement on that
  asset. Unsettling removes them. Bulk settle and "settle due today" leave
  contributions out. Add → Contribution asks for the split only when
  "already invested" is on.
- **A recurring contribution carries a default split** in percent
  (`recurrence_allocations`), a suggestion that pre-fills the sheet; amounts
  come out by largest remainder so they always sum. Saving a contribution
  with "repeat monthly" learns the split from how it was divided.
- **Redemption is a kind of its own**: the mirror of a contribution, cash
  coming back from an asset, not income, paired with a withdrawal. Recorded
  from the Portfolio (withdrawal + "record the cash entry"); not offered in
  Add or the + sheet.
- **The Portfolio points at unallocated money**: a settled contribution or
  redemption whose paired movements do not add up is listed with a link to
  the entry, never hidden.
- **`is_benefit` is now `is_earmarked`** ("verba carimbada"): the flag is
  about money arriving with its destination set, not about where it comes
  from. The category form explains it with the meal-voucher example; money
  the user could have kept is plain income.
- Account types, restated for the guide: **checking** and **cash** are
  liquid money; **savings** is money set aside with a goal, whose yield is
  not tracked (money one wants to see earning is an asset); **other** is any
  liquid balance that is not a bank (Mercado Pago, prepaid card); **credit
  card** is debt through statements.

## Decisions (2026-09-17)

After a read-only review of the whole project (`docs/roadmap.md` holds what
is still open):

- **A statement and its payment never disagree.** Deleting the payment
  transfer from Entries undoes the payment (statement open again,
  installment parts back to planned); the payment may change only its day,
  which the statement follows. Cards lists any statement marked paid with
  no payment behind it, or payment pointing at an unpaid statement — the two
  writes have no transaction (§4.1), so the screen says when one is missing.
- **Recurring card charges are settled when applied**, like a purchase typed
  by hand: the month's expense is complete before the statement is paid, and
  undoing a payment no longer touches them. Editing a card purchase cannot
  unsettle it.
- **Cashback and refunds are income** — on the bank account when paid there,
  on the card (inside the cycle) when credited to the statement. A statement
  in credit asks nothing; the credit carries into the next unpaid statement
  and is settled by its payment.
- **Inactive accounts that still hold money stay on Today** (badged), so
  cash on hand and the tiles agree. An account with entries cannot change
  between card and cash.
- Net worth counts a movement from its own date, not its month.
- **The seed has income categories** — Salário, Extras, Reembolso, Cashback,
  and Vale-refeição (in and out under one name, earmarked). Categories
  offers older accounts the starter categories they lack, one tap; the
  form explains that "both" is for money that comes in and goes out under
  one name.
- Record month takes each asset's own kind of movement, pre-set from its
  class.
- **"Not this month" is remembered.** Unticking a line when applying a
  month writes that month on the template (`recurrences.skipped_periods`):
  the month stops asking for it on Review, Today and Recurrences, and with
  nothing ticked the button reads "Skip N this month". A recurrence is
  applied once; whoever skipped one and needs it after all adds the entry
  by hand — a sheet to manage the month's templates was built and taken
  out the same day as needless. The starter categories an account lacks
  are offered as chips on "New category", one tap each — never as a
  standing button on the list, since a starter category deleted on purpose
  would keep it there.
- **Accounts in the nav is the money view** (`/accounts`: each cash
  account's balance today, one tap into its entries; cards stay on their
  own screen); adding and editing accounts stays in Settings, which holds
  profile, accounts, categories, assets and the theme and took Profile's
  place at the foot of the sidebar. The starter categories an account
  lacks are offered as chips on "New category", one tap each — never as a
  standing button on the list, since a starter category deleted on purpose
  would keep it there.

## Done

| Item | Commit |
|---|---|
| 9 Bulk-settle control | `58190bc` |
| 10–11 Responsive sheet, month grid, calendar date picker | `3ea4e07` |
| Theme toggle | `37f7c82` |
| 1 FAB with kind picker | `e18d2b7` |
| 2 Today hierarchy | `15284be` |
| 4–6 Month dashboards (spend line, donut, budget, last 6 months) | `8667573` |
| 3 Entries tabs + filters sheet | `00b18e6` |
| 4 Year and rolling-12-month views | `0e0849e` |
| 7–8 Category icons/colours, month-over-month deltas | this commit |

Sweep of 2026-09-13: bugs A1–A8, performance B1–B2 and UX D2–D12 all shipped
the same day (light chart tokens were near-white and are now dark; content
widens to 5xl on large screens and Today uses two columns from `lg`). Still
open: monthly balance checkpoints if derived balances ever get slow (B3), and
a "fix balance" helper if the owner asks for it.

Persona review of 2026-09-13 (`docs/ux-review-2026-09.md`), shipped the
same day: closed unpaid card statements are bills on Today (with Pay) and
the card tile shows what is due plus the % of the limit in use; bulk settle
takes a date; the add form defaults "already paid" on and remembers the
choice (description suggestions, category chips and a session list were
tried and taken out the same day — too much on the form; revisit later); the
portfolio form accepts the broker balance for a market adjustment,
remembers the kind per asset and moves to the next asset after saving, and
`/portfolio/record` records a whole month in one pass; Today detects the
last three months still to apply and links to Review's preview (a one-tap
apply was tried and removed: a template recorded by hand in an earlier month
would be duplicated); Review's card gained per-row skip; a month in progress is compared
with the previous one up to the same day, and not at all in its first week.
Left as they are, by decision: overdue below the fold (reopened on 2026-09-14), the "cash on hand"
wording, checking what was typed in Entries, and the number of charts on
Review. Paying a statement that has no recorded purchases is still not
possible — the statement is the purchases.

Review of 2026-09-13 (`docs/review-2026-09-13.md`), shipped the same day:
every unbounded list pages past PostgREST's 1000-row cap; owner-carrying
foreign keys and a `settled_on` index; sign-out is per device; error and
not-found screens; the two sides of a paired contribution stay in step;
settling has undo, a labelled button on desktop and no long press for the
mouse; installments can start at part N of M and count against the card
limit; a new asset starts from what is already invested; withdrawals pair
with a transfer back; "To receive" on Today; entries by date range with a
parent category including its children; CSV export; a goal on a savings
account (`accounts.target_cents`); the guide gained a Portuguese glossary
and a migration recipe. Decided and left as is: no transactions across
writes (Postgres stays storage, §4.1 — `payStatement` and `addMovement` do
two writes and a failure between them is visible, not silent); statements
are paid whole, from one account (split it with a transfer first).

## Decisions (2026-09-18)

Thinking through whether Today, Review and Net worth should be one screen —
they should not. They answer three questions on three time axes: *what do I
need to do* (now, no picker), *how did the month go* (a chosen period —
flow), *what do I hold* (month ends — stock). Today borrows a number from
each of the other two as a way in, never as a second home. What did change:

- **Net worth takes Portfolio's slot in the nav**; Portfolio goes under
  More. The portfolio is visited to record, the net worth to look.
- **The theme switch lives in Settings only**; the sidebar and More lost
  theirs.
- **"Due by" on Today opens the entries behind it**: planned, paid from
  cash, from the oldest overdue day to the horizon, on Entries — the anchor
  to "Next 7 days" it had was a no-op on desktop, where that list is beside
  the tile. Entries gained "Any cash account" in its account filter for
  that (card purchases go through their statement, so they are not due).
  Card statements in the sum stay on Today's "Needs you" (the tile's hint
  names them). A planned redemption is money coming in, not due.
- **Review's summary is one grid of cards, before "Still planned"**: the
  verdict row (savings rate wide, with its ex-earmarked twin as the hint;
  leftover; budget, red or amber as before), then income, expense,
  contributions and fixed cost. The month in numbers, then the month in
  rows, then the charts.
- **Months of runway moves to Net worth** (beside the headline, with the
  fixed cost it divides by): cash ÷ fixed cost is about what you hold, not
  about one month. Investments and Debt there link to Portfolio and Cards.

Interface-polish pass (the `make-interfaces-feel-better` guide, full
review, 2 medium + 7 low findings, all applied the same day):
reduced motion is honoured globally (every state change already has a
static cue, so movement just goes); titles `text-wrap: balance`, short
prose `pretty`; both bulk checkboxes sit in a 44px `<label>` (Base UI
wires the label to its hidden input); dialog and popover open and close
with transitions on `data-starting-style` / `data-ending-style` like the
drawer, so a close mid-open retargets instead of restarting — which left
`tw-animate-css` unused, so it went; `transition-all` on Button and Switch
names its properties; segmented controls are concentric (`rounded-xl`
outside, `rounded-lg` inside, 4px padding) and the overdue block wraps the
14px list at 26px (`rounded-4xl`); the FAB presses to 0.96; the currency
input types in tabular digits. Considered and left: press-scale on every
Button (the translate-y convention stays), layered shadows on cards (flat
rings by decision), 1.5px icon strokes beside small text (one stroke per
surface), filled icons for the active nav item (lucide has none).

Raised and left open: Net worth and Accounts both list the cash accounts
with their balances — one screen for "what do I hold" (net worth headline,
line, cash accounts, investments → Portfolio, debt → Cards) would remove
the duplicate; Today's cash on hand and leftover could link to their
screens; the net-worth sparkline is the least actionable thing on Today.

