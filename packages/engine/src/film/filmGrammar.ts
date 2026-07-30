import {
  AutoMovieGrammarStyleIntent,
  IAutoMovieCameraIntent,
  IAutoMovieReviewNote,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Vector3 } from "../math/Vector3";
import { compareCodeUnits } from "../text/compareCodeUnits";
import { FRAMING_HEIGHT_FRACTION } from "./cameraMove";
import { IAutoMovieResolvedCamera, projectToNdc } from "./cameraProjection";

/** Machine-readable film-grammar diagnostic families. */
export type AutoMovieGrammarDiagnosticCode =
  | "grammar-axis-crossed"
  | "grammar-jump-cut"
  | "grammar-eyeline"
  | "grammar-screen-direction"
  | "grammar-shot-size"
  | "grammar-reestablish"
  | "grammar-pacing";

/** One subject's deterministic measurements over a shot. */
export interface IAutoMovieGrammarSubjectObservation {
  /** Stable scene-node or formation id. */
  id: string;
  /** World root at the opening frame. */
  start: IAutoMovieVector3;
  /** World root at the closing frame. */
  end: IAutoMovieVector3;
  /** Positive world-space subject height in metres. */
  height: number;
  /** Subject this actor looks toward, when authored. */
  eyelineTarget?: string;
}

/** The geometric and editorial facts required to inspect one ordered shot. */
export interface IAutoMovieGrammarShotObservation {
  /** Stable shot id. */
  id: string;
  /** Positive edited duration in seconds. */
  duration: number;
  /** Resolved camera plus its perspective projection. */
  camera: IAutoMovieResolvedCamera & {
    /** Vertical field of view in degrees. */
    fovY: number;
    /** Render width divided by height. */
    aspect: number;
  };
  /** Subjects observed in this shot; input order has no meaning. */
  subjects: IAutoMovieGrammarSubjectObservation[];
  /** Principal subject used for cut and framing checks. */
  primarySubject: string | null;
  /** Authored framing claim, or null when none was declared. */
  declaredShotSize: IAutoMovieCameraIntent["framing"] | null;
  /** Two subjects defining the line of action, or null when unavailable. */
  actionAxis: readonly [string, string] | null;
  /**
   * Whether the shot visibly carries the camera across its action axis instead
   * of hiding the crossing in a cut.
   */
  onScreenAxisCrossing: boolean;
  /** Deliberate exceptions copied from the shot contract. */
  styleIntent?: AutoMovieGrammarStyleIntent[];
}

/** A film-grammar fact, its editorial consequence, and a concrete recovery. */
export interface IAutoMovieGrammarDiagnostic {
  /** Stable diagnostic family. */
  code: AutoMovieGrammarDiagnosticCode;
  /** Objective failures are errors; heuristics warn; statistics advise. */
  severity: "error" | "warning" | "advisory";
  /** Incoming or sole shot where the diagnostic is filed. */
  shot: string;
  /** Preceding edited shot for a cut diagnostic. */
  previousShot: string | null;
  /** Measured fact. */
  fact: string;
  /** Why that fact can damage the visual read. */
  impact: string;
  /** Concrete corrective option. */
  recovery: string;
}

/** Exact one-to-one suppression table for deliberate grammar exceptions. */
export const GRAMMAR_STYLE_SUPPRESSION: Readonly<
  Record<AutoMovieGrammarStyleIntent, AutoMovieGrammarDiagnosticCode>
> = {
  "jump-cut": "grammar-jump-cut",
  "eyeline-break": "grammar-eyeline",
  "tight-reestablish": "grammar-reestablish",
  "rhythmic-pacing": "grammar-pacing",
};

const DEFAULT_MINIMUM_CUT_ANGLE_DEGREES = 30;
const DEFAULT_REESTABLISH_DISTANCE = 10;
const EPSILON = 1e-6;

/**
 * Diagnose an ordered edit from deterministic shot observations.
 *
 * Shot order is editorial meaning and remains untouched. Subject collections
 * and action-axis endpoints are normalized by id, so collection order and
 * random generation order cannot alter the result. The analyzer has no seed,
 * clock, scene mutation, or renderer dependency.
 */
