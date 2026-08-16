"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useBoardStore } from "@/lib/store";

/** Sync Google session into the local team profile (name/email/avatar). */
export function AuthUserSync() {
  const { data: session, status } = useSession();
  const syncGoogleUser = useBoardStore((s) => s.syncGoogleUser);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    syncGoogleUser({
      name: session.user.name ?? "Usuário Google",
      email: session.user.email ?? "",
      image: session.user.image ?? null,
    });
  }, [session, status, syncGoogleUser]);

  return null;
}
