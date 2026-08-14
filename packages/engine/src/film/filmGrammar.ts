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

/**
 * Machine-readable film-grammar diagnostic families.
 *
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-finding AutoMovieGrammarDiagnosticCode supports deterministic continuity findings: Machine-readable film-grammar diagnostic families.
 * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-findings Names line crosses, eyeline breaks, screen-direction flips, and related edit observations with stable machine-readable diagnostic codes.
 * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar AutoMovieGrammarDiagnosticCode realizes deterministic continuity-grammar analysis: Machine-readable film-grammar diagnostic families.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-grammar-sampling-findings Provides stable finding identities for measured camera-grammar failures instead of reducing them to untyped prose.
 */
export type AutoMovieGrammarDiagnosticCode =
  | "grammar-axis-crossed"
  | "grammar-jump-cut"
  | "grammar-eyeline"
  | "grammar-screen-direction"
  | "grammar-shot-size"
  | "grammar-reestablish"
  | "grammar-pacing";

/**
 * One subject's deterministic measurements over a shot.
 *
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarSubjectObservation supplies deterministic spatial-grammar analysis: One subject's deterministic measurements over a shot.
 * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarSubjectObservation realizes deterministic continuity-grammar analysis: One subject's deterministic measurements over a shot.
 */
export interface IAutoMovieGrammarSubjectObservation {
  /**
   * Stable scene-node or formation id.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarSubjectObservation.id supplies deterministic spatial-grammar analysis: Stable scene-node or formation id.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarSubjectObservation.id realizes deterministic continuity-grammar analysis: Stable scene-node or formation id.
   */
  id: string;
  /**
   * World root at the opening frame.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarSubjectObservation.start supplies deterministic spatial-grammar analysis: World root at the opening frame.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarSubjectObservation.start realizes deterministic continuity-grammar analysis: World root at the opening frame.
   */
  start: IAutoMovieVector3;
  /**
   * World root at the closing frame.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarSubjectObservation.end supplies deterministic spatial-grammar analysis: World root at the closing frame.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarSubjectObservation.end realizes deterministic continuity-grammar analysis: World root at the closing frame.
   */
  end: IAutoMovieVector3;
  /**
   * Positive world-space subject height in metres.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarSubjectObservation.height supplies deterministic spatial-grammar analysis: Positive world-space subject height in metres.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarSubjectObservation.height realizes deterministic continuity-grammar analysis: Positive world-space subject height in metres.
   */
  height: number;
  /**
   * Half the subject's horizontal diagonal in metres, or 0 when nothing
   * horizontal could be measured.
   *
   * The same number {@link IAutoMovieFramedBox.radius} states, and read here for
   * the same reason the framing solve reads it: a subject wider than the frame
   * can hold at its declared height is placed by its width, so a shot size
   * measured from the height alone reports a framing no camera delivered. A
   * figure is taller than it is wide at every shot size and its radius decides
   * nothing; a 60 m facade is the opposite.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarSubjectObservation.radius supplies deterministic spatial-grammar analysis: Half the subject's horizontal diagonal in metres, so a width-placed camera is read at the size it delivers.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarSubjectObservation.radius realizes deterministic continuity-grammar analysis: Half the subject's horizontal diagonal in metres, or 0 when nothing horizontal could be measured, read for the same reason the framing solve reads it: a subject wider than the frame can hold at its declared height is placed by its width, so a shot size measured from the height alone reports a framing no camera delivered.
   */
  radius: number;
  /**
   * Resolved gaze target over the shot, or null when it is not observed.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarSubjectObservation.eyeline supplies deterministic spatial-grammar analysis: Resolved gaze target over the shot, or null when it is not observed.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarSubjectObservation.eyeline realizes deterministic continuity-grammar analysis: Resolved gaze target over the shot, or null when it is not observed.
   */
  eyeline: {
    /** Stable semantic target id, even when that target is outside the frame. */
    target: string;
    /** World gaze target at the opening frame. */
    start: IAutoMovieVector3;
    /** World gaze target at the closing frame. */
    end: IAutoMovieVector3;
  } | null;
}

