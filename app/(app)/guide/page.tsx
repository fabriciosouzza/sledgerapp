import { PageHeader } from "@/components/layout/page-header";

type Term = { term: string; meaning: string; pt?: string };
type Section = { title: string; intro?: string; terms: Term[]; example?: string[] };

const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** The screens are in English (spec §2); the words are not always obvious. Portuguese for the ones that matter. */
const GLOSSARY: [string, string][] = [
  ["Settle / Receive", "dar baixa: marcar como pago (ou recebido)"],
  ["Planned", "previsto, ainda não aconteceu"],
  ["Overdue", "atrasado: previsto para uma data que já passou"],
  ["Cash on hand", "dinheiro em caixa: a soma das contas de dinheiro"],
  ["Due in 7 days", "vence em 7 dias"],
  ["To receive", "a receber"],
  ["Leftover", "sobra do mês: receita − despesa − aportes"],
  ["Savings rate", "taxa de poupança: quanto do que entrou você não gastou"],
  ["Ex-benefits", "sem benefícios (vale-refeição, por exemplo)"],
  ["Fixed cost", "custo fixo: as despesas recorrentes ativas"],
  ["Recurring / Recurrence", "recorrente: um modelo que vira um lançamento por mês"],
  ["Generate / Apply", "aplicar as recorrências do mês"],
  ["Statement", "fatura do cartão"],
  ["Closes / Due", "fecha / vence"],
  ["Installments / Parts", "parcelas"],
  ["Transfer", "transferência entre suas contas"],
  ["Contribution", "aporte: dinheiro que vira investimento"],
  ["Withdrawal", "resgate"],
  ["Yield", "rendimento (juros, dividendos)"],
  ["Market adjustment", "ajuste de mercado: o que mudou de preço"],
  ["Contributed / Earned", "aportado / ganho"],
  ["Net worth", "patrimônio: caixa + investimentos − cartões"],
  ["Starting point", "saldo inicial de uma conta, na data em que você começou"],
  ["Cap", "teto mensal de uma categoria"],
  ["Runway", "quantos meses o caixa cobre o custo fixo"],
];

