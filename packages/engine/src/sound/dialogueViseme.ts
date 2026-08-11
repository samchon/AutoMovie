import type {
  AutoMovieExpressionPreset,
  IAutoMovieExpression,
  IAutoMovieProductionDialogueLine,
  IAutoMovieProductionLipSyncJoin,
  IAutoMovieProductionViseme,
} from "@automovie/interface";

const DIALOGUE_VISEMES = new Set<IAutoMovieProductionViseme["viseme"]>([
  "aa",
  "ih",
  "ou",
  "ee",
  "oh",
  "rest",
]);

/**
 * Explicit authored-speaker to compiled-actor binding.
 *
 * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Requires a deterministic speaker-to-actor path.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Joins final-byte visemes to one resolved actor.
 */
export interface IAutoMovieDialogueSpeakerBinding {
  /**
   * Authored speaker identity carried by the dialogue line.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Does not infer a speaker from cast order.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Makes the join key explicit.
   */
  speaker: string;
  /**
   * Resolved actor node that owns the mouth layer.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Targets the speaking actor.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Places the derived channel on the compiled actor.
   */
  actor: string;
}

/**
 * One gap-free mouth range on the emission clock.
 *
 * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-final-bytes-authority Keeps timing derived from the final synthesized bytes.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-voice-consistency-and-phoneme-state Preserves the final-byte phoneme timing that defines each mouth range.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Supports direct arbitrary-frame sampling.
 */
export interface IAutoMovieDialogueMouthRange {
  /**
   * Inclusive film-global emission frame.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Moves the mouth when the actor emits speech.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Separates mouth emission from audible arrival.
   */
  startFrame: number;
  /**
   * Exclusive film-global emission frame.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-seek-equivalence Gives each mouth state an exact range.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Makes seek history unnecessary.
   */
  endFrame: number;
  /**
   * Derived mouth preset or explicit rest.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Uses receipt visemes instead of hand-authored syllable keyframes.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Preserves the closed mouth-target vocabulary.
   */
  viseme: IAutoMovieProductionViseme["viseme"];
}

/**
 * Compiled dialogue mouth layer for one actor.
 *
 * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Makes the derived channel visible to compiler and review consumers.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Defines a deterministic seekable artifact.
 */
export interface IAutoMovieDialogueVisemeTimeline {
  /**
   * Joined dialogue line identity.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-final-bytes-authority Retains the authoritative dialogue identity.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-voice-consistency-and-phoneme-state Binds the derived phoneme state to its final-byte dialogue line.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Binds the timeline to its source line.
   */
  line: string;
  /**
   * Resolved actor node.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Records the join target.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Makes actor ownership inspectable.
   */
  actor: string;
  /**
   * Gap-free ranges covering the line, including explicit rest.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-seek-equivalence Preserves silence without playback history.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Gives arbitrary seek one canonical answer.
   */
  ranges: IAutoMovieDialogueMouthRange[];
}

/**
 * Shared receipt join plus the engine's seekable mouth timeline.
 *
 * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-refusal Refuses missing speaker binding or final-byte timing.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-failure-contract Reports why no mouth channel exists.
 */
export interface IAutoMovieDialogueVisemeCompilation {
  /**
   * Shared final-receipt join outcome.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-refusal Does not call absence a successful rest track.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-failure-contract Keeps failure distinct from silence.
   */
  join: IAutoMovieProductionLipSyncJoin;
  /**
   * Gap-free mouth timeline, available only when the join succeeded.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-refusal Names the missing join fact.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-failure-contract Makes correction non-automatic.
   */
  timeline: IAutoMovieDialogueVisemeTimeline | null;
}

/**
 * Authored expression and derived mouth layers at one frame.
 *
 * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Preserves authored emotion while adding mouth motion.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Keeps mouth composition explicit.
 */
export interface IAutoMovieDialogueExpressionLayers {
  /**
   * Unchanged authored expression layer.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Prevents lip-sync from erasing emotion.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Separates authored and derived channels.
   */
  authored: IAutoMovieExpression | null;
  /**
   * Derived mouth-only preset.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Applies speech only to the mouth layer.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Provides the renderer-facing mouth state.
   */
  mouth: {
    /** Mouth preset, with `neutral` representing receipt `rest`. */
    preset: AutoMovieExpressionPreset;
    /** Zero for rest and one for an active viseme. */
    intensity: number;
  };
}

/**
 * Join final-byte visemes to an explicitly bound actor on emission time.
 *
 * Missing or ambiguous speaker bindings return the shared `not-run` outcome;
 * the engine does not select an actor, synthesize phonemes for external audio,
 * or move mouth motion to the later audible-arrival frame. Valid receipt gaps
 * become explicit `rest` ranges, so silence has a deterministic closed mouth.
 *
 * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-final-bytes-authority Uses only the receipt timeline derived from final audio bytes.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-voice-consistency-and-phoneme-state Consumes the ordered phoneme state derived from those bytes.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Builds the compiler-visible emission-clock join.
 */
