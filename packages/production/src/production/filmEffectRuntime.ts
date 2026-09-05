import {
  IAutoMovieEffectSample,
  canonicalProductionFrameRate,
  productionFrameBoundaryToSeconds,
  resolveProductionFrameRate,
  sampleCompiledEffect,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieCompiledEffect,
  IAutoMovieCompiledFilmEffect,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionFrameRate,
  IAutoMovieWorldDesign,
} from "@automovie/interface";

import {
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
} from "./contentIdentity";
import { materializeCompiledEffects } from "./materializeProduction";

/**
 * One shot-owned effect interval projected onto the film clock.
 *
 * The compiler supplies these intervals only to prove that one world zone has
 * one effect owner at every realized film frame. They are not substituted for
 * film-owned runtime effects.
 *
 * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Keeps shot and film ownership explicit before runtime materialization.
 * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-tier-state-machine Refuses overlapping owners instead of selecting a last writer.
 * @author Samchon
 */
export interface IAutoMovieShotEffectFilmInterval {
  /** Stable shot-owned cue id. */
  cue: string;
  /** Stable shot id that owns the cue. */
  shot: string;
  /** Existing world effect-zone id. */
  zone: string;
  /** Inclusive film-global frame. */
  startFrame: number;
  /** Exclusive film-global frame. */
  endFrame: number;
}

/**
 * Current identities required when sampling a persisted film effect.
 *
 * @author Samchon
 */
export interface IAutoMovieFilmEffectCurrentIdentity {
  /** Current production identity. */
  production: string;
  /** Current film identity. */
  film: string;
  /** Current aggregate compiler input. */
  compileFingerprint: AutoMovieContentDigest;
  /** Current normalized edit identity. */
  editFingerprint: AutoMovieContentDigest;
}

/**
 * One film-owned effect and its deterministic engine sample.
 *
 * @author Samchon
 */
export interface IAutoMovieProductionFilmEffectSample {
  /** Persisted film-owned runtime identity. */
  runtime: IAutoMovieCompiledFilmEffect;
  /** Existing engine sample at the requested full-rate frame. */
  sample: IAutoMovieEffectSample;
}

/**
 * The compiler-owned film clock every film-effect projection reads.
 *
 * Segments map realized film frames back to shot-local source frames, and the
 * exact rational rate turns a shot-local second into the frame the engine
 * sampler will actually compare against.
 *
 * @author Samchon
 */
export type IAutoMovieFilmEffectClock = Pick<
  IAutoMovieFilmTimeline,
  "fps" | "frameRate" | "segments"
>;

/**
 * A named refusal at the film-effect owner and identity boundary.
 */
export class AutoMovieFilmEffectRuntimeError extends Error {
  public constructor(
    public readonly code:
      | "film-effect-input-invalid"
      | "film-effect-owner-conflict"
      | "film-effect-recipe-missing"
      | "film-effect-runtime-invalid"
      | "film-effect-runtime-stale"
      | "film-effect-zone-missing",
    message: string,
  ) {
    super(message);
    this.name = "AutoMovieFilmEffectRuntimeError";
  }
}

/**
 * Identify the normalized edit state shared by planning and film effects.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-seek-reconstruction Binds persisted film effects to the exact current normalized edit.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#arbitrary-seek-reconstruction-contract Gives compiler materialization and render planning one edit-identity algorithm.
 */
export const productionFilmEffectEditFingerprint = (
  timeline: IAutoMovieFilmTimeline,
): AutoMovieContentDigest =>
  digestAutoMovieBytes(
    canonicalAutoMovieJsonBytes({
      protocol: "automovie.production-render-edit.v2",
      id: timeline.id,
      fps: timeline.fps,
      frameRate: timeline.frameRate,
      totalFrames: timeline.totalFrames,
      segments: timeline.segments,
      omissions: timeline.omissions,
      tracks: timeline.tracks,
    }),
  );

