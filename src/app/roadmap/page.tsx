import { loadRoadmap } from "@/lib/state/queries";
import { RoadmapStepper } from "@/components/roadmap-stepper";
import { Map } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  const phases = await loadRoadmap();

  const totalFeatures = phases.reduce((s, p) => s + p.totalFeatures, 0);
  const doneFeatures = phases.reduce((s, p) => s + p.doneFeatures, 0);
  const activePhases = phases.filter((p) => p.rag !== "cinza").length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Map className="h-4 w-4" />
            <span className="text-sm">Roadmap</span>
          </div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Fases do projeto</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            24 semanas · 7 fases · clique numa fase para o painel 360° + Nero contextual
          </p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-2xl font-semibold">{activePhases}</p>
            <p className="text-xs text-muted-foreground">fases ativas</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{doneFeatures}/{totalFeatures}</p>
            <p className="text-xs text-muted-foreground">features</p>
          </div>
        </div>
      </div>

      <RoadmapStepper phases={phases} />

      <p className="mt-6 text-xs text-center text-muted-foreground">
        Clique num step para ver features, checklist, dependências e conversar com o Nero naquele contexto.
      </p>
    </div>
  );
}
