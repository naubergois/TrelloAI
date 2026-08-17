import { redirect } from "next/navigation";
import { auth, isGoogleAuthConfigured } from "@/auth";
import { AppProviders } from "@/components/AppProviders";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ local?: string }>;
}) {
  const googleConfigured = isGoogleAuthConfigured();
  const session = await auth();
  const params = await searchParams;
  const allowLocal = params.local === "1";

  if (googleConfigured && !session?.user && !allowLocal) {
    redirect("/login");
  }

  return <AppProviders googleConfigured={googleConfigured} />;
}