/**
 * Project every shot-owned effect occurrence onto the film's half-open frame
 * clock.
 *
 * A shot cue owns the source frames whose exact boundary time satisfies
 * `start <= time < end`, the same comparison the engine sampler performs, so
 * the projection is decided by the rational frame boundary rather than by a
 * rounded `seconds * fps` product. Each film occurrence of the shot is trimmed
 * to its segment, and a shot the compiled set does not contain contributes no
 * interval because the compiler's shot-availability diagnostics own that
 * refusal.
 *
 * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Projects every shot-authored cue onto the film clock so film and shot owners can be compared.
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-film-time-mapping Decides cue ownership from the rational frame boundary instead of a display-rate float product.
 * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-tier-state-machine Supplies the shot-owner intervals the one-authority check reads.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#effect-film-time-step-boundary Applies the inclusive-start, exclusive-end boundary law to the shot cue's realized frames.
 */
export const projectProductionShotEffectFilmIntervals = (props: {
  timeline: IAutoMovieFilmEffectClock;
  shots: ReadonlyMap<
    string,
    {
      effects: readonly Pick<
        IAutoMovieCompiledEffect,
        "id" | "zone" | "start" | "end"
      >[];
    }
  >;
}): IAutoMovieShotEffectFilmInterval[] => {
  const frameRate = validatedTimelineFrameRate(props.timeline);
  return props.timeline.segments.flatMap((segment) => {
    const shot = props.shots.get(segment.shot);
    if (shot === undefined) return [];
    return shot.effects.flatMap((effect) => {
      const startFrame =
        Number.isFinite(effect.start) && effect.start >= 0
          ? firstFrameAtOrAfter(effect.start, frameRate)
          : null;
      const endFrame =
        Number.isFinite(effect.end) && effect.end > effect.start
          ? firstFrameAtOrAfter(effect.end, frameRate)
          : null;
      if (startFrame === null || endFrame === null)
        throw new AutoMovieFilmEffectRuntimeError(
          "film-effect-input-invalid",
          `Shot effect cue "${effect.id}" on shot "${segment.shot}" has an invalid or unrepresentable second interval ${effect.start}..${effect.end}.`,
        );
      const start = Math.max(segment.sourceInFrame, startFrame);
      const end = Math.min(segment.sourceOutFrame, endFrame);
      return end <= start
        ? []
        : [
            {
              cue: effect.id,
              shot: segment.shot,
              zone: effect.zone,
              startFrame: segment.startFrame + start - segment.sourceInFrame,
              endFrame: segment.startFrame + end - segment.sourceInFrame,
            },
          ];
    });
  });
};

/**
 * Map one shot-local review time to its only realized film frame.
 *
 * A shot page and a review capture know a shot and a second, not a film
 * frame. Film-owned state at that second exists only when the edit realizes
 * the shot exactly once at the source frame owning that second, so an absent
 * or repeated occurrence answers `null` rather than choosing one occurrence.
 * The answer depends only on the compiled timeline, never on whether a render
 * has prepared any other runtime.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-film-time-mapping Resolves a shot-local second to the rational film frame that owns it.
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-state-sampling Gives a shot review seek the same film frame the film schedule would sample for that source frame.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#effect-film-time-step-boundary Selects the frame whose half-open boundary interval contains the requested second.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule Keeps one exact frame-number-to-time relation between shot review and film schedule.
 */
export const productionFilmFrameForShotTime = (props: {
  timeline: IAutoMovieFilmEffectClock;
  shot: string;
  time: number;
}): number | null => {
  const frameRate = validatedTimelineFrameRate(props.timeline);
  if (Number.isFinite(props.time) === false || props.time < 0) return null;
  const sourceFrame = lastFrameAtOrBefore(props.time, frameRate);
  if (sourceFrame === null) return null;
  const candidates = props.timeline.segments.filter(
    (segment) =>
      segment.shot === props.shot &&
      sourceFrame >= segment.sourceInFrame &&
      sourceFrame < segment.sourceOutFrame,
  );
  if (candidates.length !== 1) return null;
  const segment = candidates[0]!;
  return segment.startFrame + sourceFrame - segment.sourceInFrame;
};

/**
 * Prove that one persisted runtime population is the exact executable
 * projection of the current timeline's effect track.
 *
 * Per-entry identity checks cannot see an entry that is absent, so an empty
 * or truncated runtime array would otherwise read as current. The population
 * must match the canonically ordered cue set one to one, and every entry must
 * carry the timeline's film, compile, edit, and frame-rate identity together
 * with its cue's zone, interval, and intensity.
 *
 * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Refuses a runtime that silently drops or alters an accepted film cue.
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-cache-identity Binds the persisted population to the timeline identity rather than reusing a stale artifact.
 * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-tier-state-machine Requires exactly one current runtime for every accepted cue.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#checkpoint-cache-identity-and-validity Rejects a persisted stream whose identity or population differs from its current input.
 */