/**
 * One perspective camera sample at a shot boundary.
 *
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarCameraObservation supplies deterministic spatial-grammar analysis: One perspective camera sample at a shot boundary.
 * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarCameraObservation realizes deterministic continuity-grammar analysis: One perspective camera sample at a shot boundary.
 */
export interface IAutoMovieGrammarCameraObservation extends IAutoMovieResolvedCamera {
  /**
   * Vertical field of view in degrees.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarCameraObservation.fovY supplies deterministic spatial-grammar analysis: Vertical field of view in degrees.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarCameraObservation.fovY realizes deterministic continuity-grammar analysis: Vertical field of view in degrees.
   */
  fovY: number;
  /**
   * Render width divided by height.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarCameraObservation.aspect supplies deterministic spatial-grammar analysis: Render width divided by height.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarCameraObservation.aspect realizes deterministic continuity-grammar analysis: Render width divided by height.
   */
  aspect: number;
}

/**
 * The geometric and editorial facts required to inspect one ordered shot.
 *
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarShotObservation supplies deterministic spatial-grammar analysis: The geometric and editorial facts required to inspect one ordered shot.
 * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-time-sampling Carries opening and closing camera, subject, gaze-target, and travel positions so a cut can compare the outgoing close with the incoming open.
 * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarShotObservation realizes deterministic continuity-grammar analysis: The geometric and editorial facts required to inspect one ordered shot.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-grammar-sampling-findings Supplies the two observable shot-boundary samples consumed by grammar analysis rather than a start transform or average heading.
 */
export interface IAutoMovieGrammarShotObservation {
  /**
   * Stable shot id.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarShotObservation.id supplies deterministic spatial-grammar analysis: Stable shot id.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarShotObservation.id realizes deterministic continuity-grammar analysis: Stable shot id.
   */
  id: string;
  /**
   * Positive edited duration in seconds.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarShotObservation.duration supplies deterministic spatial-grammar analysis: Positive edited duration in seconds.
   * @evidence requirements/editorial/pacing-and-rhythm.md#editorial-duration-pattern Supplies the positive edited shot duration used to form the ordered duration series; it does not claim event density or audiovisual rhythm.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarShotObservation.duration realizes deterministic continuity-grammar analysis: Positive edited duration in seconds.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-pacing-rhythm Provides the per-shot input for the analyzer's duration-only pacing observation without classifying the creative result.
   */
  duration: number;
  /**
   * Resolved camera at both edited shot boundaries.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarShotObservation.camera supplies deterministic spatial-grammar analysis: Resolved camera at both edited shot boundaries.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarShotObservation.camera realizes deterministic continuity-grammar analysis: Resolved camera at both edited shot boundaries.
   */
  camera: {
    /** Opening-frame camera. */
    start: IAutoMovieGrammarCameraObservation;
    /** Closing-frame camera. */
    end: IAutoMovieGrammarCameraObservation;
  };
  /**
   * Subjects observed in this shot; input order has no meaning.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarShotObservation.subjects supplies deterministic spatial-grammar analysis: Subjects observed in this shot; input order has no meaning.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarShotObservation.subjects realizes deterministic continuity-grammar analysis: Subjects observed in this shot; input order has no meaning.
   */
  subjects: IAutoMovieGrammarSubjectObservation[];
  /**
   * Principal subject used for cut and framing checks.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarShotObservation.primarySubject supplies deterministic spatial-grammar analysis: Principal subject used for cut and framing checks.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarShotObservation.primarySubject realizes deterministic continuity-grammar analysis: Principal subject used for cut and framing checks.
   */
  primarySubject: string | null;
  /**
   * Authored framing claim, or null when none was declared.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarShotObservation.declaredShotSize supplies deterministic spatial-grammar analysis: Authored framing claim, or null when none was declared.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarShotObservation.declaredShotSize realizes deterministic continuity-grammar analysis: Authored framing claim, or null when none was declared.
   */
  declaredShotSize: IAutoMovieCameraIntent["framing"] | null;
  /**
   * Two subjects defining the line of action, or null when unavailable.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarShotObservation.actionAxis supplies deterministic spatial-grammar analysis: Two subjects defining the line of action, or null when unavailable.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarShotObservation.actionAxis realizes deterministic continuity-grammar analysis: Two subjects defining the line of action, or null when unavailable.
   */
  actionAxis: readonly [string, string] | null;
  /**
   * Deliberate exceptions copied from the shot contract.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarShotObservation.styleIntent supplies deterministic spatial-grammar analysis: Deliberate exceptions copied from the shot contract.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarShotObservation.styleIntent realizes deterministic continuity-grammar analysis: Deliberate exceptions copied from the shot contract.
   */
  styleIntent?: AutoMovieGrammarStyleIntent[];
}

