import Link from "next/link";
import { etichettaObiettivo } from "@/lib/pre-lancio-check";
import { formatDataCheck } from "@/lib/control-room";
import {
  etichettaCountLavori,
  MAX_LAVORI_COLONNA,
  type LavoroAperto,
  type LavoroColonnaId,
} from "@/lib/dashboard-home";

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
    superficie: "bg-[#f8f7fc]",
    vediTuttiHref: "/campagne",
  },
  {
    id: "rivedere",
    titolo: "Da rivedere",
    descrizione: "Il cliente ha richiesto modifiche.",
    superficie: "bg-[#fbf8f9]",
    vediTuttiHref: "/campagne",
  },
  {
    id: "monitorate",
    titolo: "Monitorate",
    descrizione: "Campagne con risultati già controllati.",
    superficie: "bg-[#f7f8f6]",
    vediTuttiHref: "/risultati",
  },
  {
    id: "controllare",
    titolo: "Da controllare",
    descrizione: "Campagne ancora senza un controllo.",
    superficie: "bg-[#faf9f5]",
    vediTuttiHref: "/risultati",
  },
];

function AvatarMini({ iniziali }: { iniziali: string }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[11px] font-medium tracking-wide text-[var(--primary)]"
      aria-hidden
    >
      {iniziali}
    </span>
  );
}

function PillCompatta({ label }: { label: string }) {
  return (
    <span className="mt-0.5 inline-flex shrink-0 rounded-full bg-[var(--lavender-muted)] px-2 py-px text-[10px] font-medium leading-5 text-[#5b4fa8]">
      {label}
    </span>
  );
}

function MiniCardLavoro({ lavoro }: { lavoro: LavoroAperto }) {
  const pill =
    lavoro.colonna === "preparazione"
      ? "Bozza"
      : lavoro.colonna === "rivedere"
        ? "Revisione"
        : null;
  return (
    <Link
      href={`/campagne/${lavoro.campaignId}`}
      className="flex items-start gap-2.5 rounded-[16px] bg-white px-2.5 py-2.5 shadow-[0_6px_18px_rgba(70,55,130,0.05)] ring-1 ring-[rgba(80,70,130,0.06)] hover:opacity-90"
    >
      <AvatarMini iniziali={lavoro.initials} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-medium leading-snug text-[var(--ink)]">
            {lavoro.clientName}
          </p>
          {pill ? <PillCompatta label={pill} /> : null}
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-muted)]">
          {lavoro.campaignName}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--ink-muted)]/70">
          {etichettaObiettivo(lavoro.objective)}
          {lavoro.lastCheckAt ? (
            <>
              {" · "}
              {formatDataCheck(lavoro.lastCheckAt)}
            </>
          ) : null}
        </p>
      </div>
    </Link>
  );
}

export function LavoriAperti({
  colonne,
}: {
  colonne: Record<LavoroColonnaId, LavoroAperto[]>;
}) {
  return (
    <section className="aff-panel-white mt-3 min-w-0 px-5 py-5 sm:px-6 sm:py-6">
      <p className="text-[13px] font-medium text-[var(--primary)]">
        Lavori aperti
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-muted)]">
        Su cosa stai lavorando e in quale situazione si trova.
      </p>
      <div className="mt-5 grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLONNE.map((meta) => {
          const items = colonne[meta.id];
          const extra = Math.max(0, items.length - MAX_LAVORI_COLONNA);
          const visibili = items.slice(0, MAX_LAVORI_COLONNA);
          const vuota = items.length === 0;
          return (
            <div
              key={meta.id}
              className={`min-w-0 w-full rounded-[18px] ${meta.superficie} ${
                vuota ? "px-3 py-2.5" : "px-3 py-3"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] font-medium leading-snug text-[var(--ink)]">
                  {meta.titolo}
                </p>
                <p className="shrink-0 text-[12px] font-medium tabular-nums text-[var(--ink-muted)]">
                  {etichettaCountLavori(items.length)}
                </p>
              </div>
              {vuota ? (
                <p className="mt-1.5 text-[12px] leading-snug text-[var(--ink-muted)]">
                  Nessun lavoro
                </p>
              ) : (
                <>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--ink-muted)]">
                    {meta.descrizione}
                  </p>
                  <ul
                    className={`mt-2.5 ${
                      visibili.length === 1 ? "space-y-0" : "space-y-2"
                    }`}
                  >
                    {visibili.map((lavoro) => (
                      <li key={lavoro.campaignId}>
                        <MiniCardLavoro lavoro={lavoro} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {extra > 0 ? (
                <Link
                  href={meta.vediTuttiHref}
                  className="mt-2 inline-block text-[11px] font-medium text-[var(--primary)] hover:opacity-80"
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
