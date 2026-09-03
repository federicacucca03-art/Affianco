/**
 * POST /api/diagnosi/campagna
 * Body: { campaignId, source } — identity only. Metrics loaded server-side.
 */

import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { isUuid } from "@/lib/meta/ids";
import { DiagnosisLoadError } from "@/lib/campaign-diagnosis/load-context";
import { diagnoseCampaignForUser } from "@/lib/campaign-diagnosis/orchestrate";
import type { DiagnosisSource } from "@/lib/campaign-diagnosis/types";
import {
  anthropicConfigMissingResponse,
  anthropicErrorResponse,
} from "@/lib/anthropic-errori";

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

  let body: { campaignId?: unknown; source?: unknown; metrics?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body JSON non valido." }, { status: 400 });
  }

  // Browser must not spoof metrics — reject if present.
  if (body.metrics != null) {
    return NextResponse.json(
      { error: "I metriche non possono essere inviate dal client." },
      { status: 400 },
    );
  }

  const campaignId =
    typeof body.campaignId === "string" ? body.campaignId.trim() : "";
  const sourceRaw = typeof body.source === "string" ? body.source.trim() : "";
  if (!isUuid(campaignId)) {
    return NextResponse.json({ error: "campaignId non valido." }, { status: 400 });
  }
  if (sourceRaw !== "NATIVE" && sourceRaw !== "META") {
    return NextResponse.json({ error: "source non valido." }, { status: 400 });
  }
  const source = sourceRaw as DiagnosisSource;

  try {
    const result = await diagnoseCampaignForUser({
      userId,
      campaignId,
      source,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DiagnosisLoadError) {
      const status =
        err.code === "NOT_FOUND"
          ? 404
          : err.code === "FORBIDDEN"
            ? 403
            : err.code === "BAD_REQUEST"
              ? 400
              : 503;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    if (err instanceof Error && err.message === "CONFIG_MISSING") {
      return anthropicConfigMissingResponse();
    }
    // Anthropic / unexpected — never break Control Room contract.
    try {
      return anthropicErrorResponse(err);
    } catch {
      return NextResponse.json(
        {
          eligibility: "AI_DIAGNOSIS_AVAILABLE",
          facts: null,
          diagnosis: null,
          message: "Analisi non disponibile al momento.",
        },
        { status: 200 },
      );
    }
  }
}