/**
 * A film-grammar fact, its editorial consequence, and a concrete recovery.
 *
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-finding IAutoMovieGrammarDiagnostic supports deterministic continuity findings: A film-grammar fact, its editorial consequence, and a concrete recovery.
 * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-findings Carries a named finding with its affected cut, measured fact, visual consequence, and corrective option.
 * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarDiagnostic realizes deterministic continuity-grammar analysis: A film-grammar fact, its editorial consequence, and a concrete recovery.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-grammar-sampling-findings Preserves the operands and editorial ownership of a measured grammar failure as a reviewable record.
 */
export interface IAutoMovieGrammarDiagnostic {
  /**
   * Stable diagnostic family.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-finding IAutoMovieGrammarDiagnostic.code supports deterministic continuity findings: Stable diagnostic family.
   * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-findings Identifies the measured grammar failure with a stable named family.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarDiagnostic.code realizes deterministic continuity-grammar analysis: Stable diagnostic family.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-grammar-sampling-findings Keeps finding classification machine-readable across repeated analysis and review adaptation.
   */
  code: AutoMovieGrammarDiagnosticCode;
  /**
   * Objective failures are errors; heuristics warn; statistics advise.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-finding IAutoMovieGrammarDiagnostic.severity supports deterministic continuity findings: Objective failures are errors; heuristics warn; statistics advise.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarDiagnostic.severity realizes deterministic continuity-grammar analysis: Objective failures are errors; heuristics warn; statistics advise.
   */
  severity: "error" | "warning" | "advisory";
  /**
   * Incoming or sole shot where the diagnostic is filed.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-finding IAutoMovieGrammarDiagnostic.shot supports deterministic continuity findings: Incoming or sole shot where the diagnostic is filed.
   * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-findings Names the incoming or sole shot affected by the measured grammar failure.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarDiagnostic.shot realizes deterministic continuity-grammar analysis: Incoming or sole shot where the diagnostic is filed.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-grammar-sampling-findings Locates the finding on the edited shot where its consequence becomes observable.
   */
  shot: string;
  /**
   * Preceding edited shot for a cut diagnostic.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-finding IAutoMovieGrammarDiagnostic.previousShot supports deterministic continuity findings: Preceding edited shot for a cut diagnostic.
   * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-findings Retains the outgoing shot identity when the finding belongs to a measured cut.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarDiagnostic.previousShot realizes deterministic continuity-grammar analysis: Preceding edited shot for a cut diagnostic.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-grammar-sampling-findings Pairs the outgoing and incoming edit operands without inventing a cut for single-shot findings.
   */
  previousShot: string | null;
  /**
   * Measured fact.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-finding IAutoMovieGrammarDiagnostic.fact supports deterministic continuity findings: Measured fact.
   * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-findings Reports the observed sides, projected relations, directions, angles, sizes, or distances that triggered the named finding.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarDiagnostic.fact realizes deterministic continuity-grammar analysis: Measured fact.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-grammar-sampling-findings Carries the compared operands and observed value in the finding instead of only a verdict.
   */
  fact: string;
  /**
   * Why that fact can damage the visual read.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-finding IAutoMovieGrammarDiagnostic.impact supports deterministic continuity findings: Why that fact can damage the visual read.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarDiagnostic.impact realizes deterministic continuity-grammar analysis: Why that fact can damage the visual read.
   */
  impact: string;
  /**
   * Concrete corrective option.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-finding IAutoMovieGrammarDiagnostic.recovery supports deterministic continuity findings: Concrete corrective option.
   * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-findings Gives an explicit camera, cutaway, establishing-shot, or declared-deviation response for the measured failure.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarDiagnostic.recovery realizes deterministic continuity-grammar analysis: Concrete corrective option.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-grammar-sampling-findings Makes each finding actionable without silently suppressing the observed relation.
   */
  recovery: string;
}

