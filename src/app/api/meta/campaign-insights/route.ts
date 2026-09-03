import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { listClientCampaignInsights } from "@/lib/meta/insight-import";
import { isMetaError } from "@/lib/meta/errors";
import { metaHttpStatus } from "@/lib/meta/graph";
import { isUuid } from "@/lib/meta/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId")?.trim() ?? "";
  const campaignId = url.searchParams.get("campaignId")?.trim() ?? "";
  if (!isUuid(clientId)) {
    return NextResponse.json({ error: "Cliente mancante." }, { status: 400 });
  }
  try {
    const insights = await listClientCampaignInsights(
      userId,
      clientId,
      campaignId || undefined,
    );
    return NextResponse.json({ insights });
  } catch (error) {
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: metaHttpStatus(error.code) },
      );
    }
    return NextResponse.json(
      { error: "Lettura Insights Meta non riuscita." },
      { status: 500 },
    );
  }
}
