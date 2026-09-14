import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";

const SKIP_LINK =
  "sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-3 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring";

export function AppShell({ email, children }: { email: string | null; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      {/* Keyboard and screen-reader users skip the page: to the bottom nav on phones, to the content beside the sidebar on wide screens. */}
      <a href="#main-nav" className={SKIP_LINK + " md:hidden"}>
        Skip to navigation
      </a>
      <a href="#main" className={SKIP_LINK + " max-md:hidden"}>
        Skip to content
      </a>
      <Sidebar email={email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main" tabIndex={-1} className="mx-auto outline-none w-full max-w-3xl flex-1 px-4 pt-4 pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] md:px-8 md:py-8 lg:max-w-4xl xl:max-w-5xl">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
