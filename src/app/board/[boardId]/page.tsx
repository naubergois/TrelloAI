import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppProviders } from "@/components/AppProviders";
import { BoardShell } from "@/components/BoardShell";
import { allowLocalBypass } from "@/lib/api-security";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ local?: string }>;
}) {
  const session = await auth();
  const { boardId } = await params;
  const query = await searchParams;
  const allowLocal = allowLocalBypass() && query.local === "1";

  if (!session?.user && !allowLocal) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/board/${boardId}`)}`);
  }

  return (
    <AppProviders>
      <BoardShell boardId={boardId} />
    </AppProviders>
  );
}
