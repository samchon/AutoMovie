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
  /** Resolved gaze target over the shot, or null when it is not observed. */
  eyeline: {
    /** Stable semantic target id, even when that target is outside the frame. */
    target: string;
    /** World gaze target at the opening frame. */
    start: IAutoMovieVector3;
    /** World gaze target at the closing frame. */
    end: IAutoMovieVector3;
  } | null;
}

/** One perspective camera sample at a shot boundary. */
export interface IAutoMovieGrammarCameraObservation extends IAutoMovieResolvedCamera {
  /** Vertical field of view in degrees. */
  fovY: number;
  /** Render width divided by height. */
  aspect: number;
}

/** The geometric and editorial facts required to inspect one ordered shot. */
export interface IAutoMovieGrammarShotObservation {
  /** Stable shot id. */
  id: string;
  /** Positive edited duration in seconds. */
  duration: number;
  /** Resolved camera at both edited shot boundaries. */
  camera: {
    /** Opening-frame camera. */
    start: IAutoMovieGrammarCameraObservation;
    /** Closing-frame camera. */
    end: IAutoMovieGrammarCameraObservation;
  };
  /** Subjects observed in this shot; input order has no meaning. */
  subjects: IAutoMovieGrammarSubjectObservation[];
  /** Principal subject used for cut and framing checks. */
  primarySubject: string | null;
  /** Authored framing claim, or null when none was declared. */
  declaredShotSize: IAutoMovieCameraIntent["framing"] | null;
  /** Two subjects defining the line of action, or null when unavailable. */
  actionAxis: readonly [string, string] | null;
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
  "axis-cross": "grammar-axis-crossed",
  "jump-cut": "grammar-jump-cut",
  "eyeline-break": "grammar-eyeline",
  "tight-reestablish": "grammar-reestablish",
  "rhythmic-pacing": "grammar-pacing",
};

/** One deliberate exception, and the shot whose contract declared it. */
export interface IAutoMovieGrammarStyleClaim {
  /** Shot that declared the exception. */
  shot: string;
  /** Declared deliberate break. */
  intent: AutoMovieGrammarStyleIntent;
}

/**
 * Everything one mechanical pass over an edited sequence establishes.
 *
 * The findings alone cannot answer the author's second question. A declaration
 * that suppresses a finding and a declaration that suppresses nothing look
 * identical from outside — both leave the diagnostic list silent — so a shot
 * declaring an exception nobody ever broke reads as a registered intent when it
 * is in fact a claim about a film that is not there. Reporting which
 * declarations were exercised is therefore part of the same read, computed by
 * the one pass that already decides it, rather than by a second implementation
 * of the suppression table downstream.
 */
export interface IAutoMovieGrammarReading {
  /** Findings no declared exception excepted, in analyzer order. */
  reported: IAutoMovieGrammarDiagnostic[];
  /** Declarations that excepted at least one finding, in shot order. */
  matched: IAutoMovieGrammarStyleClaim[];
  /** Declarations that found nothing to except, in shot order. */
  unmatched: IAutoMovieGrammarStyleClaim[];
}

/** One edited sequence and the thresholds its mechanical read uses. */
export interface IAutoMovieGrammarInput {
  /** Shots in edited playback order. */
  shots: readonly IAutoMovieGrammarShotObservation[];
  /** Smallest camera-bearing change that avoids a same-size jump cut. */
  minimumCutAngleDegrees?: number;
  /** Subject displacement that requires a wide re-establishing view. */
  reestablishDistance?: number;
}

const DEFAULT_MINIMUM_CUT_ANGLE_DEGREES = 30;
const DEFAULT_REESTABLISH_DISTANCE = 10;
const EPSILON = 1e-6;

/**
 * Diagnose an ordered edit from deterministic shot observations.
 *
 * The findings half of {@link readFilmGrammar}, kept as the plain call for a
 * consumer that only files what survived.
 */
export const analyzeFilmGrammar = (
  props: IAutoMovieGrammarInput,
): IAutoMovieGrammarDiagnostic[] => readFilmGrammar(props).reported;

/**
 * Read an ordered edit, and report which declared exceptions it exercised.
 *
 * Shot order is editorial meaning and remains untouched. Subject collections
 * and action-axis endpoints are normalized by id, so collection order and
 * random generation order cannot alter the result. The analyzer has no seed,
 * clock, scene mutation, or renderer dependency.
 */
