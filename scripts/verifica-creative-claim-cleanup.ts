/**
 * Verifica cleanup claim non supportati nei format curati (Creative Studio).
 * Esegui: npx tsx scripts/verifica-creative-claim-cleanup.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FORMATI_CURATI } from "@/lib/curatedFormats";

let falliti = 0;

function mark(ok: boolean, msg: string) {
  if (!ok) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
  } else {
    console.log(`PASS  ${msg}`);
  }
}

const IDS_ATTESI = [
  "salute-split-prima-dopo",
  "salute-tour-studio",
  "salute-dottore-camera",
  "risto-hero-piatto",
  "risto-pov-sala",
  "risto-evento-data",
  "eco-ugc-unboxing",
  "eco-before-after-soft",
  "eco-carosello-benefici",
  "art-prima-dopo-cantiere",
  "art-van-arrivo",
  "art-recensione-wa",
  "b2b-case-study",
  "b2b-talking-head-desk",
  "b2b-screen-demo",
  "fit-pov-allenamento",
  "fit-trainer-hook",
  "fit-trasformazione-soft",
] as const;

const TAGS_CONSENTITI = new Set([
  "Formato evergreen",
  "Hook immediato",
  "CTA diretta",
]);

const VIETATI = [
  "Alto CTR",
  "Longevità >60gg",
  "Conversione Diretta",
  "CTR",
  "CPL",
  "ROAS",
  "60gg",
  "60 giorni",
  "longevity",
  "performerà",
  "performera",
  "+35%",
  "+40%",
  "Top performer",
];

const formati = Object.values(FORMATI_CURATI).flat();
const ids = formati.map((f) => f.id);

mark(
  ids.length === IDS_ATTESI.length &&
    IDS_ATTESI.every((id) => ids.includes(id)),
  "id dei format invariati",
);

const tagsOk = formati.every((f) =>
  f.tag.every((t) => TAGS_CONSENTITI.has(t)),
);
mark(tagsOk, "badge solo Hook immediato / Formato evergreen / CTA diretta");

const testi = formati
  .map(
    (f) =>
      `${f.titolo}\n${f.descrizione}\n${f.tag.join(" ")}\n${f.istruzioniRegistrazione.join("\n")}`,
  )
  .join("\n");

for (const vietato of VIETATI) {
  mark(
    !testi.includes(vietato),
    `nessun claim «${vietato}» nei format curati`,
  );
}

const studio = readFileSync(
  join(process.cwd(), "src/components/nuova-contatti/StudioCreativo.tsx"),
  "utf8",
);
mark(!studio.includes("Alto CTR"), "StudioCreativo senza Alto CTR");
mark(!studio.includes("Longevità >60gg"), "StudioCreativo senza Longevità >60gg");
mark(
  !studio.includes("Conversione Diretta"),
  "StudioCreativo senza Conversione Diretta",
);
mark(
  studio.includes("Hook immediato") && studio.includes("Formato evergreen"),
  "badgeClass allineato ai nuovi tag",
);

const helperP1a = readFileSync(
  join(process.cwd(), "src/lib/qualita-creativita.ts"),
  "utf8",
);
mark(
  helperP1a.includes("generaGuidanceCreativita") &&
    helperP1a.includes("Ti manca una versione verticale."),
  "Creative Guidance P1A invariata",
);

if (falliti > 0) {
  console.error(`\n${falliti} asserzioni fallite.`);
  process.exit(1);
}
console.log("\nTutte le asserzioni claim cleanup sono passate.");
