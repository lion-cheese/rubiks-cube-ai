import { NextResponse } from "next/server";

import { regenerateSolveFeedback } from "@/lib/solve-attempt-service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const attempt = await regenerateSolveFeedback(id);
    return NextResponse.json({ attempt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate feedback." },
      { status: 500 },
    );
  }
}
