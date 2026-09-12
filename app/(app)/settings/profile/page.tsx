import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { canDeleteAccounts } from "@/lib/auth/adapter";
import { getContext } from "@/lib/services/context";
import { DeleteAccountSection } from "./delete-account";
import { ProfileForms } from "./profile-forms";

export default async function ProfilePage(props: PageProps<"/settings/profile">) {
  const sp = await props.searchParams;
  const { user } = await getContext();
  return (
    <>
      <PageHeader title="Profile" description={user.email ?? undefined} />
      {sp.reset === "1" && (
        <Alert className="mb-6">
          <AlertDescription>You are signed in through the reset link. Set a new password below.</AlertDescription>
        </Alert>
      )}
      <ProfileForms name={user.name} email={user.email} />
      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold">Your data</h2>
        <p className="text-xs text-muted-foreground">Everything you recorded, as one JSON file: accounts, categories, entries, recurrences, statements, assets and movements.</p>
        <Button variant="outline" className="h-11 w-full" render={<a href="/api/export" download />} nativeButton={false}>
          <Download data-icon="inline-start" aria-hidden />
          Download export
        </Button>
      </section>
      {canDeleteAccounts() && <DeleteAccountSection email={user.email ?? ""} />}
    </>
  );
}
