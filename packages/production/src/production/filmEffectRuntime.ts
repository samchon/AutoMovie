import {
  IAutoMovieEffectSample,
  canonicalProductionFrameRate,
  sampleCompiledEffect,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieCompiledEffect,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionFrameRate,
  IAutoMovieWorldDesign,
} from "@automovie/interface";

import {
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
} from "./contentIdentity";

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
 * One compiler-owned film effect with an explicit owner and full-rate clock.
 *
 * The inner effect remains the existing bounded engine stream. This wrapper
 * adds the film owner, current compiler identities and exact frame interval so
 * a proxy, final capture, or viewer cannot reinterpret it on a tier-local
 * output clock.
 *
 * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Carries an accepted film-global cue to the existing bounded runtime.
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-film-time-mapping Fixes effect activity to the compiler-owned full-rate frame.
 * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-tier-state-machine Preserves one explicit film owner around the existing compiled effect stream.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#effect-film-time-step-boundary Maps the exact frame boundary once onto the effect clock.
 * @author Samchon
 */
export interface IAutoMovieCompiledFilmEffect {
  /** Film-effect runtime format. */
  version: 1;
  /** Explicit authority discriminator. */
  owner: "film";
  /** Explicit clock discriminator. */
  clock: "timeline-frame";
  /** Current production identity. */
  production: string;
  /** Current compiler-owned film identity. */
  film: string;
  /** Current aggregate compiler input. */
  compileFingerprint: AutoMovieContentDigest;
  /** Current normalized edit identity. */
  editFingerprint: AutoMovieContentDigest;
  /** Exact reduced production frame rate. */
  frameRate: IAutoMovieProductionFrameRate;
  /** Inclusive film-global frame. */
  startFrame: number;
  /** Exclusive film-global frame. */
  endFrame: number;
  /** Existing bounded effect stream sampled by the engine and viewer. */
  effect: IAutoMovieCompiledEffect;
  /** Digest of every field above. */
  digest: AutoMovieContentDigest;
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
  return [...props.effects]
    .sort(
      (left, right) =>
        left.startFrame - right.startFrame ||
        compareCodeUnits(left.id, right.id),
    )
    .map((cue): IAutoMovieCompiledFilmEffect => {
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
      const effectCore: Omit<IAutoMovieCompiledEffect, "digest"> = {
        version: 1,
        id: cue.id,
        zone: zone.id,
        kind: recipe.kind,
        bounds: structuredClone(zone.bounds),
        seed: seedOf({
          protocol: "automovie.film-effect-seed.v1",
          production: props.identity.production,
          film: props.identity.film,
          cue: cue.id,
          recipe,
          zone,
        }),
        recipe: structuredClone(recipe),
        start: frameSeconds(cue.startFrame, frameRate),
        end: frameSeconds(endFrame, frameRate),
        intensity: { from: cue.intensity, to: cue.intensity },
        fixedStepSeconds: frameRate.denominator / frameRate.numerator,
      };
      const effect: IAutoMovieCompiledEffect = {
        ...effectCore,
        digest: digestAutoMovieBytes(canonicalAutoMovieJsonBytes(effectCore)),
      };
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
    validateRuntime(runtime, props.identity);
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

const validateRuntime = (
  runtime: IAutoMovieCompiledFilmEffect,
  identity: IAutoMovieFilmEffectCurrentIdentity,
): void => {
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
  if (
    runtime.production !== identity.production ||
    runtime.film !== identity.film ||
    runtime.compileFingerprint !== identity.compileFingerprint ||
    runtime.editFingerprint !== identity.editFingerprint
  )
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-runtime-stale",
      `Film effect runtime "${runtime.effect.id}" differs from the current production, film, compile, or edit identity.`,
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

const frameSeconds = (
  frame: number,
  frameRate: IAutoMovieProductionFrameRate,
): number => (frame * frameRate.denominator) / frameRate.numerator;

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

const seedOf = (value: unknown): number =>
  Number.parseInt(
    digestAutoMovieBytes(canonicalAutoMovieJsonBytes(value)).slice(7, 20),
    16,
  );

const validDigest = (value: string): boolean =>
  /^sha256:[0-9a-f]{64}$/.test(value);

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
