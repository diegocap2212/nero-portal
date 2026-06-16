import Anthropic from "@anthropic-ai/sdk";
import { buildSystem } from "./prompt";
import { NERO_TOOLS } from "./tools";

/**
 * Nero Core — o ÚNICO ponto de IA do portal. Toda interação com o Claude passa
 * por aqui. UI e features nunca chamam o modelo direto.
 */

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export const NERO_MODEL = process.env.NERO_MODEL ?? "claude-sonnet-4-6";

const MAX_TOKENS = 8000;

export type NeroMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Marca a última mensagem com cache_control para CACHE DE HISTÓRICO:
 * em turnos seguintes, o prefixo da conversa é lido do cache (~10% do custo).
 */
function withHistoryCache(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  if (messages.length === 0) return messages;
  const out = messages.slice();
  const last = out[out.length - 1];
  if (typeof last.content === "string") {
    out[out.length - 1] = {
      role: last.role,
      content: [
        { type: "text", text: last.content, cache_control: { type: "ephemeral" } },
      ],
    };
  }
  return out;
}

/**
 * Abre o stream de UM turno do Nero.
 *
 * @param opts.scopeContext - Bloco de texto compacto do step do roadmap (carregado
 *   pela rota de chat). Injetado como bloco de sistema NÃO cacheado após o prefixo
 *   estável, para que o Nero responda no contexto daquela fase sem poluir o cache.
 */
export async function streamTurn(
  messages: Anthropic.MessageParam[],
  opts: { tools?: boolean; scopeContext?: string } = {},
) {
  const baseSystem = await buildSystem();
  const system: Anthropic.TextBlockParam[] = opts.scopeContext
    ? [...baseSystem, { type: "text", text: opts.scopeContext }]
    : baseSystem;

  return getClient().messages.stream({
    model: NERO_MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: withHistoryCache(messages),
    ...(opts.tools === false ? {} : { tools: NERO_TOOLS }),
  });
}
