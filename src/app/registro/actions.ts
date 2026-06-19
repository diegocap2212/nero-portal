"use server";

import { revalidatePath } from "next/cache";
import { undoVersion } from "@/lib/state/mutations";

/** Desfaz uma versão e revalida as vistas que leem o estado. */
export async function undoActionRegistro(versionId: string) {
  await undoVersion(versionId);
  revalidatePath("/registro");
  revalidatePath("/estado");
  revalidatePath("/documentos");
}
