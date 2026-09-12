import { PageHeader } from "@/components/layout/page-header";

type Term = { term: string; meaning: string };
type Section = { title: string; intro?: string; terms: Term[] };

const SECTIONS: Section[] = [
  {
    title: "The weekly routine",
    intro:
      "sledger is built for one sitting a week: open Today, settle what was paid, add what is new, glance at the month. Nothing updates itself from a bank — every number comes from what you typed, so the app never pretends to know something it does not.",
    terms: [
      { term: "Today", meaning: "What needs doing now: cash on hand, what is overdue, what is due in the next 7 days, the cards, and one sentence about the month." },
      { term: "Review", meaning: "How the month, the year or the last 12 months went: income, expense, contributions, both savings rates, spending by category against caps, recurring entries still to apply, and what is still planned." },
      { term: "Portfolio", meaning: "Your investments as the sum of their movements — no market quotes." },
      { term: "More", meaning: "Everything else: the full list of entries, cards, recurrences, net worth, settings and this guide." },
    ],
  },
  {
    title: "Entries",
    intro: "An entry is one thing that happens to your money. It has a kind, a date, an amount and a status.",
    terms: [
      { term: "Expense", meaning: "Money spent on consumption. Counts against you." },
      { term: "Income", meaning: "Salary, benefit, refund. Counts for you." },
      { term: "Transfer", meaning: "Money moving between two of your accounts. Neither income nor expense — paying a card statement is a transfer, because the purchases were already expenses." },
      { term: "Contribution", meaning: "Cash that leaves an account to become an investment. Not an expense: investing should never lower your savings rate." },
      { term: "Planned", meaning: "It will happen: a bill to pay, income to receive, a future installment, a generated recurrence." },
      { term: "Settled", meaning: "It happened. Tap the circle on any entry to settle it; tap the check to undo." },
      { term: "Overdue", meaning: "Planned, and its date has passed. Shown in red on Today until you settle it." },
      { term: "Date vs. settled on", meaning: "Date is when it falls due; settled on is when the money moved. A bill due on the 5th paid on the 7th keeps its date and gets settled on the 7th." },
      { term: "Installments", meaning: "One purchase in N parts creates N planned entries at once, one per month, numbered 1/N … N/N. Editing or deleting asks whether it applies to this part, this and future ones, or all." },
    ],
  },
  {
    title: "Recurrences",
    intro: "A recurrence is a template — rent, a subscription, a salary — not an entry.",
    terms: [
      { term: "Generate month", meaning: "Turns every active template into that month's planned entries. Running it twice creates nothing the second time." },
      { term: "Due day", meaning: "Day of the month the entry falls on. Day 31 becomes the 28th, 29th or 30th in shorter months." },
      { term: "Fixed cost", meaning: "The sum of your active expense recurrences: what a month costs before any choice. It sizes the emergency fund." },
      { term: "Repeat monthly", meaning: "On the add screen: creates the template and this month's entry in one go." },
    ],
  },
  {
    title: "Cards",
    intro: "A credit card is an account with a closing day and a due day. Its balance is debt, never cash.",
    terms: [
      { term: "Statement", meaning: "Everything bought on the card in one cycle. A purchase after the closing day lands on the next statement." },
      { term: "Pay statement", meaning: "Records a transfer from a cash account into the card for the statement total and marks it paid." },
      { term: "Card debt", meaning: "The sum of unpaid statements across every card." },
    ],
  },
  {
    title: "Investments",
    intro: "An asset's balance is the running sum of its movements. There are no quotes and no average price.",
    terms: [
      { term: "Contribution", meaning: "New money in. Can also record the matching cash entry from your account to the brokerage." },
      { term: "Yield", meaning: "Interest or dividends, entered by hand. Raises net worth; not income for the savings rate." },
      { term: "Market adjustment", meaning: "The difference between what the broker shows and what sledger has. The only amount that may be negative." },
      { term: "Withdrawal · Fee/tax", meaning: "Money out and costs." },
      { term: "Contributed vs. earned", meaning: "Contributed = contributions − withdrawals. Earned = yield + adjustments − fees. Balance = contributed + earned." },
    ],
  },
  {
    title: "Balances and net worth",
    terms: [
      { term: "Starting point", meaning: "Each cash account has a balance on the day you start tracking it (in its settings). From then on, every settled entry moves it: income in, expenses out, transfers between accounts." },
      { term: "Cash on hand", meaning: "The sum of your cash accounts today, derived from what you recorded. If the bank shows something else, an entry is missing — add it." },
      { term: "Net worth", meaning: "cash + investments − debt, for any month. Months before your first account stay empty, never zero." },
    ],
  },
  {
    title: "The numbers",
    terms: [
      { term: "Leftover", meaning: "income − expense − contributions, settled only." },
      { term: "Savings rate", meaning: "(income − expense) ÷ income. What you kept of what came in." },
      { term: "Savings rate ex-benefits", meaning: "The same, but benefits (meal voucher, allowances) are removed from income. Mark a category as a benefit in settings." },
      { term: "Budget", meaning: "The sum of the caps you set on categories. Within under 80%, at risk up to 100%, over beyond." },
      { term: "Months of runway", meaning: "cash on hand ÷ fixed cost: how long the cash would last with no income." },
      { term: "—", meaning: "Unknown. It appears when a number cannot be computed yet (no cash account yet, no income this month). It is never a zero in disguise." },
    ],
  },
];

export default function GuidePage() {
  return (
    <>
      <PageHeader title="How sledger works" description="The terms you will see, in one place." />
      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.title} aria-labelledby={section.title}>
            <h2 id={section.title} className="mb-1 text-base font-semibold">
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
      </div>
    </>
  );
}
