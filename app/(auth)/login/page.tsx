import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · sledger" };

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const error = typeof searchParams.error === "string" ? searchParams.error : undefined;
  const next = typeof searchParams.next === "string" ? searchParams.next : "/";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">sledger</h1>
        <p className="text-sm text-muted-foreground">Sign in to your ledger.</p>
      </div>
      <LoginForm initialError={error} next={next} />
    </main>
  );
}
