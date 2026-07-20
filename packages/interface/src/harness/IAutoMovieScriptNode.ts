/**
 * One spoken line inside a beat: who says what, optionally pinned to the beat's
 * local clock. Dialogue text is authoring data. Audio rendering belongs to the
 * diffusion side; the text drives cut rhythm, viseme hints, and the
 * human-readable screenplay export.
 *
 * @author Samchon
 */
export interface IAutoMovieDialogueLine {
  /** Cast character (or scene node) who speaks. */
  speaker: string;

  /** The spoken line, verbatim. */
  text: string;

  /**
   * Seconds into the beat this line lands, riding the timing-anchor spirit
   * ({@link IAutoMovieTimingAnchor}), or `null` when the line floats freely
   * inside the beat.
   */
  anchor: number | null;
}

/**
 * The intent payload, the refinement root's thought: what film this is and
 * what it should feel like. The whole tree below refines this single statement,
 * so it carries only the top-of-funnel decomposition.
 */
export interface IAutoMovieIntentPayload {
  /** One-sentence summary of the film. */
  logline: string;

  /** The mood / thematic intent every refinement below should serve. */
  theme: string;
}

/** The act payload: one dramatic movement's purpose, in a sentence or two. */
export interface IAutoMovieActPayload {
  /** What this act accomplishes dramatically ("the hunt turns on the hunter"). */
  purpose: string;
}

/**
 * The scene payload, the screenplay slug plus optional description: where and
 * when the scene lives. The slug is the human-and-diffusion shared address of
 * the location.
 */
export interface IAutoMovieScenePayload {
  /** Interior or exterior. */
  interiorExterior: "INT" | "EXT";

  /** Location name ("castle courtyard"). */
  location: string;

  /** Time of day ("dawn", "night"). */
  timeOfDay: string;

  /** Optional scene-setting prose, or `null`. */
  description: string | null;
}

/** The group payload: why these children belong together (a montage, a duel). */
export interface IAutoMovieGroupPayload {
  /** The grouping rationale, in prose. */
  rationale: string;
}

/**
 * The beat payload, the tree's authored leaf level: stage direction, dialogue,
 * and the shot caption. A beat node joins the script's flat
 * {@link IAutoMovieBeat} list 1:1 through {@link beat}; the compiled shot
 * (`shot.id = "shot:" + beat`) is the graph's computed leaf below it.
 */
export interface IAutoMovieBeatPayload {
  /** Id of the flat {@link IAutoMovieScript.beats} entry this node refines. */
  beat: string;

  /** Stage direction: what happens, in prose (the blocking brief). */
  direction: string;

  /** Spoken lines in order, possibly empty. */
  dialogue: IAutoMovieDialogueLine[];

  /**
   * How this shot should read, for the human reviewer AND the diffusion pass
   * (the caption sidecar exports it), or `null`.
   */
  caption: string | null;
}

/**
 * Common shape of every screenplay node: the refinement edge plus the two
 * cross-cutting edges of the refinement graph.
 */
export interface IAutoMovieScriptNodeBase {
  /** Stable id, unique across the whole tree. */
  id: string;

  /**
   * The refinement edge: the parent this node makes concrete, or `null` for
   * the single intent root. The refinement axis is a strict tree (acyclic, one
   * root); feedback propagates up this chain.
   */
  parent: string | null;

  /**
   * The temporal edge: the node this one follows on the timeline (a beat
   * continuing from the previous beat, aligning with the beat-end continuity
   * handoff), or `null` when nothing precedes it.
   */
  temporal: string | null;

  /**
   * Cross-cutting interaction edges: nodes this one plays against (the beat of
   * the opponent in a duel). Free-form, validated to resolve.
   */
  interactsWith: string[];
}

/** The intent root: the film's single top thought. */
export interface IAutoMovieScriptIntentNode extends IAutoMovieScriptNodeBase {
  /** Discriminator. */
  kind: "intent";

  /** What this level of thought carries (D014: no uniform CoT slots). */
  payload: IAutoMovieIntentPayload;
}

/** A dramatic act. */
export interface IAutoMovieScriptActNode extends IAutoMovieScriptNodeBase {
  /** Discriminator. */
  kind: "act";

  /** What this level of thought carries. */
  payload: IAutoMovieActPayload;
}

/** A scene (slug level). */
export interface IAutoMovieScriptSceneNode extends IAutoMovieScriptNodeBase {
  /** Discriminator. */
  kind: "scene";

  /** What this level of thought carries. */
  payload: IAutoMovieScenePayload;
}

/** A grouping of siblings (a montage, an exchange). */
export interface IAutoMovieScriptGroupNode extends IAutoMovieScriptNodeBase {
  /** Discriminator. */
  kind: "group";

  /** What this level of thought carries. */
  payload: IAutoMovieGroupPayload;
}

/** The authored leaf: one beat's direction, dialogue, and caption. */
export interface IAutoMovieScriptBeatNode extends IAutoMovieScriptNodeBase {
  /** Discriminator. */
  kind: "beat";

  /** What this level of thought carries. */
  payload: IAutoMovieBeatPayload;
}

/**
 * One node of the screenplay **refinement graph**: the script is a tree
 * from one abstract intent down to concrete beats (whose compiled shots and
 * motions are the graph's computed leaves) with temporal and interaction edges
 * crossing it. Each kind carries its **own** payload shape (D014, heterogeneous
 * chain-of-thought): intent decomposition is not blocking geometry is not
 * dialogue, so no uniform thinking/plan/draft slots exist.
 *
 * The refinement axis is a strict tree (single intent root, acyclic); the
 * temporal and interaction axes are cross-references validated to resolve.
 * Physical/review feedback located on a leaf propagates up the refinement
 * chain, so a correction can target the beat, the scene, or the intent; the
 * screenplay is upstream truth, not a side document.
 *
 * @author Samchon
 */
export type IAutoMovieScriptNode =
  | IAutoMovieScriptIntentNode
  | IAutoMovieScriptActNode
  | IAutoMovieScriptSceneNode
  | IAutoMovieScriptGroupNode
  | IAutoMovieScriptBeatNode;
