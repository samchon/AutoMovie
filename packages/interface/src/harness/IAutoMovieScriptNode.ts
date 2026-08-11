/**
 * One spoken line inside a beat: who says what, optionally pinned to the beat's
 * local clock. Dialogue text is authoring data. Audio rendering belongs to the
 * diffusion side; the text drives cut rhythm, viseme hints, and the
 * human-readable screenplay export.
 *
 * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-voice-text-separation Exposes `IAutoMovieDialogueLine` as the portable data boundary for the story dialogue voice text separation requirement.
 * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-dialogue-voice-text-boundary Types `IAutoMovieDialogueLine` for the narrative intent dialogue voice text boundary system contract.
 * @author Samchon
 */
export interface IAutoMovieDialogueLine {
  /**
   * Cast character (or scene node) who speaks.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-voice-text-separation Exposes `speaker` as the portable data boundary for the story dialogue voice text separation requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-dialogue-voice-text-boundary Types `speaker` for the narrative intent dialogue voice text boundary system contract.
   */
  speaker: string;

  /**
   * The spoken line, verbatim.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-voice-text-separation Exposes `text` as the portable data boundary for the story dialogue voice text separation requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-dialogue-voice-text-boundary Types `text` for the narrative intent dialogue voice text boundary system contract.
   */
  text: string;

  /**
   * Seconds into the beat this line lands, riding the timing-anchor spirit
   * ({@link IAutoMovieTimingAnchor}), or `null` when the line floats freely
   * inside the beat.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-voice-text-separation Exposes `anchor` as the portable data boundary for the story dialogue voice text separation requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-dialogue-voice-text-boundary Types `anchor` for the narrative intent dialogue voice text boundary system contract.
   */
  anchor: number | null;
}

/**
 * The intent payload, the refinement root's thought: what film this is and what
 * it should feel like. The whole tree below refines this single statement, so
 * it carries only the top-of-funnel decomposition.
 *
 * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-timing-intent Exposes `IAutoMovieIntentPayload` as the portable data boundary for the story dialogue timing intent requirement.
 * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `IAutoMovieIntentPayload` for the narrative intent utterance timing action system contract.
 */
export interface IAutoMovieIntentPayload {
  /**
   * One-sentence summary of the film.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-timing-intent Exposes `logline` as the portable data boundary for the story dialogue timing intent requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `logline` for the narrative intent utterance timing action system contract.
   */
  logline: string;

  /**
   * The mood / thematic intent every refinement below should serve.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-timing-intent Exposes `theme` as the portable data boundary for the story dialogue timing intent requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `theme` for the narrative intent utterance timing action system contract.
   */
  theme: string;
}

/**
 * The act payload: one dramatic movement's purpose, in a sentence or two.
 *
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-distance Exposes `IAutoMovieActPayload` as the portable data boundary for the camera focus distance requirement.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Types `IAutoMovieActPayload` for the clv focus intent appearance boundary system contract.
 */
export interface IAutoMovieActPayload {
  /**
   * What this act accomplishes dramatically ("the hunt turns on the hunter").
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-distance Exposes `purpose` as the portable data boundary for the camera focus distance requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Types `purpose` for the clv focus intent appearance boundary system contract.
   */
  purpose: string;
}

/**
 * The scene payload, the screenplay slug plus optional description: where and
 * when the scene lives. The slug is the human-and-diffusion shared address of
 * the location.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc Exposes `IAutoMovieScenePayload` as the portable data boundary for the story scene local arc requirement.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `IAutoMovieScenePayload` for the narrative intent scene prose index system contract.
 */
export interface IAutoMovieScenePayload {
  /**
   * Interior or exterior.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc Exposes `interiorExterior` as the portable data boundary for the story scene local arc requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `interiorExterior` for the narrative intent scene prose index system contract.
   */
  interiorExterior: "INT" | "EXT";

  /**
   * Location name ("hotel lobby").
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc Exposes `location` as the portable data boundary for the story scene local arc requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `location` for the narrative intent scene prose index system contract.
   */
  location: string;

  /**
   * Time of day ("dawn", "night").
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc Exposes `timeOfDay` as the portable data boundary for the story scene local arc requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `timeOfDay` for the narrative intent scene prose index system contract.
   */
  timeOfDay: string;

