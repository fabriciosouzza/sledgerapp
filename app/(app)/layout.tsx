import { RefreshOnFocus } from "@/components/layout/refresh-on-focus";
import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <AppShell email={user.name ?? user.email}>
      <RefreshOnFocus />
      {children}
    </AppShell>
  );
}
