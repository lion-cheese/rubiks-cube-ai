export const SOLVED_FACELETS = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

export const FACE_ORDER = ["U", "R", "F", "D", "L", "B"] as const;
export const BASE_MOVES = ["U", "R", "F", "D", "L", "B"] as const;

export const STICKER_COLORS: Record<string, string> = {
  U: "#f8fafc",
  R: "#ef4444",
  F: "#22c55e",
  D: "#facc15",
  L: "#fb923c",
  B: "#3b82f6",
};

const MOVE_MODIFIERS = ["", "'", "2"] as const;
const AXIS_GROUPS: Record<string, string> = {
  U: "y",
  D: "y",
  L: "x",
  R: "x",
  F: "z",
  B: "z",
};

export type Move = `${(typeof BASE_MOVES)[number]}${(typeof MOVE_MODIFIERS)[number]}`;

export interface MoveHistoryEntry {
  move: string;
  source: "manual" | "scramble" | "solution";
}

export interface SolutionState {
  startFacelets: string;
  moves: string[];
  currentStep: number;
}

export function parseFacelets(facelets: string) {
  return FACE_ORDER.map((face, faceIndex) => ({
    face,
    stickers: facelets.slice(faceIndex * 9, faceIndex * 9 + 9).split(""),
  }));
}

export function normalizeAlgorithm(algorithm: string): string[] {
  return algorithm
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export async function loadCubeJs() {
  const mod = await import("cubejs");
  return mod.default;
}

export async function applyAlgorithm(facelets: string, algorithm: string): Promise<string> {
  const Cube = await loadCubeJs();
  const cube = Cube.fromString(facelets);
  cube.move(algorithm);
  return cube.asString();
}

export async function solveFacelets(facelets: string): Promise<string[]> {
  const Cube = await loadCubeJs();
  Cube.initSolver();
  const cube = Cube.fromString(facelets);
  return normalizeAlgorithm(cube.solve());
}

export function buildScramble(length = 20) {
  const result: string[] = [];

  while (result.length < length) {
    const base = BASE_MOVES[Math.floor(Math.random() * BASE_MOVES.length)];
    const lastMove = result.at(-1);
    const previousMove = result.at(-2);
    const modifier = MOVE_MODIFIERS[Math.floor(Math.random() * MOVE_MODIFIERS.length)];

    if (lastMove && lastMove[0] === base) {
      continue;
    }

    if (
      lastMove &&
      previousMove &&
      AXIS_GROUPS[lastMove[0]] === AXIS_GROUPS[base] &&
      AXIS_GROUPS[previousMove[0]] === AXIS_GROUPS[base]
    ) {
      continue;
    }

    result.push(`${base}${modifier}`);
  }

  return result;
}

export function getVisibleSolutionFacelets(solution: SolutionState | null, liveFacelets: string) {
  if (!solution) {
    return liveFacelets;
  }

  return solution.currentStep === 0 ? solution.startFacelets : liveFacelets;
}
