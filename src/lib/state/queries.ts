import { prisma } from "@/lib/db";
import { agingDias } from "./aging";
import type { Prisma } from "@prisma/client";

/** Carrega todo o estado vivo do projeto em paralelo (para o dashboard /estado). */
export async function loadProjectState() {
  const [stack, dependencies, decisions, risks, phases, stakeholders, baseline] =
    await Promise.all([
      prisma.stackItem.findMany({ orderBy: { ordem: "asc" } }),
      prisma.dependency.findMany({ orderBy: { ordem: "asc" } }),
      prisma.decision.findMany({ orderBy: { data: "desc" } }),
      prisma.risk.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.phaseStatus.findMany({ orderBy: { ordem: "asc" } }),
      prisma.stakeholder.findMany({ orderBy: { ordem: "asc" } }),
      prisma.baselineMetric.findMany({ orderBy: { ordem: "asc" } }),
    ]);
  return { stack, dependencies, decisions, risks, phases, stakeholders, baseline };
}

export type ProjectState = Awaited<ReturnType<typeof loadProjectState>>;

// ---- Tipos para o roadmap ----

type PhaseWithFeatures = Prisma.PhaseStatusGetPayload<{
  include: { features: { include: { checklist: true } } };
}>;

export type RoadmapPhase = PhaseWithFeatures & {
  pctDerived: number;
  totalFeatures: number;
  doneFeatures: number;
  totalChecklist: number;
  doneChecklist: number;
  riskDepsCount: number;
  highRisksCount: number;
};

export type PhaseDetail = {
  phase: PhaseWithFeatures;
  deps: Prisma.DependencyGetPayload<object>[];
  risks: Prisma.RiskGetPayload<object>[];
  decisions: Prisma.DecisionGetPayload<object>[];
};

/** Carrega todas as fases com agregados para o stepper do roadmap. */
export async function loadRoadmap(): Promise<RoadmapPhase[]> {
  const [phases, allDeps, allRisks] = await Promise.all([
    prisma.phaseStatus.findMany({
      orderBy: { ordem: "asc" },
      include: { features: { orderBy: { ordem: "asc" }, include: { checklist: true } } },
    }),
    prisma.dependency.findMany({ where: { faseId: { not: null } } }),
    prisma.risk.findMany({ where: { faseId: { not: null }, ativo: true } }),
  ]);

  const now = new Date();

  return phases.map((phase) => {
    const totalFeatures = phase.features.length;
    const doneFeatures = phase.features.filter((f) => f.status === "concluida").length;
    const pctDerived =
      totalFeatures > 0 ? Math.round((doneFeatures / totalFeatures) * 100) : 0;

    const totalChecklist = phase.features.reduce((s, f) => s + f.checklist.length, 0);
    const doneChecklist = phase.features.reduce(
      (s, f) => s + f.checklist.filter((c) => c.done).length,
      0,
    );

    const phaseDeps = allDeps.filter((d) => d.faseId === phase.id);
    const riskDepsCount = phaseDeps.filter((d) => {
      if (d.status !== "aguardando" || !d.solicitadoEm) return false;
      return (agingDias(d.solicitadoEm, now) ?? 0) >= 5;
    }).length;

    const highRisksCount = allRisks.filter(
      (r) => r.faseId === phase.id && r.severidade === "Alta",
    ).length;

    return {
      ...phase,
      pctDerived,
      totalFeatures,
      doneFeatures,
      totalChecklist,
      doneChecklist,
      riskDepsCount,
      highRisksCount,
    };
  });
}

/** Carrega o detalhe de uma fase (painel 360°). */
export async function loadPhase(slug: string): Promise<PhaseDetail | null> {
  const phase = await prisma.phaseStatus.findFirst({
    where: { slug },
    include: {
      features: {
        orderBy: { ordem: "asc" },
        include: { checklist: { orderBy: { ordem: "asc" } } },
      },
    },
  });
  if (!phase) return null;

  const [deps, risks, decisions] = await Promise.all([
    prisma.dependency.findMany({
      where: { faseId: phase.id },
      orderBy: { ordem: "asc" },
    }),
    prisma.risk.findMany({
      where: { faseId: phase.id, ativo: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.decision.findMany({
      where: { faseId: phase.id },
      orderBy: { data: "desc" },
    }),
  ]);

  return { phase, deps, risks, decisions };
}

/** Constrói o bloco de contexto compacto de uma fase para injetar no system do Nero. */
export function buildPhaseContext(detail: PhaseDetail): string {
  const { phase, deps, risks, decisions } = detail;
  const ragEmoji =
    { cinza: "⚪", amarelo: "🟡", verde: "🟢", vermelho: "🔴" }[phase.rag] ?? "⚪";
  const doneFeatures = phase.features.filter((f) => f.status === "concluida").length;

  const lines: string[] = [
    `## Contexto do step atual no roadmap: ${phase.fase}`,
    `Gate: ${phase.gate ?? "—"} | Janela: ${phase.janela ?? "—"} | Status: ${ragEmoji} ${phase.rag} | Progresso: ${doneFeatures}/${phase.features.length} features concluídas`,
  ];
  if (phase.foco) lines.push(`Foco: ${phase.foco}`);

  if (phase.features.length > 0) {
    lines.push("\n### Features desta fase");
    for (const f of phase.features) {
      const sym =
        { nao_iniciada: "○", em_andamento: "◑", concluida: "●", bloqueada: "✕" }[f.status] ?? "○";
      const lmTag = f.dependeLM ? " ⚠️LM" : "";
      const doneItems = f.checklist.filter((c) => c.done).length;
      const checkTag = f.checklist.length > 0 ? ` [${doneItems}/${f.checklist.length} ✓]` : "";
      lines.push(`- ${f.codigo} ${f.titulo} [${sym}${lmTag}${checkTag}]`);
    }
  }

  if (deps.length > 0) {
    lines.push("\n### Dependências do LM (desta fase)");
    for (const d of deps) {
      lines.push(`- ${d.codigo}: ${d.descricao} [${d.status}]${d.trilhoParalelo ? ` → trilho: ${d.trilhoParalelo}` : ""}`);
    }
  }

  if (risks.length > 0) {
    lines.push("\n### Riscos (desta fase)");
    for (const r of risks) {
      lines.push(`- ${r.codigo} [${r.severidade}]: ${r.descricao}`);
    }
  }

  if (decisions.length > 0) {
    lines.push("\n### Decisões desta fase");
    for (const d of decisions) {
      lines.push(`- ${d.decisao}${d.porque ? ` (${d.porque})` : ""}`);
    }
  }

  lines.push(
    "\nO analista está visualizando este step no roadmap. Responda no contexto desta fase — aponte gaps, riscos e próximas ações prioritárias.",
  );

  return lines.join("\n");
}
