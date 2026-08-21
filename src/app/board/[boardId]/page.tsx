import { redirect } from "next/navigation";
import { auth, isGoogleAuthConfigured } from "@/auth";
import { AppProviders } from "@/components/AppProviders";
import { BoardShell } from "@/components/BoardShell";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ local?: string }>;
}) {
  const googleConfigured = isGoogleAuthConfigured();
  const session = await auth();
  const { boardId } = await params;
  const query = await searchParams;
  const allowLocal = query.local === "1";

  if (!session?.user && !allowLocal) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/board/${boardId}`)}`);
  }

  return (
    <AppProviders>
      <BoardShell boardId={boardId} googleConfigured={googleConfigured} />
    </AppProviders>
  );
}
