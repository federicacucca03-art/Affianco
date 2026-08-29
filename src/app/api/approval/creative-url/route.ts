import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "campaign-creatives";
const SIGNED_URL_TTL_SEC = 600; // 10 minuti

type CreativeUrlBody = {
  approvalToken?: string;
  storagePath?: string;
};

type CreativitaRpcItem = {
  storagePath?: string;
  storage_path?: string;
};

function storagePathDaItem(item: CreativitaRpcItem): string | undefined {
  const path = item.storagePath ?? item.storage_path;
  return typeof path === "string" && path.trim() ? path.trim() : undefined;
}

/** Path plausibile: owner UUID prefix, niente traversal. Autorizzazione reale via RPC. */
function isPlausibleStoragePath(path: string): boolean {
  if (!path || path.includes("..") || path.startsWith("/")) return false;
  return /^[0-9a-f-]{36}\/.+\.[a-z0-9]+$/i.test(path);
}

function logDebug(payload: Record<string, string | number | boolean>) {
  if (process.env.NODE_ENV === "production") {
    console.info("[approval/creative-url]", payload);
  } else {
    console.info("[approval/creative-url]", payload);
  }
}

export async function POST(request: Request) {
  let body: CreativeUrlBody;
  try {
    body = (await request.json()) as CreativeUrlBody;
  } catch {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const approvalToken = body.approvalToken?.trim();
  const storagePath = body.storagePath?.trim();

  if (!approvalToken || !storagePath) {
    logDebug({ status: 400, reason: "missing_fields" });
    return NextResponse.json(
      { error: "approvalToken e storagePath sono obbligatori" },
      { status: 400 },
    );
  }

  if (!isPlausibleStoragePath(storagePath)) {
    logDebug({
      status: 400,
      reason: "invalid_path_format",
      pathSegments: storagePath.split("/").length,
    });
    return NextResponse.json({ error: "storagePath non valido" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    logDebug({ status: 503, reason: "admin_not_configured" });
    return NextResponse.json(
      { error: "Configurazione server incompleta" },
      { status: 503 },
    );
  }

  const { data: campaign, error: rpcError } = await admin.rpc(
    "get_campaign_for_public_approval_token",
    { p_token: approvalToken },
  );

  if (rpcError) {
    logDebug({ status: 502, reason: "rpc_error" });
    return NextResponse.json({ error: "Errore validazione token" }, { status: 502 });
  }
  if (!campaign) {
    logDebug({ status: 404, reason: "token_not_found" });
    return NextResponse.json({ error: "Token non valido" }, { status: 404 });
  }

  const creativita = (campaign as { creativita?: unknown }).creativita;
  if (!Array.isArray(creativita)) {
    logDebug({ status: 404, reason: "creativita_missing" });
    return NextResponse.json({ error: "Creatività non trovata" }, { status: 404 });
  }

  logDebug({
    status: 200,
    creativitaCount: creativita.length,
    hasStoragePathInCampaign: creativita.some(
      (item) =>
        item &&
        typeof item === "object" &&
        Boolean(storagePathDaItem(item as CreativitaRpcItem)),
    ),
  });

  const autorizzato = creativita.some((item) => {
    if (!item || typeof item !== "object") return false;
    return storagePathDaItem(item as CreativitaRpcItem) === storagePath;
  });

  if (!autorizzato) {
    logDebug({ status: 403, reason: "path_not_in_campaign" });
    return NextResponse.json(
      { error: "storagePath non associato a questa campagna" },
      { status: 403 },
    );
  }

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);

  if (signError || !signed?.signedUrl) {
    logDebug({
      status: 502,
      reason: "sign_failed",
      signError: Boolean(signError),
    });
    return NextResponse.json(
      { error: "Impossibile generare URL firmato" },
      { status: 502 },
    );
  }

  logDebug({ status: 200, reason: "signed_ok" });

  return NextResponse.json({
    signedUrl: signed.signedUrl,
    expiresIn: SIGNED_URL_TTL_SEC,
  });
}
