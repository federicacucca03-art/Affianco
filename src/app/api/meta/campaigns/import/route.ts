import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { importClientMetaCampaigns } from "@/lib/meta/campaign-import";
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
  let body: { clientId?: unknown };
  try {
    body = (await request.json()) as { clientId?: unknown };
  } catch {
    return NextResponse.json({ error: "Body JSON non valido." }, { status: 400 });
  }
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  if (!isUuid(clientId)) {
    return NextResponse.json({ error: "Cliente mancante." }, { status: 400 });
  }
  try {
    const result = await importClientMetaCampaigns(userId, clientId);
    return NextResponse.json({
      imported: result.imported,
      updated: result.updated,
      truncated: result.truncated,
      campaigns: result.campaigns,
    });
  } catch (error) {
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: metaHttpStatus(error.code) },
      );
    }
    return NextResponse.json(
      { error: "Importazione campagne Meta non riuscita." },
      { status: 500 },
    );
  }
}
