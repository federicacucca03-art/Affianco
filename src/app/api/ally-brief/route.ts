/**
 * POST /api/ally-brief
 * Body: { brief, clienteId? }
 * Max 1 AI call. No campaign DB writes.
 */

import { NextResponse } from "next/server";
import {
  requireRouteUserId,
  tokenDaAuthorization,
} from "@/lib/api-auth";
import { isUuid } from "@/lib/meta/ids";
import { ALLY_BRIEF_MAX_CHARS } from "@/lib/ally-brief/types";
import {
  loadAllyBriefExistingClient,
  matchAllyBriefClientByName,
} from "@/lib/ally-brief/load-client";
import { runAllyBriefAnalysis } from "@/lib/ally-brief/service";
import { buildAllyBriefFallbackProposal } from "@/lib/ally-brief/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  const token = tokenDaAuthorization(
    request.headers.get("authorization") ??
      request.headers.get("Authorization"),
  );
  if (!token) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  let body: {
    brief?: unknown;
    clienteId?: unknown;
    campaignId?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body JSON non valido." }, { status: 400 });
  }

  // Never accept spoofed campaign creation payloads.
  if (body.campaignId != null) {
    return NextResponse.json(
      { error: "La brief analysis non crea campagne." },
      { status: 400 },
    );
  }

  const brief =
    typeof body.brief === "string" ? body.brief.trim() : "";
  if (!brief) {
    return NextResponse.json({ error: "Inserisci un brief." }, { status: 400 });
  }
  if (brief.length > ALLY_BRIEF_MAX_CHARS) {
    return NextResponse.json(
      {
        error: `Il brief può avere al massimo ${ALLY_BRIEF_MAX_CHARS} caratteri.`,
      },
      { status: 400 },
    );
  }

  const clienteIdRaw =
    typeof body.clienteId === "string" ? body.clienteId.trim() : "";
  const clienteId =
    clienteIdRaw && isUuid(clienteIdRaw) ? clienteIdRaw : null;

  try {
    let existing = await loadAllyBriefExistingClient(token, clienteId);
    if (!existing) {
      // Soft name match only when no clienteId provided
      const nameGuess = brief.match(
        /(?:per|cliente|azienda)\s+([A-ZÀ-Ü][\wÀ-ü'&.-]{2,}(?:\s+[A-ZÀ-Ü][\wÀ-ü'&.-]{1,}){0,3})/i,
      );
      if (nameGuess?.[1]) {
        existing = await matchAllyBriefClientByName(token, nameGuess[1]);
      }
    }

    const proposal = await runAllyBriefAnalysis({
      brief,
      existingClient: existing,
    });

    return NextResponse.json({
      proposal,
      aiCalls: proposal.fromAi ? 1 : 0,
      dbWrites: 0,
    });
  } catch {
    const proposal = buildAllyBriefFallbackProposal(brief, null);
    return NextResponse.json({
      proposal,
      aiCalls: 0,
      dbWrites: 0,
      degraded: true,
    });
  }
}
