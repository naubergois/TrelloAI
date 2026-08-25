"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useBoardStore } from "@/lib/store";

/** Sync authenticated session into the local team profile (name/email/avatar). */
export function AuthUserSync() {
  const { data: session, status } = useSession();
  const syncAuthUser = useBoardStore((s) => s.syncAuthUser);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    syncAuthUser({
      name: session.user.name ?? "Usuário",
      email: session.user.email ?? "",
      image: session.user.image ?? null,
    });
  }, [session, status, syncAuthUser]);

  return null;
}
