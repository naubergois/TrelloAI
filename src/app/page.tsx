import { redirect } from "next/navigation";
import { auth, isGoogleAuthConfigured } from "@/auth";
import { AppProviders } from "@/components/AppProviders";

export default async function Home() {
  const googleConfigured = isGoogleAuthConfigured();
  const session = await auth();

  if (googleConfigured && !session?.user) {
    redirect("/login");
  }

  return <AppProviders googleConfigured={googleConfigured} />;
}
