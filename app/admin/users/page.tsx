import { listProfiles } from "./actions";
import UserClient from "./UserClient";

export default async function UsersPage() {
  const initialProfiles = await listProfiles();
  return <UserClient initialProfiles={initialProfiles} />;
}
