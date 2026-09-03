import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { getAccessibleMetaAdAccounts } from "@/lib/meta/accounts";
import { assertClientOwnedByUser } from "@/lib/meta/client-accounts";
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

  const clientId = new URL(request.url).searchParams.get("clientId")?.trim() ?? "";
  if (!isUuid(clientId)) {
    return NextResponse.json({ error: "Cliente mancante." }, { status: 400 });
  }

  try {
    await assertClientOwnedByUser(userId, clientId);
    const accounts = await getAccessibleMetaAdAccounts(userId, clientId);
    return NextResponse.json({
      accounts,
      ...(accounts.length === 0 ? { code: "META_NO_AD_ACCOUNTS" } : {}),
    });
  } catch (error) {
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: metaHttpStatus(error.code) },
      );
    }
    return NextResponse.json(
      { error: "Lettura account Meta non riuscita." },
      { status: 500 },
    );
  }
}
