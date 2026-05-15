import OpenAI from "openai";

import { SolveAnalysisMetrics } from "@/lib/solve-attempts";

function buildFallbackFeedback(metrics: SolveAnalysisMetrics) {
  if (!metrics.solved) {
    return "The cube was not fully solved. Focus on finishing the solve before optimizing move efficiency.";
  }

  const details: string[] = [];

  if (metrics.moveCountDelta !== null) {
    if (metrics.moveCountDelta <= 2) {
      details.push("This solve was close to the solver baseline.");
    } else if (metrics.moveCountDelta <= 10) {
      details.push("The solve was successful, but there was still some extra move overhead.");
    } else {
      details.push("The solve finished with substantially more moves than the solver baseline.");
    }
  } else {
    details.push("The solve finished successfully.");
  }

  if (metrics.inverseMovePairs > 0) {
    details.push(
      `There were ${metrics.inverseMovePairs} immediate back-and-forth corrections. Try to pause before undoing a turn.`,
    );
  }

  if (metrics.repeatedMovePatterns.length > 0) {
    details.push("Several repeated patterns suggest the solve path could be planned more cleanly.");
  }

  if (details.length === 1) {
    details.push("A useful next step is to reduce unnecessary corrections and repeated sequences.");
  }

  return details.slice(0, 2).join(" ");
}

export async function generateSolveFeedback(metrics: SolveAnalysisMetrics) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return buildFallbackFeedback(metrics);
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_FEEDBACK_MODEL ?? "gpt-5-mini";

  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "You write concise product-style Rubik's Cube coaching feedback. Use the metrics only. Be practical, specific, and limited to 2 short sentences.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(metrics),
          },
        ],
      },
    ],
  });

  return response.output_text.trim() || buildFallbackFeedback(metrics);
}