  /**
   * Optional scene-setting prose, or `null`.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc Exposes `description` as the portable data boundary for the story scene local arc requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `description` for the narrative intent scene prose index system contract.
   */
  description: string | null;
}

/**
 * The group payload: why these children belong together (a montage, a duel).
 *
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-distance Exposes `IAutoMovieGroupPayload` as the portable data boundary for the camera focus distance requirement.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Types `IAutoMovieGroupPayload` for the clv focus intent appearance boundary system contract.
 */
export interface IAutoMovieGroupPayload {
  /**
   * The grouping rationale, in prose.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-distance Exposes `rationale` as the portable data boundary for the camera focus distance requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Types `rationale` for the clv focus intent appearance boundary system contract.
   */
  rationale: string;
}

/**
 * The beat payload, the tree's authored leaf level: stage direction, dialogue,
 * and the shot caption. A beat node joins the script's flat
 * {@link IAutoMovieBeat} list 1:1 through {@link beat}; the compiled shot
 * (`shot.id = "shot:" + beat`) is the graph's computed leaf below it.
 *
 * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `IAutoMovieBeatPayload` as the portable data boundary for the story beat observation plan requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `IAutoMovieBeatPayload` for the narrative intent beat observation boundary system contract.
 */
export interface IAutoMovieBeatPayload {
  /**
   * Id of the flat {@link IAutoMovieScript.beats} entry this node refines.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `beat` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `beat` for the narrative intent beat observation boundary system contract.
   */
  beat: string;

  /**
   * Stage direction: what happens, in prose (the blocking brief).
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `direction` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `direction` for the narrative intent beat observation boundary system contract.
   */
  direction: string;

  /**
   * Spoken lines in order, possibly empty.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `dialogue` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `dialogue` for the narrative intent beat observation boundary system contract.
   */
  dialogue: IAutoMovieDialogueLine[];

  /**
   * How this shot should read, for the human reviewer AND the diffusion pass
   * (the caption sidecar exports it), or `null`.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `caption` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `caption` for the narrative intent beat observation boundary system contract.
   */
  caption: string | null;
}

/**
 * Common shape of every screenplay node: the refinement edge plus the two
 * cross-cutting edges of the refinement graph.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `IAutoMovieScriptNodeBase` as the portable data boundary for the story screenplay index prose requirement.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `IAutoMovieScriptNodeBase` for the narrative intent scene prose index system contract.
 */
export interface IAutoMovieScriptNodeBase {
  /**
   * Stable id, unique across the whole tree.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `id` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `id` for the narrative intent scene prose index system contract.
   */
  id: string;

  /**
   * The refinement edge: the parent this node makes concrete, or `null` for the
   * single intent root. The refinement axis is a strict tree (acyclic, one
   * root); feedback propagates up this chain.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `parent` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `parent` for the narrative intent scene prose index system contract.
   */
  parent: string | null;

  /**
   * The temporal edge: the node this one follows on the timeline (a beat
   * continuing from the previous beat, aligning with the beat-end continuity
   * handoff), or `null` when nothing precedes it.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `temporal` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `temporal` for the narrative intent scene prose index system contract.
   */
  temporal: string | null;

  /**
   * Cross-cutting interaction edges: nodes this one plays against (the beat of
   * the opponent in a duel). Free-form, validated to resolve.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `interactsWith` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `interactsWith` for the narrative intent scene prose index system contract.
   */
  interactsWith: string[];
}

/**
 * The intent root: the film's single top thought.
 *
 * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-timing-intent Exposes `IAutoMovieScriptIntentNode` as the portable data boundary for the story dialogue timing intent requirement.
 * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `IAutoMovieScriptIntentNode` for the narrative intent utterance timing action system contract.
 */
export interface IAutoMovieScriptIntentNode extends IAutoMovieScriptNodeBase {
  /**
   * Discriminator.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-timing-intent Exposes `kind` as the portable data boundary for the story dialogue timing intent requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `kind` for the narrative intent utterance timing action system contract.
   */
  kind: "intent";

  /**
   * What this level of thought carries (D014: no uniform CoT slots).
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-timing-intent Exposes `payload` as the portable data boundary for the story dialogue timing intent requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `payload` for the narrative intent utterance timing action system contract.
   */
  payload: IAutoMovieIntentPayload;
}

