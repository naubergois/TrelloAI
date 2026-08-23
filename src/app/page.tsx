import { redirect } from "next/navigation";
import { auth, isGoogleAuthConfigured } from "@/auth";
import { AppProviders } from "@/components/AppProviders";
import { BoardsHome } from "@/components/BoardsHome";
import { allowLocalBypass } from "@/lib/api-security";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ local?: string }>;
}) {
  const googleConfigured = isGoogleAuthConfigured();
  const session = await auth();
  const params = await searchParams;
  const allowLocal = allowLocalBypass() && params.local === "1";

  if (!session?.user && !allowLocal) {
    redirect("/login");
  }

  return (
    <AppProviders>
      <BoardsHome googleConfigured={googleConfigured} />
    </AppProviders>
  );
}
