"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  LoaderCircle,
  RotateCcw,
  Shuffle,
  Sparkles,
} from "lucide-react";
import {
  BASE_MOVES,
  MoveHistoryEntry,
  SolutionState,
  SOLVED_FACELETS,
  STICKER_COLORS,
  applyAlgorithm,
  buildScramble,
  normalizeAlgorithm,
  parseFacelets,
  solveFacelets,
} from "@/lib/cube";
import {
  SolveAttemptDetail,
  SolveAttemptListItem,
  SolveAttemptRecord,
} from "@/lib/solve-attempts";

const MOVE_BUTTONS = BASE_MOVES.flatMap((move) => [move, `${move}'`, `${move}2`]);
const VIEW_FACES = ["U", "R", "F", "D", "L", "B"] as const;

type RotationState = {
  x: number;
  y: number;
};

type Vector3 = {
  x: number;
  y: number;
  z: number;
};

type StageDragState =
  | {
      mode: "cube";
      x: number;
      y: number;
      rotateX: number;
      rotateY: number;
    }
  | {
      mode: "face";
      x: number;
      y: number;
      face: keyof typeof FACE_GESTURE_VECTORS;
      startedOnSticker: boolean;
      rowBand: -1 | 0 | 1;
      columnBand: -1 | 0 | 1;
      facePoint: { x: number; y: number };
      resolved: boolean;
    };

const FACE_GESTURE_THRESHOLD = 18;
const FACE_GESTURE_VECTORS = {
  F: {
    normal: { x: 0, y: 0, z: 1 },
    right: { x: 1, y: 0, z: 0 },
    down: { x: 0, y: -1, z: 0 },
  },
  B: {
    normal: { x: 0, y: 0, z: -1 },
    right: { x: -1, y: 0, z: 0 },
    down: { x: 0, y: -1, z: 0 },
  },
  R: {
    normal: { x: 1, y: 0, z: 0 },
    right: { x: 0, y: 0, z: -1 },
    down: { x: 0, y: -1, z: 0 },
  },
  L: {
    normal: { x: -1, y: 0, z: 0 },
    right: { x: 0, y: 0, z: 1 },
    down: { x: 0, y: -1, z: 0 },
  },
  U: {
    normal: { x: 0, y: 1, z: 0 },
    right: { x: 1, y: 0, z: 0 },
    down: { x: 0, y: 0, z: 1 },
  },
  D: {
    normal: { x: 0, y: -1, z: 0 },
    right: { x: 1, y: 0, z: 0 },
    down: { x: 0, y: 0, z: -1 },
  },
} as const;

