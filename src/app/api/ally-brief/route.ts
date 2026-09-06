/**
 * POST /api/ally-brief
 * Body: { brief, clienteId? }
 * Max 1 AI call. No campaign DB writes.
 *
 * SUCCESS: { ok: true, proposal, aiCalls, dbWrites: 0 }
 * FAILURE: { ok: false, code, aiCalls, dbWrites: 0 } — no synthetic empty proposal
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Non autenticato." },
      { status: 401 },
    );
  }

  const token = tokenDaAuthorization(
    request.headers.get("authorization") ??
      request.headers.get("Authorization"),
  );
  if (!token) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Non autenticato." },
      { status: 401 },
    );
  }

  let body: {
    brief?: unknown;
    clienteId?: unknown;
    campaignId?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, code: "BAD_REQUEST", error: "Body JSON non valido." },
      { status: 400 },
    );
  }

  if (body.campaignId != null) {
    return NextResponse.json(
      {
        ok: false,
        code: "BAD_REQUEST",
        error: "La brief analysis non crea campagne.",
      },
      { status: 400 },
    );
  }

  const brief =
    typeof body.brief === "string" ? body.brief.trim() : "";
  if (!brief) {
    return NextResponse.json(
      { ok: false, code: "BAD_REQUEST", error: "Inserisci un brief." },
      { status: 400 },
    );
  }
  if (brief.length > ALLY_BRIEF_MAX_CHARS) {
    return NextResponse.json(
      {
        ok: false,
        code: "BAD_REQUEST",
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
      const nameGuess = brief.match(
        /(?:per|cliente|azienda)\s+([A-ZÀ-Ü][\wÀ-ü'&.-]{2,}(?:\s+[A-ZÀ-Ü][\wÀ-ü'&.-]{1,}){0,3})/i,
      );
      if (nameGuess?.[1]) {
        existing = await matchAllyBriefClientByName(token, nameGuess[1]);
      }
    }

    const result = await runAllyBriefAnalysis({
      brief,
      existingClient: existing,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: result.code,
          aiCalls: result.aiCalls,
          dbWrites: 0,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      ok: true,
      proposal: result.proposal,
      aiCalls: result.aiCalls,
      dbWrites: 0,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "ANTHROPIC",
        aiCalls: 0,
        dbWrites: 0,
      },
      { status: 200 },
    );
  }
}
