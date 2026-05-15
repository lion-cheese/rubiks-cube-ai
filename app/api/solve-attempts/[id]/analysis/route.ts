import { NextResponse } from "next/server";

import { getSolveAttempt } from "@/lib/solve-attempt-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const attempt = await getSolveAttempt(id);
    return NextResponse.json({ attempt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load solve analysis." },
      { status: 500 },
    );
  }
}
