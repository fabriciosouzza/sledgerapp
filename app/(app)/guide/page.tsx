import { PageHeader } from "@/components/layout/page-header";

type Term = { term: string; meaning: string };
type Section = { title: string; intro?: string; terms: Term[]; example?: string[] };

const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const SECTIONS: Section[] = [
  {
    title: "The idea",
    intro:
      "sledger is a ledger you keep by hand, once a week: what you spent, what is still due, what you invested, what you own. Nothing arrives from a bank; every number is derived from what you typed. Three rules run through the whole app.",
    terms: [
      { term: "Money is never counted twice", meaning: "A card purchase is an expense the day it is made, so paying the statement is a transfer, not a second expense. Money that leaves cash for an investment is a contribution, not spending; what it earns is yield, not income. Each real event is recorded once, in the place it belongs." },
      { term: "The app never pretends to know", meaning: "A month with no data shows “—”, not zero. A cash balance exists only from the day you set its starting point. Nothing is estimated behind your back." },
      { term: "Planned is not real yet", meaning: "Bills, installments and applied recurrences are planned entries: visible, due, but counted nowhere until you settle them. Settling — one tap, always with Undo — is the moment a number becomes real." },
      { term: "The weekly routine", meaning: "Open the app on the month; settle what was paid and received; add what is new (a purchase, a bill, a contribution); glance at the numbers. At the end of the month, apply next month's recurrences and record what the portfolio earned." },
    ],
  },
  {
    title: "Screens",
    terms: [
      { term: "Home", meaning: "The month, and the screen the app opens on: the recurring entries still to apply, the month in numbers (income, expense, contributions, fixed cost; savings rate, leftover, budget), what is still planned, what was already settled, spending through the month, and spending by category against the caps. Every tile opens the matching list in Entries. Year, under More, shows a calendar year or the last 12 months, with the budget month by month." },
      { term: "Add", meaning: "The fast form: amount first, with the numeric keyboard up. Expense, income, transfer or contribution; already paid or planned; installments and repeat monthly behind a disclosure. Enter saves; the confirmation offers Undo and Edit." },
      { term: "Entries", meaning: "Everything, a month at a time: tabs All · Spending · Income · Moves (transfers, contributions, redemptions), search, more filters, and Settle several… for a batch." },
      { term: "Portfolio", meaning: "Your assets as the sum of their movements: balance, contributed versus earned, by class, over time. Record month enters every asset's yield in one pass. It also warns when a contribution has no asset behind it." },
      { term: "Net worth · Cards · Accounts · Recurrences · Portfolio", meaning: "Net worth sits in the bottom nav; the rest is under More on the phone, in the sidebar on a wide screen. Accounts is your money by account — each balance today and, one tap in, the entries behind it." },
      { term: "Settings", meaning: "At the foot of the sidebar, at the end of More: your profile, the accounts themselves (starting balances, closing and due days, goals), the categories with their caps, the assets you invest in, the theme, sign out." },
    ],
  },
  {
    title: "Accounts and assets",
    intro:
      "The two things you own are different in nature. An account's balance moves only when you move money — every change is an entry. An asset's balance moves on its own — it yields, swings, gets charged — with no cash flow behind it. That is why an investment is never modelled as an account: its yield would have to be typed as income, and the savings rate would lie.",
    terms: [
      { term: "Checking · Cash", meaning: "Liquid money: the bank account, the notes in your wallet. Their balance is a starting point plus every settled entry since." },
      { term: "Savings", meaning: "Money set aside but still liquid — a reserve, a box for a goal — with an optional target (“R$ 2.500 of R$ 10.000”). It counts as cash and feeds the runway. Its yield is not tracked here: money you want to see earning is an asset." },
      { term: "Other", meaning: "Any liquid balance that is not a bank: a payment app, a prepaid card, money someone holds for you." },
      { term: "Credit card", meaning: "An account with a closing day, a due day and a limit. Its balance is debt through statements, never cash. You can have several." },
      { term: "Asset", meaning: "Something you invested in: Tesouro Selic, a CDB, Bitcoin. It has a class (fixed income, stocks, REITs, crypto, foreign currency, other), an optional subclass, and the broker where it is held. Two assets may share a name across brokers — a CDB at two banks — so pick lists read “name · broker”. Two CDBs at the same bank with different rates are two assets; the subclass tells them apart." },
      { term: "Where each balance comes from", meaning: "Cash from accounts and their settled entries. Investments from asset movements. Debt from unpaid card statements. Net worth is the three together, and no number is ever typed twice." },
    ],
  },
  {
    title: "Entries",
    intro: "An entry is one thing that happens to your money: a kind, a date, an amount, an account and a status.",
    terms: [
      { term: "Expense", meaning: "Money spent on consumption — a purchase, a bill, a donation. Counts against you; needs a category." },
      { term: "Income", meaning: "Salary, a voucher, a refund. Counts for you; needs a category." },
      { term: "Transfer", meaning: "Money moving between two of your accounts. Neither income nor expense; neutral for net worth. Paying a card statement is a transfer." },
      { term: "Contribution", meaning: "Cash leaving an account to become an investment. Not an expense: investing never lowers your savings rate. Its other side is one or more assets, chosen when it is settled (see below)." },
      { term: "Redemption", meaning: "The mirror of a contribution: your own money coming back from an asset into a cash account. Not income. Recorded from the Portfolio, as a withdrawal that also records the cash." },
      { term: "Planned · Settled", meaning: "Planned means it will happen: a bill to pay, income to receive, a future installment, an applied recurrence. Settled means it did, on a given day. Tap the circle to settle today; for another day, tap Other day in the confirmation or hold the circle; tap the check to undo." },
      { term: "Date vs. settled on", meaning: "Date is competence — when it falls due. Settled on is when the money moved. A bill due on the 5th paid on the 7th keeps its date and leaves your balance on the 7th." },
      { term: "Overdue", meaning: "Planned, and its date has passed (for a card purchase, its statement's due date). Shown in red until you settle it, however old it is: on Home when it belongs to the month, on Entries otherwise." },
      { term: "Categories and caps", meaning: "Every expense and income has a category; sub-categories go one level deep and roll up into their parent. An expense category may have a monthly cap; Home shows the progress bar and says “over by” when it is blown. The caps together are your budget." },
      { term: "Earmarked money", meaning: "A meal voucher arrives as income and leaves as lunches in the same month: it inflates both sides and makes the savings rate look worse the bigger it is. A category marked earmarked takes both the income and the matching expenses; the second savings rate leaves them out. The test is “could I have kept this money?” — if yes, it is plain income." },
      { term: "Installments", meaning: "One purchase in N parts creates N planned entries at once, one per month, numbered 1/N … N/N, with the whole commitment visible from day one. A plan already under way starts at part K of N. Editing or deleting asks: this part, this and future ones, or all." },
      { term: "On a card", meaning: "A purchase on a credit card counts the day it is made — typed by hand or applied from a recurrence — and joins the statement of its cycle; you never settle it one by one, and the edit form will not unsettle it. Card installments are the exception: each part settles when its statement is paid." },
    ],
  },
  {
    title: "Contributions, step by step",
    intro: "A contribution has one side in cash and the other in the portfolio. The amount is decided when you plan; the destination when the money actually moves.",
    terms: [
      { term: "1. Plan it", meaning: "From Add (Contribution, “already invested” off) or from a recurrence: R$ 1.000 leaving Conta Corrente on the 6th. No asset yet — it is only an intention." },
      { term: "2. Settle it with its allocation", meaning: "Tapping the circle opens “Which assets does it go to?”: one row per asset with an amount, and a running “still to place” until the parts add up to the entry. All into fixed income this month, half crypto the next — you decide each time. Settle records one contribution movement per asset, paired to the entry." },
      { term: "The default split", meaning: "A recurring contribution can carry percentages per asset (70/30). They only pre-fill the sheet; the amounts come out of them so that they always sum exactly, and you can still change them for the month. Saving a contribution with “repeat monthly” learns the split from how you divided it." },
      { term: "Already invested", meaning: "With “already invested” on, Add asks for the allocation right there. The Portfolio's Contribution movement does the same from the other side: pick the cash account and the entry is created, settled and paired." },
      { term: "One line per asset", meaning: "Each asset appears once in a split: its part is what matters for the balance. Two purchases of the same asset on one day are one line, or two contributions." },
      { term: "Editing and undoing", meaning: "Unsettling a contribution removes its movements; settling again asks for the split again. Editing a settled one shows its split, and the amount can change only with a split that adds up. Deleting the entry deletes its movements; a paired movement cannot be deleted or resized from the Portfolio on its own — it is one part of the entry." },
      { term: "Never left without a destination", meaning: "Bulk settle and “settle all due today” skip contributions, because they need a split. If something still leaves a settled contribution or redemption with parts that do not add up, the Portfolio lists it with a link to fix it." },
    ],
  },
  {
    title: "Recurrences",
    intro: "A recurrence is a template — rent, a subscription, a salary, a monthly contribution — not an entry. Each month it becomes entries when you apply it.",
    terms: [
      { term: "Apply to the month", meaning: "Home shows a card whenever the month still has recurring entries to apply: each amount is editable before it exists, and a line can be skipped. Applying twice creates nothing the second time; a template recorded by hand in an earlier month is not duplicated either." },
      { term: "Variable", meaning: "Water, electricity: the template holds an estimate; you type the real amount when applying, and the estimate stays on the template. Variable bills are left out of “settle all due today”." },
      { term: "Due day", meaning: "Day of the month the entry falls on. Day 31 becomes the 28th, 29th or 30th in shorter months. Starts on and ends on bound which months it applies to." },
      { term: "Fixed cost", meaning: "The sum of your active expense recurrences: what a month costs before any choice, and the number that sizes the emergency fund. Contributions and income are not in it." },
      { term: "Repeat monthly", meaning: "On the add screen: creates the template and this month's entry in one go. A template that already ran cannot be deleted, only deactivated — its entries stay." },
    ],
  },
  {
    title: "Cards",
    intro: "A credit card is an account with a closing day and a due day. Its balance is debt, never cash.",
    terms: [
      { term: "Statement", meaning: "Everything bought on the card in one cycle. The cycle ends on the closing day; a purchase after it lands on the next statement; the due date follows. The cycle that contains today is the open statement." },
      { term: "Pay statement", meaning: "Once a statement has closed, Pay records a transfer from a cash account into the card for its total, dated the day you paid, and marks it paid — that is what settles the installment parts on it. An open statement cannot be paid yet, and a statement is paid whole, from one account. The payment can only change its day; to change anything else, undo it from Cards and pay again — deleting the payment is the same as undoing it." },
      { term: "Cashback and refunds", meaning: "Money the card gives back is income, in a category of its own (say Cashback). Paid into your bank account, it is income on that account; credited on the statement, it is income on the card, dated inside the cycle, and the statement to pay shrinks by it. A statement whose credits exceed its purchases asks nothing and carries the surplus into the next unpaid one." },
      { term: "Card debt", meaning: "Everything bought and not yet paid, across every card, open statements included. Cards shows closed, unpaid statements first, with Pay right there." },
      { term: "Limit", meaning: "The tile shows the share of the limit in use: the debt plus the installments still to come." },
    ],
  },
  {
    title: "Investments",
    intro: "An asset's balance is the running sum of its movements. There are no quotes and no average price: the dashboard separates what you put in from what it earned.",
    terms: [
      { term: "Contribution", meaning: "New money in. From an entry's allocation (above), or from the Portfolio with the cash account picked, so the entry is created too. An asset added with “already invested” starts from what you put in and what it is worth today, with no cash entry — that money left the bank long ago." },
      { term: "Yield", meaning: "Interest or dividends, entered by hand. Raises net worth; not income for the savings rate." },
      { term: "Market adjustment", meaning: "Crypto, currency, stocks: type what the broker shows and the difference becomes the adjustment — the only amount in sledger that may be negative." },
      { term: "Withdrawal · Fee/tax", meaning: "Money out and costs. A withdrawal with a cash account picked records the cash arriving as a redemption, paired." },
      { term: "Record month", meaning: "One pass over every asset at month end: the yield of each, or the balance at the broker — the difference is recorded, unchanged lines are skipped. Each line moves the way its asset does: fixed income as yield, anything with a price as a market adjustment; change a line when it was the other way, and the choice is remembered." },
      { term: "Contributed vs. earned", meaning: "Contributed = contributions − withdrawals. Earned = yield + adjustments − fees. Balance = contributed + earned. Return on contributions = earned ÷ contributed." },
    ],
  },
  {
    title: "Balances and net worth",
    terms: [
      { term: "Starting point", meaning: "Each cash account has a balance on the day you start tracking it (Settings → Accounts). From then on, every settled entry moves it: income in, expenses out, transfers between accounts, contributions out, redemptions in." },
      { term: "Account screen", meaning: "Accounts in the menu, or tap an account on Net worth: balance today, starting point, what changed since, and only that account's entries. If the bank shows a different number, the missing entry is somewhere in that list — or not yet recorded." },
      { term: "Cash on hand", meaning: "The sum of your cash accounts today, derived from what you recorded. Savings accounts are part of it, shown apart." },
      { term: "Net worth", meaning: "cash + investments − debt, for any month, each part derived: cash from accounts and entries, investments from movements, debt from unpaid statements. Months before your first account stay empty, never zero." },
    ],
  },
  {
    title: "The numbers",
    intro:
      "All of them come from settled entries of one month, in cents, with no rounding tricks. Take a month with R$ 5.000 salary, R$ 800 meal voucher (earmarked), R$ 3.200 spent, R$ 1.000 contributed, R$ 2.500 in fixed recurrences and R$ 10.000 of cash: the examples below use it.",
    terms: [
      { term: "Income · Expense · Contributions", meaning: "Sums of settled entries of each kind. Transfers are never in any of them; a redemption is shown next to contributions, never as income. Planned entries show separately (\"+ R$ 120,00 planned\") and only count once settled. Example: income R$ 5.800, expense R$ 3.200, contributions R$ 1.000." },
      { term: "Leftover", meaning: "income − expense − contributions + redemptions: what stayed in cash after everything, investing included. Example: 5.800 − 3.200 − 1.000 = R$ 1.600. Negative means the month ate into what you had." },
      { term: "Savings rate", meaning: "(income − expense) ÷ income: the share of what came in that you did not consume. Contributions are not subtracted — they are saving, not spending. Example: (5.800 − 3.200) ÷ 5.800 = 44,8%. Irregular income? The month's rate swings with who paid; read the 12-month one on Home." },
      { term: "Savings rate ex-earmarked", meaning: "The same, with earmarked income removed from the denominator, because it arrives with its destination set and leaves in the same month. Example: (5.800 − 3.200) ÷ (5.800 − 800) = 52%. This is the honest one." },
      { term: "Budget", meaning: "The sum of the caps you set on categories; a category without a cap adds nothing. \"Spent R$ 3.200 of R$ 3.500 · 91%\" — within under 80%, at risk between 80% and 100%, over beyond. Spending in categories without a cap is shown beside it, not counted against it." },
      { term: "Fixed cost", meaning: "Σ active expense recurrences, whatever was applied this month. Example: R$ 2.500. Installment parts are shown next to it: committed too, but they end." },
      { term: "Months of runway", meaning: "cash on hand ÷ fixed cost: how long the cash would last with no income at all. Example: 10.000 ÷ 2.500 = 4,0 months." },
      { term: "vs last month", meaning: "The change in income or expense against the previous month, up to the same day of the month, so a month in progress is compared fairly — and not at all in its first week." },
      { term: "—", meaning: "Unknown. It appears when a number cannot be computed yet (no cash account, no income this month, no fixed cost). It is never a zero in disguise." },
    ],
  },
];