export const analyzeFilmGrammar = (props: {
  /** Shots in edited playback order. */
  shots: readonly IAutoMovieGrammarShotObservation[];
  /** Smallest camera-bearing change that avoids a same-size jump cut. */
  minimumCutAngleDegrees?: number;
  /** Subject displacement that requires a wide re-establishing view. */
  reestablishDistance?: number;
}): IAutoMovieGrammarDiagnostic[] => {
  const minimumCutAngleDegrees =
    props.minimumCutAngleDegrees ?? DEFAULT_MINIMUM_CUT_ANGLE_DEGREES;
  const reestablishDistance =
    props.reestablishDistance ?? DEFAULT_REESTABLISH_DISTANCE;
  positive(minimumCutAngleDegrees, "minimumCutAngleDegrees");
  positive(reestablishDistance, "reestablishDistance");
  const shots = props.shots.map(normalizeShot);
  const ids = new Set<string>();
  for (const shot of shots) {
    if (ids.has(shot.id))
      throw new Error(`Film grammar shot id "${shot.id}" is duplicated.`);
    ids.add(shot.id);
  }

  const diagnostics: IAutoMovieGrammarDiagnostic[] = [];
  for (const shot of shots) inspectShotSize(diagnostics, shot);
  for (let i = 1; i < shots.length; ++i)
    inspectCut(
      diagnostics,
      shots[i - 1]!,
      shots[i]!,
      minimumCutAngleDegrees,
      reestablishDistance,
    );
  if (shots.length !== 0) {
    const average =
      shots.reduce((sum, shot) => sum + shot.duration, 0) / shots.length;
    const incoming = shots[shots.length - 1]!;
    diagnostics.push({
      code: "grammar-pacing",
      severity: "advisory",
      shot: incoming.id,
      previousShot: null,
      fact: `edited durations are [${shots
        .map((shot) => `${round(shot.duration)}s`)
        .join(", ")}], average shot length ${round(average)}s`,
      impact:
        "the duration series is the measurable basis for judging whether the cut rhythm serves the beat",
      recovery:
        "compare the duration series with the intended dramatic cadence, then trim, extend, or explicitly mark rhythmic-pacing",
    });
  }
  return diagnostics.filter((diagnostic) => {
    const shot = shots.find((candidate) => candidate.id === diagnostic.shot)!;
    return (shot.styleIntent ?? []).some(
      (intent) => GRAMMAR_STYLE_SUPPRESSION[intent] === diagnostic.code,
    )
      ? false
      : true;
  });
};

/** Adapt grammar diagnostics into the existing visual-review backlog socket. */
export const grammarDiagnosticsToReviewNotes = (props: {
  /** Narrative beat that owns the review backlog. */
  beat: string;
  /** Mechanical grammar findings to file. */
  diagnostics: readonly IAutoMovieGrammarDiagnostic[];
}): IAutoMovieReviewNote[] =>
  props.diagnostics.map((diagnostic) => ({
    beat: props.beat,
    tier: "visual",
    issue: `${diagnostic.code}: ${diagnostic.fact}; ${diagnostic.impact}`,
    suggestion: diagnostic.recovery,
  }));

/** Classify a subject's measured fraction of total frame height. */
export const classifyGrammarShotSize = (
  verticalFrameOccupancy: number,
): IAutoMovieCameraIntent["framing"] => {
  positive(verticalFrameOccupancy, "verticalFrameOccupancy");
  const visibleHeightMultiple = 1 / verticalFrameOccupancy;
  return (
    Object.entries(FRAMING_HEIGHT_FRACTION) as [
      IAutoMovieCameraIntent["framing"],
      number,
    ][]
  ).reduce((best, candidate) =>
    Math.abs(Math.log(visibleHeightMultiple / candidate[1])) <
    Math.abs(Math.log(visibleHeightMultiple / best[1]))
      ? candidate
      : best,
  )[0];
};

type NormalizedShot = Omit<
  IAutoMovieGrammarShotObservation,
  "subjects" | "actionAxis" | "styleIntent"
