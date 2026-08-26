/**
 * Next.js Instrumentation — executado uma vez na inicialização do servidor.
 *
 * Usa o hook register() para carregar secrets do AWS Secrets Manager
 * antes de qualquer request ser processado.
 *
 * Ref: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register(): Promise<void> {
  // Só executa no servidor (não no edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadSecrets } = await import("@/lib/secrets");
    await loadSecrets();
    const { startMayaGitScheduler } = await import("@/lib/maya-git-scheduler");
    startMayaGitScheduler();
  }
}
