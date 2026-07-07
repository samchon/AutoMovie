import { IAutoMovieMcpProjectSummary } from "../dto";
import { AutoMovieProject } from "./AutoMovieProject";

/**
 * The resident-mode ordering gate (#615) — AutoBe's `TOOL_PREREQUISITES`
 * structure over automovie's film ladder. Each resident commit tool declares
 * the coarse project state it needs; an out-of-order call **throws an
 * actionable prompt** ("Cannot commitScene yet … Do this next: 1. …"), so the
 * agent is told the next step instead of decoding a violation list. The server
 * still never orchestrates (D012): it blocks wrong order and names the fix, the
 * agent drives.
 *
 * Only the **resident** path is gated: a commit with an explicit slate is a
 * pure stateless transform whose cross-slice preconditions already surface as
 * violations, and the pipeline compute tools (`stage`/`block`/`perform`/`cut`/
 * `forge`/`forgeProp`) are pure functions over explicit inputs — ordering lives
 * where state lives. `get*` tools require nothing; they answer `null`
 * honestly.
 *
 * Prerequisite failure THROWS (the AutoBe convention and the `requireProject`
 * precedent): the submission never happened, so there is no artifact for a
 * violation to locate — the error is the guidance.
 */
export type AutoMoviePrerequisiteTool =
  | "commitScript"
  | "commitScene"
  | "commitShot"
  | "commitBeatEnd"
  | "commitNotes"
  | "commitFilm";

type PrerequisiteKey = "script" | "scene" | "shots";

const TOOL_PREREQUISITES: Record<
  AutoMoviePrerequisiteTool,
  readonly PrerequisiteKey[]
> = {
  commitScript: [],
  commitScene: ["script"],
  commitShot: ["script", "scene"],
  commitBeatEnd: ["script", "scene", "shots"],
  commitNotes: ["script", "scene", "shots"],
  commitFilm: ["script", "scene", "shots"],
};

/**
 * Gate one resident commit: with unmet prerequisites this throws the actionable
 * prompt; otherwise it is a no-op.
 */
export const assertPrerequisites = (
  tool: AutoMoviePrerequisiteTool,
  project: AutoMovieProject,
): void => {
  const status = project.summary();
  const missing = TOOL_PREREQUISITES[tool].filter(
    (key) => !satisfied(key, status),
  );
  if (missing.length === 0) return;
  throw new Error(buildPrerequisitePrompt(tool, status, missing));
};

/**
 * The film ladder's current status and ordered next actions, as data — the same
 * computation the prerequisite throw uses, so an agent can ASK before trying.
 * Per-beat detail (which beats still need shots or beat ends) comes from the
 * resident slices.
 */
export const nextStepsOf = (
  project: AutoMovieProject,
): {
  status: IAutoMovieMcpProjectSummary;
  missing: string[];
  nextActions: string[];
} => {
  const status = project.summary();
  const missing = LADDER.filter((key) => !satisfied(key, status)).map(
    describeMissing,
  );

  const actions: string[] = [];
  if (!status.script) actions.push(ACTIONS.script);
  else if (!status.scene) actions.push(ACTIONS.scene);
  else {
    const slate = project.writableSlate();
    const beats = slate.script?.beats ?? [];
    const shotIds = new Set(status.shots);
    const beatEnds = new Set(status.beatEnds);
    for (const beat of beats)
      if (!shotIds.has(`shot:${beat.id}`))
        actions.push(
          `Call commitShot for beat "${beat.id}" (build it with block + perform).`,
        );
    for (const beat of beats)
      if (shotIds.has(`shot:${beat.id}`) && !beatEnds.has(beat.id))
        actions.push(
          `Call commitBeatEnd for beat "${beat.id}" so the next beat can resume from it.`,
        );
    if (status.notes > 0)
      actions.push(
        `Resolve and clear the ${status.notes} open review note(s) with commitNotes.`,
      );
    if (actions.length === 0 && !status.film) actions.push(ACTIONS.film);
  }
  return { status, missing, nextActions: actions };
};

const LADDER: readonly PrerequisiteKey[] = ["script", "scene", "shots"];

const satisfied = (
  key: PrerequisiteKey,
  status: IAutoMovieMcpProjectSummary,
): boolean => {
  switch (key) {
    case "script":
      return status.script;
    case "scene":
      return status.scene;
    case "shots":
      return status.shots.length > 0;
  }
};

const ACTIONS: Record<PrerequisiteKey | "film", string> = {
  script:
    "Call commitScript with the film's script (logline, theme, cast, beats).",
  scene:
    "Call commitScene with the staged scene (stage the script's cast with the stage tool first).",
  shots:
    "Call commitShot for at least one performed beat (build it with block + perform).",
  film: "Call commitFilm with the assembled sequence (cut the shots with the cut tool first).",
};

const describeMissing = (key: PrerequisiteKey): string => {
  switch (key) {
    case "script":
      return "script: no script committed — commit one with commitScript";
    case "scene":
      return "scene: no staged scene committed — commit one with commitScene";
    case "shots":
      return "shots: no shots committed — commit at least one with commitShot";
  }
};

const buildPrerequisitePrompt = (
  tool: AutoMoviePrerequisiteTool,
  status: IAutoMovieMcpProjectSummary,
  missing: readonly PrerequisiteKey[],
): string =>
  [
    `Cannot ${tool} yet.`,
    "",
    "The resident project's film ladder is not ready for this commit. Commit the missing prerequisites first (script → scene → shots → beat ends / notes → film).",
    "",
    "Current project status:",
    `- Script: ${status.script ? "committed" : "missing"}`,
    `- Scene: ${status.scene ? "committed" : "missing"}`,
    `- Shots committed: ${status.shots.length}`,
    `- Beat ends: ${status.beatEnds.length}`,
    `- Open notes: ${status.notes}`,
    `- Film: ${status.film ? "committed" : "missing"}`,
    "",
    "Missing prerequisite(s):",
    ...missing.map((key) => `- ${describeMissing(key)}`),
    "",
    "Do this next:",
    ...missing.map((key, index) => `${index + 1}. ${ACTIONS[key]}`),
  ].join("\n");
