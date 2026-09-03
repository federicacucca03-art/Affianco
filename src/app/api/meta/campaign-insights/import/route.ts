import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { importClientCampaignInsights } from "@/lib/meta/insight-import";
import { isMetaError } from "@/lib/meta/errors";
import { metaHttpStatus } from "@/lib/meta/graph";
import { isUuid } from "@/lib/meta/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }
  let body: { clientId?: unknown; campaignId?: unknown };
  try {
    body = (await request.json()) as {
      clientId?: unknown;
      campaignId?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Body JSON non valido." }, { status: 400 });
  }
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  const campaignId =
    typeof body.campaignId === "string" ? body.campaignId.trim() : "";
  if (!isUuid(clientId)) {
    return NextResponse.json({ error: "Cliente mancante." }, { status: 400 });
  }
  if (!campaignId) {
    return NextResponse.json({ error: "Campagna mancante." }, { status: 400 });
  }
  try {
    const insight = await importClientCampaignInsights(
      userId,
      clientId,
      campaignId,
    );
    return NextResponse.json({
      insight,
      code: insight.emptyValid ? "META_INSIGHTS_EMPTY" : undefined,
    });
  } catch (error) {
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: metaHttpStatus(error.code) },
      );
    }
    return NextResponse.json(
      { error: "Sincronizzazione Insights Meta non riuscita." },
      { status: 500 },
    );
  }
}