export default function GuidePage() {
  return (
    <>
      <PageHeader title="How sledger works" description="The concepts, the flows and the rules behind every number." />
      <div className="space-y-8">
        <nav aria-label="Sections" className="flex flex-wrap gap-1.5 text-xs">
          {[...SECTIONS.map((s) => s.title), "Starting from a spreadsheet", "Two people, one ledger"].map((title) => (
            <a key={title} href={`#${slug(title)}`} className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-muted-foreground hover:text-foreground">
              {title}
            </a>
          ))}
        </nav>

        {SECTIONS.map((section) => (
          <section key={section.title} aria-labelledby={slug(section.title)}>
            <h2 id={slug(section.title)} className="mb-1 text-base font-semibold">
              {section.title}
            </h2>
            {section.intro && <p className="mb-3 text-sm text-muted-foreground">{section.intro}</p>}
            <dl className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              {section.terms.map((t) => (
                <div key={t.term} className="px-4 py-3">
                  <dt className="text-sm font-medium">{t.term}</dt>
                  <dd className="text-sm text-muted-foreground">{t.meaning}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <section aria-labelledby={slug("Starting from a spreadsheet")}>
          <h2 id={slug("Starting from a spreadsheet")} className="mb-1 text-base font-semibold">
            Starting from a spreadsheet
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">Your history stays where it is; sledger starts on the day you pick. Five things to set on that day — Recurrences from the menu, the rest in Settings:</p>
          <ol className="list-decimal space-y-2 rounded-xl bg-card px-4 py-3 pl-8 text-sm ring-1 ring-foreground/10">
            <li>
              <strong>Cash accounts</strong>: the balance each one had at the start of that day (“Starting point”). Entries settled before it are ignored.
            </li>
            <li>
              <strong>Cards</strong>: closing and due days. For a statement already running, add one expense on the card dated inside the cycle, category Outros, description “Fatura anterior” — it becomes the statement to pay. It does count as spending of that month; if that bothers you, date it in the previous month instead.
            </li>
            <li>
              <strong>Installments under way</strong>: add the purchase with “Parts” = the total and “This is part” = the next one to pay. Earlier parts are not created.
            </li>
            <li>
              <strong>Investments</strong>: one asset per thing you hold, with its broker; when adding it, fill “Already invested?” with what you put in and what it is worth today. No cash entry is created — that money left the bank long ago.
            </li>
            <li>
              <strong>Recurrences</strong>: salary, rent, the fixed bills, the monthly transfer to savings, the monthly contribution with its default split. Apply them from Home each month.
            </li>
          </ol>
        </section>

        <section aria-labelledby={slug("Two people, one ledger")}>
          <h2 id={slug("Two people, one ledger")} className="mb-1 text-base font-semibold">
            Two people, one ledger
          </h2>
          <dl className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <div className="px-4 py-3">
              <dt className="text-sm font-medium">Who paid</dt>
              <dd className="text-sm text-muted-foreground">The account says it: one checking account each, plus the joint one. When that is not enough, write it in the notes (“#carla”) — search finds notes too.</dd>
            </div>
            <div className="px-4 py-3">
              <dt className="text-sm font-medium">Sessions</dt>
              <dd className="text-sm text-muted-foreground">Sign in on each phone with the same account. Signing out on one device does not sign out the other. A tab left open refreshes itself when you come back to it.</dd>
            </div>
            <div className="px-4 py-3">
              <dt className="text-sm font-medium">A goal</dt>
              <dd className="text-sm text-muted-foreground">One savings account per goal, with a target (Settings → Accounts): the tile shows how far along it is.</dd>
            </div>
            <div className="px-4 py-3">
              <dt className="text-sm font-medium">Sub-categories</dt>
              <dd className="text-sm text-muted-foreground">One level only, and a sub-category rolls up into one parent. “Pediatra” is either Saúde or Filho — pick the question you ask most often.</dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}