const SECTIONS: Section[] = [
  {
    title: "The weekly routine",
    intro:
      "sledger is built for one sitting a week: open Today, settle what was paid, add what is new, glance at the month. Nothing updates itself from a bank — every number comes from what you typed, so the app never pretends to know something it does not.",
    terms: [
      { term: "Today", meaning: "What needs doing now: cash on hand, one sentence about the month, what is due in the next 7 days, your accounts and cards, what is overdue. Tap a number to open the entries behind it; tap an account to see its balance and its entries." },
      { term: "Review", meaning: "How a month went — or a calendar year, or the last 12 months. Income, expense, contributions, both savings rates, spending against your caps, the recurring entries still to apply, and what is still planned. Every tile opens the matching list in Entries." },
      { term: "Entries", meaning: "Every entry, a month at a time, with tabs All · Spending · Income · Moves (transfers and contributions), search and more filters. Settle several at once from here." },
      { term: "Portfolio", meaning: "Your investments as the sum of their movements — no market quotes." },
      { term: "More", meaning: "Entries, Cards, Recurrences, Net worth, Settings, this guide. On a wide screen they sit in the sidebar." },
    ],
  },
  {
    title: "Entries",
    intro: "An entry is one thing that happens to your money. It has a kind, a date, an amount, an account and a status.",
    terms: [
      { term: "Expense", meaning: "Money spent on consumption. Counts against you." },
      { term: "Income", meaning: "Salary, benefit, refund. Counts for you." },
      { term: "Transfer", meaning: "Money moving between two of your accounts. Neither income nor expense — paying a card statement is a transfer, because the purchases were already expenses when they happened." },
      { term: "Contribution", meaning: "Cash that leaves an account to become an investment. Not an expense: investing should never lower your savings rate. Record it from the Portfolio so the asset moves too." },
      { term: "Planned", meaning: "It will happen: a bill to pay, income to receive, a future installment, a recurring entry you applied to the month." },
      { term: "Settled", meaning: "It happened. Tap the circle on any entry to settle it today; hold the circle to pick another day; tap the check to undo." },
      { term: "Overdue", meaning: "Planned, and its date has passed. Shown in red on Today until you settle it, however old it is." },
      { term: "Date vs. settled on", meaning: "Date is when it falls due; settled on is when the money moved. A bill due on the 5th paid on the 7th keeps its date and gets settled on the 7th — and that is the day it leaves your balance." },
      { term: "Installments", meaning: "One purchase in N parts creates N planned entries at once, one per month, numbered 1/N … N/N. Editing or deleting asks whether it applies to this part, this and future ones, or all." },
      { term: "On a card", meaning: "A purchase on a credit card counts the day it is made — you never settle it one by one; you pay the statement. Card installments wait for their statement: they settle when it is paid." },
    ],
  },
  {
    title: "Recurrences",
    intro: "A recurrence is a template — rent, a subscription, a salary — not an entry. Each month it becomes entries when you apply it.",
    terms: [
      { term: "Apply to the month", meaning: "Review shows a card whenever the month still has recurring entries to apply, with each amount editable before it exists. Applying twice creates nothing the second time." },
      { term: "Variable", meaning: "Water, electricity: the template holds an estimate; you type the real amount when applying, and the template keeps its estimate." },
      { term: "Due day", meaning: "Day of the month the entry falls on. Day 31 becomes the 28th, 29th or 30th in shorter months." },
      { term: "Fixed cost", meaning: "The sum of your active expense recurrences: what a month costs before any choice. It sizes the emergency fund." },
      { term: "Repeat monthly", meaning: "On the add screen: creates the template and this month's entry in one go." },
    ],
  },
  {
    title: "Cards",
    intro: "A credit card is an account with a closing day and a due day. Its balance is debt, never cash.",
    terms: [
      { term: "Statement", meaning: "Everything bought on the card in one cycle. A purchase after the closing day lands on the next statement. The cycle that contains today is the open statement." },
      { term: "Pay statement", meaning: "Once a statement has closed, Pay records a transfer from a cash account into the card for its total and marks it paid. An open statement cannot be paid yet." },
      { term: "Card debt", meaning: "Everything bought and not yet paid, across every card — open statements included." },
    ],
  },
  {
    title: "Investments",
    intro: "An asset's balance is the running sum of its movements. There are no quotes and no average price.",
    terms: [
      { term: "Contribution", meaning: "New money in. From the Portfolio it can also record the cash entry from your account to the brokerage, so cash flow and portfolio agree." },
      { term: "Yield", meaning: "Interest or dividends, entered by hand. Raises net worth; not income for the savings rate." },
      { term: "Market adjustment", meaning: "The difference between what the broker shows and what sledger has. The only amount that may be negative." },
      { term: "Withdrawal · Fee/tax", meaning: "Money out and costs. Record the cash arriving as a transfer from the brokerage account." },
      { term: "Contributed vs. earned", meaning: "Contributed = contributions − withdrawals. Earned = yield + adjustments − fees. Balance = contributed + earned." },
    ],
  },
  {
    title: "Balances and net worth",
    terms: [
      { term: "Starting point", meaning: "Each cash account has a balance on the day you start tracking it (Settings → Accounts). From then on, every settled entry moves it: income in, expenses out, transfers between accounts." },
      { term: "Account screen", meaning: "Tap an account on Today or on Net worth: balance today, starting point, what changed since, and only that account's entries. If the bank shows a different number, the missing entry is somewhere in that list — or not yet recorded." },
      { term: "Cash on hand", meaning: "The sum of your cash accounts today, derived from what you recorded." },
      { term: "Net worth", meaning: "cash + investments − debt, for any month. Months before your first account stay empty, never zero." },
    ],
  },
  {
    title: "The numbers",
    intro:
      "All of them come from settled entries of one month, in cents, with no rounding tricks. Take a month with R$ 5.000 salary, R$ 800 meal voucher (a benefit), R$ 3.200 spent, R$ 1.000 contributed, R$ 2.500 in fixed recurrences and R$ 10.000 of cash: the examples below use it.",
    terms: [
      { term: "Income · Expense · Contributions", meaning: "Sums of settled entries of each kind. Transfers are never in any of them. Planned entries show separately (\"+ R$ 120,00 planned\") and only count once settled. Example: income R$ 5.800, expense R$ 3.200, contributions R$ 1.000." },
      { term: "Leftover", meaning: "income − expense − contributions: what stayed in cash after everything, investing included. Example: 5.800 − 3.200 − 1.000 = R$ 1.600. Negative means the month ate into what you had." },
      { term: "Savings rate", meaning: "(income − expense) ÷ income: the share of what came in that you did not consume. Contributions are not subtracted — they are saving, not spending. Example: (5.800 − 3.200) ÷ 5.800 = 44,8%. Irregular income? The month's rate swings with who paid; read the 12-month one in Review." },
      { term: "Savings rate ex-benefits", meaning: "The same, but benefits (meal voucher, allowances — categories marked as benefit) are removed from income, because they enter and leave in the same month and inflate both sides. Example: (5.800 − 3.200) ÷ (5.800 − 800) = 52%. This is the honest one." },
      { term: "Budget", meaning: "The sum of the caps you set on categories; a category without a cap adds nothing. \"Spent R$ 3.200 of R$ 3.500 · 91%\" — within under 80%, at risk between 80% and 100%, over beyond. Sub-categories keep their own caps and roll up into their parent." },
      { term: "Fixed cost", meaning: "Σ active expense recurrences, whatever was applied this month. Example: R$ 2.500. Installment parts are shown next to it: committed too, but they end." },
      { term: "Months of runway", meaning: "cash on hand ÷ fixed cost: how long the cash would last with no income at all. Example: 10.000 ÷ 2.500 = 4,0 months." },
      { term: "vs last month", meaning: "The change in income or expense against the previous month: (this − last) ÷ last. It compares the month so far with a whole month, so early in the month it exaggerates; read it after the 20th." },
      { term: "The sentence on Today", meaning: "Picks the most useful true statement: spending up or down vs last month when both months have expenses; otherwise the savings rate; otherwise what is still planned. The ring is the savings rate." },
      { term: "—", meaning: "Unknown. It appears when a number cannot be computed yet (no cash account, no income this month, no fixed cost). It is never a zero in disguise." },
    ],
  },
];

