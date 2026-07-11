import { NextResponse } from "next/server";

// TEMPORARY verification probe — reports only whether the running server process
// has an Anthropic key, never the value. Deleted after Phase 4.3 verification.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ hasKey: Boolean(process.env.ANTHROPIC_API_KEY) });
}
