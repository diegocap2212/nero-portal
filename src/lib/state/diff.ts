/**
 * Diff entre snapshots before/after de uma StateVersion. É o que materializa "como a
 * ação impactou a visão do Nero": cada linha mostra um campo do estado que mudou.
 * Usado na timeline de /registro.
 */

// Campos de ruído que não agregam ao entendimento da mudança.
const NOISE = new Set(["id", "createdAt", "updatedAt", "ordem"]);

export type FieldChange = { campo: string; antes: string | null; depois: string | null };

function parse(snapshot: string | null): Record<string, unknown> | null {
  if (!snapshot) return null;
  try {
    return JSON.parse(snapshot) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function fmt(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  // datas ISO → só o dia, p/ caber na linha
  const m = /^(\d{4}-\d{2}-\d{2})T/.exec(s);
  return m ? m[1] : s;
}

/**
 * Compara before/after e devolve só os campos relevantes que mudaram.
 * - create: campos preenchidos do `after` (antes = null).
 * - delete: campos preenchidos do `before` (depois = null).
 * - update: campos cujo valor difere.
 */
export function diffSnapshots(
  beforeRaw: string | null,
  afterRaw: string | null,
): FieldChange[] {
  const before = parse(beforeRaw);
  const after = parse(afterRaw);

  const keys = new Set<string>([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  const changes: FieldChange[] = [];
  for (const campo of keys) {
    if (NOISE.has(campo)) continue;
    const antes = fmt(before?.[campo]);
    const depois = fmt(after?.[campo]);
    if (antes === depois) continue;
    if (antes === null && depois === null) continue;
    changes.push({ campo, antes, depois });
  }
  return changes;
}
