import { auth } from "@/auth";
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
  const callbackUrl = params.callbackUrl || "/";

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
          Kanban da gestão cearense. Cadastre-se com e-mail e senha.
        </p>

        {params.error ? (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            Falha no login ({params.error}). Verifique suas credenciais e tente novamente.
          </p>
        ) : null}

        <div className="mt-6">
          <CredentialsAuthForm callbackUrl={callbackUrl} />
        </div>

        <div className="mt-6">
          <AuthActions />
        </div>
      </section>
    </main>
  );
}