export const verifyProductionFilmEffectPopulation = (props: {
  timeline: IAutoMovieFilmTimeline;
  effects: readonly IAutoMovieCompiledFilmEffect[];
}): void => {
  const frameRate = validatedTimelineFrameRate(props.timeline);
  const editFingerprint = productionFilmEffectEditFingerprint(props.timeline);
  const cues = sortedCues(props.timeline.tracks.effects);
  if (props.effects.length !== cues.length)
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-runtime-invalid",
      `Film effect runtime population has ${props.effects.length} entries; the current timeline requires ${cues.length}.`,
    );
  props.effects.forEach((runtime, index) => {
    const cue = cues[index]!;
    validateRuntimeShape(runtime);
    if (
      runtime.film !== props.timeline.id ||
      runtime.compileFingerprint !== props.timeline.inputFingerprint ||
      runtime.editFingerprint !== editFingerprint ||
      runtime.frameRate.numerator !== frameRate.numerator ||
      runtime.frameRate.denominator !== frameRate.denominator ||
      runtime.effect.id !== cue.id ||
      runtime.effect.zone !== cue.zone ||
      runtime.startFrame !== cue.startFrame ||
      runtime.endFrame !== cue.startFrame + cue.durationFrames ||
      runtime.effect.intensity.from !== cue.intensity ||
      runtime.effect.intensity.to !== cue.intensity
    )
      throw new AutoMovieFilmEffectRuntimeError(
        "film-effect-runtime-invalid",
        `Film effect runtime entry ${index} differs from current timeline cue "${cue.id}" in identity, clock, zone, interval, or intensity.`,
      );
  });
};

/**
 * Materialize normalized film cues into current, deterministic effect streams.
 *
 * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Makes an accepted film cue observable through the existing bounded runtime.
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-seek-reconstruction Derives every stream from current content identities rather than playback history.
 * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-tier-state-machine Gives film-global and shot-local cues disjoint, checked ownership.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#arbitrary-seek-reconstruction-contract Produces immutable streams that can be sampled in any order.
 */
