import type Anthropic from "@anthropic-ai/sdk";
import {
  addRisk,
  recordDecision,
  setPhase,
  setStackItem,
  upsertDependency,
} from "@/lib/state/mutations";
import { STATUS_VERDADE } from "@/lib/state/provenance";

/**
 * Tools que o Nero pode usar para ESCREVER no estado vivo (01). Cada chamada
 * grava uma StateVersion (auditoria + undo). Mantemos o conjunto enxuto e de alto
 * valor; nada de execução em ferramentas externas (gated — ver kit §1.1).
 */

export const NERO_TOOLS: Anthropic.Tool[] = [
  {
    name: "registrar_decisao",
    description:
      "Registra uma decisão no log de decisões do projeto (seção 4 do 01). Use quando uma decisão for tomada na conversa.",
    input_schema: {
      type: "object",
      properties: {
        decisao: { type: "string", description: "A decisão, em uma frase." },
        porque: { type: "string", description: "Justificativa breve." },
        quem: { type: "string", description: "Quem decidiu." },
      },
      required: ["decisao"],
    },
  },
  {
    name: "definir_stack",
    description:
      "Define/atualiza um item do stack do Data Lake com seu status de verdade (teoria × realidade). Use ao confirmar ou assumir informação de ambiente.",
    input_schema: {
      type: "object",
      properties: {
        item: { type: "string", description: "Nome do item de stack (ex.: 'Plataforma do Data Lake')." },
        resposta: { type: "string", description: "Valor/resposta." },
        statusVerdade: {
          type: "string",
          enum: [...STATUS_VERDADE],
          description: "template (ideal DAMA), assumido (premissa), confirmado (validado com o LM), lacuna.",
        },
        proveniencia: { type: "string", description: "Fonte / quem confirmou / quando." },
      },
      required: ["item", "statusVerdade"],
    },
  },
  {
    name: "atualizar_dependencia",
    description:
      "Cria ou atualiza uma dependência do cliente LM (seção 7 do 01). Aging é calculado a partir de solicitadoEm.",
    input_schema: {
      type: "object",
      properties: {
        codigo: { type: "string", description: "Código curto (D1, D2, ...)." },
        descricao: { type: "string" },
        solicitadoEm: { type: "string", format: "date", description: "Data do pedido (YYYY-MM-DD)." },
        status: { type: "string", enum: ["aguardando", "recebido", "cancelado"] },
        trilhoParalelo: { type: "string", description: "O que avança sem o cliente." },
        decisaoPedida: { type: "string" },
      },
      required: ["codigo"],
    },
  },
  {
    name: "adicionar_risco",
    description: "Adiciona um risco/blocker ao projeto (seção 8 do 01).",
    input_schema: {
      type: "object",
      properties: {
        codigo: { type: "string", description: "Código curto (R1, R2, ...)." },
        descricao: { type: "string" },
        severidade: { type: "string", enum: ["Alta", "Média", "Baixa"] },
        mitigacao: { type: "string" },
        dono: { type: "string" },
      },
      required: ["codigo", "descricao"],
    },
  },
  {
    name: "definir_fase",
    description: "Atualiza o status (RAG), % e comentário de uma fase do roadmap (seção 6 do 01).",
    input_schema: {
      type: "object",
      properties: {
        fase: { type: "string", description: "Nome exato da fase (ex.: 'Fase 0 — Mobilização & Discovery')." },
        rag: { type: "string", enum: ["cinza", "amarelo", "verde", "vermelho"] },
        pct: { type: "integer", description: "Percentual de conclusão (0-100)." },
        comentario: { type: "string" },
      },
      required: ["fase"],
    },
  },
];

type ToolInput = Record<string, unknown>;
const s = (v: unknown) => (v === undefined || v === null ? undefined : String(v));
const n = (v: unknown) => (v === undefined || v === null ? undefined : Number(v));

/** Executa uma tool do Nero e devolve um texto de confirmação para o tool_result. */
export async function runNeroTool(name: string, input: ToolInput): Promise<string> {
  try {
    switch (name) {
      case "registrar_decisao": {
        const r = await recordDecision({ decisao: String(input.decisao), porque: s(input.porque), quem: s(input.quem) });
        return `Decisão registrada (id ${r.id}).`;
      }
      case "definir_stack": {
        const r = await setStackItem({
          item: String(input.item),
          resposta: s(input.resposta),
          statusVerdade: s(input.statusVerdade),
          proveniencia: s(input.proveniencia),
        });
        return `Stack "${r.item}" atualizado para status "${r.statusVerdade}".`;
      }
      case "atualizar_dependencia": {
        const r = await upsertDependency({
          codigo: String(input.codigo),
          descricao: s(input.descricao),
          solicitadoEm: s(input.solicitadoEm),
          status: s(input.status),
          trilhoParalelo: s(input.trilhoParalelo),
          decisaoPedida: s(input.decisaoPedida),
        });
        return `Dependência ${r.codigo} salva (status ${r.status}).`;
      }
      case "adicionar_risco": {
        const r = await addRisk({
          codigo: String(input.codigo),
          descricao: String(input.descricao),
          severidade: s(input.severidade),
          mitigacao: s(input.mitigacao),
          dono: s(input.dono),
        });
        return `Risco ${r.codigo} adicionado.`;
      }
      case "definir_fase": {
        const r = await setPhase({
          fase: String(input.fase),
          rag: s(input.rag),
          pct: n(input.pct),
          comentario: s(input.comentario),
        });
        return `Fase "${r.fase}" → ${r.rag} (${r.pct}%).`;
      }
      default:
        return `Tool desconhecida: ${name}`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro";
    return `Falha ao executar ${name}: ${msg}`;
  }
}