export const readFilmGrammar = (
  props: IAutoMovieGrammarInput,
): IAutoMovieGrammarReading => {
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
  // Which declaration excepted which finding is decided exactly once, here,
  // while the decision is being made. Recomputing it downstream from the same
  // table is how a suppression and a report of that suppression come to
  // disagree about the same edit.
  const exercised = new Set<string>();
  const reported = diagnostics.filter((diagnostic) => {
    if (diagnostic.code === "grammar-pacing") {
      // Pacing is the one film-wide finding, so any participating shot's
      // marker excepts it and every such marker is exercised by it.
      const marked = shots.filter((shot) =>
        shot.styleIntent.includes("rhythmic-pacing"),
      );
      for (const shot of marked)
        exercised.add(claimKey(shot.id, "rhythmic-pacing"));
      return marked.length === 0;
    }
    const shot = shots.find((candidate) => candidate.id === diagnostic.shot)!;
    const intent = shot.styleIntent.find(
      (candidate) => GRAMMAR_STYLE_SUPPRESSION[candidate] === diagnostic.code,
    );
    if (intent === undefined) return true;
    exercised.add(claimKey(shot.id, intent));
    return false;
  });
  const claims: IAutoMovieGrammarStyleClaim[] = shots.flatMap((shot) =>
    shot.styleIntent.map((intent) => ({ shot: shot.id, intent })),
  );
  return {
    reported,
    matched: claims.filter((claim) =>
      exercised.has(claimKey(claim.shot, claim.intent)),
    ),
    unmatched: claims.filter(
      (claim) => exercised.has(claimKey(claim.shot, claim.intent)) === false,
    ),
  };
};

/**
 * Shot and intent as one lookup key.
 *
 * Separated by a character no declared intent carries, so two distinct claims
 * cannot collide however a shot happens to be named.
 */
