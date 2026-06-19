"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, FileText, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { diffSnapshots } from "@/lib/state/diff";
import { undoActionRegistro } from "@/app/registro/actions";

export type ActivityRow = {
  id: string;
  entity: string;
  operation: string;
  resumo: string | null;
  actor: string;
  desfeito: boolean;
  before: string | null;
  after: string | null;
  createdAt: Date;
};

const OP_LABEL: Record<string, string> = {
  create: "criou",
  update: "atualizou",
  delete: "removeu",
};

// Tradução curta dos nomes de entidade do banco para a UI.
const ENTITY_LABEL: Record<string, string> = {
  Decision: "Decisão",
  Document: "Documento",
  Risk: "Risco",
  Dependency: "Dependência",
  StackItem: "Stack",
  PhaseStatus: "Fase",
  Feature: "Feature",
  ChecklistItem: "Checklist",
  Stakeholder: "Stakeholder",
  BaselineMetric: "Baseline",
  ProjectNote: "Memória",
};

// Entidades em destaque (o que o usuário pediu: decisões e documentos).
const HIGHLIGHT: Record<string, { className: string; icon: typeof FileText }> = {
  Decision: {
    className: "border-brand/40 bg-brand/5",
    icon: ClipboardList,
  },
  Document: {
    className: "border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30",
    icon: FileText,
  },
};

function entityLabel(e: string) {
  return ENTITY_LABEL[e] ?? e;
}

export function ActivityTimeline({ rows }: { rows: ActivityRow[] }) {
  const [actor, setActor] = useState<string>("todos");
  const [entity, setEntity] = useState<string>("todos");
  const [query, setQuery] = useState("");

  const entidades = useMemo(
    () => Array.from(new Set(rows.map((r) => r.entity))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (actor !== "todos" && r.actor !== actor) return false;
      if (entity !== "todos" && r.entity !== entity) return false;
      if (q && !(r.resumo ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, actor, entity, query]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          className="rounded-md border bg-card px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          <option value="todos">Todos os atores</option>
          <option value="nero">Nero</option>
          <option value="analista">Analista</option>
        </select>
        <select
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          className="rounded-md border bg-card px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          <option value="todos">Todas as entidades</option>
          {entidades.map((e) => (
            <option key={e} value={e}>
              {entityLabel(e)}
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar no resumo…"
          className="flex-1 rounded-md border bg-card px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length} de {rows.length}
        </span>
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma ação registrada para este filtro. Cada escrita do Nero (ou do analista) no
          estado aparece aqui, com o antes→depois e botão para desfazer.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <ActivityItem key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityItem({ row }: { row: ActivityRow }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const changes = useMemo(() => diffSnapshots(row.before, row.after), [row.before, row.after]);
  const highlight = HIGHLIGHT[row.entity];
  const Icon = highlight?.icon;

  return (
    <div className={cn("rounded-lg border", highlight?.className)}>
      <div className="flex items-center justify-between gap-3 p-2.5 text-sm">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0">
            <span className={row.desfeito ? "text-muted-foreground line-through" : ""}>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {row.actor} {OP_LABEL[row.operation] ?? row.operation} {entityLabel(row.entity)}
              </span>{" "}
              · {row.resumo ?? "(sem resumo)"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {new Date(row.createdAt).toLocaleString("pt-BR")}
            </span>
          </span>
        </button>
        {row.desfeito ? (
          <span className="shrink-0 text-xs text-muted-foreground">desfeito</span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(() => undoActionRegistro(row.id))}
          >
            Desfazer
          </Button>
        )}
      </div>

      {open && (
        <div className="border-t px-2.5 py-2 text-xs">
          <div className="mb-1 font-medium text-muted-foreground">
            Impacto na visão do Nero (antes → depois)
          </div>
          {changes.length === 0 ? (
            <p className="text-muted-foreground">Sem campos comparáveis registrados.</p>
          ) : (
            <ul className="space-y-1">
              {changes.map((c) => (
                <li key={c.campo} className="flex flex-wrap items-baseline gap-1">
                  <span className="font-medium">{c.campo}:</span>
                  <span className="text-muted-foreground line-through">{c.antes ?? "—"}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-foreground">{c.depois ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
