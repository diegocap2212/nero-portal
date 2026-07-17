import {
  AlertTriangle,
  Database,
  Flag,
  History,
  ShieldAlert,
  Users,
  Activity,
  ClipboardList,
} from "lucide-react";
import { loadProjectState } from "@/lib/state/queries";
import { listVersions } from "@/lib/state/mutations";
import { prisma } from "@/lib/db";
import { VersionHistory } from "@/components/version-history";
import { DamaRadar } from "@/components/dama-radar";
import { Radar } from "lucide-react";
import { agingDias, agingNivel, type AgingNivel } from "@/lib/state/aging";
import {
  STATUS_VERDADE_CLASS,
  STATUS_VERDADE_LABEL,
  isStatusVerdade,
} from "@/lib/state/provenance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const fmtData = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const RAG_DOT: Record<string, string> = {
  cinza: "bg-zinc-400",
  amarelo: "bg-amber-500",
  verde: "bg-green-500",
  vermelho: "bg-red-500",
};

const AGING_CLASS: Record<AgingNivel, string> = {
  ok: "bg-muted text-muted-foreground",
  atencao: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  vermelho: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "red" | "amber" | "green";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-600 dark:text-red-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "green"
          ? "text-green-600 dark:text-green-400"
          : "text-brand";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className={`h-4 w-4 ${toneClass}`} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <CardTitle className="flex items-center gap-2 text-base">
      <Icon className="h-4 w-4 text-brand" />
      {children}
    </CardTitle>
  );
}