function CubeStage({
  facelets,
  rotation,
  onRotationChange,
  onMove,
  disabled,
}: {
  facelets: string;
  rotation: RotationState;
  onRotationChange: (rotation: RotationState) => void;
  onMove: (move: string) => void;
  disabled?: boolean;
}) {
  const faces = useMemo(() => parseFacelets(facelets), [facelets]);
  const dragState = useRef<StageDragState | null>(null);
  const cubeRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const liveRotationRef = useRef(rotation);

  const applyRotation = (nextRotation: RotationState) => {
    liveRotationRef.current = nextRotation;

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;

      if (cubeRef.current) {
        cubeRef.current.style.transform = `rotateX(${liveRotationRef.current.x}deg) rotateY(${liveRotationRef.current.y}deg)`;
      }
    });
  };

  useEffect(() => {
    if (dragState.current) {
      return;
    }

    liveRotationRef.current = rotation;

    if (cubeRef.current) {
      cubeRef.current.style.transform = `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`;
    }
  }, [rotation]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    const target = event.target instanceof HTMLElement ? event.target : null;
    const faceTarget = target?.closest<HTMLElement>("[data-face-surface]");
    const stickerTarget = target?.closest<HTMLElement>("[data-sticker-index]");
    const face = faceTarget?.dataset.faceSurface as keyof typeof FACE_GESTURE_VECTORS | undefined;
    const stickerIndex = Number(stickerTarget?.dataset.stickerIndex ?? "4");
    const normalizedStickerIndex = Number.isNaN(stickerIndex) ? 4 : stickerIndex;
    const facePoint =
      face && faceTarget
        ? getFaceLocalPoint(
            faceTarget,
            face,
            liveRotationRef.current,
            event.clientX,
            event.clientY,
          )
        : { x: 0, y: 0 };

    dragState.current = face
      ? {
          mode: "face",
          x: event.clientX,
          y: event.clientY,
          face,
          startedOnSticker: Boolean(stickerTarget),
          rowBand: resolveLockedBand(
            facePoint.y,
            Math.max(0, Math.min(2, Math.floor(normalizedStickerIndex / 3))) - 1,
            Boolean(stickerTarget),
          ),
          columnBand: resolveLockedBand(
            facePoint.x,
            Math.max(0, Math.min(2, normalizedStickerIndex % 3)) - 1,
            Boolean(stickerTarget),
          ),
          facePoint,
          resolved: false,
        }
      : {
          mode: "cube",
          x: event.clientX,
          y: event.clientY,
          rotateX: liveRotationRef.current.x,
          rotateY: liveRotationRef.current.y,
        };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current || disabled) {
      return;
    }

    const deltaX = event.clientX - dragState.current.x;
    const deltaY = event.clientY - dragState.current.y;

    if (dragState.current.mode === "cube") {
      applyRotation({
        x: Math.max(-75, Math.min(75, dragState.current.rotateX - deltaY * 0.35)),
        y: dragState.current.rotateY + deltaX * 0.4,
      });
      return;
    }

    if (
      dragState.current.resolved ||
      Math.hypot(deltaX, deltaY) < FACE_GESTURE_THRESHOLD
    ) {
      return;
    }

    const move = resolveFaceGestureMove(
      dragState.current.face,
      dragState.current.startedOnSticker,
      dragState.current.rowBand,
      dragState.current.columnBand,
      dragState.current.facePoint,
      liveRotationRef.current,
      deltaX,
      deltaY,
    );

    if (!move) {
      return;
    }

    logGestureDecision({
      pickedFace: dragState.current.face,
      facePoint: dragState.current.facePoint,
      rowBand: dragState.current.rowBand,
      columnBand: dragState.current.columnBand,
      deltaX,
      deltaY,
      move,
    });

    dragState.current.resolved = true;
    onMove(move);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current || disabled) {
      return;
    }

    if (dragState.current.mode === "cube") {
      onRotationChange(liveRotationRef.current);
    }

    dragState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="glass-panel relative overflow-hidden rounded-[1.5rem] p-6 sm:p-8">
      <div className="mesh-background pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/60">Cube View</p>
            <h2 className="font-[family-name:var(--font-display)] text-2xl">Interactive Stage</h2>
          </div>
          <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
            Drag to rotate
          </span>
        </div>

        <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-950/35">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(196,240,158,0.16),transparent_42%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.16),transparent_34%)]" />
          <div className="absolute h-40 w-40 rounded-full bg-emerald-300/15 blur-3xl" />
          <div
            className="relative h-[320px] w-full cursor-grab touch-none select-none [perspective:1200px] active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            <div className="absolute left-1/2 top-1/2 h-[228px] w-[228px] -translate-x-1/2 -translate-y-1/2">
              <div
                ref={cubeRef}
                className="relative h-full w-full [transform-origin:center_center] [transform-style:preserve-3d] will-change-transform"
                style={{
                  transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
                }}
              >
                {faces.map(({ face, stickers }) => (
                  <div
                    key={face}
                    className="absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 [transform-style:preserve-3d]"
                  >
                    <div
                      data-face-surface={face}
                      className="grid h-full w-full grid-cols-3 gap-[6px] rounded-[1rem] border border-white/12 bg-slate-950/70 p-[10px] shadow-[0_20px_80px_rgba(0,0,0,0.4)] [backface-visibility:hidden]"
                      style={{ transform: faceTransform(face) }}
                    >
                      {stickers.map((sticker, index) => (
                        <div
                          key={`${face}-${index}`}
                          data-sticker-index={index}
                          className="rounded-[0.6rem] border border-black/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_4px_18px_rgba(0,0,0,0.18)]"
                          style={{ backgroundColor: STICKER_COLORS[sticker] }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function faceTransform(face: string) {
  switch (face) {
    case "F":
      return "translateZ(90px)";
    case "B":
      return "rotateY(180deg) translateZ(90px)";
    case "R":
      return "rotateY(90deg) translateZ(90px)";
    case "L":
      return "rotateY(-90deg) translateZ(90px)";
    case "U":
      return "rotateX(90deg) translateZ(90px)";
    case "D":
      return "rotateX(-90deg) translateZ(90px)";
    default:
      return "";
  }
}

function resolveFaceGestureMove(
  face: keyof typeof FACE_GESTURE_VECTORS,
  startedOnSticker: boolean,
  rowBand: -1 | 0 | 1,
  columnBand: -1 | 0 | 1,
  facePoint: { x: number; y: number },
  rotation: RotationState,
  deltaX: number,
  deltaY: number,
) {
  const gesture = FACE_GESTURE_VECTORS[face];
  const rightVector = normalizeScreenVector(projectVectorToScreen(rotateVector(gesture.right, rotation)));
  const downVector = normalizeScreenVector(projectVectorToScreen(rotateVector(gesture.down, rotation)));
  const localDrag = {
    x: dotProduct2D({ x: deltaX, y: deltaY }, rightVector),
    y: dotProduct2D({ x: deltaX, y: deltaY }, downVector),
  };
  const isHorizontal = Math.abs(localDrag.x) >= Math.abs(localDrag.y);
  const dominantDrag = isHorizontal
    ? { x: Math.sign(localDrag.x) || 1, y: 0 }
    : { x: 0, y: Math.sign(localDrag.y) || 1 };
  const moveSelection = resolveMoveSelection(
    face,
    startedOnSticker,
    rowBand,
    columnBand,
    isHorizontal,
  );

  if (!moveSelection) {
    return null;
  }
  const moveNormal =
    moveSelection.offset === 0
      ? getSliceReferenceNormal(moveSelection.axisVector)
      : scaleVector(moveSelection.axisVector, moveSelection.offset);
  const interactionPoint = addVectors(
    addVectors(
      gesture.normal,
      scaleVector(gesture.right, clampEdgeCoordinate(facePoint.x)),
    ),
    addVectors(
      scaleVector(gesture.down, clampEdgeCoordinate(facePoint.y)),
      scaleVector(moveSelection.axisVector, moveSelection.offset),
    ),
  );
  const worldDrag = addVectors(
    scaleVector(gesture.right, dominantDrag.x),
    scaleVector(gesture.down, dominantDrag.y),
  );
  const positiveTangent = crossProduct(moveNormal, interactionPoint);
  const rotationSign = dotProduct(positiveTangent, worldDrag) >= 0 ? 1 : -1;

  return `${formatLayerMove(moveSelection, rotationSign)}${rotationSign === -1 ? "" : "'"}`;
}

function getFaceLocalPoint(
  faceElement: HTMLElement | null | undefined,
  face: keyof typeof FACE_GESTURE_VECTORS,
  rotation: RotationState,
  clientX: number,
  clientY: number,
) {
  if (!faceElement) {
    return { x: 0, y: 0 };
  }

  const gesture = FACE_GESTURE_VECTORS[face];
  const rightVector = normalizeScreenVector(projectVectorToScreen(rotateVector(gesture.right, rotation)));
  const downVector = normalizeScreenVector(projectVectorToScreen(rotateVector(gesture.down, rotation)));
  const rect = faceElement.getBoundingClientRect();
  const screenOffset = {
    x: clientX - (rect.left + rect.width / 2),
    y: clientY - (rect.top + rect.height / 2),
  };
  const scale = Math.max(1, Math.min(rect.width, rect.height) / 2);
  const localPoint = clampLocalPoint({
    x: dotProduct2D(screenOffset, rightVector) / scale,
    y: dotProduct2D(screenOffset, downVector) / scale,
  });

  return localPoint;
}

function clampLocalPoint(point: { x: number; y: number }) {
  return {
    x: Math.max(-1, Math.min(1, point.x)),
    y: Math.max(-1, Math.min(1, point.y)),
  };
}

function resolveMoveSelection(
  pickedFace: keyof typeof FACE_GESTURE_VECTORS,
  startedOnSticker: boolean,
  rowBand: -1 | 0 | 1,
  columnBand: -1 | 0 | 1,
  isHorizontal: boolean,
): { axisVector: Vector3; offset: -1 | 0 | 1 } | null {
  const gesture = FACE_GESTURE_VECTORS[pickedFace];
  const axisVector = isHorizontal ? gesture.down : gesture.right;
  const offset = isHorizontal ? rowBand : columnBand;

  if (axisVector.z !== 0 && !startedOnSticker) {
    return null;
  }

  return { axisVector, offset };
}

function clampEdgeCoordinate(value: number) {
  return Math.max(-0.85, Math.min(0.85, value));
}

function resolveLockedBand(
  coordinate: number,
  stickerBand: number,
  preferStickerBand: boolean,
): -1 | 0 | 1 {
  if (preferStickerBand) {
    if (stickerBand < 0) {
      return -1;
    }

    if (stickerBand > 0) {
      return 1;
    }

    return 0;
  }

  const CENTER_BAND_THRESHOLD = 0.28;

  if (coordinate <= -CENTER_BAND_THRESHOLD) {
    return -1;
  }

  if (coordinate >= CENTER_BAND_THRESHOLD) {
    return 1;
  }

  if (stickerBand < 0) {
    return -1;
  }

  if (stickerBand > 0) {
    return 1;
  }

  return 0;
}

function getSliceReferenceNormal(axisVector: Vector3): Vector3 {
  if (axisVector.x !== 0) {
    return { x: -1, y: 0, z: 0 };
  }

  if (axisVector.y !== 0) {
    return { x: 0, y: -1, z: 0 };
  }

  return { x: 0, y: 0, z: 1 };
}

function formatLayerMove(
  selection: { axisVector: Vector3; offset: -1 | 0 | 1 },
  rotationSign: number,
) {
  if (selection.offset === 0) {
    if (selection.axisVector.x !== 0) {
      return "M";
    }

    if (selection.axisVector.y !== 0) {
      return "E";
    }

    return "S";
  }

  return vectorToFace(scaleVector(selection.axisVector, selection.offset));
}

function logGestureDecision(data: {
  pickedFace: keyof typeof FACE_GESTURE_VECTORS;
  facePoint: { x: number; y: number };
  rowBand: -1 | 0 | 1;
  columnBand: -1 | 0 | 1;
  deltaX: number;
  deltaY: number;
  move: string;
}) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.debug("[cube-gesture]", data);
}

function vectorToFace(vector: Vector3): keyof typeof FACE_GESTURE_VECTORS {
  if (vector.x === 1) {
    return "R";
  }

  if (vector.x === -1) {
    return "L";
  }

  if (vector.y === 1) {
    return "U";
  }

  if (vector.y === -1) {
    return "D";
  }

  return vector.z === 1 ? "F" : "B";
}

function addVectors(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scaleVector(vector: Vector3, scalar: number): Vector3 {
  return { x: vector.x * scalar, y: vector.y * scalar, z: vector.z * scalar };
}

function negateVector(vector: Vector3): Vector3 {
  return scaleVector(vector, -1);
}

function crossProduct(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dotProduct(a: Vector3, b: Vector3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function projectVectorToScreen(vector: Vector3) {
  return {
    x: vector.x,
    y: -vector.y,
  };
}

function normalizeScreenVector(vector: { x: number; y: number }) {
  const length = Math.hypot(vector.x, vector.y);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function dotProduct2D(a: { x: number; y: number }, b: { x: number; y: number }) {
  return a.x * b.x + a.y * b.y;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function SectionHeader({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-200/10 bg-emerald-300/10 text-emerald-100">
        {icon}
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/55">{eyebrow}</p>
        <h3 className="font-[family-name:var(--font-display)] text-xl text-white">{title}</h3>
        <p className="mt-1 text-sm text-slate-300">{description}</p>
      </div>
    </div>
  );
}

export function RubiksCubeApp() {
  const [cubeFacelets, setCubeFacelets] = useState(SOLVED_FACELETS);
  const [history, setHistory] = useState<MoveHistoryEntry[]>([]);
  const [scramble, setScramble] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [solution, setSolution] = useState<SolutionState | null>(null);
  const [rotation, setRotation] = useState<RotationState>({ x: -24, y: -38 });
  const [solveHistory, setSolveHistory] = useState<SolveAttemptListItem[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<SolveAttemptDetail | null>(null);
  const [latestAttempt, setLatestAttempt] = useState<SolveAttemptRecord | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isAttemptLoading, setIsAttemptLoading] = useState(false);
  const [isSavingAttempt, setIsSavingAttempt] = useState(false);
  const [isApplyingMove, startMoveTransition] = useTransition();
  const [isSolving, startSolvingTransition] = useTransition();
  const attemptRef = useRef<{
    startedAt: number | null;
    startFacelets: string | null;
    lastSavedSignature: string | null;
  }>({
    startedAt: null,
    startFacelets: null,
    lastSavedSignature: null,
  });

  const isSolved = cubeFacelets === SOLVED_FACELETS;
  const moveCount = history.length;
  const nextSolutionMove = solution?.moves[solution.currentStep] ?? null;
  const latestFeedback = latestAttempt?.ai_feedback ?? solveHistory[0]?.ai_feedback ?? null;
  const relativeFaceMap = useMemo(() => getRelativeFaceMap(rotation), [rotation]);
  const moveButtons = useMemo(
    () =>
      VIEW_FACES.flatMap((viewFace) => {
        const actualFace = relativeFaceMap[viewFace];
        return [
          {
            key: `${viewFace}`,
            label: `${viewFace}`,
            actualMove: `${actualFace}`,
          },
          {
            key: `${viewFace}'`,
            label: `${viewFace}'`,
            actualMove: `${actualFace}'`,
          },
          {
            key: `${viewFace}2`,
            label: `${viewFace}2`,
            actualMove: `${actualFace}2`,
          },
        ];
      }),
    [relativeFaceMap],
  );

  const loadSolveHistory = async () => {
    try {
      setIsHistoryLoading(true);
      const response = await fetch("/api/solve-attempts", { cache: "no-store" });
      const payload = (await response.json()) as { attempts?: SolveAttemptListItem[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load solve history.");
      }

      setSolveHistory(payload.attempts ?? []);
      setHistoryError(null);
    } catch (loadError) {
      setHistoryError(loadError instanceof Error ? loadError.message : "Failed to load solve history.");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const loadAttemptDetail = async (id: string) => {
    try {
      setIsAttemptLoading(true);
      const response = await fetch(`/api/solve-attempts/${id}/analysis`, { cache: "no-store" });
      const payload = (await response.json()) as { attempt?: SolveAttemptDetail; error?: string };

      if (!response.ok || !payload.attempt) {
        throw new Error(payload.error ?? "Failed to load solve attempt.");
      }

      setSelectedAttempt(payload.attempt);
      setHistoryError(null);
    } catch (loadError) {
      setHistoryError(loadError instanceof Error ? loadError.message : "Failed to load solve attempt.");
    } finally {
      setIsAttemptLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      await loadSolveHistory();
    };

    void run();
  }, []);

  useEffect(() => {
    if (!isSolved || history.length === 0 || isSavingAttempt) {
      return;
    }

    const signature = JSON.stringify({
      scramble,
      moves: history,
      solved: isSolved,
      endFacelets: cubeFacelets,
    });

    if (attemptRef.current.lastSavedSignature === signature) {
      return;
    }

    const run = async () => {
      try {
        setIsSavingAttempt(true);
        const response = await fetch("/api/solve-attempts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            scramble,
            moveHistory: history,
            solved: isSolved,
            solveDurationMs:
              attemptRef.current.startedAt === null ? null : Date.now() - attemptRef.current.startedAt,
            solverSolution: solution?.moves ?? null,
            startFacelets: scramble.length > 0 ? null : attemptRef.current.startFacelets,
            endFacelets: cubeFacelets,
          }),
        });
        const payload = (await response.json()) as { attempt?: SolveAttemptRecord; error?: string };

        if (!response.ok || !payload.attempt) {
          throw new Error(payload.error ?? "Failed to save solve attempt.");
        }

        const attempt = payload.attempt;

        attemptRef.current.lastSavedSignature = signature;
        setLatestAttempt(attempt);
        setSolveHistory((current) => [
          {
            id: attempt.id,
            created_at: attempt.created_at,
            solved: attempt.solved,
            move_count: attempt.move_count,
            solve_duration_ms: attempt.solve_duration_ms,
            ai_feedback: attempt.ai_feedback,
          },
          ...current.filter((currentAttempt) => currentAttempt.id !== attempt.id),
        ]);
        setHistoryError(null);
      } catch (saveError) {
        setHistoryError(saveError instanceof Error ? saveError.message : "Failed to save solve attempt.");
      } finally {
        setIsSavingAttempt(false);
      }
    };

    void run();
  }, [cubeFacelets, history, isSolved, isSavingAttempt, scramble, solution]);

  useEffect(() => {
    if (selectedAttempt || solveHistory.length === 0 || isAttemptLoading) {
      return;
    }

    const run = async () => {
      await loadAttemptDetail(solveHistory[0].id);
    };

    void run();
  }, [isAttemptLoading, selectedAttempt, solveHistory]);

  const runAlgorithm = (algorithm: string, source: MoveHistoryEntry["source"]) => {
    setError(null);

    if (attemptRef.current.startedAt === null) {
      attemptRef.current.startedAt = Date.now();
      attemptRef.current.startFacelets = cubeFacelets;
    }

    startMoveTransition(async () => {
      try {
        const nextFacelets = await applyAlgorithm(cubeFacelets, algorithm);
        const moves = normalizeAlgorithm(algorithm);

        setCubeFacelets(nextFacelets);
        setHistory((current) => [...current, ...moves.map((move) => ({ move, source }))]);
        setSolution(null);
      } catch {
        setError("The cube move could not be applied.");
      }
    });
  };

  const handleScramble = () => {
    const nextScramble = buildScramble();
    setScramble(nextScramble);
    attemptRef.current.startedAt = Date.now();
    attemptRef.current.startFacelets = null;
    attemptRef.current.lastSavedSignature = null;
    runAlgorithm(nextScramble.join(" "), "scramble");
  };

  const handleReset = () => {
    setCubeFacelets(SOLVED_FACELETS);
    setHistory([]);
    setScramble([]);
    setSolution(null);
    setError(null);
    setLatestAttempt(null);
    attemptRef.current.startedAt = null;
    attemptRef.current.startFacelets = null;
    attemptRef.current.lastSavedSignature = null;
  };

  const handleSolve = () => {
    setError(null);

    startSolvingTransition(async () => {
      try {
        const moves = await solveFacelets(cubeFacelets);

        setSolution({
          startFacelets: cubeFacelets,
          moves,
          currentStep: 0,
        });
      } catch {
        setError("The solver could not compute a solution for this state.");
      }
    });
  };

  const setSolutionStep = async (nextStep: number) => {
    if (!solution) {
      return;
    }

    const boundedStep = Math.max(0, Math.min(solution.moves.length, nextStep));
    const algorithm = solution.moves.slice(0, boundedStep).join(" ");
    const nextFacelets =
      boundedStep === 0 ? solution.startFacelets : await applyAlgorithm(solution.startFacelets, algorithm);

    setCubeFacelets(nextFacelets);
    setSolution((current) => (current ? { ...current, currentStep: boundedStep } : current));
  };

  const applySolutionToLiveCube = () => {
    if (!solution || solution.moves.length === 0) {
      return;
    }

    setHistory((current) => [
      ...current,
      ...solution.moves.map((move) => ({ move, source: "solution" as const })),
    ]);
    setCubeFacelets(SOLVED_FACELETS);
    setSolution((current) =>
      current
        ? {
            ...current,
            currentStep: current.moves.length,
          }
        : current,
    );
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-6rem] h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-6rem] h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="glass-panel overflow-hidden rounded-[1.75rem] px-6 py-8 sm:px-8">
          <div className="mesh-background pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="space-y-4">
                <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-4xl leading-tight sm:text-5xl">
                  Interactive Rubik&apos;s Cube Solver
                </h1>
                <p className="max-w-2xl text-base text-slate-300 sm:text-lg">
                  A full-stack Rubik&apos;s Cube experience with a responsive 3D cube, guided move
                  playback, persisted solve history, and backend-generated performance feedback.
                  It pairs tactile interaction on the frontend with solve analysis and coaching
                  summaries that make each attempt easier to review.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-200">
                <MetricBadge label="State" value={isSolved ? "Solved" : "Active"} />
                <MetricBadge label="Moves" value={String(moveCount)} />
                <MetricBadge
                  label="Solver"
                  value={solution ? `${solution.moves.length} steps` : "Ready"}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <FeatureCard
                title="Interactive cube"
                description="Rotate the cube freely and inspect it from different angles in a responsive 3D view."
              />
              <FeatureCard
                title="Move playback"
                description="Apply moves manually, generate a solution, and step through each move one at a time."
              />
              <FeatureCard
                title="History and feedback"
                description="Review saved solves with backend analysis, redundant move metrics, and concise coaching notes."
              />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <CubeStage
            facelets={cubeFacelets}
            rotation={rotation}
            onRotationChange={setRotation}
            onMove={(move) => runAlgorithm(move, "manual")}
            disabled={isApplyingMove || isSolving}
          />

          <div className="flex flex-col gap-6">
            <Panel>
              <SectionHeader
                icon={<Sparkles className="h-5 w-5" />}
                eyebrow="Controls"
                title="Move Console"
                description="Apply manual turns or generate a fresh scramble."
              />

              <div className="mt-6 grid grid-cols-3 gap-2">
                {moveButtons.map((move) => (
                  <button
                    key={move.key}
                    type="button"
                    onClick={() => runAlgorithm(move.actualMove, "manual")}
                    disabled={isApplyingMove || isSolving}
                    className="rounded-xl border border-white/10 bg-white/6 px-3 py-3 text-sm font-semibold text-slate-100 transition hover:border-emerald-300/35 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                    title={`Applies ${move.actualMove} on the cube`}
                  >
                    <span>{move.label}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-4 text-sm text-slate-300">
                <p>
                  Controls are view-relative. Current mapping:{" "}
                  {VIEW_FACES.map((face) => `${face}→${relativeFaceMap[face]}`).join("  ")}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <ActionButton
                  label="Scramble"
                  icon={<Shuffle className="h-4 w-4" />}
                  onClick={handleScramble}
                  disabled={isApplyingMove || isSolving}
                />
                <ActionButton
                  label="Reset"
                  icon={<RotateCcw className="h-4 w-4" />}
                  onClick={handleReset}
                  disabled={isApplyingMove || isSolving}
                  subtle
                />
                <ActionButton
                  label={isSolving ? "Solving..." : "Solve"}
                  icon={isSolving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  onClick={handleSolve}
                  disabled={isApplyingMove || isSolving}
                />
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-4 text-sm">
                <p className="text-slate-200">
                  <span className="text-slate-400">Current scramble:</span>{" "}
                  {scramble.length > 0 ? scramble.join(" ") : "No scramble generated yet."}
                </p>
              </div>

              {error ? (
                <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </p>
              ) : null}
            </Panel>

            <Panel>
              <SectionHeader
                icon={<History className="h-5 w-5" />}
                eyebrow="History"
                title="Move Timeline"
                description="Every scramble, manual turn, and solver sequence is tracked here."
              />

              <div className="mt-6 max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {history.length > 0 ? (
                  history.map((entry, index) => (
                    <div
                      key={`${entry.move}-${index}`}
                      className="flex items-center justify-between rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 text-xs text-slate-500">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="font-semibold text-white">{entry.move}</span>
                      </div>
                      <span className="rounded-lg border border-white/8 bg-black/20 px-2 py-1 text-[11px] uppercase tracking-[0.25em] text-slate-400">
                        {entry.source}
                      </span>
                    </div>
                  ))
                ) : (
                  <EmptyState message="Moves will appear here after you scramble or start turning faces." />
                )}
              </div>
            </Panel>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Panel>
            <SectionHeader
              icon={<CheckCircle2 className="h-5 w-5" />}
              eyebrow="Status"
              title="Cube Summary"
              description="A quick read on the current state before you solve."
            />

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <StatusCard label="Cube state" value={isSolved ? "Solved" : "Scrambled"} />
              <StatusCard label="Recorded moves" value={String(moveCount)} />
              <StatusCard label="Last move" value={history.at(-1)?.move ?? "None"} />
              <StatusCard label="Next solve step" value={nextSolutionMove ?? "Not generated"} />
            </div>
          </Panel>

          <Panel>
            <SectionHeader
              icon={<Sparkles className="h-5 w-5" />}
              eyebrow="Walkthrough"
              title="Step-by-Step Solution"
              description="Preview the solver sequence and scrub through it at your own pace."
            />

            {solution ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-[1.25rem] border border-white/10 bg-black/15 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-400">Step progress</p>
                      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl">
                        {solution.currentStep}/{solution.moves.length}
                      </p>
                    </div>
                    <div className="min-w-[220px] flex-1 rounded-xl bg-white/8 p-1">
                      <div
                        className="h-2 rounded-lg bg-gradient-to-r from-emerald-300 to-lime-200 transition-all"
                        style={{
                          width: `${solution.moves.length === 0 ? 100 : (solution.currentStep / solution.moves.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <ActionButton
                      label="Previous"
                      icon={<ChevronLeft className="h-4 w-4" />}
                      onClick={() => void setSolutionStep(solution.currentStep - 1)}
                      disabled={solution.currentStep === 0}
                      subtle
                    />
                    <ActionButton
                      label={solution.currentStep === solution.moves.length ? "Complete" : "Next"}
                      icon={<ChevronRight className="h-4 w-4" />}
                      onClick={() => void setSolutionStep(solution.currentStep + 1)}
                      disabled={solution.currentStep === solution.moves.length}
                    />
                    <ActionButton
                      label="Apply All"
                      icon={<CheckCircle2 className="h-4 w-4" />}
                      onClick={applySolutionToLiveCube}
                      disabled={solution.moves.length === 0}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {solution.moves.length > 0 ? (
                    solution.moves.map((move, index) => {
                      const isCurrent = solution.currentStep === index + 1;
                      const isDone = solution.currentStep > index + 1;

                      return (
                        <button
                          key={`${move}-${index}`}
                          type="button"
                          onClick={() => void setSolutionStep(index + 1)}
                          className={`rounded-xl border px-4 py-4 text-left transition ${
                            isCurrent
                              ? "border-emerald-300/45 bg-emerald-300/12"
                              : isDone
                                ? "border-sky-300/25 bg-sky-300/10"
                                : "border-white/10 bg-white/5"
                          }`}
                        >
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            Step {index + 1}
                          </p>
                          <p className="mt-2 font-[family-name:var(--font-display)] text-xl">{move}</p>
                        </button>
                      );
                    })
                  ) : (
                    <EmptyState message="The cube is already solved. No solution moves are needed." />
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6">
                <EmptyState message="Generate a solution to open the walkthrough viewer." />
              </div>
            )}
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Panel>
            <SectionHeader
              icon={<Sparkles className="h-5 w-5" />}
              eyebrow="Feedback"
              title="Latest Coaching"
              description="Each saved solve is analyzed in the backend and summarized into short coaching notes."
            />

            <div className="mt-6 space-y-4">
              <div className="rounded-[1.25rem] border border-white/10 bg-black/15 p-5">
                <p className="text-sm text-slate-400">Most recent feedback</p>
                <p className="mt-3 text-sm leading-7 text-slate-200">
                  {latestFeedback ?? "Complete and save a solve to generate backend analysis and AI coaching feedback."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <StatusCard
                  label="Saved solves"
                  value={String(solveHistory.length)}
                />
                <StatusCard
                  label="Latest result"
                  value={solveHistory[0] ? (solveHistory[0].solved ? "Solved" : "Unsolved") : "None"}
                />
              </div>
            </div>
          </Panel>

          <Panel>
            <SectionHeader
              icon={<History className="h-5 w-5" />}
              eyebrow="Persistence"
              title="Solve History"
              description="Saved attempts include solve metrics, redundant move analysis, and stored feedback."
            />

            {historyError ? (
              <p className="mt-5 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {historyError}
              </p>
            ) : null}

            <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3">
                {isHistoryLoading ? (
                  <EmptyState message="Loading solve history..." />
                ) : solveHistory.length > 0 ? (
                  solveHistory.map((attempt) => (
                    <button
                      key={attempt.id}
                      type="button"
                      onClick={() => void loadAttemptDetail(attempt.id)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:border-emerald-300/35 hover:bg-white/8"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-white">
                          {formatTimestamp(attempt.created_at)}
                        </span>
                        <span className="rounded-lg border border-white/8 bg-black/20 px-2 py-1 text-[11px] uppercase tracking-[0.25em] text-slate-400">
                          {attempt.solved ? "Solved" : "Unsolved"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">
                        {attempt.move_count} moves
                        {attempt.solve_duration_ms !== null
                          ? ` • ${formatDuration(attempt.solve_duration_ms)}`
                          : ""}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        {attempt.ai_feedback ?? "No AI feedback stored for this attempt yet."}
                      </p>
                    </button>
                  ))
                ) : (
                  <EmptyState message="Saved solve attempts will appear here after you complete a solve." />
                )}
              </div>

              <div className="rounded-[1.25rem] border border-white/10 bg-black/15 p-5">
                {isAttemptLoading ? (
                  <EmptyState message="Loading solve details..." />
                ) : selectedAttempt ? (
                  <div className="space-y-5">
                    <div>
                      <p className="text-sm text-slate-400">Selected attempt</p>
                      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-white">
                        {formatTimestamp(selectedAttempt.created_at)}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        {selectedAttempt.solved ? "Solved successfully." : "Attempt ended unsolved."}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <StatusCard label="Move count" value={String(selectedAttempt.move_count)} />
                      <StatusCard
                        label="Optimal baseline"
                        value={
                          selectedAttempt.optimal_move_count === null
                            ? "Unavailable"
                            : String(selectedAttempt.optimal_move_count)
                        }
                      />
                      <StatusCard
                        label="Move delta"
                        value={
                          selectedAttempt.move_count_delta === null
                            ? "Unavailable"
                            : `${selectedAttempt.move_count_delta > 0 ? "+" : ""}${selectedAttempt.move_count_delta}`
                        }
                      />
                      <StatusCard
                        label="Inverse pairs"
                        value={String(selectedAttempt.inverse_move_pairs)}
                      />
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-slate-400">Repeated patterns</p>
                        <p className="mt-2 text-sm leading-6 text-slate-200">
                          {selectedAttempt.repeated_move_patterns.length > 0
                            ? selectedAttempt.repeated_move_patterns.join(", ")
                            : "No repeated patterns were detected."}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Stored feedback</p>
                        <p className="mt-2 text-sm leading-7 text-slate-200">
                          {selectedAttempt.ai_feedback ?? "No feedback stored yet."}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState message="Choose a saved solve to inspect its metrics and coaching feedback." />
                )}
              </div>
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function getRelativeFaceMap(rotation: RotationState): Record<(typeof VIEW_FACES)[number], string> {
  const directions = {
    U: { x: 0, y: 1, z: 0 },
    R: { x: 1, y: 0, z: 0 },
    F: { x: 0, y: 0, z: 1 },
    D: { x: 0, y: -1, z: 0 },
    L: { x: -1, y: 0, z: 0 },
    B: { x: 0, y: 0, z: -1 },
  };
  const rotated = Object.entries(directions).map(([face, vector]) => ({
    face,
    vector: rotateVector(vector, rotation),
  }));

  return {
    F: pickFace(rotated, "z", "max"),
    B: pickFace(rotated, "z", "min"),
    R: pickFace(rotated, "x", "max"),
    L: pickFace(rotated, "x", "min"),
    U: pickFace(rotated, "y", "max"),
    D: pickFace(rotated, "y", "min"),
  };
}

function rotateVector(
  vector: { x: number; y: number; z: number },
  rotation: RotationState,
) {
  const xRadians = (rotation.x * Math.PI) / 180;
  const yRadians = (rotation.y * Math.PI) / 180;

  const afterY = {
    x: vector.x * Math.cos(yRadians) + vector.z * Math.sin(yRadians),
    y: vector.y,
    z: -vector.x * Math.sin(yRadians) + vector.z * Math.cos(yRadians),
  };

  return {
    x: afterY.x,
    y: afterY.y * Math.cos(xRadians) - afterY.z * Math.sin(xRadians),
    z: afterY.y * Math.sin(xRadians) + afterY.z * Math.cos(xRadians),
  };
}

function pickFace(
  faces: Array<{ face: string; vector: { x: number; y: number; z: number } }>,
  axis: "x" | "y" | "z",
  direction: "max" | "min",
) {
  return faces.reduce((best, current) => {
    if (!best) {
      return current;
    }

    if (direction === "max") {
      return current.vector[axis] > best.vector[axis] ? current : best;
    }

    return current.vector[axis] < best.vector[axis] ? current : best;
  }, null as { face: string; vector: { x: number; y: number; z: number } } | null)?.face ?? "F";
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="glass-panel rounded-[1.5rem] p-6 sm:p-7">{children}</section>;
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  subtle,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
        subtle
          ? "border border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10"
          : "bg-gradient-to-r from-emerald-300 to-lime-200 text-slate-950 hover:brightness-105"
      } disabled:cursor-not-allowed disabled:opacity-45`}
    >
      {icon}
      {label}
    </button>
  );
}

function MetricBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/6 px-4 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="ml-2 font-semibold text-white">{value}</span>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
      <p className="font-[family-name:var(--font-display)] text-lg text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-xl text-white">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-white/12 bg-white/3 px-4 py-8 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}
