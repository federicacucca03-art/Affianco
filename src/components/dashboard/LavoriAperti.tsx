import Link from "next/link";
import { etichettaObiettivo } from "@/lib/pre-lancio-check";
import { formatDataCheck } from "@/lib/control-room";
import {
  etichettaCountLavori,
  MAX_LAVORI_COLONNA,
  type LavoroAperto,
  type LavoroColonnaId,
} from "@/lib/dashboard-home";
import { StatoChip } from "@/components/nuova-contatti/StatoChip";

const COLONNE: {
  id: LavoroColonnaId;
  titolo: string;
  descrizione: string;
  superficie: string;
  vediTuttiHref: string;
}[] = [
  {
    id: "preparazione",
    titolo: "In preparazione",
    descrizione: "Campagne ancora in lavorazione.",
    superficie: "bg-[#f3f1fa]",
    vediTuttiHref: "/campagne",
  },
  {
    id: "rivedere",
    titolo: "Da rivedere",
    descrizione: "Il cliente ha richiesto modifiche.",
    superficie: "bg-[#faf2f5]",
    vediTuttiHref: "/campagne",
  },
  {
    id: "monitorate",
    titolo: "Monitorate",
    descrizione: "Campagne con risultati già controllati.",
    superficie: "bg-[#f3f5f2]",
    vediTuttiHref: "/risultati",
  },
  {
    id: "controllare",
    titolo: "Da controllare",
    descrizione: "Campagne ancora senza un controllo.",
    superficie: "bg-[#f8f5ee]",
    vediTuttiHref: "/risultati",
  },
];

function AvatarMini({ iniziali }: { iniziali: string }) {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-medium text-[var(--primary)] shadow-[var(--shadow-card)]"
      aria-hidden
    >
      {iniziali}
    </span>
  );
}

function MiniCardLavoro({ lavoro }: { lavoro: LavoroAperto }) {
  return (
    <Link
      href={`/campagne/${lavoro.campaignId}`}
      className="flex items-start gap-2 rounded-[14px] bg-white/90 px-2 py-2 hover:opacity-90"
    >
      <AvatarMini iniziali={lavoro.initials} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-snug text-[var(--ink)]">
          {lavoro.clientName}
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-muted)]">
          {lavoro.campaignName}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--ink-muted)]/80">
          {etichettaObiettivo(lavoro.objective)}
          {lavoro.lastCheckAt ? (
            <>
              {" · "}
              {formatDataCheck(lavoro.lastCheckAt)}
            </>
          ) : null}
        </p>
      </div>
      {lavoro.colonna === "preparazione" ? (
        <StatoChip kind="pending" label="Bozza" />
      ) : null}
      {lavoro.colonna === "rivedere" ? (
        <StatoChip kind="pending" label="Revisione" />
      ) : null}
    </Link>
  );
}

export function LavoriAperti({
  colonne,
}: {
  colonne: Record<LavoroColonnaId, LavoroAperto[]>;
}) {
  return (
    <section className="aff-panel-white mt-3 min-w-0 p-4 sm:p-5">
      <p className="text-[13px] font-medium text-[var(--primary)]">
        Lavori aperti
      </p>
      <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--ink-muted)]">
        Su cosa stai lavorando e in quale situazione si trova.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLONNE.map((meta) => {
          const items = colonne[meta.id];
          const extra = Math.max(0, items.length - MAX_LAVORI_COLONNA);
          const visibili = items.slice(0, MAX_LAVORI_COLONNA);
          return (
            <div
              key={meta.id}
              className={`min-w-0 rounded-[20px] p-3 ${meta.superficie}`}
            >
              <p className="text-[13px] font-medium text-[var(--ink)]">
                {meta.titolo}
              </p>
              <p className="mt-0.5 text-sm font-medium tabular-nums text-[var(--ink)]">
                {etichettaCountLavori(items.length)}
              </p>
              <p className="mt-1 text-[12px] leading-snug text-[var(--ink-muted)]">
                {meta.descrizione}
              </p>
              {items.length === 0 ? (
                <p className="mt-4 text-[13px] text-[var(--ink-muted)]">
                  Nessun lavoro
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {visibili.map((lavoro) => (
                    <li key={lavoro.campaignId}>
                      <MiniCardLavoro lavoro={lavoro} />
                    </li>
                  ))}
                </ul>
              )}
              {extra > 0 ? (
                <Link
                  href={meta.vediTuttiHref}
                  className="mt-2 inline-block text-xs font-medium text-[var(--primary)] hover:opacity-80"
                >
                  + {extra} {extra === 1 ? "altro" : "altri"}
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