export default function GuidePage() {
  return (
    <>
      <PageHeader title="How sledger works" description="The terms you will see, in one place." />
      <div className="space-y-8">
        <nav aria-label="Sections" className="flex flex-wrap gap-1.5 text-xs">
          {[...SECTIONS.map((s) => s.title), "Em português", "Starting from a spreadsheet", "Two people, one ledger"].map((title) => (
            <a key={title} href={`#${slug(title)}`} className="rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground">
              {title}
            </a>
          ))}
        </nav>

        <section aria-labelledby={slug("Em português")}>
          <h2 id={slug("Em português")} className="mb-1 text-base font-semibold">
            Em português
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">As telas estão em inglês. As palavras que mais aparecem, traduzidas.</p>
          <dl className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 sm:grid-cols-2 sm:divide-y-0">
            {GLOSSARY.map(([en, pt]) => (
              <div key={en} className="flex gap-3 px-4 py-2 text-sm">
                <dt className="w-36 shrink-0 font-medium">{en}</dt>
                <dd className="text-muted-foreground">{pt}</dd>
              </div>
            ))}
          </dl>
        </section>

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
          <p className="mb-3 text-sm text-muted-foreground">Your history stays where it is; sledger starts on the day you pick. Five things to set on that day, all in Settings:</p>
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
              <strong>Investments</strong>: when adding the asset, fill “Already invested?” with what you put in and what it is worth today. No cash entry is created.
            </li>
            <li>
              <strong>Recurrences</strong>: salary, rent, the fixed bills, the monthly transfer to savings. Apply them from Review each month.
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
