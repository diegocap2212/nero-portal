import Anthropic from "@anthropic-ai/sdk";
import { buildSystem } from "./prompt";
import { NERO_TOOLS } from "./tools";

/**
 * Nero Core — o ÚNICO ponto de IA do portal. Toda interação com o Claude passa
 * por aqui. UI e features nunca chamam o modelo direto.
 */

// Cliente lê ANTHROPIC_API_KEY do ambiente. Inicialização preguiçosa: o construtor
// do SDK lança erro sem a key, então só criamos o cliente quando há uma requisição
// (evita quebrar o build quando a key não está presente).
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

// Motor padrão = Sonnet 4.6 (custo/latência). Configurável por NERO_MODEL
// (claude-haiku-4-5 é mais barato; claude-opus-4-8 para docs longos).
export const NERO_MODEL = process.env.NERO_MODEL ?? "claude-sonnet-4-6";

// Teto de saída por turno (só o gerado é cobrado; isto limita o pior caso).
const MAX_TOKENS = 8000;

export type NeroMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Marca a última mensagem (string) com cache_control para CACHE DE HISTÓRICO:
 * em turnos seguintes, todo o prefixo da conversa é lido do cache (~10% do custo).
 * Combinado com o cache do system prompt, é a maior alavanca de economia.
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
 * Abre o stream de UM turno do Nero. O loop agêntico (executar tools, devolver
 * tool_result e continuar) vive na rota de chat, que consome este stream.
 */
export async function streamTurn(
  messages: Anthropic.MessageParam[],
  opts: { tools?: boolean } = {},
) {
  return getClient().messages.stream({
    model: NERO_MODEL,
    max_tokens: MAX_TOKENS,
    system: await buildSystem(),
    messages: withHistoryCache(messages),
    ...(opts.tools === false ? {} : { tools: NERO_TOOLS }),
  });
}
