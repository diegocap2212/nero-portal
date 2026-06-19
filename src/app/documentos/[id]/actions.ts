"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteDocument } from "@/lib/state/mutations";

export async function removeDocument(id: string) {
  await deleteDocument({ id });
  revalidatePath("/documentos");
  revalidatePath("/registro");
  redirect("/documentos");
}
