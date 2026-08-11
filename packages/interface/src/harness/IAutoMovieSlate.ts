import { IAutoMovieSequence } from "../cinematics/IAutoMovieSequence";
import { IAutoMovieShot } from "../cinematics/IAutoMovieShot";
import { IAutoMovieScene } from "../scene/IAutoMovieScene";
import { IAutoMovieBeatEndState } from "./IAutoMovieBeatEndState";
import { IAutoMovieScriptNode } from "./IAutoMovieScriptNode";

/**
 * One planned shot, described in words before it is blocked and performed.
 *
 * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `IAutoMovieBeat` as the portable data boundary for the story beat observation plan requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `IAutoMovieBeat` for the narrative intent beat observation boundary system contract.
 */
export interface IAutoMovieBeat {
  /**
   * Stable id, referenced by the shot built from it.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `id` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `id` for the narrative intent beat observation boundary system contract.
   */
  id: string;

  /**
   * Short title ("the charge", "the rear").
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `name` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `name` for the narrative intent beat observation boundary system contract.
   */
  name: string;

  /**
   * What happens in this beat, in prose: the brief the blocking stage works to.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `summary` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `summary` for the narrative intent beat observation boundary system contract.
   */
  summary: string;

  /**
   * Rough length (seconds) the script imagines; blocking may refine it.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `durationHint` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `durationHint` for the narrative intent beat observation boundary system contract.
   */
  durationHint: number;
}

/**
 * A character the film needs, mapped to the scene node that will play it.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc Exposes `IAutoMovieCastMember` as the portable data boundary for the story scene local arc requirement.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `IAutoMovieCastMember` for the narrative intent scene prose index system contract.
 */
export interface IAutoMovieCastMember {
  /**
   * Id of the scene node (set in staging) that embodies this character.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc Exposes `node` as the portable data boundary for the story scene local arc requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `node` for the narrative intent scene prose index system contract.
   */
  node: string;

  /**
   * Who they are, read by the model when blocking their action.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc Exposes `character` as the portable data boundary for the story scene local arc requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `character` for the narrative intent scene prose index system contract.
   */
  character: string;

  /**
   * Optional reference to an existing/importable model (a VRM, a built rig), or
   * null to use a generated stand-in.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc Exposes `modelRef` as the portable data boundary for the story scene local arc requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `modelRef` for the narrative intent scene prose index system contract.
   */
  modelRef: string | null;
}

/**
 * The script: the macro plan the rest of the production works from.
 *
 * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `IAutoMovieScript` as the portable data boundary for the story beat observation plan requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `IAutoMovieScript` for the narrative intent beat observation boundary system contract.
 */
export interface IAutoMovieScript {
  /**
   * One-sentence summary of the film.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `logline` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `logline` for the narrative intent beat observation boundary system contract.
   */
  logline: string;

  /**
   * The intent / mood the shots should serve.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `theme` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `theme` for the narrative intent beat observation boundary system contract.
   */
  theme: string;

  /**
   * Everyone who appears.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `cast` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `cast` for the narrative intent beat observation boundary system contract.
   */
  cast: IAutoMovieCastMember[];

  /**
   * The ordered beats (each becomes a shot).
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `beats` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `beats` for the narrative intent beat observation boundary system contract.
   */
  beats: IAutoMovieBeat[];

  /**
   * The screenplay refinement tree ({@link IAutoMovieScriptNode}, D013): intent
   * → acts/scenes/groups → beat nodes carrying stage direction, dialogue, and
   * shot captions. Evolving-schema optional: absent means the flat `beats` list
   * is the whole authored structure (fully backward-compatible); when present,
   * beat-kind nodes join `beats` 1:1 and the tree validates on commit.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `tree` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `tree` for the narrative intent beat observation boundary system contract.
   */
  tree?: IAutoMovieScriptNode[] | null;
}

/**
 * A reviewer's note on a built shot: the feedback that drives a
 * re-block/re-perform.
 *
 * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `IAutoMovieReviewNote` as the portable data boundary for the story time state review scope requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `IAutoMovieReviewNote` for the narrative intent temporal state handoff system contract.
 */
export interface IAutoMovieReviewNote {
  /**
   * Which beat/shot the note is about.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `beat` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `beat` for the narrative intent temporal state handoff system contract.
   */
  beat: string;

  /**
   * Which tier raised it.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `tier` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `tier` for the narrative intent temporal state handoff system contract.
   */
  tier: "structural" | "physical" | "visual";

  /**
   * What is wrong, located as concretely as possible ("left foot skates at
   * t=1.2s").
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `issue` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `issue` for the narrative intent temporal state handoff system contract.
   */
  issue: string;

  /**
   * A suggested fix the next pass should apply.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `suggestion` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `suggestion` for the narrative intent temporal state handoff system contract.
   */
  suggestion: string;
}

/**
 * The **slate**: the clapperboard that heads every take and carries the
 * production's running context between stages. Each harness stage reads the
 * slate's upstream slices and writes its own, exactly as AutoBe threads state
 * between analyze → database → interface → realize → test. State lives here;
 * the model just calls functions.
 *
 * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `IAutoMovieSlate` as the portable data boundary for the story time state review scope requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `IAutoMovieSlate` for the narrative intent temporal state handoff system contract.
 * @author Samchon
 */
export interface IAutoMovieSlate {
  /**
   * The user's original request (+ any references), verbatim.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `brief` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `brief` for the narrative intent temporal state handoff system contract.
   */
  brief: string;

  /**
   * The macro plan, once the SCRIPT stage has run (else null).
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `script` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `script` for the narrative intent temporal state handoff system contract.
   */
  script: IAutoMovieScript | null;

  /**
   * The staged world: placed models, cameras, lights (once STAGING has run).
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `scene` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `scene` for the narrative intent temporal state handoff system contract.
   */
  scene: IAutoMovieScene | null;

  /**
   * Shots built so far, keyed by the beat id they realise.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `shots` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `shots` for the narrative intent temporal state handoff system contract.
   */
  shots: IAutoMovieShot[];

  /**
   * Resolved end-state snapshots for built beats, keyed by beat id.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `beatEnds` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `beatEnds` for the narrative intent temporal state handoff system contract.
   */
  beatEnds: IAutoMovieBeatEndState[];

  /**
   * Open review notes still to be addressed (the correction backlog).
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `notes` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `notes` for the narrative intent temporal state handoff system contract.
   */
  notes: IAutoMovieReviewNote[];

  /**
   * The assembled film, once every beat has passed review (else null).
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `film` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `film` for the narrative intent temporal state handoff system contract.
   */
  film: IAutoMovieSequence | null;
}
