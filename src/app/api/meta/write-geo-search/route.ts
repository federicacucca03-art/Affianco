import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { isMetaError } from "@/lib/meta/errors";
import { metaHttpStatus } from "@/lib/meta/graph";
import { isUuid } from "@/lib/meta/ids";
import { getDecryptedMetaAccessToken } from "@/lib/meta/connections";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { searchMetaGeoLocations } from "@/lib/meta/write/geo-search";

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

  let body: { campaignId?: unknown; query?: unknown; countryCode?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body JSON non valido." }, { status: 400 });
  }

  const campaignId =
    typeof body.campaignId === "string" ? body.campaignId.trim() : "";
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!isUuid(campaignId)) {
    return NextResponse.json({ error: "Campagna non valida." }, { status: 400 });
  }
  if (query.length < 2) {
    return NextResponse.json({ hits: [] });
  }

  try {
    const admin = createSupabaseAdmin();
    const { data: camp } = await admin
      .from("campaigns")
      .select("id,user_id,client_id,citta")
      .eq("id", campaignId)
      .maybeSingle();
    if (!camp || camp.user_id !== userId || !isUuid(camp.client_id ?? "")) {
      return NextResponse.json({ error: "Campagna non trovata." }, { status: 404 });
    }
    const token = await getDecryptedMetaAccessToken(userId, camp.client_id!);
    const hits = await searchMetaGeoLocations({
      accessToken: token,
      query: query || (camp.citta ?? ""),
      countryCode:
        typeof body.countryCode === "string" ? body.countryCode : "IT",
    });
    return NextResponse.json({
      hits,
      plannedCity: camp.citta ?? null,
      invented: false,
    });
  } catch (error) {
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: metaHttpStatus(error.code) },
      );
    }
    return NextResponse.json(
      { error: "Ricerca zona Meta non riuscita." },
      { status: 500 },
    );
  }
}
