import type Anthropic from "@anthropic-ai/sdk";
import { loadKit, type KitKey } from "./kit";

/**
 * Monta o system prompt do Nero a partir do kit.
 *
 * Ordem importa para o prompt caching (prefixo estável primeiro, volátil depois):
 *  1. Bloco ESTÁVEL — instruções (00) + conhecimento de referência (02–09).
 *     Recebe cache_control: é o prefixo grande e fixo do projeto.
 *  2. Bloco de ESTADO — a memória viva (01), que muda conforme o projeto evolui.
 *     Fica por último, sem cache, marcado como a fonte da verdade.
 */

// 00 = identidade/regras (vem primeiro). 02–09 = base de conhecimento. 01 = estado (por último).
const KNOWLEDGE_ORDER: KitKey[] = ["02", "03", "04", "05", "06", "07", "08", "09"];

export async function buildSystem(): Promise<Anthropic.TextBlockParam[]> {
  const kit = await loadKit();

  const stable = [
    kit["00"],
    "\n\n# ================= BASE DE CONHECIMENTO DO PROJETO =================\n" +
      "Os documentos abaixo são referência (roadmap, processos, guardrails LGPD, âncora DAMA, " +
      "padrão de documentação). Lembre-se da distinção teoria × realidade: o DAMA e o Golden " +
      "Example são o ideal/template — o ambiente real do LM só se confirma no discovery.\n",
    ...KNOWLEDGE_ORDER.map((k) => kit[k]),
  ].join("\n\n---\n\n");

  const state =
    "# ================= ESTADO ATUAL DO PROJETO =================\n" +
    "Este é o `01_MEMORIA_PROJETO` — a **fonte da verdade** do estado atual. " +
    "Trate como verdade; se a conversa contradisser, sinalize. Ao encerrar uma sessão " +
    "relevante, ofereça o bloco 📌 DELTA DE MEMÓRIA.\n\n" +
    kit["01"];

  return [
    { type: "text", text: stable, cache_control: { type: "ephemeral" } },
    { type: "text", text: state },
  ];
}