export const materializeProductionFilmEffects = (props: {
  identity: IAutoMovieFilmEffectCurrentIdentity;
  frameRate: number | IAutoMovieProductionFrameRate;
  world: IAutoMovieWorldDesign;
  effects: IAutoMovieFilmTimeline["tracks"]["effects"];
  shotEffects?: readonly IAutoMovieShotEffectFilmInterval[];
}): IAutoMovieCompiledFilmEffect[] => {
  validateIdentity(props.identity);
  const frameRate = validatedFrameRate(
    props.frameRate,
    "film-effect-input-invalid",
  );
  const recipes = uniqueMap(
    props.world.effectRecipes,
    "recipe",
    (value) => value.id,
  );
  const zones = uniqueMap(props.world.effectZones, "zone", (value) => value.id);
  validateShotIntervals(props.shotEffects ?? []);
  const cueIds = new Set<string>();
  const filmIntervals: Array<{
    cue: string;
    zone: string;
    startFrame: number;
    endFrame: number;
  }> = [];
  return sortedCues(props.effects).map((cue): IAutoMovieCompiledFilmEffect => {
    validateCue(cue);
    if (cueIds.has(cue.id))
      throw new AutoMovieFilmEffectRuntimeError(
        "film-effect-input-invalid",
        `Film effect cue id "${cue.id}" must be unique.`,
      );
    cueIds.add(cue.id);
    const zone = zones.get(cue.zone);
    if (zone === undefined)
      throw new AutoMovieFilmEffectRuntimeError(
        "film-effect-zone-missing",
        `Film effect cue "${cue.id}" references missing world zone "${cue.zone}".`,
      );
    const recipe = recipes.get(zone.recipe);
    if (recipe === undefined)
      throw new AutoMovieFilmEffectRuntimeError(
        "film-effect-recipe-missing",
        `Film effect cue "${cue.id}" uses zone "${zone.id}" whose recipe "${zone.recipe}" is missing.`,
      );
    const endFrame = cue.startFrame + cue.durationFrames;
    const filmConflict = filmIntervals.find(
      (candidate) =>
        candidate.zone === cue.zone &&
        candidate.startFrame < endFrame &&
        cue.startFrame < candidate.endFrame,
    );
    if (filmConflict !== undefined)
      throw new AutoMovieFilmEffectRuntimeError(
        "film-effect-owner-conflict",
        `Film effect cues "${filmConflict.cue}" and "${cue.id}" both own zone "${cue.zone}" during frames ${Math.max(cue.startFrame, filmConflict.startFrame)}..${Math.min(endFrame, filmConflict.endFrame)}.`,
      );
    filmIntervals.push({
      cue: cue.id,
      zone: cue.zone,
      startFrame: cue.startFrame,
      endFrame,
    });
    const conflict = (props.shotEffects ?? []).find(
      (candidate) =>
        candidate.zone === cue.zone &&
        candidate.startFrame < endFrame &&
        cue.startFrame < candidate.endFrame,
    );
    if (conflict !== undefined)
      throw new AutoMovieFilmEffectRuntimeError(
        "film-effect-owner-conflict",
        `Film effect cue "${cue.id}" and shot effect cue "${conflict.cue}" on shot "${conflict.shot}" both own zone "${cue.zone}" during frames ${Math.max(cue.startFrame, conflict.startFrame)}..${Math.min(endFrame, conflict.endFrame)}.`,
      );
    const [effect] = materializeCompiledEffects({
      world: props.world,
      fixedStepSeconds: frameRate.denominator / frameRate.numerator,
      seedOwner: {
        production: props.identity.production,
        film: props.identity.film,
      },
      cues: [
        {
          id: cue.id,
          zone: cue.zone,
          start: frameSeconds(cue.startFrame, frameRate),
          end: frameSeconds(endFrame, frameRate),
          intensity: { from: cue.intensity, to: cue.intensity },
        },
      ],
    });
    if (effect === undefined)
      throw new AutoMovieFilmEffectRuntimeError(
        "film-effect-runtime-invalid",
        `Film effect cue "${cue.id}" did not materialize its validated zone and recipe.`,
      );
    const core: Omit<IAutoMovieCompiledFilmEffect, "digest"> = {
      version: 1,
      owner: "film",
      clock: "timeline-frame",
      ...structuredClone(props.identity),
      frameRate,
      startFrame: cue.startFrame,
      endFrame,
      effect,
    };
    return {
      ...core,
      digest: digestAutoMovieBytes(canonicalAutoMovieJsonBytes(core)),
    };
  });
};

/**
 * Sample film-owned effects at one compiler-owned full-rate timeline frame.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-arbitrary-seek Samples without retaining a cursor or depending on call order.
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-film-time-mapping Uses the timeline frame even when a proxy output frame has a different index.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#arbitrary-seek-reconstruction-contract Reconstructs the same state for repeated and reordered seeks.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#effect-film-time-step-boundary Performs one exact rational frame-to-seconds conversion at the sampler boundary.
 */
export const sampleProductionFilmEffects = (props: {
  identity: IAutoMovieFilmEffectCurrentIdentity;
  effects: readonly IAutoMovieCompiledFilmEffect[];
  timelineFrame: number;
  cameraDistance?: number;
}): IAutoMovieProductionFilmEffectSample[] => {
  validateIdentity(props.identity);
  if (
    Number.isSafeInteger(props.timelineFrame) === false ||
    props.timelineFrame < 0
  )
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-input-invalid",
      `Film effect timeline frame ${props.timelineFrame} must be a nonnegative safe integer.`,
    );
  if (
    props.cameraDistance !== undefined &&
    (Number.isFinite(props.cameraDistance) === false ||
      props.cameraDistance < 0)
  )
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-input-invalid",
      `Film effect camera distance ${props.cameraDistance} must be finite and nonnegative.`,
    );
  return props.effects.map((runtime) => {
    validateRuntimeShape(runtime);
    if (
      runtime.production !== props.identity.production ||
      runtime.film !== props.identity.film ||
      runtime.compileFingerprint !== props.identity.compileFingerprint ||
      runtime.editFingerprint !== props.identity.editFingerprint
    )
      throw new AutoMovieFilmEffectRuntimeError(
        "film-effect-runtime-stale",
        `Film effect runtime "${runtime.effect.id}" differs from the current production, film, compile, or edit identity.`,
      );
    return {
      runtime: structuredClone(runtime),
      sample: sampleCompiledEffect(
        runtime.effect,
        frameSeconds(props.timelineFrame, runtime.frameRate),
        props.cameraDistance,
      ),
    };
  });
};

