import { redirect } from "next/navigation";

/** Alias `/campagne/nuova/negozio` → percorso drive-to-store. */
export default function NegozioAliasPage() {
  redirect("/campagne/nuova/instore");
}