/**
 * A dramatic act.
 *
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-distance Exposes `IAutoMovieScriptActNode` as the portable data boundary for the camera focus distance requirement.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Types `IAutoMovieScriptActNode` for the clv focus intent appearance boundary system contract.
 */
export interface IAutoMovieScriptActNode extends IAutoMovieScriptNodeBase {
  /**
   * Discriminator.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-distance Exposes `kind` as the portable data boundary for the camera focus distance requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Types `kind` for the clv focus intent appearance boundary system contract.
   */
  kind: "act";

  /**
   * What this level of thought carries.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-distance Exposes `payload` as the portable data boundary for the camera focus distance requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Types `payload` for the clv focus intent appearance boundary system contract.
   */
  payload: IAutoMovieActPayload;
}

/**
 * A scene (slug level).
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc Exposes `IAutoMovieScriptSceneNode` as the portable data boundary for the story scene local arc requirement.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `IAutoMovieScriptSceneNode` for the narrative intent scene prose index system contract.
 */
export interface IAutoMovieScriptSceneNode extends IAutoMovieScriptNodeBase {
  /**
   * Discriminator.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc Exposes `kind` as the portable data boundary for the story scene local arc requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `kind` for the narrative intent scene prose index system contract.
   */
  kind: "scene";

  /**
   * What this level of thought carries.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc Exposes `payload` as the portable data boundary for the story scene local arc requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `payload` for the narrative intent scene prose index system contract.
   */
  payload: IAutoMovieScenePayload;
}

/**
 * A grouping of siblings (a montage, an exchange).
 *
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-distance Exposes `IAutoMovieScriptGroupNode` as the portable data boundary for the camera focus distance requirement.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Types `IAutoMovieScriptGroupNode` for the clv focus intent appearance boundary system contract.
 */
export interface IAutoMovieScriptGroupNode extends IAutoMovieScriptNodeBase {
  /**
   * Discriminator.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-distance Exposes `kind` as the portable data boundary for the camera focus distance requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Types `kind` for the clv focus intent appearance boundary system contract.
   */
  kind: "group";

  /**
   * What this level of thought carries.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-distance Exposes `payload` as the portable data boundary for the camera focus distance requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Types `payload` for the clv focus intent appearance boundary system contract.
   */
  payload: IAutoMovieGroupPayload;
}

/**
 * The authored leaf: one beat's direction, dialogue, and caption.
 *
 * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `IAutoMovieScriptBeatNode` as the portable data boundary for the story beat observation plan requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `IAutoMovieScriptBeatNode` for the narrative intent beat observation boundary system contract.
 */
export interface IAutoMovieScriptBeatNode extends IAutoMovieScriptNodeBase {
  /**
   * Discriminator.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `kind` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `kind` for the narrative intent beat observation boundary system contract.
   */
  kind: "beat";

  /**
   * What this level of thought carries.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `payload` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `payload` for the narrative intent beat observation boundary system contract.
   */
  payload: IAutoMovieBeatPayload;
}

/**
 * One node of the screenplay **refinement graph**: the script is a tree from
 * one abstract intent down to concrete beats (whose compiled shots and motions
 * are the graph's computed leaves) with temporal and interaction edges crossing
 * it. Each kind carries its **own** payload shape (D014, heterogeneous
 * chain-of-thought): intent decomposition is not blocking geometry is not
 * dialogue, so no uniform thinking/plan/draft slots exist.
 *
 * The refinement axis is a strict tree (single intent root, acyclic); the
 * temporal and interaction axes are cross-references validated to resolve.
 * Physical/review feedback located on a leaf propagates up the refinement
 * chain, so a correction can target the beat, the scene, or the intent; the
 * screenplay is upstream truth, not a side document.
 *
 * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-timing-intent Exposes `IAutoMovieScriptNode` as the portable data boundary for the story dialogue timing intent requirement.
 * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `IAutoMovieScriptNode` for the narrative intent utterance timing action system contract.
 * @author Samchon
 */
export type IAutoMovieScriptNode =
  | IAutoMovieScriptIntentNode
  | IAutoMovieScriptActNode
  | IAutoMovieScriptSceneNode
  | IAutoMovieScriptGroupNode
  | IAutoMovieScriptBeatNode;