const validateIdentity = (
  identity: IAutoMovieFilmEffectCurrentIdentity,
): void => {
  if (
    identity.production.trim().length === 0 ||
    identity.film.trim().length === 0
  )
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-input-invalid",
      "Film effect production and film identities must be non-blank.",
    );
  if (
    validDigest(identity.compileFingerprint) === false ||
    validDigest(identity.editFingerprint) === false
  )
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-input-invalid",
      "Film effect compile and edit identities must be SHA-256 content digests.",
    );
};

const validateCue = (
  cue: IAutoMovieFilmTimeline["tracks"]["effects"][number],
): void => {
  if (
    cue.id.trim().length === 0 ||
    cue.recipe !== "world-zone" ||
    cue.zone.trim().length === 0 ||
    Number.isSafeInteger(cue.startFrame) === false ||
    cue.startFrame < 0 ||
    Number.isSafeInteger(cue.durationFrames) === false ||
    cue.durationFrames <= 0 ||
    Number.isSafeInteger(cue.startFrame + cue.durationFrames) === false ||
    Number.isFinite(cue.intensity) === false ||
    cue.intensity < 0 ||
    cue.intensity > 1
  )
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-input-invalid",
      `Film effect cue "${cue.id}" has an invalid id, recipe, zone, frame interval, or intensity.`,
    );
};

const validateShotIntervals = (
  intervals: readonly IAutoMovieShotEffectFilmInterval[],
): void => {
  for (const interval of intervals)
    if (
      interval.cue.trim().length === 0 ||
      interval.shot.trim().length === 0 ||
      interval.zone.trim().length === 0 ||
      Number.isSafeInteger(interval.startFrame) === false ||
      interval.startFrame < 0 ||
      Number.isSafeInteger(interval.endFrame) === false ||
      interval.endFrame <= interval.startFrame
    )
      throw new AutoMovieFilmEffectRuntimeError(
        "film-effect-input-invalid",
        `Shot effect cue "${interval.cue}" has an invalid owner or film-frame interval.`,
      );
};

/**
 * Refuse a persisted runtime whose version, owner, clock, frame rate, inner
 * effect, or content digests are not the ones this module writes. Identity
 * currentness is a separate question each consumer answers against the
 * identity it independently established.
 */
const validateRuntimeShape = (runtime: IAutoMovieCompiledFilmEffect): void => {
  if (
    runtime.version !== 1 ||
    runtime.owner !== "film" ||
    runtime.clock !== "timeline-frame" ||
    runtime.startFrame < 0 ||
    runtime.endFrame <= runtime.startFrame ||
    Number.isSafeInteger(runtime.startFrame) === false ||
    Number.isSafeInteger(runtime.endFrame) === false
  )
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-runtime-invalid",
      `Film effect runtime "${runtime.effect.id}" has an unsupported version, owner, clock, or interval.`,
    );
  const frameRate = validatedFrameRate(
    runtime.frameRate,
    "film-effect-runtime-invalid",
  );
  if (
    runtime.frameRate.numerator !== frameRate.numerator ||
    runtime.frameRate.denominator !== frameRate.denominator ||
    runtime.effect.version !== 1 ||
    runtime.effect.id.trim().length === 0 ||
    runtime.effect.zone.trim().length === 0 ||
    runtime.effect.intensity.from !== runtime.effect.intensity.to ||
    Number.isFinite(runtime.effect.intensity.from) === false ||
    runtime.effect.intensity.from < 0 ||
    runtime.effect.intensity.from > 1
  )
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-runtime-invalid",
      `Film effect runtime "${runtime.effect.id}" has a noncanonical frame rate or malformed inner film effect.`,
    );
  const effectCore = { ...runtime.effect, digest: undefined };
  const expectedEffectDigest = digestAutoMovieBytes(
    canonicalAutoMovieJsonBytes(effectCore),
  );
  const runtimeCore = { ...runtime, digest: undefined };
  const expectedRuntimeDigest = digestAutoMovieBytes(
    canonicalAutoMovieJsonBytes(runtimeCore),
  );
  if (
    runtime.effect.digest !== expectedEffectDigest ||
    runtime.digest !== expectedRuntimeDigest ||
    runtime.effect.start !== frameSeconds(runtime.startFrame, frameRate) ||
    runtime.effect.end !== frameSeconds(runtime.endFrame, frameRate) ||
    runtime.effect.fixedStepSeconds !==
      frameRate.denominator / frameRate.numerator
  )
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-runtime-invalid",
      `Film effect runtime "${runtime.effect.id}" differs from its content digest or exact frame clock.`,
    );
};

