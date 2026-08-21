import { InviteClient } from "@/components/InviteClient";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[var(--accent)]/20 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" />
      </div>
      <section className="anim-rise relative w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--panel-strong)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-white">
          Trello<span className="text-[var(--accent)]">AI</span>
        </p>
        <div className="mt-6">
          <InviteClient token={token} />
        </div>
      </section>
    </main>
  );
}
