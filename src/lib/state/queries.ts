import { prisma } from "@/lib/db";

/** Carrega todo o estado vivo do projeto em paralelo (para o dashboard). */
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