const uniqueMap = <T>(
  values: readonly T[],
  kind: string,
  key: (value: T) => string,
): Map<string, T> => {
  const output = new Map<string, T>();
  for (const value of values) {
    const id = key(value);
    if (id.trim().length === 0 || output.has(id))
      throw new AutoMovieFilmEffectRuntimeError(
        "film-effect-input-invalid",
        `Film effect world ${kind} id "${id}" must be non-blank and unique.`,
      );
    output.set(id, value);
  }
  return output;
};

const sortedCues = (
  cues: IAutoMovieFilmTimeline["tracks"]["effects"],
): IAutoMovieFilmTimeline["tracks"]["effects"] =>
  [...cues].sort(
    (left, right) =>
      left.startFrame - right.startFrame || compareCodeUnits(left.id, right.id),
  );

const frameSeconds = (
  frame: number,
  frameRate: IAutoMovieProductionFrameRate,
): number => productionFrameBoundaryToSeconds({ frame, frameRate });

/**
 * The smallest frame whose exact boundary time is at or after `seconds`, or
 * `null` when no safe-integer frame can represent that boundary.
 *
 * The float product only estimates the frame; the answer is settled by the
 * same boundary comparison the sampler performs, so a product that lands one
 * ulp on the wrong side of an integer cannot move ownership by a frame.
 */
const firstFrameAtOrAfter = (
  seconds: number,
  frameRate: IAutoMovieProductionFrameRate,
): number | null => {
  let frame = frameEstimate(seconds, frameRate, Math.ceil);
  if (frame === null) return null;
  while (frame > 0 && frameSeconds(frame - 1, frameRate) >= seconds) frame -= 1;
  while (frameSeconds(frame, frameRate) < seconds) frame += 1;
  return frame;
};

/**
 * The largest frame whose exact boundary time is at or before a nonnegative
 * finite `seconds`, or `null` when no safe-integer frame can own it.
 */
const lastFrameAtOrBefore = (
  seconds: number,
  frameRate: IAutoMovieProductionFrameRate,
): number | null => {
  let frame = frameEstimate(seconds, frameRate, Math.floor);
  if (frame === null) return null;
  while (frame > 0 && frameSeconds(frame, frameRate) > seconds) frame -= 1;
  while (frameSeconds(frame + 1, frameRate) <= seconds) frame += 1;
  return frame;
};

/**
 * Estimate a frame from the float product and keep two frames of headroom so
 * the exact correction above never leaves the safe-integer range. An infinite
 * or NaN product fails the comparison and is reported as unrepresentable.
 */
const frameEstimate = (
  seconds: number,
  frameRate: IAutoMovieProductionFrameRate,
  round: (value: number) => number,
): number | null => {
  const frame = Math.max(
    0,
    round((seconds * frameRate.numerator) / frameRate.denominator),
  );
  return frame <= Number.MAX_SAFE_INTEGER - 2 ? frame : null;
};

const validatedFrameRate = (
  frameRate: number | IAutoMovieProductionFrameRate,
  code: "film-effect-input-invalid" | "film-effect-runtime-invalid",
): IAutoMovieProductionFrameRate => {
  try {
    return canonicalProductionFrameRate(frameRate);
  } catch {
    throw new AutoMovieFilmEffectRuntimeError(
      code,
      "Film effect frame rate must be a positive exact rational identity.",
    );
  }
};

const validatedTimelineFrameRate = (
  timeline: Pick<IAutoMovieFilmTimeline, "fps" | "frameRate">,
): IAutoMovieProductionFrameRate => {
  try {
    return resolveProductionFrameRate(timeline);
  } catch {
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-input-invalid",
      "Film effect timeline frame rate must be a consistent positive exact rational identity.",
    );
  }
};

const validDigest = (value: string): boolean =>
  /^sha256:[0-9a-f]{64}$/.test(value);

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
