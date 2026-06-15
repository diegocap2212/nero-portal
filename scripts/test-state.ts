/* Verificação do versionamento + undo (sem API key). Roda: npx tsx scripts/test-state.ts */
import { prisma } from "../src/lib/db";
import { recordDecision, setStackItem, listVersions, undoVersion } from "../src/lib/state/mutations";

async function main() {
  let pass = 0;
  let fail = 0;
  const check = (ok: boolean, label: string) => {
    console.log(`${ok ? "PASS" : "FAIL"} — ${label}`);
    ok ? pass++ : fail++;
  };

  // 1) create + version
  const dec = await recordDecision({ decisao: "TESTE: decisão de verificação", quem: "script" }, "nero");
  const vList1 = await listVersions(5);
  const vDec = vList1.find((v) => v.entityId === dec.id && v.operation === "create");
  check(!!vDec, "recordDecision cria Decision + StateVersion(create)");
  check((await prisma.decision.findUnique({ where: { id: dec.id } })) !== null, "Decision existe após criar");

  // 2) undo do create → entidade some, versão marcada desfeita
  if (vDec) await undoVersion(vDec.id);
  check((await prisma.decision.findUnique({ where: { id: dec.id } })) === null, "undo(create) removeu a Decision");
  const vDecAfter = await prisma.stateVersion.findUnique({ where: { id: vDec!.id } });
  check(vDecAfter?.desfeito === true, "versão marcada como desfeito");

  // 3) update path: setStackItem altera item existente; undo restaura o 'before'
  const before = await prisma.stackItem.findFirst({ where: { item: "Plataforma do Data Lake" } });
  const updated = await setStackItem(
    { item: "Plataforma do Data Lake", resposta: "Databricks", statusVerdade: "confirmado", proveniencia: "script" },
    "nero",
  );
  check(updated.statusVerdade === "confirmado" && updated.resposta === "Databricks", "setStackItem aplicou update");
  const vUpd = (await listVersions(5)).find((v) => v.entityId === updated.id && v.operation === "update");
  check(!!vUpd, "setStackItem gravou StateVersion(update)");
  if (vUpd) await undoVersion(vUpd.id);
  const reverted = await prisma.stackItem.findUnique({ where: { id: updated.id } });
  check(
    reverted?.statusVerdade === (before?.statusVerdade ?? "lacuna") && (reverted?.resposta ?? null) === (before?.resposta ?? null),
    "undo(update) restaurou o estado anterior do StackItem",
  );

  console.log(`\n${pass} pass, ${fail} fail`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
