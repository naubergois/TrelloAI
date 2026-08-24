import { auth, isGoogleAuthConfigured } from "@/auth";
import { AuthActions } from "@/components/LoginActions";
import { BrandMark } from "@/components/BrandMark";
import { CredentialsAuthForm } from "@/components/CredentialsAuthForm";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const googleConfigured = isGoogleAuthConfigured();
  const callbackUrl = params.callbackUrl || "/";
  const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "";

  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[var(--accent)]/20 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-80 w-80 rounded-full bg-[var(--accent-2)]/15 blur-3xl" />
      </div>

      <section className="anim-rise relative w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--panel-strong)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <BrandMark size="lg" subtitle="Governo do Ceará · Terra da Luz" />
        <h1 className="mt-5 font-[family-name:var(--font-display)] text-xl text-white">
          Entrar ou criar conta
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Kanban da gestão cearense. Cadastre-se com e-mail e senha. O Google é opcional.
        </p>

        {params.error ? (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            Falha no login ({params.error}). Se usou Google, confira a URI de redirecionamento
            no Cloud Console.
          </p>
        ) : null}

        <div className="mt-6">
          <CredentialsAuthForm callbackUrl={callbackUrl} />
        </div>

        {googleConfigured ? (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
              <span className="h-px flex-1 bg-[var(--line)]" />
              ou
              <span className="h-px flex-1 bg-[var(--line)]" />
            </div>
            <form
              action={async () => {
                "use server";
                const { signIn } = await import("@/auth");
                await signIn("google", { redirectTo: callbackUrl });
              }}
            >
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:brightness-95"
              >
                <GoogleGlyph />
                Continuar com Google
              </button>
            </form>
            {authUrl ? (
              <p className="text-[11px] leading-relaxed text-[var(--muted)]">
                Redirect URI no Google:{" "}
                <code className="break-all text-[var(--accent)]">
                  {authUrl.replace(/\/$/, "")}/api/auth/callback/google
                </code>
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6">
          <AuthActions />
        </div>
      </section>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.1 4 9.2 8.5 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.1 39.5 16 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.1.1 6.3 5.2C39.3 36.9 44 32 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}