> & {
  subjects: IAutoMovieGrammarSubjectObservation[];
  actionAxis: readonly [string, string] | null;
  styleIntent: AutoMovieGrammarStyleIntent[];
};

const normalizeShot = (
  input: IAutoMovieGrammarShotObservation,
): NormalizedShot => {
  nonBlank(input.id, "shot.id");
  positive(input.duration, `${input.id}.duration`);
  positive(input.camera.fovY, `${input.id}.camera.fovY`);
  if (input.camera.fovY >= 180)
    throw new Error(`${input.id}.camera.fovY must be below 180.`);
  positive(input.camera.aspect, `${input.id}.camera.aspect`);
  finiteVector(input.camera.position, `${input.id}.camera.position`);
  for (const [key, value] of Object.entries(input.camera.rotation))
    if (Number.isFinite(value) === false)
      throw new Error(`${input.id}.camera.rotation.${key} must be finite.`);

  const subjects = [...input.subjects].sort((a, b) =>
    compareCodeUnits(a.id, b.id),
  );
  const subjectIds = new Set<string>();
  for (const subject of subjects) {
    nonBlank(subject.id, `${input.id}.subjects.id`);
    if (subjectIds.has(subject.id))
      throw new Error(
        `Film grammar subject id "${subject.id}" is duplicated in "${input.id}".`,
      );
    subjectIds.add(subject.id);
    finiteVector(subject.start, `${input.id}.${subject.id}.start`);
    finiteVector(subject.end, `${input.id}.${subject.id}.end`);
    positive(subject.height, `${input.id}.${subject.id}.height`);
    if (subject.eyelineTarget !== undefined)
      nonBlank(
        subject.eyelineTarget,
        `${input.id}.${subject.id}.eyelineTarget`,
      );
  }
  if (
    input.primarySubject !== null &&
    subjectIds.has(input.primarySubject) === false
  )
    throw new Error(
      `Primary subject "${input.primarySubject}" is absent from "${input.id}".`,
    );
  let actionAxis: readonly [string, string] | null = null;
  if (input.actionAxis !== null) {
    const [first, second] = input.actionAxis;
    if (first === second)
      throw new Error(`Action axis in "${input.id}" repeats "${first}".`);
    if (subjectIds.has(first) === false || subjectIds.has(second) === false)
      throw new Error(
        `Action axis in "${input.id}" must reference two observed subjects.`,
      );
    actionAxis =
      compareCodeUnits(first, second) <= 0 ? [first, second] : [second, first];
  }
  const styleIntent = [...(input.styleIntent ?? [])];
  if (new Set(styleIntent).size !== styleIntent.length)
    throw new Error(`styleIntent in "${input.id}" must be unique.`);
  return { ...input, subjects, actionAxis, styleIntent };
};

const inspectShotSize = (
  diagnostics: IAutoMovieGrammarDiagnostic[],
  shot: NormalizedShot,
): void => {
  if (shot.primarySubject === null || shot.declaredShotSize === null) return;
  const measured = measuredShotSize(shot);
  if (measured === null || measured === shot.declaredShotSize) return;
  diagnostics.push({
    code: "grammar-shot-size",
    severity: "warning",
    shot: shot.id,
    previousShot: null,
    fact: `shot "${shot.id}" declares ${shot.declaredShotSize} framing but projects "${shot.primarySubject}" as ${measured}`,
    impact:
      "the rendered subject scale does not deliver the authored shot-size hierarchy",
    recovery: `move camera "${shot.id}" to measure as ${shot.declaredShotSize}, change its lens, or correct the declared framing`,
  });
};