const claimKey = (shot: string, intent: AutoMovieGrammarStyleIntent): string =>
  `${shot}|${intent}`;

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
  for (const boundary of ["start", "end"] as const) {
    const camera = input.camera[boundary];
    positive(camera.fovY, `${input.id}.camera.${boundary}.fovY`);
    if (camera.fovY >= 180)
      throw new Error(`${input.id}.camera.${boundary}.fovY must be below 180.`);
    positive(camera.aspect, `${input.id}.camera.${boundary}.aspect`);
    finiteVector(camera.position, `${input.id}.camera.${boundary}.position`);
    for (const [key, value] of Object.entries(camera.rotation))
      if (Number.isFinite(value) === false)
        throw new Error(
          `${input.id}.camera.${boundary}.rotation.${key} must be finite.`,
        );
  }

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
    if (subject.eyeline !== null) {
      nonBlank(
        subject.eyeline.target,
        `${input.id}.${subject.id}.eyeline.target`,
      );
      finiteVector(
        subject.eyeline.start,
        `${input.id}.${subject.id}.eyeline.start`,
      );
      finiteVector(
        subject.eyeline.end,
        `${input.id}.${subject.id}.eyeline.end`,
      );
    }
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
  const start = measuredShotSize(shot, "start");
  const end = measuredShotSize(shot, "end");
  const measured = [start, end].filter(
    (value): value is IAutoMovieCameraIntent["framing"] => value !== null,
  );
  if (
    measured.length === 0 ||
    measured.every((value) => value === shot.declaredShotSize)
  )
    return;
  diagnostics.push({
    code: "grammar-shot-size",
    severity: "warning",
    shot: shot.id,
    previousShot: null,
    fact: `shot "${shot.id}" declares ${shot.declaredShotSize} framing but projects "${shot.primarySubject}" as ${start ?? "unmeasurable"} -> ${end ?? "unmeasurable"}`,
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
  inspectEyeline(
    diagnostics,
    previous,
    incoming,
    previousSubjects,
    incomingSubjects,
  );
  if (
    previous.primarySubject !== null &&
    previous.primarySubject === incoming.primarySubject
  ) {
    const subjectId = previous.primarySubject;
    const outgoing = previousSubjects.get(subjectId)!;
    const arriving = incomingSubjects.get(subjectId)!;
    const previousSize = measuredShotSize(previous, "end");
    const incomingSize = measuredShotSize(incoming, "start");
    const cutAngle = cameraBearingAngleDegrees(
      outgoing.end,
      arriving.start,
      previous.camera.end.position,
      incoming.camera.start.position,
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
    inspectScreenDirection(diagnostics, previous, incoming, outgoing, arriving);
  }
  const incomingSize = measuredShotSize(incoming, "start");
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
    crossesActionAxisOnScreen(previous) ||
    crossesActionAxisOnScreen(incoming)
  )
    return;
  const previousSide = actionAxisSide(previous, "end");
  const incomingSide = actionAxisSide(incoming, "start");
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
  previousSubjects: ReadonlyMap<string, IAutoMovieGrammarSubjectObservation>,
  incomingSubjects: ReadonlyMap<string, IAutoMovieGrammarSubjectObservation>,
): void => {
  if (previous.primarySubject === null || incoming.primarySubject === null)
    return;
  const outgoing = previousSubjects.get(previous.primarySubject)!;
  if (outgoing.eyeline === null) return;
  const targetId = outgoing.eyeline.target;
  const incomingLooker = incomingSubjects.get(incoming.primarySubject);
  if (incomingLooker === undefined || incomingLooker.eyeline === null) return;
  const incomingTargetId = incomingLooker.eyeline.target;
  const reverse =
    incomingLooker.id === targetId && incomingTargetId === outgoing.id;
  const continuation =
    incomingLooker.id === outgoing.id && incomingTargetId === targetId;
  if (reverse === false && continuation === false) return;
  const outgoingSide = relativeScreenDirection(
    previous.camera.end,
    outgoing.end,
    outgoing.eyeline.end,
  );
  const incomingSide = relativeScreenDirection(
    incoming.camera.start,
    incomingLooker.start,
    incomingLooker.eyeline.start,
  );
  const expectedMultiplier = reverse ? -1 : 1;
  const matches = (
    outgoingValue: -1 | 0 | 1,
    incomingValue: -1 | 0 | 1,
  ): boolean =>
    outgoingValue === 0 ||
    incomingValue === 0 ||
    incomingValue === outgoingValue * expectedMultiplier;
  if (
    matches(outgoingSide.horizontal, incomingSide.horizontal) &&
    matches(outgoingSide.vertical, incomingSide.vertical)
  )
    return;
  diagnostics.push({
    code: "grammar-eyeline",
    severity: "warning",
    shot: incoming.id,
    previousShot: previous.id,
    fact: `eyeline "${outgoing.id}" -> "${targetId}" reads ${screenRelation(outgoingSide)}, but incoming "${incomingLooker.id}" -> "${incomingTargetId}" reads ${screenRelation(incomingSide)} instead of the ${reverse ? "opposite" : "same"} screen relation`,
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

const actionAxisSide = (
  shot: NormalizedShot,
  boundary: "start" | "end",
): -1 | 0 | 1 => {
  const subjects = byId(shot.subjects);
  const first = subjects.get(shot.actionAxis![0])!;
  const second = subjects.get(shot.actionAxis![1])!;
  const axis = Vector3.subtract(second[boundary], first[boundary]);
  const camera = Vector3.subtract(
    shot.camera[boundary].position,
    first[boundary],
  );
  return sign(axis.x * camera.z - axis.z * camera.x);
};

const crossesActionAxisOnScreen = (shot: NormalizedShot): boolean => {
  if (shot.actionAxis === null) return false;
  const start = actionAxisSide(shot, "start");
  const end = actionAxisSide(shot, "end");
  return start !== 0 && end !== 0 && start !== end;
};

const measuredShotSize = (
  shot: NormalizedShot,
  boundary: "start" | "end",
): IAutoMovieCameraIntent["framing"] | null => {
  if (shot.primarySubject === null) return null;
  const subject = byId(shot.subjects).get(shot.primarySubject)!;
  const camera = shot.camera[boundary];
  const halfY = Math.tan((camera.fovY * Math.PI) / 360);
  const base = projectToNdc(camera, subject[boundary], halfY, camera.aspect);
  const top = projectToNdc(
    camera,
    {
      ...subject[boundary],
      y: subject[boundary].y + subject.height,
    },
    halfY,
    camera.aspect,
  );
  if (base.depth <= EPSILON || top.depth <= EPSILON) return null;
  const occupancy = Math.abs(top.ndcY - base.ndcY) / 2;
  return occupancy <= EPSILON ? null : classifyGrammarShotSize(occupancy);
};

const relativeScreenDirection = (
  camera: IAutoMovieGrammarCameraObservation,
  subject: IAutoMovieVector3,
  target: IAutoMovieVector3,
): { horizontal: -1 | 0 | 1; vertical: -1 | 0 | 1 } => {
  const halfY = Math.tan((camera.fovY * Math.PI) / 360);
  const subjectProjection = projectToNdc(camera, subject, halfY, camera.aspect);
  const targetProjection = projectToNdc(camera, target, halfY, camera.aspect);
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
  const startHalfY = Math.tan((shot.camera.start.fovY * Math.PI) / 360);
  const endHalfY = Math.tan((shot.camera.end.fovY * Math.PI) / 360);
  const start = projectToNdc(
    shot.camera.start,
    subject.start,
    startHalfY,
    shot.camera.start.aspect,
  );
  const end = projectToNdc(
    shot.camera.end,
    subject.end,
    endHalfY,
    shot.camera.end.aspect,
  );
  if (start.depth <= EPSILON || end.depth <= EPSILON) return 0;
  return sign(end.ndcX - start.ndcX);
};

const cameraBearingAngleDegrees = (
  previousSubject: IAutoMovieVector3,
  incomingSubject: IAutoMovieVector3,
  previousCamera: IAutoMovieVector3,
  incomingCamera: IAutoMovieVector3,
): number => {
  const previous = Vector3.subtract(previousCamera, previousSubject);
  const incoming = Vector3.subtract(incomingCamera, incomingSubject);
  const lengths = Vector3.length(previous) * Vector3.length(incoming);
  if (lengths <= EPSILON) return 180;
  const cosine = Math.max(
    -1,
    Math.min(1, Vector3.dot(previous, incoming) / lengths),
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
