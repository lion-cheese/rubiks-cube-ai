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

const MOVE_BUTTONS = BASE_MOVES.flatMap((move) => [move, `${move}'`, `${move}2`]);
const VIEW_FACES = ["U", "R", "F", "D", "L", "B"] as const;

type RotationState = {
  x: number;
  y: number;
};

function CubeStage({
  facelets,
  rotation,
  onRotationChange,
  disabled,
}: {
  facelets: string;
  rotation: RotationState;
  onRotationChange: (rotation: RotationState) => void;
  disabled?: boolean;
}) {
  const faces = useMemo(() => parseFacelets(facelets), [facelets]);
  const dragState = useRef<{ x: number; y: number; rotateX: number; rotateY: number } | null>(
    null,
  );
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

    dragState.current = {
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

    applyRotation({
      x: Math.max(-75, Math.min(75, dragState.current.rotateX - deltaY * 0.35)),
      y: dragState.current.rotateY + deltaX * 0.4,
    });
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current || disabled) {
      return;
    }

    dragState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onRotationChange(liveRotationRef.current);
  };

  return (
    <div className="glass-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
      <div className="mesh-background pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/60">Cube View</p>
            <h2 className="font-[family-name:var(--font-display)] text-2xl">Interactive Stage</h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
            Drag to rotate
          </span>
        </div>

        <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950/35">
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
                      className="grid h-full w-full grid-cols-3 gap-[6px] rounded-[1.25rem] border border-white/12 bg-slate-950/70 p-[10px] shadow-[0_20px_80px_rgba(0,0,0,0.4)]"
                      style={{ transform: faceTransform(face) }}
                    >
                      {stickers.map((sticker, index) => (
                        <div
                          key={`${face}-${index}`}
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
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200/10 bg-emerald-300/10 text-emerald-100">
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
  const [isApplyingMove, startMoveTransition] = useTransition();
  const [isSolving, startSolvingTransition] = useTransition();

  const isSolved = cubeFacelets === SOLVED_FACELETS;
  const moveCount = history.length;
  const nextSolutionMove = solution?.moves[solution.currentStep] ?? null;
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

  const runAlgorithm = (algorithm: string, source: MoveHistoryEntry["source"]) => {
    setError(null);

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
    runAlgorithm(nextScramble.join(" "), "scramble");
  };

  const handleReset = () => {
    setCubeFacelets(SOLVED_FACELETS);
    setHistory([]);
    setScramble([]);
    setSolution(null);
    setError(null);
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
        <section className="glass-panel overflow-hidden rounded-[2.25rem] px-6 py-8 sm:px-8">
          <div className="mesh-background pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/65">
                Phase 1 MVP
              </p>
              <div className="space-y-4">
                <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-4xl leading-tight sm:text-5xl">
                  Rubik&apos;s Cube solver with a tactile UI, move controls, and guided playback.
                </h1>
                <p className="max-w-2xl text-base text-slate-300 sm:text-lg">
                  Frontend-first and portfolio-ready: scramble the cube, apply face turns, inspect
                  move history, and generate a solver-powered sequence you can step through one move
                  at a time.
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
                description="A draggable 3D cube stage keeps the core interaction visual and immediate."
              />
              <FeatureCard
                title="Guided solve viewer"
                description="Preview each solver move with previous and next step controls."
              />
              <FeatureCard
                title="Frontend-only"
                description="No auth, no database, no backend dependencies in this phase."
              />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <CubeStage
            facelets={cubeFacelets}
            rotation={rotation}
            onRotationChange={setRotation}
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
                    className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3 text-sm font-semibold text-slate-100 transition hover:border-emerald-300/35 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                    title={`Applies ${move.actualMove} on the cube`}
                  >
                    <span>{move.label}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-slate-300">
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

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4 text-sm">
                <p className="text-slate-200">
                  <span className="text-slate-400">Current scramble:</span>{" "}
                  {scramble.length > 0 ? scramble.join(" ") : "No scramble generated yet."}
                </p>
              </div>

              {error ? (
                <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
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
                      className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 text-xs text-slate-500">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="font-semibold text-white">{entry.move}</span>
                      </div>
                      <span className="rounded-full border border-white/8 bg-black/20 px-2 py-1 text-[11px] uppercase tracking-[0.25em] text-slate-400">
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
                <div className="rounded-[1.6rem] border border-white/10 bg-black/15 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-400">Step progress</p>
                      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl">
                        {solution.currentStep}/{solution.moves.length}
                      </p>
                    </div>
                    <div className="min-w-[220px] flex-1 rounded-full bg-white/8 p-1">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-emerald-300 to-lime-200 transition-all"
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
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
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
  return <section className="glass-panel rounded-[2rem] p-6 sm:p-7">{children}</section>;
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
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
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
    <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2">
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
    <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
      <p className="font-[family-name:var(--font-display)] text-lg text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-xl text-white">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/3 px-4 py-8 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}