export const joinAutoMovieDialogueVisemes = (props: {
  /** Dialogue line whose film range is authoritative. */
  line: IAutoMovieProductionDialogueLine;
  /** Explicit speaker-to-actor bindings in authored order. */
  bindings: readonly IAutoMovieDialogueSpeakerBinding[];
  /** Final-byte receipt visemes for this line. */
  visemes: readonly IAutoMovieProductionViseme[];
}): IAutoMovieDialogueVisemeCompilation => {
  if (props.line.speaker === undefined)
    return {
      join: { status: "not-run", reason: "speaker-not-declared" },
      timeline: null,
    };
  const bindings = props.bindings.filter(
    (binding) => binding.speaker === props.line.speaker,
  );
  if (bindings.length === 0)
    return {
      join: { status: "not-run", reason: "speaker-actor-not-found" },
      timeline: null,
    };
  if (bindings.length > 1)
    return {
      join: { status: "not-run", reason: "speaker-actor-ambiguous" },
      timeline: null,
    };
  const binding = bindings[0]!;
  if (binding.actor.trim().length === 0)
    throw new Error("dialogue actor binding must not be blank");
  if (props.visemes.length === 0)
    throw new Error(
      `dialogue line "${props.line.id}" has no final-byte viseme timing`,
    );
  if (
    !Number.isSafeInteger(props.line.startFrame) ||
    !Number.isSafeInteger(props.line.endFrame) ||
    props.line.startFrame < 0 ||
    props.line.endFrame <= props.line.startFrame
  )
    throw new Error(`dialogue line "${props.line.id}" has an invalid range`);

  const ranges: IAutoMovieDialogueMouthRange[] = [];
  let cursor = props.line.startFrame;
  for (const [index, viseme] of props.visemes.entries()) {
    if (!DIALOGUE_VISEMES.has(viseme.viseme))
      throw new Error(
        `dialogue line "${props.line.id}" viseme[${index}] has unsupported mouth target "${String(viseme.viseme)}"`,
      );
    if (
      !Number.isSafeInteger(viseme.startFrame) ||
      !Number.isSafeInteger(viseme.endFrame) ||
      viseme.startFrame < cursor ||
      viseme.endFrame <= viseme.startFrame ||
      viseme.endFrame > props.line.endFrame
    )
      throw new Error(
        `dialogue line "${props.line.id}" viseme[${index}] is outside or overlaps its emission range`,
      );
    if (viseme.startFrame > cursor)
      ranges.push({
        startFrame: cursor,
        endFrame: viseme.startFrame,
        viseme: "rest",
      });
    ranges.push({
      startFrame: viseme.startFrame,
      endFrame: viseme.endFrame,
      viseme: viseme.viseme,
    });
    cursor = viseme.endFrame;
  }
  if (cursor < props.line.endFrame)
    ranges.push({
      startFrame: cursor,
      endFrame: props.line.endFrame,
      viseme: "rest",
    });
  return {
    join: {
      status: "available",
      actor: binding.actor,
      timing: "emission",
      composition: "mouth-layer-over-authored-expression",
    },
    timeline: { line: props.line.id, actor: binding.actor, ranges },
  };
};

/**
 * Sample authored emotion and derived mouth state without either replacing the
 * other. Frames outside the line and explicit receipt gaps are `neutral` at
 * zero intensity; sampling never depends on a previous cursor.
 *
 * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-seek-equivalence Makes arbitrary seek equal sequential sampling.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Composes the mouth layer at the requested emission frame.
 */
export const sampleAutoMovieDialogueExpression = (props: {
  /** Compiled actor mouth timeline. */
  timeline: IAutoMovieDialogueVisemeTimeline;
  /** Film-global frame to sample. */
  frame: number;
  /** Authored emotion/expression, retained unchanged. */
  authored: IAutoMovieExpression | null;
}): IAutoMovieDialogueExpressionLayers => {
  if (!Number.isSafeInteger(props.frame) || props.frame < 0)
    throw new Error("dialogue expression frame must be a non-negative integer");
  const viseme = props.timeline.ranges.find(
    (range) => props.frame >= range.startFrame && props.frame < range.endFrame,
  )?.viseme;
  return {
    authored: props.authored,
    mouth:
      viseme === undefined || viseme === "rest"
        ? { preset: "neutral", intensity: 0 }
        : { preset: viseme, intensity: 1 },
  };
};
