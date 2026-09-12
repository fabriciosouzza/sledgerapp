import { PageHeader } from "@/components/layout/page-header";
import { AccountForm } from "@/components/settings/account-form";
import { today } from "@/lib/domain/dates";
import { createAccountAction } from "../actions";

export default function NewAccountPage() {
  return (
    <>
      <PageHeader title="New account" />
      <AccountForm action={createAccountAction} today={today()} />
    </>
  );
}
