/**
 * POST /api/ally-oggi
 * Body: { context: AllyOggiBriefContext } — compact deterministic facts only.
 * One Anthropic call. Fallback deterministic on failure.
 */

import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { runAllyOggiBrief } from "@/lib/ally-oggi/service";
import {
  sanitizeAllyOggiBriefContext,
  shouldGenerateAllyOggiBrief,
} from "@/lib/ally-oggi/sanitize-context";
import { buildAllyOggiFallback } from "@/lib/ally-oggi/fallback";
import { estimateAllyOggiPromptChars } from "@/lib/ally-oggi/build-context";

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

  let body: { context?: unknown; isFirstRunOnboarding?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body JSON non valido." }, { status: 400 });
  }

  let context;
  try {
    context = sanitizeAllyOggiBriefContext(body.context);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Contesto briefing non valido.",
      },
      { status: 400 },
    );
  }

  const isFirstRun =
    body.isFirstRunOnboarding === true ||
    body.isFirstRunOnboarding === "true";

  if (
    !shouldGenerateAllyOggiBrief({
      isFirstRunOnboarding: isFirstRun,
      totalMonitored: context.totalMonitored,
    })
  ) {
    return NextResponse.json({
      skipped: true,
      reason: isFirstRun ? "ONBOARDING" : "NO_CAMPAIGNS",
      brief: null,
      promptCharsEstimate: 0,
      aiCalls: 0,
    });
  }

  const promptCharsEstimate = estimateAllyOggiPromptChars(context);

  try {
    const brief = await runAllyOggiBrief(context);
    return NextResponse.json({
      skipped: false,
      brief,
      promptCharsEstimate,
      aiCalls: brief.fromAi ? 1 : 0,
    });
  } catch {
    const brief = buildAllyOggiFallback(context);
    return NextResponse.json({
      skipped: false,
      brief,
      promptCharsEstimate,
      aiCalls: 0,
    });
  }
}
