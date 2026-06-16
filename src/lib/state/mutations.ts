import { prisma } from "@/lib/db";
import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Mutações do estado vivo. TODA alteração grava uma StateVersion (snapshot
 * before/after) na MESMA transação — isso dá auditoria e undo.
 */

export type Actor = "nero" | "analista";

type Tx = Prisma.TransactionClient | PrismaClient;

const ENTITY_DATE_FIELDS: Record<string, string[]> = {
  Decision: ["data", "createdAt"],
  StackItem: ["createdAt", "updatedAt"],
  Dependency: ["solicitadoEm", "resolvidoEm", "createdAt", "updatedAt"],
  Risk: ["createdAt", "updatedAt"],
  PhaseStatus: ["updatedAt"],
  Feature: ["createdAt", "updatedAt"],
  ChecklistItem: [],
};

function modelOf(tx: Tx, entity: string) {
  switch (entity) {
    case "Decision":      return tx.decision;
    case "StackItem":     return tx.stackItem;
    case "Dependency":    return tx.dependency;
    case "Risk":          return tx.risk;
    case "PhaseStatus":   return tx.phaseStatus;
    case "Feature":       return tx.feature;
    case "ChecklistItem": return tx.checklistItem;
    default: throw new Error(`Entidade desconhecida: ${entity}`);
  }
}

function snapshot(row: unknown): string {
  return JSON.stringify(row);
}

function reviveDates(entity: string, obj: Record<string, unknown>): Record<string, unknown> {
  const fields = ENTITY_DATE_FIELDS[entity] ?? [];
  const copy = { ...obj };
  for (const f of fields) {
    if (typeof copy[f] === "string") copy[f] = new Date(copy[f] as string);
  }
  return copy;
}

async function recordVersion(
  tx: Tx,
  args: {
    entity: string;
    entityId: string;
    operation: "create" | "update" | "delete";
    before: unknown;
    after: unknown;
    actor: Actor;
    resumo: string;
  },
) {
  await tx.stateVersion.create({
    data: {
      entity: args.entity,
      entityId: args.entityId,
      operation: args.operation,
      before: args.before ? snapshot(args.before) : null,
      after: args.after ? snapshot(args.after) : null,
      actor: args.actor,
      resumo: args.resumo,
    },
  });
}

// ---- Helper: resolve faseId a partir de slug ----

async function resolvePhaseId(tx: Tx, faseSlug?: string): Promise<string | undefined> {
  if (!faseSlug) return undefined;
  const phase = await tx.phaseStatus.findFirst({ where: { slug: faseSlug } });
  return phase?.id ?? undefined;
}

// ---- Mutações de alto nível ----

export async function recordDecision(
  input: { decisao: string; porque?: string; quem?: string; faseSlug?: string },
  actor: Actor = "nero",
) {
  return prisma.$transaction(async (tx) => {
    const faseId = await resolvePhaseId(tx, input.faseSlug);
    const created = await tx.decision.create({
      data: { decisao: input.decisao, porque: input.porque, quem: input.quem, faseId },
    });
    await recordVersion(tx, {
      entity: "Decision",
      entityId: created.id,
      operation: "create",
      before: null,
      after: created,
      actor,
      resumo: `Decisão registrada: ${input.decisao}`,
    });
    return created;
  });
}

export async function setStackItem(
  input: { item: string; resposta?: string; statusVerdade?: string; proveniencia?: string },
  actor: Actor = "nero",
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.stackItem.findFirst({ where: { item: input.item } });
    const data = {
      resposta: input.resposta,
      statusVerdade: input.statusVerdade ?? before?.statusVerdade ?? "lacuna",
      proveniencia: input.proveniencia,
    };
    const after = before
      ? await tx.stackItem.update({ where: { id: before.id }, data })
      : await tx.stackItem.create({ data: { item: input.item, ...data } });
    await recordVersion(tx, {
      entity: "StackItem",
      entityId: after.id,
      operation: before ? "update" : "create",
      before,
      after,
      actor,
      resumo: `Stack "${input.item}" → ${data.statusVerdade}${input.resposta ? `: ${input.resposta}` : ""}`,
    });
    return after;
  });
}

export async function upsertDependency(
  input: {
    codigo: string;
    descricao?: string;
    solicitadoEm?: string;
    status?: string;
    trilhoParalelo?: string;
    decisaoPedida?: string;
    faseSlug?: string;
  },
  actor: Actor = "nero",
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.dependency.findFirst({ where: { codigo: input.codigo } });
    const faseId = await resolvePhaseId(tx, input.faseSlug) ?? before?.faseId ?? undefined;
    const data = {
      descricao: input.descricao ?? before?.descricao ?? input.codigo,
      solicitadoEm: input.solicitadoEm ? new Date(input.solicitadoEm) : before?.solicitadoEm,
      status: input.status ?? before?.status ?? "aguardando",
      trilhoParalelo: input.trilhoParalelo ?? before?.trilhoParalelo,
      decisaoPedida: input.decisaoPedida ?? before?.decisaoPedida,
      faseId: faseId ?? null,
    };
    const after = before
      ? await tx.dependency.update({ where: { id: before.id }, data })
      : await tx.dependency.create({ data: { codigo: input.codigo, ...data } });
    await recordVersion(tx, {
      entity: "Dependency",
      entityId: after.id,
      operation: before ? "update" : "create",
      before,
      after,
      actor,
      resumo: `Dependência ${input.codigo} (${data.status})`,
    });
    return after;
  });
}

