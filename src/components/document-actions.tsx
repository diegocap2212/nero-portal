"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeDocument } from "@/app/documentos/[id]/actions";

/**
 * Ações da página de detalhe do documento:
 * - "Copiar para Confluence": copia o Markdown cru para a área de transferência. O
 *   Confluence Cloud converte Markdown colado em conteúdo nativo (títulos, tabelas, código).
 * - "Apagar": remove o documento (server action; auditável e reversível via /registro).
 */
export function DocumentActions({ id, conteudo }: { id: string; conteudo: string }) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(conteudo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard pode falhar fora de contexto seguro; ignora silenciosamente
    }
  }

  function onDelete() {
    if (!confirm("Apagar este documento? A ação fica no histórico (/registro) e pode ser desfeita.")) {
      return;
    }
    startTransition(() => removeDocument(id));
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={copy} size="sm" className="gap-1.5">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copiado!" : "Copiar para Confluence"}
      </Button>
      <Button onClick={onDelete} size="sm" variant="outline" disabled={pending} className="gap-1.5">
        <Trash2 className="h-4 w-4" />
        {pending ? "Apagando…" : "Apagar"}
      </Button>
    </div>
  );
}
