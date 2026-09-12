import { PageHeader } from "@/components/layout/page-header";
import { AccountForm } from "@/components/settings/account-form";
import { createAccountAction } from "../actions";

export default function NewAccountPage() {
  return (
    <>
      <PageHeader title="New account" />
      <AccountForm action={createAccountAction} />
    </>
  );
}
