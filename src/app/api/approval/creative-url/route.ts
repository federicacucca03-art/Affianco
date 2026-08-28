import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

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
    return NextResponse.json(
      { error: "approvalToken e storagePath sono obbligatori" },
      { status: 400 },
    );
  }

  // Path arbitrario fornito dal client: rifiuta formati non plausibili.
  if (
    storagePath.includes("..") ||
    storagePath.startsWith("/") ||
    !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]+$/i.test(storagePath)
  ) {
    return NextResponse.json({ error: "storagePath non valido" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
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
    return NextResponse.json({ error: "Errore validazione token" }, { status: 502 });
  }
  if (!campaign) {
    return NextResponse.json({ error: "Token non valido" }, { status: 404 });
  }

  const creativita = (campaign as { creativita?: unknown }).creativita;
  if (!Array.isArray(creativita)) {
    return NextResponse.json({ error: "Creatività non trovata" }, { status: 404 });
  }

  const autorizzato = creativita.some((item) => {
    if (!item || typeof item !== "object") return false;
    return storagePathDaItem(item as CreativitaRpcItem) === storagePath;
  });

  if (!autorizzato) {
    return NextResponse.json(
      { error: "storagePath non associato a questa campagna" },
      { status: 403 },
    );
  }

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "Impossibile generare URL firmato" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    signedUrl: signed.signedUrl,
    expiresIn: SIGNED_URL_TTL_SEC,
  });
}
