function normalizeMayaChatText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;:…~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cumprimento / confirmação curta — Maya não deve mexer no board. */
export function isMayaChatSmallTalk(text: string) {
  const t = normalizeMayaChatText(text);
  if (!t) return true;
  if (t.length > 48) return false;
  return /^(oi+|ola+|hey+|hi+|hello+|eae+|eai|e ai|opa+|fala+|salve+|bom dia|boa tarde|boa noite|tudo bem|tudo bom|td bem|td bom|beleza|blz|ok+|okay|valeu|obrigado|obrigada|vlw|thanks|maya)( maya| gestora)?$/.test(
    t,
  );
}

/** Pedido explícito para criar/mover/atribuir/analisar — aí sim vale action. */
export function mayaChatRequestsBoardChange(text: string) {
  if (isMayaChatSmallTalk(text)) return false;
  const t = normalizeMayaChatText(text);
  return /\b(crie|criar|cria|adicione|adicionar|adiciona|nova lista|nova coluna|novo card|novos cards|mova|mover|atualize|atualizar|atribua|atribuir|priorize|priorizar|conclua|concluir|arquive|processe a daily|aplique|organize o (projeto|board)|alimente|preencha|analise|analisar|cobertura git|coloque|coloca|passe para|deixa com|defina prazo|faz um card|faz cards)\b/.test(
    t,
  );
}

/** Texto da Maya afirmando que já alterou o kanban. */
export function mayaReplyLooksLikeBoardChange(text: string) {
  const t = normalizeMayaChatText(text);
  return /\b(atribui|atualizei|criei|movimentei|movi o card|priorizei|definin o prazo)\b/.test(t);
}

export function resolveMayaChatReply(opts: {
  userMessage: string;
  apiMessage?: string;
  greeting: string;
}): { message: string; allowActions: boolean } {
  const allowActions = mayaChatRequestsBoardChange(opts.userMessage);
  if (isMayaChatSmallTalk(opts.userMessage)) {
    return { message: opts.greeting, allowActions: false };
  }
  const api = (opts.apiMessage || "").trim();
  if (!allowActions && api && mayaReplyLooksLikeBoardChange(api)) {
    return {
      message:
        "Li o board e o histórico, mas não mexi em card nenhum. Manda o comando se quiser criar, atribuir ou mover.",
      allowActions: false,
    };
  }
  return { message: api || opts.greeting, allowActions };
}
