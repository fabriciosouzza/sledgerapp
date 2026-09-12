"use client";

import { useActionState, useState } from "react";
import {
  forgotPasswordAction,
  magicLinkAction,
  signInAction,
  signUpAction,
  type AuthFormState,
} from "@/app/(auth)/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "password" | "magic" | "forgot";

export function LoginForm({
  initialError,
  next,
}: {
  initialError?: string;
  next: string;
}) {
  const [mode, setMode] = useState<Mode>("password");
  const initial: AuthFormState = { error: initialError };
  const [signIn, signInDispatch, signingIn] = useActionState(
    signInAction,
    initial,
  );
  const [signUp, signUpDispatch, signingUp] = useActionState(
    signUpAction,
    initial,
  );
  const [magic, magicDispatch, sendingMagic] = useActionState(
    magicLinkAction,
    initial,
  );
  const [forgot, forgotDispatch, sendingReset] = useActionState(
    forgotPasswordAction,
    initial,
  );

  const pending = signingIn || signingUp || sendingMagic || sendingReset;
  const state =
    mode === "password"
      ? signUp.error || signUp.message
        ? signUp
        : signIn
      : mode === "magic"
        ? magic
        : forgot;

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Sign-in method"
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
      >
        <ModeTab
          active={mode === "password" || mode === "forgot"}
          onClick={() => setMode("password")}
        >
          Password
        </ModeTab>
        <ModeTab active={mode === "magic"} onClick={() => setMode("magic")}>
          Magic link
        </ModeTab>
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.message && (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="min-h-[17.5rem]">
        {mode === "password" ? (
          <form className="space-y-4" action={signInDispatch}>
            <input type="hidden" name="next" value={next} />
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                defaultValue={state.email ?? initial.email}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-11"
              />
            </div>
            <div className="grid gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11"
                disabled={pending}
              >
                {signingIn ? "Signing in…" : "Sign in"}
              </Button>
              <Button
                type="submit"
                variant="outline"
                size="lg"
                className="h-11"
                formAction={signUpDispatch}
                disabled={pending}
              >
                {signingUp ? "Creating account…" : "Create account"}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="min-h-9 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot your password?
            </button>
          </form>
        ) : mode === "forgot" ? (
          <form className="space-y-4" action={forgotDispatch}>
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                defaultValue={state.email}
                className="h-11"
              />
            </div>
            <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
              {sendingReset ? "Sending…" : "Send reset link"}
            </Button>
            <p className="text-xs text-muted-foreground">
              The link signs you in and takes you to the profile to set a new password.
            </p>
            <button
              type="button"
              onClick={() => setMode("password")}
              className="min-h-9 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form className="space-y-4" action={magicDispatch}>
            <input type="hidden" name="next" value={next} />
            <div className="space-y-2">
              <Label htmlFor="magic-email">Email</Label>
              <Input
                id="magic-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                defaultValue={state.email}
                className="h-11"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-11 w-full"
              disabled={pending}
            >
              {sendingMagic ? "Sending…" : "Send magic link"}
            </Button>
            <p className="text-xs text-muted-foreground">
              No password needed. The link creates the account if it does not
              exist.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`h-9 rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
