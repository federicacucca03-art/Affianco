import { redirect } from "next/navigation";

/** Alias `/campagne/nuova/ecommerce` → percorso e-commerce. */
export default function EcommerceAliasPage() {
  redirect("/campagne/nuova/vendite-online");
}
