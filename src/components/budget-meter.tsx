"use client";

import { useCallback, useEffect, useState } from "react";

type Usage = {
  costUsd: number;
  budgetUsd: number;
  pct: number;
  turns: number;
  remainingDays: number;
  resetAt: string;
};

export function BudgetMeter() {
  const [u, setU] = useState<Usage | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/usage", { cache: "no-store" });
      if (r.ok) setU(await r.json());
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    // load() é assíncrono — o setU só ocorre após o await do fetch, não de forma
    // síncrona no corpo do efeito. Falso-positivo conhecido da regra para fetch-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, 20000);
    const onUpdate = () => load();
    window.addEventListener("nero:usage-updated", onUpdate);
    return () => {
      clearInterval(id);
      window.removeEventListener("nero:usage-updated", onUpdate);
    };
  }, [load]);

  if (!u) return null;

  const tone = u.pct >= 90 ? "red" : u.pct >= 70 ? "amber" : "green";
  const bar =
    tone === "red" ? "bg-red-500" : tone === "amber" ? "bg-amber-500" : "bg-emerald-500";
  const valueColor =
    tone === "red"
      ? "text-red-600 dark:text-red-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-400";

  const resetDate = u.resetAt
    ? new Date(u.resetAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : "—";
  const tooltipText = `Budget mensal · $${u.costUsd.toFixed(3)} de $${u.budgetUsd.toFixed(0)} · ${u.turns} turnos · zera em ${resetDate}`;

  return (
    <div className="flex flex-col gap-0.5" title={tooltipText} aria-label={tooltipText}>
      {/* Rótulo "Budget mensal" */}
      <span className="hidden text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 sm:block">
        Budget mensal
      </span>

      <div className="flex items-center gap-2">
        {/* Valor gasto / orçamento */}
        <span className={`hidden text-[11px] font-semibold tabular-nums sm:inline ${valueColor}`}>
          ${u.costUsd.toFixed(2)}
          <span className="font-normal text-muted-foreground"> /{u.budgetUsd.toFixed(0)}</span>
        </span>

        {/* Barra de progresso */}
        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted/80">
          <div
            className={`h-full rounded-full transition-all ${bar}`}
            style={{ width: `${Math.max(3, u.pct)}%` }}
          />
        </div>

        {/* "zera em X dias" — visível em telas largas */}
        <span className="hidden text-[10px] text-muted-foreground lg:inline whitespace-nowrap">
          {u.remainingDays === 0 ? "zera hoje" : `zera em ${u.remainingDays}d`}
        </span>
      </div>
    </div>
  );
}