const inspectCut = (
  diagnostics: IAutoMovieGrammarDiagnostic[],
  previous: NormalizedShot,
  incoming: NormalizedShot,
  minimumCutAngleDegrees: number,
  reestablishDistance: number,
): void => {
  inspectAxis(diagnostics, previous, incoming);
  const previousSubjects = byId(previous.subjects);
  const incomingSubjects = byId(incoming.subjects);
  if (
    previous.primarySubject !== null &&
    previous.primarySubject === incoming.primarySubject
  ) {
    const subjectId = previous.primarySubject;
    const outgoing = previousSubjects.get(subjectId)!;
    const arriving = incomingSubjects.get(subjectId)!;
    const previousSize = measuredShotSize(previous);
    const incomingSize = measuredShotSize(incoming);
    const cutAngle = cameraBearingAngleDegrees(
      outgoing.end,
      previous.camera.position,
      incoming.camera.position,
    );
    if (
      previousSize !== null &&
      previousSize === incomingSize &&
      cutAngle < minimumCutAngleDegrees
    )
      diagnostics.push({
        code: "grammar-jump-cut",
        severity: "warning",
        shot: incoming.id,
        previousShot: previous.id,
        fact: `cut "${previous.id}" -> "${incoming.id}" keeps ${subjectId} at ${incomingSize} size while camera bearing changes ${round(cutAngle)} degrees`,
        impact:
          "the small same-size spatial change can read as an accidental jump",
        recovery: `move camera "${incoming.id}" at least ${minimumCutAngleDegrees} degrees around "${subjectId}", change shot size, insert a neutral cutaway, or mark jump-cut`,
      });
    const displacement = Vector3.length(
      Vector3.subtract(arriving.start, outgoing.end),
    );
    if (
      displacement > reestablishDistance &&
      incomingSize !== null &&
      incomingSize !== "wide"
    )
      diagnostics.push({
        code: "grammar-reestablish",
        severity: "warning",
        shot: incoming.id,
        previousShot: previous.id,
        fact: `"${subjectId}" moves ${round(displacement)}m across the cut into a ${incomingSize} shot`,
        impact:
          "the audience loses the subject's new spatial relation without a wide orientation view",
        recovery: `make "${incoming.id}" wide, insert a neutral establishing shot before it, or mark tight-reestablish`,
      });
    inspectEyeline(
      diagnostics,
      previous,
      incoming,
      outgoing,
      previousSubjects,
      incomingSubjects,
    );
    inspectScreenDirection(diagnostics, previous, incoming, outgoing, arriving);
  }
  const incomingSize = measuredShotSize(incoming);
  const entrant = incoming.subjects.find(
    (subject) => previousSubjects.has(subject.id) === false,
  );
  if (
    entrant !== undefined &&
    incomingSize !== null &&
    incomingSize !== "wide" &&
    diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "grammar-reestablish" &&
        diagnostic.shot === incoming.id,
    ) === false
  )
    diagnostics.push({
      code: "grammar-reestablish",
      severity: "warning",
      shot: incoming.id,
      previousShot: previous.id,
      fact: `"${entrant.id}" first enters the edit in a ${incomingSize} shot`,
      impact:
        "the audience has no wide spatial introduction for the newly visible subject",
      recovery: `introduce "${entrant.id}" in a wide or neutral establishing shot before "${incoming.id}", or mark tight-reestablish`,
    });
};

const inspectAxis = (
  diagnostics: IAutoMovieGrammarDiagnostic[],
  previous: NormalizedShot,
  incoming: NormalizedShot,
): void => {
  if (
    previous.actionAxis === null ||
    incoming.actionAxis === null ||
    previous.actionAxis[0] !== incoming.actionAxis[0] ||
    previous.actionAxis[1] !== incoming.actionAxis[1] ||
    previous.onScreenAxisCrossing ||
    incoming.onScreenAxisCrossing
  )
    return;
  const previousSide = actionAxisSide(previous);
  const incomingSide = actionAxisSide(incoming);
  if (previousSide === 0 || incomingSide === 0 || previousSide === incomingSide)
    return;
  const halfPlane = previousSide > 0 ? "positive" : "negative";
  diagnostics.push({
    code: "grammar-axis-crossed",
    severity: "error",
    shot: incoming.id,
    previousShot: previous.id,
    fact: `cut "${previous.id}" -> "${incoming.id}" moves the camera from the ${halfPlane} to the ${halfPlane === "positive" ? "negative" : "positive"} half-plane of axis "${previous.actionAxis[0]}"-"${previous.actionAxis[1]}"`,
    impact:
      "the unseen axis crossing reverses established left-right geography",
    recovery: `keep camera "${incoming.id}" on the ${halfPlane} half-plane, show the crossing on screen, or insert a neutral shot on the action axis`,
  });
};

