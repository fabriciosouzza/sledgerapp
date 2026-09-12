import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";

export function AppShell({ email, children }: { email: string | null; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <Sidebar email={email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] md:px-8 md:py-8 lg:max-w-4xl xl:max-w-5xl">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
