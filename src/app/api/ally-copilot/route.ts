/**
 * POST /api/ally-copilot
 * Body: { campaignId, source, question, history? }
 * Context loaded server-side with ownership. Max 1 AI call.
 * GET /api/ally-copilot?campaignId=&source= → suggestions + compact context preview (0 AI).
 */

import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { isUuid } from "@/lib/meta/ids";
import type { DiagnosisSource } from "@/lib/campaign-diagnosis/types";
import {
  DiagnosisLoadError,
  loadAllyCampaignCopilotContext,
} from "@/lib/ally-copilot/load-context";
import {
  sanitizeAllyCopilotHistory,
  sanitizeAllyCopilotQuestion,
} from "@/lib/ally-copilot/sanitize";
import { buildAllyCopilotSuggestions } from "@/lib/ally-copilot/suggestions";
import { runAllyCampaignCopilot } from "@/lib/ally-copilot/service";
import {
  assertAllyCopilotContextBounded,
  estimateAllyCopilotInputChars,
  fitAllyCopilotInput,
} from "@/lib/ally-copilot/build-context";
import { buildAllyCopilotFallbackAnswer } from "@/lib/ally-copilot/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSource(raw: unknown): DiagnosisSource | null {
  if (raw === "NATIVE" || raw === "META") return raw;
  return null;
}

function mapLoadError(err: DiagnosisLoadError) {
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

/** Deterministic bootstrap: suggestions + identity (0 AI calls). */
export async function GET(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }
  const url = new URL(request.url);
  const campaignId = (url.searchParams.get("campaignId") ?? "").trim();
  const source = parseSource(url.searchParams.get("source"));
  if (!isUuid(campaignId) || !source) {
    return NextResponse.json({ error: "Parametri non validi." }, { status: 400 });
  }
  try {
    const context = await loadAllyCampaignCopilotContext(
      userId,
      source,
      campaignId,
    );
    return NextResponse.json({
      suggestions: buildAllyCopilotSuggestions(context),
      identity: context.identity,
      workflow: {
        status: context.workflow.status,
        attentionState: context.workflow.attentionState,
      },
      aiCalls: 0,
    });
  } catch (err) {
    if (err instanceof DiagnosisLoadError) return mapLoadError(err);
    return NextResponse.json(
      { error: "Contesto non disponibile." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  let body: {
    campaignId?: unknown;
    source?: unknown;
    question?: unknown;
    history?: unknown;
    context?: unknown;
    metrics?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body JSON non valido." }, { status: 400 });
  }

  // Client must not spoof context/metrics.
  if (body.context != null || body.metrics != null) {
    return NextResponse.json(
      { error: "Il contesto campagna non può essere inviato dal client." },
      { status: 400 },
    );
  }

  const campaignId =
    typeof body.campaignId === "string" ? body.campaignId.trim() : "";
  const source = parseSource(body.source);
  if (!isUuid(campaignId) || !source) {
    return NextResponse.json(
      { error: "campaignId o source non validi." },
      { status: 400 },
    );
  }

  let question: string;
  let history;
  try {
    question = sanitizeAllyCopilotQuestion(body.question);
    history = sanitizeAllyCopilotHistory(body.history);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Domanda non valida." },
      { status: 400 },
    );
  }

  try {
    const loaded = await loadAllyCampaignCopilotContext(
      userId,
      source,
      campaignId,
    );
    const fitted = fitAllyCopilotInput({
      context: loaded,
      question,
      history,
    });
    assertAllyCopilotContextBounded(
      fitted.context,
      fitted.question,
      fitted.history,
    );
    const promptCharsEstimate = estimateAllyCopilotInputChars(
      fitted.context,
      fitted.question,
      fitted.history,
    );

    const answer = await runAllyCampaignCopilot({
      context: fitted.context,
      question: fitted.question,
      history: fitted.history,
    });

    return NextResponse.json({
      answer,
      suggestions: buildAllyCopilotSuggestions(fitted.context),
      promptCharsEstimate,
      aiCalls: answer.fromAi ? 1 : 0,
    });
  } catch (err) {
    if (err instanceof DiagnosisLoadError) return mapLoadError(err);
    // Never break campaign detail.
    try {
      const context = await loadAllyCampaignCopilotContext(
        userId,
        source,
        campaignId,
      );
      return NextResponse.json({
        answer: buildAllyCopilotFallbackAnswer(context),
        suggestions: buildAllyCopilotSuggestions(context),
        promptCharsEstimate: 0,
        aiCalls: 0,
      });
    } catch {
      return NextResponse.json({
        answer: {
          answer:
            "Non riesco a rispondere in questo momento.",
          confidence: "UNKNOWN",
          evidence: [],
          hypotheses: [],
          missingInformation: [],
          suggestedNextQuestions: [],
          recommendedActionHref: null,
          fromAi: false,
        },
        suggestions: [],
        promptCharsEstimate: 0,
        aiCalls: 0,
      });
    }
  }
}
