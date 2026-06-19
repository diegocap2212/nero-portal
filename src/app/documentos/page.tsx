import Link from "next/link";
import { FileText } from "lucide-react";
import { listDocuments } from "@/lib/state/queries";
import {
  STATUS_VERDADE_CLASS,
  STATUS_VERDADE_LABEL,
  isStatusVerdade,
} from "@/lib/state/provenance";

export const dynamic = "force-dynamic";

const fmtData = (d: Date) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const TIPO_LABEL: Record<string, string> = {
  catalogo: "Catálogo",
  dicionario: "Dicionário",
  glossario: "Glossário",
  report: "Report",
  guia: "Guia",
  ata: "Ata",
  documento: "Documento",
};

export default async function DocumentosPage() {
  const docs = await listDocuments();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Documentos</h1>
        <p className="text-sm text-muted-foreground">
          Artefatos gerados pelo Nero, arquivados em Markdown pronto para colar no Confluence.
          Cada documento carrega seu status de verdade (teoria × realidade).
        </p>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum documento arquivado ainda. Peça ao Nero para gerar um artefato (catálogo,
            dicionário, guia, report…) e ele o arquiva aqui automaticamente, pronto para o Confluence.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {docs.map((d) => {
            const sv = isStatusVerdade(d.statusVerdade) ? d.statusVerdade : "lacuna";
            return (
              <Link
                key={d.id}
                href={`/documentos/${d.id}`}
                className="group flex flex-col gap-2 rounded-xl border bg-card p-4 transition-all hover:border-brand/40 hover:bg-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium leading-snug group-hover:text-brand">{d.titulo}</h2>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${STATUS_VERDADE_CLASS[sv]}`}
                  >
                    {STATUS_VERDADE_LABEL[sv]}
                  </span>
                </div>
                {d.resumo && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{d.resumo}</p>
                )}
                <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5">
                    {TIPO_LABEL[d.tipo] ?? d.tipo}
                  </span>
                  <span>· {fmtData(d.createdAt)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
