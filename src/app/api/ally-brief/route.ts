/**
 * POST /api/ally-brief
 * Body: { brief?, websiteUrl?, clienteId? }
 * Max 1 AI call. Optional server-side website fetch (not an AI call).
 * No campaign DB writes.
 *
 * SUCCESS: { ok: true, proposal, aiCalls, dbWrites: 0, websiteStatus?, websiteWarning? }
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
import {
  ALLY_BRIEF_WEBSITE_BLOCKED_MESSAGE,
  validatePublicWebsiteUrl,
} from "@/lib/ally-brief/website-safety";

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
    websiteUrl?: unknown;
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
  const websiteUrl =
    typeof body.websiteUrl === "string" ? body.websiteUrl.trim() : "";

  if (!brief && !websiteUrl) {
    return NextResponse.json(
      {
        ok: false,
        code: "BAD_REQUEST",
        error: "Inserisci un brief o un sito cliente.",
      },
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

  // Site-only with a blocked URL → fail early (nothing to analyze).
  if (!brief && websiteUrl) {
    const v = validatePublicWebsiteUrl(websiteUrl);
    if (!v.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: "BAD_REQUEST",
          error: ALLY_BRIEF_WEBSITE_BLOCKED_MESSAGE,
          websiteStatus: "blocked",
        },
        { status: 400 },
      );
    }
  }

  const clienteIdRaw =
    typeof body.clienteId === "string" ? body.clienteId.trim() : "";
  const clienteId =
    clienteIdRaw && isUuid(clienteIdRaw) ? clienteIdRaw : null;

  try {
    let existing = await loadAllyBriefExistingClient(token, clienteId);
    if (!existing && brief) {
      // Explicit name cue only ("per/cliente/azienda X") → exact owned-client match.
      // Never fuzzy-match sector/city/"Studio dentistico" onto an existing profile.
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
      websiteUrl: websiteUrl || null,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: result.code,
          aiCalls: result.aiCalls,
          dbWrites: 0,
          websiteStatus: result.websiteStatus ?? null,
          websiteWarning: result.websiteWarning ?? null,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      ok: true,
      proposal: result.proposal,
      aiCalls: result.aiCalls,
      dbWrites: 0,
      websiteStatus: result.websiteStatus,
      websiteWarning: result.websiteWarning,
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
