import { ScrollText } from "lucide-react";
import { listVersions } from "@/lib/state/mutations";
import { ActivityTimeline, type ActivityRow } from "@/components/activity-timeline";

export const dynamic = "force-dynamic";

export default async function RegistroPage() {
  const versions = await listVersions(100);
  const rows: ActivityRow[] = versions.map((v) => ({
    id: v.id,
    entity: v.entity,
    operation: v.operation,
    resumo: v.resumo,
    actor: v.actor,
    desfeito: v.desfeito,
    before: v.before,
    after: v.after,
    createdAt: v.createdAt,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <ScrollText className="h-5 w-5 text-brand" />
          Logs & Decisões
        </h1>
        <p className="text-sm text-muted-foreground">
          Linha do tempo de tudo que o Nero e o analista fizeram no estado do projeto. Expanda
          uma ação para ver o <strong>antes → depois</strong> — como ela mudou a visão do Nero.
          Decisões e documentos aparecem em destaque. Toda ação é reversível.
        </p>
      </div>

      <ActivityTimeline rows={rows} />
    </main>
  );
}
