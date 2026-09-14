import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { NetWorthLine } from "@/components/charts/net-worth-line";
import { PageHeader } from "@/components/layout/page-header";
import { Stat } from "@/components/month/stat";
import { accountTypeLabel } from "@/lib/domain/accounts";
import { formatDate, formatPeriodLong, today } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import { getContext } from "@/lib/services/context";
import { netWorthOverview } from "@/lib/services/netWorth";

export default async function NetWorthPage() {
  const now = today();
  const { userId, repos } = await getContext();
  const overview = await netWorthOverview(repos, userId, now);
  const current = overview.current;
  const active = overview.balances.filter((b) => b.account.isActive);

  return (
    <>
      <PageHeader title="Net worth" description="cash + investments − debt, from what you recorded" />
      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-2 md:grid-cols-3" aria-label="Current">
          <Stat label={`Net worth · ${formatPeriodLong(current.period)}`} cents={current.netWorthCents} tone="signed" className="col-span-2" />
          <Stat label="Cash" cents={current.cashCents} hint="accounts below" />
          <Stat label="Debt" cents={current.debtCents} hint="unpaid statements" />
          <Stat label="Investments" cents={current.investmentsCents} hint="from movements" className="col-span-2" />
        </section>

        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-2 text-sm font-semibold">Last 12 months</h2>
          <NetWorthLine data={overview.series} />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Cash accounts</h2>
          {active.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">No cash account yet.</p>
              <Link href="/settings/accounts/new" className="mt-2 inline-flex min-h-11 items-center text-sm text-primary hover:underline">
                Add one
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              {active.map(({ account, balanceCents }) => (
                <li key={account.id}>
                  <Link
                    href={`/accounts/${account.id}`}
                    className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{account.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {accountTypeLabel(account.type)} · from {formatDate(account.openingOn)} at {formatBRL(account.openingBalanceCents)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{balanceCents === null ? "—" : formatBRL(balanceCents)}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            A balance is the opening balance plus every settled entry since. If the bank shows something else, an entry is missing — add it.
          </p>
        </section>
      </div>
    </>
  );
}
