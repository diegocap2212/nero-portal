import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDocument } from "@/lib/state/queries";
import { Markdown } from "@/components/markdown";
import { DocumentActions } from "@/components/document-actions";
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

export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) notFound();

  const sv = isStatusVerdade(doc.statusVerdade) ? doc.statusVerdade : "lacuna";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6">
      <Link
        href="/documentos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Documentos
      </Link>

      <div className="mb-4 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{doc.titulo}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5">{TIPO_LABEL[doc.tipo] ?? doc.tipo}</span>
            <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS_VERDADE_CLASS[sv]}`}>
              {STATUS_VERDADE_LABEL[sv]}
            </span>
            <span>· Arquivado em {fmtData(doc.createdAt)}</span>
          </div>
        </div>
        <DocumentActions id={doc.id} conteudo={doc.conteudo} />
      </div>

      <article className="rounded-xl border bg-card p-5">
        <Markdown>{doc.conteudo}</Markdown>
      </article>
    </main>
  );
}
