import { applyAlgorithm, MoveHistoryEntry, normalizeAlgorithm, SOLVED_FACELETS, solveFacelets } from "@/lib/cube";
import { SolveAnalysisMetrics, SolveAttemptInput } from "@/lib/solve-attempts";

function areInverseMoves(current: string, next: string) {
  const normalized = normalizeAlgorithm(`${current} ${next}`);

  if (normalized.length !== 2) {
    return false;
  }

  const [a, b] = normalized;
  return (
    a[0] === b[0] &&
    ((a.endsWith("'") && !b.endsWith("'") && !b.endsWith("2")) ||
      (!a.endsWith("'") && !a.endsWith("2") && b.endsWith("'")))
  );
}

function collectRepeatedPatterns(moves: string[]) {
  const patterns = new Set<string>();

  for (let index = 0; index < moves.length - 1; index += 1) {
    if (moves[index] === moves[index + 1]) {
      patterns.add(`${moves[index]} repeated twice`);
    }
  }

  for (let index = 0; index < moves.length - 2; index += 1) {
    const first = moves[index];
    const second = moves[index + 1];
    const third = moves[index + 2];

    if (first === third && first !== second) {
      patterns.add(`${first} ${second} ${third} oscillation`);
    }
  }

  return Array.from(patterns);
}

function countInversePairs(moves: string[]) {
  let inverseMovePairs = 0;

  for (let index = 0; index < moves.length - 1; index += 1) {
    if (areInverseMoves(moves[index], moves[index + 1])) {
      inverseMovePairs += 1;
    }
  }

  return inverseMovePairs;
}

function getAttemptMoves(moveHistory: MoveHistoryEntry[]) {
  return moveHistory.map((entry) => entry.move);
}

export async function resolveAttemptStartFacelets(input: SolveAttemptInput) {
  if (input.startFacelets) {
    return input.startFacelets;
  }

  if (input.scramble.length > 0) {
    return applyAlgorithm(SOLVED_FACELETS, input.scramble.join(" "));
  }

  return SOLVED_FACELETS;
}

export async function buildSolveAnalysis(input: SolveAttemptInput): Promise<{
  metrics: SolveAnalysisMetrics;
  startFacelets: string;
  solverSolution: string[] | null;
}> {
  const moves = getAttemptMoves(input.moveHistory);
  const inverseMovePairs = countInversePairs(moves);
  const repeatedMovePatterns = collectRepeatedPatterns(moves);
  const startFacelets = await resolveAttemptStartFacelets(input);

  let solverSolution = input.solverSolution ?? null;

  if (!solverSolution && startFacelets !== SOLVED_FACELETS) {
    try {
      solverSolution = await solveFacelets(startFacelets);
    } catch {
      solverSolution = null;
    }
  }

  const optimalMoveCount = solverSolution ? solverSolution.length : null;
  const redundantMoveCount = inverseMovePairs * 2 + repeatedMovePatterns.length;

  return {
    startFacelets,
    solverSolution,
    metrics: {
      moveCount: moves.length,
      solved: input.solved,
      optimalMoveCount,
      moveCountDelta: optimalMoveCount === null ? null : moves.length - optimalMoveCount,
      redundantMoveCount,
      inverseMovePairs,
      repeatedMovePatterns,
    },
  };
}
