import { NextResponse } from "next/server";

import { createSolveAttempt, listSolveAttempts } from "@/lib/solve-attempt-service";
import { SolveAttemptInput } from "@/lib/solve-attempts";

export async function GET() {
  try {
    const attempts = await listSolveAttempts();
    return NextResponse.json({ attempts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load solve history." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SolveAttemptInput;
    const attempt = await createSolveAttempt(payload);
    return NextResponse.json({ attempt }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save solve attempt." },
      { status: 500 },
    );
  }
}
