import { redirect } from "next/navigation";

/** Alias `/campagne/nuova/lancio` → percorso awareness. */
export default function LancioAliasPage() {
  redirect("/campagne/nuova/apertura");
}
