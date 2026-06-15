"use client";

import { useCallback, useEffect, useState } from "react";

type Usage = { costUsd: number; budgetUsd: number; pct: number; turns: number };

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
    tone === "red" ? "bg-red-500" : tone === "amber" ? "bg-amber-500" : "bg-green-500";
  const text =
    tone === "red"
      ? "text-red-600 dark:text-red-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

  return (
    <div
      className="flex items-center gap-2"
      title={`Consumo do mês: $${u.costUsd.toFixed(3)} de $${u.budgetUsd.toFixed(2)} · ${u.turns} turnos`}
    >
      <span className={`hidden text-xs font-medium tabular-nums sm:inline ${text}`}>
        ${u.costUsd.toFixed(2)}
        <span className="text-muted-foreground"> / ${u.budgetUsd.toFixed(0)}</span>
      </span>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(3, u.pct)}%` }} />
      </div>
    </div>
  );
}
