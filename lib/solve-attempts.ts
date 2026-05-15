import { MoveHistoryEntry } from "@/lib/cube";

export interface SolveAttemptInput {
  scramble: string[];
  moveHistory: MoveHistoryEntry[];
  solved: boolean;
  solveDurationMs?: number | null;
  solverSolution?: string[] | null;
  startFacelets?: string | null;
  endFacelets: string;
}

export interface SolveAnalysisMetrics {
  moveCount: number;
  solved: boolean;
  optimalMoveCount: number | null;
  moveCountDelta: number | null;
  redundantMoveCount: number;
  inverseMovePairs: number;
  repeatedMovePatterns: string[];
}

export interface SolveAttemptRecord {
  id: string;
  created_at: string;
  scramble: string[];
  move_history: MoveHistoryEntry[];
  move_count: number;
  solved: boolean;
  solve_duration_ms: number | null;
  solver_solution: string[] | null;
  optimal_move_count: number | null;
  move_count_delta: number | null;
  redundant_move_count: number;
  inverse_move_pairs: number;
  repeated_move_patterns: string[];
  ai_feedback: string | null;
  start_facelets: string | null;
  end_facelets: string;
}

export interface SolveAttemptListItem {
  id: string;
  created_at: string;
  solved: boolean;
  move_count: number;
  solve_duration_ms: number | null;
  ai_feedback: string | null;
}

export interface SolveAttemptDetail extends SolveAttemptRecord {}
