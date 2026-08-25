import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UsersAdmin } from "@/components/UsersAdmin";
import { ensureDefaultAdminSafe } from "@/lib/users";

export default async function AdminUsersPage() {
  await ensureDefaultAdminSafe();
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/usuarios");
  }
  if (session.user.role !== "admin") {
    redirect("/");
  }
  return <UsersAdmin />;
}