/**
 * Exact one-to-one suppression table for deliberate grammar exceptions.
 *
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-grammar-violation GRAMMAR_STYLE_SUPPRESSION makes grammar violations actionable: Exact one-to-one suppression table for deliberate grammar exceptions.
 * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar GRAMMAR_STYLE_SUPPRESSION realizes deterministic continuity-grammar analysis: Exact one-to-one suppression table for deliberate grammar exceptions.
 */
export const GRAMMAR_STYLE_SUPPRESSION: Readonly<
  Record<AutoMovieGrammarStyleIntent, AutoMovieGrammarDiagnosticCode>
> = {
  "axis-cross": "grammar-axis-crossed",
  "jump-cut": "grammar-jump-cut",
  "eyeline-break": "grammar-eyeline",
  "tight-reestablish": "grammar-reestablish",
  "rhythmic-pacing": "grammar-pacing",
};

/**
 * One deliberate exception, and the shot whose contract declared it.
 *
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-grammar-violation IAutoMovieGrammarStyleClaim makes grammar violations actionable: One deliberate exception, and the shot whose contract declared it.
 * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarStyleClaim realizes deterministic continuity-grammar analysis: One deliberate exception, and the shot whose contract declared it.
 */
export interface IAutoMovieGrammarStyleClaim {
  /**
   * Shot that declared the exception.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-grammar-violation IAutoMovieGrammarStyleClaim.shot makes grammar violations actionable: Shot that declared the exception.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarStyleClaim.shot realizes deterministic continuity-grammar analysis: Shot that declared the exception.
   */
  shot: string;
  /**
   * Declared deliberate break.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-grammar-violation IAutoMovieGrammarStyleClaim.intent makes grammar violations actionable: Declared deliberate break.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarStyleClaim.intent realizes deterministic continuity-grammar analysis: Declared deliberate break.
   */
  intent: AutoMovieGrammarStyleIntent;
}

/**
 * Everything one mechanical pass over an edited sequence establishes.
 *
 * The findings alone cannot answer the author's second question. A declaration
 * that suppresses a finding and a declaration that suppresses nothing look
 * identical from outside — both leave the diagnostic list silent — so a shot
 * declaring an exception nobody ever broke reads as a registered intent when it
 * is in fact a claim about a film that is not there. Which declarations went
 * unexercised is therefore part of the same read, computed by the one pass that
 * already decides it, rather than by a second implementation of the suppression
 * table downstream.
 *
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarReading retains the ordered findings and exception matches established by one deterministic grammar pass.
 * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarReading realizes deterministic continuity-grammar analysis: Everything one mechanical pass over an edited sequence establishes. The findings alone cannot answer the author's second question. A declaration that suppresses a finding and a declaration that suppresses nothing look identical from outside — both leave the diagnostic list silent — so a shot declaring an exception nobody ever broke reads as a registered intent when it is in fact a claim about a film that is not there. Which declarations went unexercised is therefore part of the same read, computed by the one pass that already decides it, rather than by a second implementation of the suppression table downstream.
 */
