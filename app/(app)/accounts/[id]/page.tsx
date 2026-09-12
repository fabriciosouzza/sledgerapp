import Link from "next/link";
import { notFound } from "next/navigation";
import { Settings2 } from "lucide-react";
import { EntryList } from "@/components/entries/entry-list";
import { buildLookups } from "@/components/entries/lookups";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/month/month-picker";
import { Stat } from "@/components/month/stat";
import { Button } from "@/components/ui/button";
import { accountTypeLabel, isCashAccount, isCreditCard } from "@/lib/domain/accounts";
import { formatDate, isPeriod, periodOf, today } from "@/lib/domain/dates";
import { getAccount, listAccounts } from "@/lib/services/accounts";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { listEntries } from "@/lib/services/entries";
import { ServiceError } from "@/lib/services/errors";
import { netWorthOverview } from "@/lib/services/netWorth";

/** One account: its balance, where it started, and only its entries, month by month. */
export default async function AccountPage(props: PageProps<"/accounts/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const now = today();
  const month = typeof sp.month === "string" && isPeriod(sp.month) ? sp.month : periodOf(now);
  const { userId, repos } = await getContext();
  const account = await getAccount(repos, userId, id).catch((error: unknown) => {
    if (error instanceof ServiceError && error.code === "not_found") notFound();
    throw error;
  });
  if (isCreditCard(account)) {
    // Cards live on /cards, statement by statement.
    return (
      <>
        <PageHeader title={account.name} description={accountTypeLabel(account.type)} />
        <Button render={<Link href={`/cards?card=${account.id}`} />} nativeButton={false} className="h-11">
          Open the card statements
        </Button>
      </>
    );
  }

  const filters = { touchingAccountIds: [account.id] };
  const [entries, accounts, categories, netWorth] = await Promise.all([
    listEntries(repos, userId, { ...filters, period: month }),
    listAccounts(repos, userId),
    listCategories(repos, userId),
    isCashAccount(account) ? netWorthOverview(repos, userId, now, 1) : Promise.resolve(null),
  ]);
  const balance = netWorth?.balances.find((b) => b.account.id === account.id)?.balanceCents ?? null;

  return (
    <>
      <PageHeader
        title={account.name}
        description={[accountTypeLabel(account.type), account.institution].filter(Boolean).join(" · ")}
        action={
          <Button variant="ghost" size="icon-lg" aria-label="Account settings" className="size-11" render={<Link href={`/settings/accounts/${account.id}`} />} nativeButton={false}>
            <Settings2 aria-hidden />
          </Button>
        }
      />
      <div className="space-y-6">
        {isCashAccount(account) && (
          <section className="grid grid-cols-2 gap-2" aria-label="Balance">
            <Stat label="Balance today" cents={balance} className="col-span-2" />
            <Stat label="Started at" cents={account.openingBalanceCents} hint={`on ${formatDate(account.openingOn)}`} />
            <Stat label="Since then" cents={balance === null ? null : balance - account.openingBalanceCents} tone="signed" hint="settled entries" />
          </section>
        )}
        {!isCashAccount(account) && (
          <p className="text-sm text-muted-foreground">
            A brokerage holds investments; its value is on <Link href="/portfolio" className="text-primary hover:underline">Portfolio</Link>. Below, the cash that went in and out.
          </p>
        )}

        <MonthPicker period={month} basePath={`/accounts/${account.id}`} />

        <EntryList
          key={month}
          initial={entries}
          period={month}
          filters={filters}
          lookups={buildLookups(accounts, categories)}
          today={now}
          emptyMessage={`Nothing on ${account.name} this month.`}
        />
        <p className="px-1 text-xs text-muted-foreground">A transfer shows on both accounts it touches.</p>
      </div>
    </>
  );
}
