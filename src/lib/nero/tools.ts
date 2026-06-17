import type Anthropic from "@anthropic-ai/sdk";
import {
  addChecklistItem,
  addRisk,
  createFeature,
  editFeature,
  MEMORIA_SECOES,
  recordDecision,
  setFeatureStatus,
  setPhase,
  setStackItem,
  toggleChecklistItemByText,
  upsertBaselineMetric,
  upsertDependency,
  upsertProjectNote,
  upsertStakeholder,
} from "@/lib/state/mutations";
import { STATUS_VERDADE } from "@/lib/state/provenance";

/**
 * Tools que o Nero pode usar para ESCREVER no estado vivo (01). Cada chamada
 * grava uma StateVersion (auditoria + undo). Conjunto enxuto e de alto valor.
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
        faseSlug: { type: "string", description: "Slug da fase relacionada (ex.: 'fase-0'). Opcional." },
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
        faseSlug: { type: "string", description: "Slug da fase relacionada (ex.: 'fase-0'). Opcional." },
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
        faseSlug: { type: "string", description: "Slug da fase relacionada (ex.: 'fase-0'). Opcional." },
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
  {
    name: "definir_feature",
    description:
      "Atualiza o status de uma feature do roadmap (ex.: F0.1). Use quando a feature mudar de estado durante a conversa.",
    input_schema: {
      type: "object",
      properties: {
        codigo: { type: "string", description: "Código da feature (ex.: 'F0.1', 'F1.3')." },
        status: {
          type: "string",
          enum: ["nao_iniciada", "em_andamento", "concluida", "bloqueada"],
          description: "Novo status da feature.",
        },
      },
      required: ["codigo", "status"],
    },
  },
  {
    name: "criar_feature",
    description:
      "Cria uma feature NOVA no roadmap, sob uma fase. Use quando uma feature inédita for proposta/decidida na conversa (o roadmap evolui). Para apenas mudar o status de uma feature que já existe, use definir_feature. Features novas nascem como premissa a confirmar com o LM.",
    input_schema: {
      type: "object",
      properties: {
        codigo: { type: "string", description: "Código da nova feature (ex.: 'F0.5')." },
        titulo: { type: "string", description: "Título curto da feature." },
        faseSlug: { type: "string", description: "Slug da fase onde criar (ex.: 'fase-0')." },
        descricao: { type: "string", description: "Descrição opcional." },
        dependeLM: { type: "boolean", description: "true se depende de algo do cliente LM." },
        areaDama: { type: "string", description: "Área DAMA (ex.: 'Metadata Management')." },
        status: {
          type: "string",
          enum: ["nao_iniciada", "em_andamento", "concluida", "bloqueada"],
          description: "Status inicial (padrão: nao_iniciada).",
        },
        checklist: {
          type: "array",
          items: { type: "string" },
          description: "Itens de checklist (entregáveis) iniciais, opcional.",
        },
      },
      required: ["codigo", "titulo", "faseSlug"],
    },
  },
  {
    name: "editar_feature",
    description:
      "Edita metadados de uma feature existente: título, descrição, dependeLM, área DAMA, ou renomeia o código. Não muda status (use definir_feature).",
    input_schema: {
      type: "object",
      properties: {
        codigo: { type: "string", description: "Código atual da feature (ex.: 'F0.5')." },
        novoCodigo: { type: "string", description: "Novo código, para renomear. Opcional." },
        titulo: { type: "string" },
        descricao: { type: "string" },
        dependeLM: { type: "boolean" },
        areaDama: { type: "string" },
      },
      required: ["codigo"],
    },
  },
  {
    name: "adicionar_item_checklist",
    description:
      "Adiciona um item de checklist (entregável) a uma feature existente. Use para detalhar o que precisa ser feito numa feature.",
    input_schema: {
      type: "object",
      properties: {
        featureCodigo: { type: "string", description: "Código da feature (ex.: 'F0.5')." },
        itemTexto: { type: "string", description: "Texto do item/entregável." },
        done: { type: "boolean", description: "Se já está concluído (padrão: false)." },
      },
      required: ["featureCodigo", "itemTexto"],
    },
  },
  {
    name: "marcar_checklist",
    description:
      "Marca um item de checklist de uma feature como concluído ou pendente. Use quando um entregável específico for finalizado ou reaberto.",
    input_schema: {
      type: "object",
      properties: {
        featureCodigo: { type: "string", description: "Código da feature (ex.: 'F0.1')." },
        itemTexto: {
          type: "string",
          description: "Texto (ou parte) do item de checklist. Match por substring, case-insensitive.",
        },
        done: { type: "boolean", description: "true = concluído; false = pendente." },
      },
      required: ["featureCodigo", "itemTexto", "done"],
    },
  },
  {
    name: "definir_stakeholder",
    description:
      "Cria ou atualiza um stakeholder do RACI (seção 3 da memória). Use ao identificar/confirmar quem é sponsor, owner de domínio, eng. de plataforma, etc.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome da pessoa (se conhecido)." },
        papel: { type: "string", description: "Papel (ex.: 'Sponsor', 'Owner de domínio')." },
        lado: { type: "string", enum: ["LM", "Blite"], description: "De que lado está." },
        responsabilidade: { type: "string", description: "Responsabilidade no projeto." },
      },
      required: ["papel"],
    },
  },
  {
    name: "definir_baseline",
    description:
      "Cria ou atualiza uma métrica de baseline de adoção (seção 10). Use ao capturar valor inicial ou medição atual (usuários ativos, queries/semana, tabelas documentadas, etc.).",
    input_schema: {
      type: "object",
      properties: {
        metrica: { type: "string", description: "Nome da métrica." },
        valorInicial: { type: "string", description: "Valor inicial (baseline)." },
        atual: { type: "string", description: "Medição atual." },
        data: { type: "string", format: "date", description: "Data da medição (YYYY-MM-DD)." },
        fonte: { type: "string", description: "Fonte do dado." },
      },
      required: ["metrica"],
    },
  },
  {
    name: "editar_memoria",
    description:
      "Atualiza uma seção de TEXTO LIVRE da memória do projeto (markdown). Use para resumo, premissas/pendências, próximas ações de curto prazo e glossário. Para dados estruturados (decisões, stack, fases, features, riscos, dependências, stakeholders, baseline) use as ferramentas específicas, não esta.",
    input_schema: {
      type: "object",
      properties: {
        secao: {
          type: "string",
          enum: [...MEMORIA_SECOES],
          description:
            "metadados | resumo | premissas | proximas_acoes | glossario.",
        },
        conteudo: { type: "string", description: "Conteúdo completo da seção, em markdown (substitui o anterior)." },
      },
      required: ["secao", "conteudo"],
    },
  },
];

type ToolInput = Record<string, unknown>;
const s = (v: unknown) => (v === undefined || v === null ? undefined : String(v));
const n = (v: unknown) => (v === undefined || v === null ? undefined : Number(v));
const b = (v: unknown) => Boolean(v);

export async function runNeroTool(name: string, input: ToolInput): Promise<string> {
  try {
    switch (name) {
      case "registrar_decisao": {
        const r = await recordDecision({
          decisao: String(input.decisao),
          porque: s(input.porque),
          quem: s(input.quem),
          faseSlug: s(input.faseSlug),
        });
        return `Decisão registrada (id ${r.id})${r.faseId ? " · ligada à fase" : ""}.`;
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
          faseSlug: s(input.faseSlug),
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
          faseSlug: s(input.faseSlug),
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
      case "definir_feature": {
        const r = await setFeatureStatus({
          codigo: String(input.codigo),
          status: String(input.status),
        });
        return `Feature ${r.codigo} → ${r.status}.`;
      }
      case "criar_feature": {
        const r = await createFeature({
          codigo: String(input.codigo),
          titulo: String(input.titulo),
          faseSlug: String(input.faseSlug),
          descricao: s(input.descricao),
          dependeLM: input.dependeLM === undefined ? undefined : b(input.dependeLM),
          areaDama: s(input.areaDama),
          status: s(input.status),
          checklist: Array.isArray(input.checklist) ? input.checklist.map(String) : undefined,
        });
        return `Feature ${r.codigo} criada: ${r.titulo}.`;
      }
      case "editar_feature": {
        const r = await editFeature({
          codigo: String(input.codigo),
          novoCodigo: s(input.novoCodigo),
          titulo: s(input.titulo),
          descricao: s(input.descricao),
          dependeLM: input.dependeLM === undefined ? undefined : b(input.dependeLM),
          areaDama: s(input.areaDama),
        });
        return `Feature ${r.codigo} editada.`;
      }
      case "adicionar_item_checklist": {
        const r = await addChecklistItem({
          featureCodigo: String(input.featureCodigo),
          itemTexto: String(input.itemTexto),
          done: input.done === undefined ? undefined : b(input.done),
        });
        return `Item "${r.texto.slice(0, 50)}" adicionado.`;
      }
      case "marcar_checklist": {
        const r = await toggleChecklistItemByText({
          featureCodigo: String(input.featureCodigo),
          itemTexto: String(input.itemTexto),
          done: b(input.done),
        });
        return `Checklist "${r.texto.slice(0, 50)}" → ${r.done ? "✓ concluído" : "pendente"}.`;
      }
      case "definir_stakeholder": {
        const r = await upsertStakeholder({
          nome: s(input.nome),
          papel: String(input.papel),
          lado: s(input.lado),
          responsabilidade: s(input.responsabilidade),
        });
        return `Stakeholder ${r.nome ? `${r.nome} ` : ""}(${r.papel}) salvo.`;
      }
      case "definir_baseline": {
        const r = await upsertBaselineMetric({
          metrica: String(input.metrica),
          valorInicial: s(input.valorInicial),
          atual: s(input.atual),
          data: s(input.data),
          fonte: s(input.fonte),
        });
        return `Baseline "${r.metrica}" salva.`;
      }
      case "editar_memoria": {
        const r = await upsertProjectNote({
          secao: String(input.secao),
          conteudo: String(input.conteudo),
        });
        return `Memória "${r.secao}" atualizada.`;
      }
      default:
        return `Tool desconhecida: ${name}`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro";
    return `Falha ao executar ${name}: ${msg}`;
  }
}
