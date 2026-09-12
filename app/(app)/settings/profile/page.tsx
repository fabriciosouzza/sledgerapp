import { PageHeader } from "@/components/layout/page-header";
import { getContext } from "@/lib/services/context";
import { ProfileForms } from "./profile-forms";

export default async function ProfilePage() {
  const { user } = await getContext();
  return (
    <>
      <PageHeader title="Profile" description={user.email ?? undefined} />
      <ProfileForms name={user.name} email={user.email} />
    </>
  );
}