export interface IAutoMovieGrammarReading {
  /**
   * Findings no declared exception excepted, in analyzer order.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarReading.reported supplies deterministic spatial-grammar analysis: Findings no declared exception excepted, in analyzer order.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarReading.reported realizes deterministic continuity-grammar analysis: Findings no declared exception excepted, in analyzer order.
   */
  reported: IAutoMovieGrammarDiagnostic[];
  /**
   * Declarations that found nothing to except, in shot order.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarReading.unmatched supplies deterministic spatial-grammar analysis: Declarations that found nothing to except, in shot order.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarReading.unmatched realizes deterministic continuity-grammar analysis: Declarations that found nothing to except, in shot order.
   */
  unmatched: IAutoMovieGrammarStyleClaim[];
}

/**
 * One edited sequence and the thresholds its mechanical read uses.
 *
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarInput supplies deterministic spatial-grammar analysis: One edited sequence and the thresholds its mechanical read uses.
 * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarInput realizes deterministic continuity-grammar analysis: One edited sequence and the thresholds its mechanical read uses.
 */
export interface IAutoMovieGrammarInput {
  /**
   * Shots in edited playback order.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarInput.shots supplies deterministic spatial-grammar analysis: Shots in edited playback order.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarInput.shots realizes deterministic continuity-grammar analysis: Shots in edited playback order.
   */
  shots: readonly IAutoMovieGrammarShotObservation[];
  /**
   * Smallest camera-bearing change that avoids a same-size jump cut.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarInput.minimumCutAngleDegrees supplies deterministic spatial-grammar analysis: Smallest camera-bearing change that avoids a same-size jump cut.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarInput.minimumCutAngleDegrees realizes deterministic continuity-grammar analysis: Smallest camera-bearing change that avoids a same-size jump cut.
   */
  minimumCutAngleDegrees?: number;
  /**
   * Subject displacement that requires a wide re-establishing view.
   *
   * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar IAutoMovieGrammarInput.reestablishDistance supplies deterministic spatial-grammar analysis: Subject displacement that requires a wide re-establishing view.
   * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar IAutoMovieGrammarInput.reestablishDistance realizes deterministic continuity-grammar analysis: Subject displacement that requires a wide re-establishing view.
   */
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
 *
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar analyzeFilmGrammar compares measured framing, axis, displacement, and cut facts across the ordered edit to emit reproducible diagnoses.
 * @evidence requirements/staging/coverage-and-alternative-takes.md#staging-coverage-gap Reports screen-direction and edit-compatibility conflicts as explicit findings instead of treating the available shots as usable coverage.
 * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-180-line Compares matching action-axis identities at the outgoing close and incoming open, reporting a camera half-plane reversal only when neither shot shows the crossing.
 * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-eyeline-match Projects the outgoing gaze relation and the incoming reciprocal or continuing gaze relation at the cut, then reports a horizontal or vertical screen-relation mismatch.
 * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-entry-exit-direction Reports a travel reversal only when the same primary subject has nonzero projected horizontal motion of opposite signs in adjacent shots.
 * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-time-sampling Evaluates the previous shot's closing sample against the incoming shot's opening sample instead of substituting shot starts or average headings.
 * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-findings Returns stable named findings with the affected cut, measured fact, visual consequence, and concrete recovery.
 * @evidence requirements/editorial/pacing-and-rhythm.md#editorial-duration-pattern Reports the ordered edited shot durations and their arithmetic mean as the measurable duration-pattern subset of pacing analysis.
 * @evidence requirements/editorial/pacing-and-rhythm.md#editorial-pacing-claim-boundary Keeps that duration series advisory and directs creative cadence judgment back to authored intent instead of declaring the sequence objectively fast, slow, effective, or entertaining.
 * @evidence requirements/editorial/validation.md#editorial-sequence-review Reviews the ordered shot observations for deterministic duration, framing, axis, eyeline, travel, and displacement findings without changing the authored cut.
 * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar analyzeFilmGrammar realizes deterministic continuity-grammar analysis: Diagnose an ordered edit from deterministic shot observations. The findings half of {@link readFilmGrammar}, kept as the plain call for a consumer that only files what survived.
 * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-pacing-rhythm Emits only the measured duration series, average, and an advisory recovery for this duration-only subset; it makes no structural, audiovisual, delivery, or creative-quality verdict.
 * @evidence specifications/editorial-render-and-delivery/editorial-version-conform-and-validation.md#spec-editorial-validation-recovery Returns the measurable grammar findings and their concrete recoveries for this ordered-shot review subset; it does not claim full conform, approval, or delivery status.
 * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-take-continuity-edit-compatibility Checks the ordered edit's measured axis, screen direction, framing, and displacement facts for deterministic cut-compatibility failures.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-line-eyeline-travel-evaluation Computes action-axis half-planes, projected gaze relations, and subject travel signs from the declared scene-local operands at each cut boundary.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-grammar-sampling-findings Converts exact outgoing-close and incoming-open observations into named findings rather than inferring dynamic relations from edit order.
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
 *
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar readFilmGrammar matches declared style exceptions to their exact diagnoses while leaving unmatched findings visible.
 * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar readFilmGrammar realizes deterministic continuity-grammar analysis: Read an ordered edit, and report which declared exceptions it exercised. Shot order is editorial meaning and remains untouched. Subject collections and action-axis endpoints are normalized by id, so collection order and random generation order cannot alter the result. The analyzer has no seed, clock, scene mutation, or renderer dependency.
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

/**
 * Adapt grammar diagnostics into the existing visual-review backlog socket.
 *
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-finding grammarDiagnosticsToReviewNotes supports deterministic continuity findings: Adapt grammar diagnostics into the existing visual-review backlog socket.
 * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar grammarDiagnosticsToReviewNotes realizes deterministic continuity-grammar analysis: Adapt grammar diagnostics into the existing visual-review backlog socket.
 */
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

/**
 * Classify a subject's measured fraction of the frame.
 *
 * The fraction is of the frame's own height for a subject the frame holds
 * vertically, and of its width for one whose width is what placed the camera:
 * {@link FRAMING_HEIGHT_FRACTION} is applied to both axes by the framing solve,
 * so the axis that fills the most of its own side is the one that states the
 * size delivered.
 *
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar classifyGrammarShotSize supplies deterministic spatial-grammar analysis: Classify a subject's measured fraction of the frame, of its height or of its width, whichever the subject fills more.
 * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar classifyGrammarShotSize realizes deterministic continuity-grammar analysis: Classify a subject's measured fraction of the frame. The fraction is of the frame's own height for a subject the frame holds vertically, and of its width for one whose width is what placed the camera: the framing fractions are applied to both axes by the framing solve, so the axis that fills the most of its own side is the one that states the size delivered.
 */
export const classifyGrammarShotSize = (
  frameOccupancy: number,
): IAutoMovieCameraIntent["framing"] => {
  positive(frameOccupancy, "frameOccupancy");
  const visibleHeightMultiple = 1 / frameOccupancy;
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
    nonNegative(subject.radius, `${input.id}.${subject.id}.radius`);
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
  // Both axes, because the solve places the camera at whichever distance holds
  // the subject on the axis that binds: `compileCameraMove` takes the greater
  // of the height-derived and width-derived distances, so at the distance it
  // chose, the subject fills the declared fraction of exactly one axis and less
  // of the other. Reading the vertical fill alone therefore reports a wide
  // subject one or two sizes looser than the camera actually delivered, and
  // asks the author to move in until the ends of the mass leave the frame.
  const vertical = Math.abs(top.ndcY - base.ndcY) / 2;
  const horizontal = subject.radius / (base.depth * halfY * camera.aspect);
  const occupancy = Math.max(vertical, horizontal);
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

const nonNegative = (value: number, path: string): void => {
  if (Number.isFinite(value) === false || value < 0)
    throw new Error(`${path} must be finite and non-negative.`);
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