export async function addRisk(
  input: {
    codigo: string;
    descricao: string;
    severidade?: string;
    mitigacao?: string;
    dono?: string;
    faseSlug?: string;
  },
  actor: Actor = "nero",
) {
  return prisma.$transaction(async (tx) => {
    const faseId = await resolvePhaseId(tx, input.faseSlug);
    const created = await tx.risk.create({
      data: {
        codigo: input.codigo,
        descricao: input.descricao,
        severidade: input.severidade ?? "Média",
        mitigacao: input.mitigacao,
        dono: input.dono,
        faseId: faseId ?? null,
      },
    });
    await recordVersion(tx, {
      entity: "Risk",
      entityId: created.id,
      operation: "create",
      before: null,
      after: created,
      actor,
      resumo: `Risco ${input.codigo}: ${input.descricao}`,
    });
    return created;
  });
}

export async function setPhase(
  input: { fase: string; rag?: string; pct?: number; comentario?: string },
  actor: Actor = "nero",
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.phaseStatus.findFirst({ where: { fase: input.fase } });
    if (!before) throw new Error(`Fase não encontrada: ${input.fase}`);
    const after = await tx.phaseStatus.update({
      where: { id: before.id },
      data: {
        rag: input.rag ?? before.rag,
        pct: input.pct ?? before.pct,
        comentario: input.comentario ?? before.comentario,
      },
    });
    await recordVersion(tx, {
      entity: "PhaseStatus",
      entityId: after.id,
      operation: "update",
      before,
      after,
      actor,
      resumo: `Fase "${input.fase}" → ${after.rag} ${after.pct}%`,
    });
    return after;
  });
}

export async function setFeatureStatus(
  input: { codigo: string; status: string },
  actor: Actor = "nero",
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.feature.findFirst({ where: { codigo: input.codigo } });
    if (!before) throw new Error(`Feature não encontrada: ${input.codigo}`);
    const after = await tx.feature.update({
      where: { id: before.id },
      data: { status: input.status },
    });
    await recordVersion(tx, {
      entity: "Feature",
      entityId: after.id,
      operation: "update",
      before,
      after,
      actor,
      resumo: `Feature ${input.codigo} → ${input.status}`,
    });
    return after;
  });
}

export async function toggleChecklistItem(
  input: { id: string; done: boolean },
  actor: Actor = "nero",
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.checklistItem.findUnique({ where: { id: input.id } });
    if (!before) throw new Error(`ChecklistItem não encontrado: ${input.id}`);
    const after = await tx.checklistItem.update({
      where: { id: input.id },
      data: { done: input.done },
    });
    await recordVersion(tx, {
      entity: "ChecklistItem",
      entityId: after.id,
      operation: "update",
      before,
      after,
      actor,
      resumo: `Checklist "${before.texto.slice(0, 40)}" → ${input.done ? "✓ concluído" : "pendente"}`,
    });
    return after;
  });
}

/** Alterna checklist pelo texto (para uso pelo Nero via tool). */
export async function toggleChecklistItemByText(
  input: { featureCodigo: string; itemTexto: string; done: boolean },
  actor: Actor = "nero",
) {
  const feature = await prisma.feature.findFirst({
    where: { codigo: input.featureCodigo },
    include: { checklist: true },
  });
  if (!feature) throw new Error(`Feature não encontrada: ${input.featureCodigo}`);

  const item = feature.checklist.find((c) =>
    c.texto.toLowerCase().includes(input.itemTexto.toLowerCase()),
  );
  if (!item)
    throw new Error(`Item de checklist não encontrado: "${input.itemTexto}" em ${input.featureCodigo}`);

  return toggleChecklistItem({ id: item.id, done: input.done }, actor);
}

// ---- Histórico & undo ----

export async function listVersions(limit = 30) {
  return prisma.stateVersion.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

export async function undoVersion(versionId: string) {
  return prisma.$transaction(async (tx) => {
    const v = await tx.stateVersion.findUnique({ where: { id: versionId } });
    if (!v) throw new Error("Versão não encontrada.");
    if (v.desfeito) throw new Error("Esta versão já foi desfeita.");

    const m = modelOf(tx, v.entity) as {
      delete: (a: unknown) => Promise<unknown>;
      update: (a: unknown) => Promise<unknown>;
      create: (a: unknown) => Promise<unknown>;
      findUnique: (a: unknown) => Promise<unknown>;
    };

    if (v.operation === "create") {
      const exists = await m.findUnique({ where: { id: v.entityId } });
      if (exists) await m.delete({ where: { id: v.entityId } });
    } else if (v.operation === "update" && v.before) {
      const data = reviveDates(v.entity, JSON.parse(v.before));
      delete (data as { id?: string }).id;
      await m.update({ where: { id: v.entityId }, data });
    } else if (v.operation === "delete" && v.before) {
      const data = reviveDates(v.entity, JSON.parse(v.before));
      await m.create({ data });
    }

    await tx.stateVersion.update({ where: { id: versionId }, data: { desfeito: true } });
    return { undone: v.entity, operation: v.operation };
  });
}