const inspectEyeline = (
  diagnostics: IAutoMovieGrammarDiagnostic[],
  previous: NormalizedShot,
  incoming: NormalizedShot,
  outgoing: IAutoMovieGrammarSubjectObservation,
  previousSubjects: ReadonlyMap<string, IAutoMovieGrammarSubjectObservation>,
  incomingSubjects: ReadonlyMap<string, IAutoMovieGrammarSubjectObservation>,
): void => {
  const targetId = outgoing.eyelineTarget;
  if (targetId === undefined) return;
  const previousTarget = previousSubjects.get(targetId);
  const incomingSubject = incomingSubjects.get(outgoing.id);
  const incomingTarget = incomingSubjects.get(targetId);
  if (
    previousTarget === undefined ||
    incomingSubject === undefined ||
    incomingTarget === undefined
  )
    return;
  const outgoingSide = relativeScreenDirection(
    previous,
    outgoing.end,
    previousTarget.end,
  );
  const incomingSide = relativeScreenDirection(
    incoming,
    incomingSubject.start,
    incomingTarget.start,
  );
  if (
    (outgoingSide.horizontal === 0 || incomingSide.horizontal === 0
      ? true
      : outgoingSide.horizontal === incomingSide.horizontal) &&
    (outgoingSide.vertical === 0 || incomingSide.vertical === 0
      ? true
      : outgoingSide.vertical === incomingSide.vertical)
  )
    return;
  diagnostics.push({
    code: "grammar-eyeline",
    severity: "warning",
    shot: incoming.id,
    previousShot: previous.id,
    fact: `"${targetId}" changes from ${screenRelation(outgoingSide)} to ${screenRelation(incomingSide)} of "${outgoing.id}" across the cut`,
    impact:
      "the reverse relative screen position breaks the established eyeline match",
    recovery: `place camera "${incoming.id}" on the prior eyeline half-plane, insert a neutral look shot, or mark eyeline-break`,
  });
};

const inspectScreenDirection = (
  diagnostics: IAutoMovieGrammarDiagnostic[],
  previous: NormalizedShot,
  incoming: NormalizedShot,
  outgoing: IAutoMovieGrammarSubjectObservation,
  arriving: IAutoMovieGrammarSubjectObservation,
): void => {
  const outgoingDirection = screenMotionDirection(previous, outgoing);
  const incomingDirection = screenMotionDirection(incoming, arriving);
  if (
    outgoingDirection === 0 ||
    incomingDirection === 0 ||
    outgoingDirection === incomingDirection
  )
    return;
  diagnostics.push({
    code: "grammar-screen-direction",
    severity: "error",
    shot: incoming.id,
    previousShot: previous.id,
    fact: `"${outgoing.id}" moves screen-${outgoingDirection > 0 ? "right" : "left"} in "${previous.id}" then screen-${incomingDirection > 0 ? "right" : "left"} in "${incoming.id}"`,
    impact:
      "the reversal can read as the subject turning around or changing destination",
    recovery: `keep "${outgoing.id}" moving screen-${outgoingDirection > 0 ? "right" : "left"}, cross the camera visibly, or insert a neutral head-on shot`,
  });
};

const actionAxisSide = (shot: NormalizedShot): -1 | 0 | 1 => {
  const subjects = byId(shot.subjects);
  const first = subjects.get(shot.actionAxis![0])!;
  const second = subjects.get(shot.actionAxis![1])!;
  const axis = Vector3.subtract(second.start, first.start);
  const camera = Vector3.subtract(shot.camera.position, first.start);
  return sign(axis.x * camera.z - axis.z * camera.x);
};

const measuredShotSize = (
  shot: NormalizedShot,
): IAutoMovieCameraIntent["framing"] | null => {
  if (shot.primarySubject === null) return null;
  const subject = byId(shot.subjects).get(shot.primarySubject)!;
  const halfY = Math.tan((shot.camera.fovY * Math.PI) / 360);
  const base = projectToNdc(
    shot.camera,
    subject.start,
    halfY,
    shot.camera.aspect,
  );
  const top = projectToNdc(
    shot.camera,
    { ...subject.start, y: subject.start.y + subject.height },
    halfY,
    shot.camera.aspect,
  );
  if (base.depth <= EPSILON || top.depth <= EPSILON) return null;
  const occupancy = Math.abs(top.ndcY - base.ndcY) / 2;
  return occupancy <= EPSILON ? null : classifyGrammarShotSize(occupancy);
};