export default async function EstadoPage() {
  const { stack, dependencies, decisions, risks, phases, stakeholders, baseline } =
    await loadProjectState();
  const versions = await listVersions(20);
  const maturity = await prisma.maturityAssessment.findMany({ orderBy: { ordem: "asc" } });
  const maturityAvaliadas = maturity.filter(
    (m) => m.nivelAtual !== null || m.nivelMeta !== null,
  );

  // KPIs
  const activePhase =
    phases.find((p) => p.rag === "amarelo") ??
    phases.find((p) => p.rag !== "cinza") ??
    phases[0];
  const depsRisco = dependencies.filter(
    (d) => d.status === "aguardando" && agingNivel(agingDias(d.solicitadoEm)) === "vermelho",
  ).length;
  const stackConfirmado = stack.filter((s) => s.statusVerdade === "confirmado").length;
  const riscosAltos = risks.filter((r) => r.ativo && r.severidade === "Alta").length;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Estado vivo do projeto</h1>
        <p className="text-sm text-muted-foreground">
          Equivale ao <code className="rounded bg-muted px-1 py-0.5 text-xs">01_MEMORIA</code> — a
          fonte da verdade. Aging calculado automaticamente; cada fato carrega seu status de verdade
          (teoria × realidade).
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Flag}
          label="Fase atual"
          value={activePhase ? activePhase.fase.split("—")[0].trim() : "—"}
          sub={activePhase?.fase.split("—")[1]?.trim()}
        />
        <Kpi
          icon={AlertTriangle}
          label="Dependências em risco"
          value={String(depsRisco)}
          sub={`de ${dependencies.length} dependências do LM`}
          tone={depsRisco > 0 ? "red" : "green"}
        />
        <Kpi
          icon={Database}
          label="Stack confirmado"
          value={`${stackConfirmado}/${stack.length}`}
          sub="itens validados com o LM"
          tone={stackConfirmado === 0 ? "amber" : "default"}
        />
        <Kpi
          icon={ShieldAlert}
          label="Riscos altos"
          value={String(riscosAltos)}
          sub={`de ${risks.length} riscos ativos`}
          tone={riscosAltos > 0 ? "amber" : "green"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Dependências do LM com aging */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionTitle icon={AlertTriangle}>
              Dependências do cliente LM · aging automático
            </SectionTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dependencies.map((d) => {
              const dias = agingDias(d.solicitadoEm);
              const nivel = agingNivel(dias);
              return (
                <div
                  key={d.id}
                  className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      <span className="text-brand">{d.codigo}</span> · {d.descricao}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Solicitado em {fmtData(d.solicitadoEm)} · Trilho paralelo:{" "}
                      {d.trilhoParalelo ?? "—"}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${AGING_CLASS[nivel]}`}
                  >
                    {d.status !== "aguardando"
                      ? d.status
                      : dias === null
                        ? "sem data"
                        : `${dias} dia(s) úteis${nivel === "vermelho" ? " · vermelho" : nivel === "atencao" ? " · atenção" : ""}`}
                  </span>
                </div>
              );
            })}
            {dependencies.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma dependência registrada.</p>
            )}
          </CardContent>
        </Card>

        {/* Fases */}
        <Card>
          <CardHeader>
            <SectionTitle icon={Flag}>Fases & gates</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {phases.map((p) => (
              <div key={p.id} className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${RAG_DOT[p.rag] ?? "bg-zinc-400"}`}
                  />
                  <span className="flex-1">{p.fase}</span>
                  <span className="text-xs text-muted-foreground">{p.pct}%</span>
                </div>
                <div className="ml-[18px] h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${p.pct}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Stack com proveniência */}
        <Card>
          <CardHeader>
            <SectionTitle icon={Database}>Stack do Data Lake · teoria × realidade</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stack.map((s) => {
              const sv = isStatusVerdade(s.statusVerdade) ? s.statusVerdade : "lacuna";
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex-1">{s.item}</span>
                  <span className="text-xs text-muted-foreground">{s.resposta ?? "—"}</span>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${STATUS_VERDADE_CLASS[sv]}`}
                  >
                    {STATUS_VERDADE_LABEL[sv]}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Radar de maturidade DAMA */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionTitle icon={Radar}>
              Maturidade DAMA · onde o LM está vs. para onde vamos
            </SectionTitle>
          </CardHeader>
          <CardContent>
            {maturityAvaliadas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma área avaliada ainda — as 11 áreas da Roda DAMA estão como{" "}
                <span className="font-medium">lacuna</span>. Peça ao Nero: &ldquo;avalie a
                maturidade de Metadata&rdquo; para o radar ganhar forma.
              </p>
            ) : (
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <DamaRadar
                  points={maturity.map((m) => ({
                    area: m.area,
                    nivelAtual: m.nivelAtual,
                    nivelMeta: m.nivelMeta,
                  }))}
                />
                <div className="space-y-1.5">
                  {maturity.map((m) => {
                    const sv = isStatusVerdade(m.statusVerdade) ? m.statusVerdade : "lacuna";
                    return (
                      <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex-1 truncate">{m.area}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {m.nivelAtual ?? "—"} → {m.nivelMeta ?? "—"}
                        </span>
                        <span
                          className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${STATUS_VERDADE_CLASS[sv]}`}
                        >
                          {STATUS_VERDADE_LABEL[sv]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Riscos */}
        <Card>
          <CardHeader>
            <SectionTitle icon={ShieldAlert}>Riscos & blockers</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {risks.map((r) => (
              <div key={r.id} className="text-sm">
                <div className="font-medium">
                  <span className="text-brand">{r.codigo}</span> · {r.descricao}{" "}
                  <span className="text-xs text-muted-foreground">({r.severidade})</span>
                </div>
                {r.mitigacao && <div className="text-xs text-muted-foreground">↳ {r.mitigacao}</div>}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Baseline */}
        <Card>
          <CardHeader>
            <SectionTitle icon={Activity}>Baseline de adoção</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {baseline.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex-1">{b.metrica}</span>
                <span className="text-xs text-muted-foreground">
                  {b.valorInicial ?? "—"} → {b.atual ?? "—"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Decisões */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionTitle icon={ClipboardList}>Log de decisões</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {decisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma decisão registrada ainda. O Nero registra decisões aqui pela conversa, com
                versionamento.
              </p>
            ) : (
              decisions.map((d) => (
                <div key={d.id} className="text-sm">
                  <span className="text-xs text-muted-foreground">{fmtData(d.data)}</span> —{" "}
                  {d.decisao}
                  {d.porque && <span className="text-muted-foreground"> · {d.porque}</span>}
                  {d.quem && <span className="text-xs text-muted-foreground"> ({d.quem})</span>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Stakeholders */}
        <Card>
          <CardHeader>
            <SectionTitle icon={Users}>Stakeholders & RACI</SectionTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {stakeholders.map((s) => (
              <div key={s.id} className="rounded-lg border p-2 text-sm">
                <div className="font-medium">
                  {s.nome ?? "(a definir)"}{" "}
                  <span className="text-xs text-muted-foreground">· {s.papel}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.lado ?? "—"} — {s.responsabilidade ?? ""}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Histórico de alterações + undo */}
        <Card>
          <CardHeader>
            <SectionTitle icon={History}>Histórico · auditoria + desfazer</SectionTitle>
          </CardHeader>
          <CardContent>
            <VersionHistory versions={versions} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
