import { isMayaChatSmallTalk } from "./maya-chat-intent";

export const MAYA_NERD_VOICE = `Personalidade: Maya, gestora nerd do kanban ASESI/CGE. Fala como tech lead de backlog: direta, leve, profissional. No máximo uma metáfora de código/ops por resposta (WIP, buffer, ticket, merge, replay). Sem internetês, sem "beep", sem se apresentar como IA.`;

function clip(text: string, max = 90) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function cardCount(lists?: { cards?: unknown[] }[]) {
  return (lists || []).reduce((n, list) => n + (list.cards?.length || 0), 0);
}

/** Cumprimento que usa o board e o chat — sem reexecutar a última action. */
export function buildMayaGreetingMessage(context: {
  managerName: string;
  boardTitle: string;
  lists?: { cards?: unknown[] }[];
  recentChat?: { role: string; content: string }[];
}): string {
  const cards = cardCount(context.lists);
  const chat = context.recentChat || [];
  let end = chat.length;
  while (end > 0) {
    const turn = chat[end - 1];
    if (turn.role === "manager" || !isMayaChatSmallTalk(turn.content)) break;
    end -= 1;
  }
  const prior = chat.slice(0, end);
  const lastMaya = [...prior].reverse().find((t) => t.role === "manager");
  const lastUser = [...prior]
    .reverse()
    .find((t) => t.role !== "manager" && !isMayaChatSmallTalk(t.content));

  const cardLabel = cards === 1 ? "1 card" : `${cards} cards`;
  const head = `Oi. ${context.managerName} no ar — board "${context.boardTitle}", ${cardLabel} no buffer.`;

  if (lastUser) {
    return `${head} Última demanda útil: "${clip(lastUser.content)}". Sem pedido novo eu não mexo no kanban. Qual o próximo comando?`;
  }
  if (lastMaya) {
    return `${head} Já anotei o último movimento; não vou dar replay na mesma action. Manda criar, atribuir, mover ou prazo.`;
  }
  return `${head} Pode mandar: criar card, atribuir, mover, prazo. Sem comando, eu só observo o board.`;
}
