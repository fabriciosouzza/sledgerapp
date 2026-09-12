"use client";

import { useActionState } from "react";
import { updateEmailAction, updateNameAction, updatePasswordAction, type ProfileState } from "./actions";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

function Status({ state }: { state: ProfileState }) {
  if (state.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (state.message) {
    return (
      <Alert>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

export function ProfileForms({ name, email }: { name: string | null; email: string | null }) {
  const [nameState, nameDispatch] = useActionState(updateNameAction, {});
  const [emailState, emailDispatch] = useActionState(updateEmailAction, {});
  const [passwordState, passwordDispatch] = useActionState(updatePasswordAction, {});

  return (
    <div className="space-y-8">
      <form action={nameDispatch} className="space-y-3">
        <h2 className="text-sm font-semibold">Name</h2>
        <Status state={nameState} />
        <Field label="How the app greets you" htmlFor="name">
          <Input id="name" name="name" defaultValue={name ?? ""} maxLength={60} autoComplete="name" className="h-11" />
        </Field>
        <SubmitButton variant="outline" className="w-full" pendingText="Saving…">
          Save name
        </SubmitButton>
      </form>

      <form action={emailDispatch} className="space-y-3">
        <h2 className="text-sm font-semibold">Email</h2>
        <Status state={emailState} />
        <Field label="Sign-in email" htmlFor="email" hint="Changing it sends a confirmation link to both addresses.">
          <Input id="email" name="email" type="email" defaultValue={email ?? ""} autoComplete="email" inputMode="email" required className="h-11" aria-describedby="email-hint" />
        </Field>
        <SubmitButton variant="outline" className="w-full" pendingText="Sending…">
          Change email
        </SubmitButton>
      </form>

      <form action={passwordDispatch} className="space-y-3">
        <h2 className="text-sm font-semibold">Password</h2>
        <Status state={passwordState} />
        <Field label="New password" htmlFor="password" hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="h-11" aria-describedby="password-hint" />
        </Field>
        <Field label="Repeat it" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} className="h-11" />
        </Field>
        <SubmitButton variant="outline" className="w-full" pendingText="Changing…">
          Change password
        </SubmitButton>
      </form>
    </div>
  );
}
