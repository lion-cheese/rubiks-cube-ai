import { buildSolveAnalysis } from "@/lib/solve-analysis";
import { generateSolveFeedback } from "@/lib/solve-feedback";
import {
  SolveAttemptDetail,
  SolveAttemptInput,
  SolveAttemptListItem,
  SolveAttemptRecord,
} from "@/lib/solve-attempts";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const TABLE_NAME = "solve_attempts";

function mapSolveAttempt(record: Record<string, unknown>): SolveAttemptRecord {
  return {
    id: String(record.id),
    created_at: String(record.created_at),
    scramble: Array.isArray(record.scramble) ? (record.scramble as string[]) : [],
    move_history: Array.isArray(record.move_history) ? (record.move_history as SolveAttemptRecord["move_history"]) : [],
    move_count: Number(record.move_count ?? 0),
    solved: Boolean(record.solved),
    solve_duration_ms: record.solve_duration_ms === null ? null : Number(record.solve_duration_ms ?? null),
    solver_solution: Array.isArray(record.solver_solution) ? (record.solver_solution as string[]) : null,
    optimal_move_count: record.optimal_move_count === null ? null : Number(record.optimal_move_count ?? null),
    move_count_delta: record.move_count_delta === null ? null : Number(record.move_count_delta ?? null),
    redundant_move_count: Number(record.redundant_move_count ?? 0),
    inverse_move_pairs: Number(record.inverse_move_pairs ?? 0),
    repeated_move_patterns: Array.isArray(record.repeated_move_patterns)
      ? (record.repeated_move_patterns as string[])
      : [],
    ai_feedback: typeof record.ai_feedback === "string" ? record.ai_feedback : null,
    start_facelets: typeof record.start_facelets === "string" ? record.start_facelets : null,
    end_facelets: String(record.end_facelets ?? ""),
  };
}

export async function createSolveAttempt(input: SolveAttemptInput) {
  const supabase = createSupabaseServerClient();
  const { metrics, startFacelets, solverSolution } = await buildSolveAnalysis(input);
  const aiFeedback = await generateSolveFeedback(metrics);

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({
      scramble: input.scramble,
      move_history: input.moveHistory,
      move_count: metrics.moveCount,
      solved: input.solved,
      solve_duration_ms: input.solveDurationMs ?? null,
      solver_solution: solverSolution,
      optimal_move_count: metrics.optimalMoveCount,
      move_count_delta: metrics.moveCountDelta,
      redundant_move_count: metrics.redundantMoveCount,
      inverse_move_pairs: metrics.inverseMovePairs,
      repeated_move_patterns: metrics.repeatedMovePatterns,
      ai_feedback: aiFeedback,
      start_facelets: startFacelets,
      end_facelets: input.endFacelets,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save solve attempt.");
  }

  return mapSolveAttempt(data);
}

export async function listSolveAttempts(): Promise<SolveAttemptListItem[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("id, created_at, solved, move_count, solve_duration_ms, ai_feedback")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to fetch solve history.");
  }

  return data.map((record) => ({
    id: String(record.id),
    created_at: String(record.created_at),
    solved: Boolean(record.solved),
    move_count: Number(record.move_count ?? 0),
    solve_duration_ms: record.solve_duration_ms === null ? null : Number(record.solve_duration_ms ?? null),
    ai_feedback: typeof record.ai_feedback === "string" ? record.ai_feedback : null,
  }));
}

export async function getSolveAttempt(id: string): Promise<SolveAttemptDetail> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from(TABLE_NAME).select("*").eq("id", id).single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to fetch solve attempt.");
  }

  return mapSolveAttempt(data);
}

export async function regenerateSolveFeedback(id: string) {
  const supabase = createSupabaseServerClient();
  const attempt = await getSolveAttempt(id);
  const aiFeedback = await generateSolveFeedback({
    moveCount: attempt.move_count,
    solved: attempt.solved,
    optimalMoveCount: attempt.optimal_move_count,
    moveCountDelta: attempt.move_count_delta,
    redundantMoveCount: attempt.redundant_move_count,
    inverseMovePairs: attempt.inverse_move_pairs,
    repeatedMovePatterns: attempt.repeated_move_patterns,
  });

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ ai_feedback: aiFeedback })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update feedback.");
  }

  return mapSolveAttempt(data);
}
