import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { getAccessibleMetaAdAccounts } from "@/lib/meta/accounts";
import { isMetaError } from "@/lib/meta/errors";
import { metaHttpStatus } from "@/lib/meta/graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  try {
    const accounts = await getAccessibleMetaAdAccounts(userId);
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
