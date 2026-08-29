import { supabase } from "@/lib/supabase";
import type { CreativitaAsset, CreativitaMeta } from "@/lib/creativita";
import { creativitaToMeta } from "@/lib/creativita";

const BUCKET = "campaign-creatives";

function estensioneDaAsset(asset: CreativitaAsset): string {
  const daNome = asset.nomeFile.split(".").pop()?.toLowerCase();
  if (daNome && daNome.length <= 5) return daNome;
  return asset.isVideo ? "mp4" : "jpg";
}

function metaDaCreativitaJson(raw: unknown): CreativitaMeta[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: CreativitaMeta[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string") continue;
    out.push({
      id: o.id,
      nomeFile: String(o.nomeFile ?? o.nome_file ?? "asset"),
      width: Number(o.width) || 1080,
      height: Number(o.height) || 1080,
      ruolo: (o.ruolo as CreativitaMeta["ruolo"]) ?? "principale",
      avvisoFormato: Boolean(o.avvisoFormato ?? o.avviso_formato),
      formatoOrizzontale: Boolean(
        o.formatoOrizzontale ?? o.formato_orizzontale,
      ),
      isVideo: Boolean(o.isVideo ?? o.is_video),
      storagePath:
        typeof o.storagePath === "string"
          ? o.storagePath
          : typeof o.storage_path === "string"
            ? o.storage_path
            : undefined,
    });
  }
  return out.length > 0 ? out : undefined;
}

export { metaDaCreativitaJson };

/** Elimina file Storage dell'owner corrente (best-effort, non bloccante). */
export async function eliminaCreativitaDaStorage(
  paths: string[],
): Promise<void> {
  const puliti = paths.map((p) => p.trim()).filter(Boolean);
  if (puliti.length === 0) return;

  const { error } = await supabase.storage.from(BUCKET).remove(puliti);
  if (error) {
    throw new Error(error.message);
  }
}

/** Paths da eliminare confrontando meta precedente e nuova lista. */
export function pathsCreativitaRimossi(
  precedente: CreativitaMeta[],
  aggiornata: CreativitaMeta[],
): string[] {
  const ancoraPresenti = new Set(
    aggiornata
      .map((m) => m.storagePath?.trim())
      .filter((p): p is string => Boolean(p)),
  );
  return precedente
    .map((m) => m.storagePath?.trim())
    .filter((p): p is string => Boolean(p))
    .filter((p) => !ancoraPresenti.has(p));
}

/**
 * Carica blob locali su Supabase Storage (bucket privato).
 * Path: {user_id}/{asset.id}.{ext} — nessun campaign_id nel path.
 */
export async function caricaCreativitaSuStorage(
  assets: CreativitaAsset[],
  existingMeta: CreativitaMeta[] = [],
): Promise<CreativitaMeta[]> {
  if (assets.length === 0) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error("Sessione non valida: impossibile salvare le creatività.");
  }

  const risultati: CreativitaMeta[] = [];

  for (const asset of assets) {
    const base = creativitaToMeta([asset])[0];
    const metaEsistente = existingMeta.find(
      (m) => m.id === asset.id && m.storagePath,
    );
    // Già su Storage (es. blob URL revocato dopo il primo save): riusa path DB.
    if (metaEsistente?.storagePath) {
      risultati.push({ ...base, storagePath: metaEsistente.storagePath });
      continue;
    }

    if (
      !asset.url.startsWith("blob:") &&
      !asset.url.startsWith("data:") &&
      asset.url.startsWith("http")
    ) {
      const pathEsistente = existingMeta.find((m) => m.id === asset.id)
        ?.storagePath;
      if (pathEsistente) {
        risultati.push({ ...base, storagePath: pathEsistente });
      } else {
        throw new Error(
          `Impossibile salvare ${asset.nomeFile}: file remoto senza path Storage.`,
        );
      }
      continue;
    }

    const response = await fetch(asset.url);
    if (!response.ok) {
      throw new Error(`Impossibile leggere il file ${asset.nomeFile}.`);
    }
    const blob = await response.blob();
    const ext = estensioneDaAsset(asset);
    const path = `${user.id}/${asset.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, {
        upsert: true,
        contentType: blob.type || undefined,
      });
    if (uploadError) {
      throw new Error(uploadError.message);
    }

    risultati.push({
      ...base,
      storagePath: path,
    });
  }

  const senzaPath = risultati.filter((m) => !m.storagePath?.trim());
  if (senzaPath.length > 0) {
    throw new Error(
      "Impossibile salvare una o più creatività: upload Storage incompleto.",
    );
  }

  return risultati;
}
