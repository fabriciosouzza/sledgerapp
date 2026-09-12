import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { accountTypeLabel, isCreditCard } from "@/lib/domain/accounts";
import { formatBRL } from "@/lib/domain/money";
import type { Account } from "@/lib/domain/types";
import { listAccounts } from "@/lib/services/accounts";
import { getContext } from "@/lib/services/context";

export default async function AccountsPage() {
  const { userId, repos } = await getContext();
  const accounts = await listAccounts(repos, userId);
  const active = accounts.filter((a) => a.isActive);
  const inactive = accounts.filter((a) => !a.isActive);

  return (
    <>
      <PageHeader
        title="Accounts"
        action={
          <Button render={<Link href="/settings/accounts/new" />} nativeButton={false} size="lg" className="h-11">
            <Plus data-icon="inline-start" aria-hidden />
            Add
          </Button>
        }
      />
      {accounts.length === 0 ? (
        <EmptyAccounts />
      ) : (
        <div className="space-y-6">
          <AccountList accounts={active} />
          {inactive.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Inactive</h2>
              <AccountList accounts={inactive} />
            </section>
          )}
        </div>
      )}
    </>
  );
}

function AccountList({ accounts }: { accounts: Account[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      {accounts.map((a) => (
        <li key={a.id}>
          <Link
            href={`/settings/accounts/${a.id}`}
            className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{a.name}</span>
                <Badge variant="secondary">{accountTypeLabel(a.type)}</Badge>
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {isCreditCard(a)
                  ? `Closes day ${a.closingDay} · due day ${a.dueDay}${a.creditLimitCents ? ` · limit ${formatBRL(a.creditLimitCents)}` : ""}`
                  : (a.institution ?? "—")}
              </span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EmptyAccounts() {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center">
      <p className="text-sm text-muted-foreground">No accounts yet. Add a checking account or a credit card to start.</p>
      <Button render={<Link href="/settings/accounts/new" />} nativeButton={false} className="mt-4 h-11">
        Add account
      </Button>
    </div>
  );
}
