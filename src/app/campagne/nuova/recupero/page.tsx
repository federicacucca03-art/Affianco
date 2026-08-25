import { redirect } from "next/navigation";

/** Alias `/campagne/nuova/recupero` → percorso retargeting. */
export default function RecuperoAliasPage() {
  redirect("/campagne/nuova/retargeting");
}