const relativeScreenDirection = (
  shot: NormalizedShot,
  subject: IAutoMovieVector3,
  target: IAutoMovieVector3,
): { horizontal: -1 | 0 | 1; vertical: -1 | 0 | 1 } => {
  const halfY = Math.tan((shot.camera.fovY * Math.PI) / 360);
  const subjectProjection = projectToNdc(
    shot.camera,
    subject,
    halfY,
    shot.camera.aspect,
  );
  const targetProjection = projectToNdc(
    shot.camera,
    target,
    halfY,
    shot.camera.aspect,
  );
  if (subjectProjection.depth <= EPSILON || targetProjection.depth <= EPSILON)
    return { horizontal: 0, vertical: 0 };
  return {
    horizontal: sign(targetProjection.ndcX - subjectProjection.ndcX),
    vertical: sign(targetProjection.ndcY - subjectProjection.ndcY),
  };
};

const screenMotionDirection = (
  shot: NormalizedShot,
  subject: IAutoMovieGrammarSubjectObservation,
): -1 | 0 | 1 => {
  const halfY = Math.tan((shot.camera.fovY * Math.PI) / 360);
  const start = projectToNdc(
    shot.camera,
    subject.start,
    halfY,
    shot.camera.aspect,
  );
  const end = projectToNdc(shot.camera, subject.end, halfY, shot.camera.aspect);
  if (start.depth <= EPSILON || end.depth <= EPSILON) return 0;
  return sign(end.ndcX - start.ndcX);
};

const cameraBearingAngleDegrees = (
  subject: IAutoMovieVector3,
  previousCamera: IAutoMovieVector3,
  incomingCamera: IAutoMovieVector3,
): number => {
  const previous = Vector3.subtract(previousCamera, subject);
  const incoming = Vector3.subtract(incomingCamera, subject);
  const previousXZ = { x: previous.x, y: 0, z: previous.z };
  const incomingXZ = { x: incoming.x, y: 0, z: incoming.z };
  const lengths = Vector3.length(previousXZ) * Vector3.length(incomingXZ);
  if (lengths <= EPSILON) return 180;
  const cosine = Math.max(
    -1,
    Math.min(1, Vector3.dot(previousXZ, incomingXZ) / lengths),
  );
  return (Math.acos(cosine) * 180) / Math.PI;
};

const byId = (
  subjects: readonly IAutoMovieGrammarSubjectObservation[],
): ReadonlyMap<string, IAutoMovieGrammarSubjectObservation> =>
  new Map(subjects.map((subject) => [subject.id, subject]));

const sign = (value: number): -1 | 0 | 1 =>
  Math.abs(value) <= EPSILON ? 0 : value > 0 ? 1 : -1;

const screenRelation = (direction: {
  horizontal: -1 | 0 | 1;
  vertical: -1 | 0 | 1;
}): string =>
  [
    direction.horizontal === 0
      ? "screen-center"
      : `screen-${direction.horizontal > 0 ? "right" : "left"}`,
    direction.vertical === 0
      ? "level"
      : direction.vertical > 0
        ? "above"
        : "below",
  ].join("/");

const positive = (value: number, path: string): void => {
  if (Number.isFinite(value) === false || value <= 0)
    throw new Error(`${path} must be finite and positive.`);
};

const nonBlank = (value: string, path: string): void => {
  if (value.trim().length === 0) throw new Error(`${path} must be non-blank.`);
};

const finiteVector = (value: IAutoMovieVector3, path: string): void => {
  for (const [key, component] of Object.entries(value))
    if (Number.isFinite(component) === false)
      throw new Error(`${path}.${key} must be finite.`);
};

const round = (value: number): number => Math.round(value * 1_000) / 1_000;
