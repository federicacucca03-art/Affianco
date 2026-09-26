import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { isMetaError } from "@/lib/meta/errors";
import { metaHttpStatus } from "@/lib/meta/graph";
import { isUuid } from "@/lib/meta/ids";
import { confirmAndExecuteMetaWrite } from "@/lib/meta/write/execute";
import { getMetaServerConfig } from "@/lib/meta/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

/**
 * Confirm executes from the persisted canonical plan only.
 * Client may not inject a divergent Meta write payload.
 */
export async function POST(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON non valido." }, { status: 400 });
  }

  const campaignId =
    typeof body.campaignId === "string" ? body.campaignId.trim() : "";
  if (!isUuid(campaignId)) {
    return NextResponse.json({ error: "Campagna non valida." }, { status: 400 });
  }
  const fingerprint =
    typeof body.fingerprint === "string" ? body.fingerprint.trim() : "";
  if (!fingerprint) {
    return NextResponse.json({ error: "Fingerprint mancante." }, { status: 400 });
  }
  if (body.humanConfirmed !== true) {
    return NextResponse.json(
      { error: "Conferma esplicita richiesta." },
      { status: 400 },
    );
  }

  // Reject client Meta create payloads — confirm is canonical-plan only.
  if (
    body.campaignPayload != null ||
    body.adSetPayload != null ||
    body.metaPayload != null ||
    body.accessToken != null
  ) {
    return NextResponse.json(
      { error: "Payload Meta non accettato dal client.", code: "INVALID_PARAM" },
      { status: 400 },
    );
  }

  try {
    getMetaServerConfig();
    const result = await confirmAndExecuteMetaWrite({
      userId,
      allyCampaignId: campaignId,
      fingerprint,
      humanConfirmed: true,
    });

    return NextResponse.json({
      result,
      metaWrites: result.executed ? 1 : 0,
      autoActivation: 0,
      writeSlice: "CAMPAIGN_ADSET_PAUSED",
      creative: false,
      ad: false,
    });
  } catch (error) {
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: metaHttpStatus(error.code) },
      );
    }
    return NextResponse.json(
      { error: "Conferma creazione Meta non riuscita." },
      { status: 500 },
    );
  }
}
