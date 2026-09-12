import {
  AutoMovieFilmEffectRuntimeError,
  type IAutoMovieFilmEffectCurrentIdentity,
  canonicalizeAutoMovieJson,
  materializeProductionFilmEffects,
  productionFilmEffectEditFingerprint,
} from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  IAutoMovieCompiledFilmEffect,
  IAutoMovieEffectRecipe,
  IAutoMovieFilmTimeline,
  IAutoMovieWorldDesign,
  IAutoMovieWorldEffectZone,
} from "@automovie/interface";
import { createHash } from "node:crypto";

/** A bounded fog recipe every film-effect scenario activates. */
export const filmEffectRecipe = (
  id = "fog-recipe",
): IAutoMovieEffectRecipe => ({
  id,
  kind: "fog",
  seed: 7,
  emission: { rate: 10, burst: 2, duration: 5 },
  particle: {
    lifetime: { min: 1, max: 2 },
    size: { min: 0.1, max: 0.2 },
    color: "#aabbcc",
    opacity: { min: 0.2, max: 0.6 },
  },
  motion: { wind: { x: 0.1, y: 0, z: 0 }, rise: 0.05, turbulence: 0.01 },
  budget: { maxParticles: 64, lodDistance: 30 },
  blend: "alpha",
});

/** One world effect zone using the fog recipe unless told otherwise. */
export const filmEffectZone = (
  id: string,
  recipe = "fog-recipe",
  seed = 3,
): IAutoMovieWorldEffectZone => ({
  id,
  recipe,
  bounds: { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 1, z: 1 } },
  seed,
});

/** A world with one recipe and the `yard` and `gate` zones. */
export const filmEffectWorld = (): IAutoMovieWorldDesign => ({
  id: "world",
  units: "meter",
  landmarks: [],
  surfaces: [],
  routes: [],
  effectRecipes: [filmEffectRecipe()],
  effectZones: [
    filmEffectZone("yard"),
    filmEffectZone("gate", "fog-recipe", 5),
  ],
});

/** One normalized film effect cue. */
export const filmEffectCue = (
  partial: Partial<IAutoMovieFilmTimeline["tracks"]["effects"][number]> = {},
): IAutoMovieFilmTimeline["tracks"]["effects"][number] => ({
  id: "mist",
  recipe: "world-zone",
  zone: "yard",
  startFrame: 12,
  durationFrames: 12,
  intensity: 0.5,
  ...partial,
});

/**
 * A 48-frame film at 24 fps whose default effect track holds `mist` on `yard`
 * for frames 12..24 and `haze` on `gate` for frames 0..6, authored out of
 * canonical order.
 */
export const filmEffectTimeline = (
  effects: IAutoMovieFilmTimeline["tracks"]["effects"] = [
    filmEffectCue(),
    filmEffectCue({
      id: "haze",
      zone: "gate",
      startFrame: 0,
      durationFrames: 6,
      intensity: 1,
    }),
  ],
): IAutoMovieFilmTimeline => ({
  version: 1,
  builder: "test",
  inputFingerprint: `sha256:${"c".repeat(64)}`,
  sourceDigest: `sha256:${"d".repeat(64)}`,
  id: "film",
  fps: 24,
  totalFrames: 48,
  segments: [
    {
      shot: "shot",
      sourceInFrame: 0,
      sourceOutFrame: 48,
      startFrame: 0,
      endFrame: 48,
      headHandleFrames: 0,
      tailHandleFrames: 0,
      transitionIn: { kind: "cut" },
      transitionOut: { kind: "cut" },
    },
  ],
  omissions: [],
  tracks: { audio: [], captions: [], effects },
});

/** The current identity a consumer establishes from a timeline. */
export const filmEffectIdentity = (
  timeline: IAutoMovieFilmTimeline,
): IAutoMovieFilmEffectCurrentIdentity => ({
  production: "production",
  film: timeline.id,
  compileFingerprint: timeline.inputFingerprint,
  editFingerprint: productionFilmEffectEditFingerprint(timeline),
});

/** The builder's current runtime population for a timeline. */
export const materializedFilmEffects = (
  timeline: IAutoMovieFilmTimeline,
): IAutoMovieCompiledFilmEffect[] =>
  materializeProductionFilmEffects({
    identity: filmEffectIdentity(timeline),
    frameRate: 24,
    world: filmEffectWorld(),
    effects: timeline.tracks.effects,
  });

/** SHA-256 through `node:crypto` over canonical JSON v2 UTF-8 bytes. */
export const nodeCanonicalDigest = (value: unknown): AutoMovieContentDigest =>
  `sha256:${createHash("sha256")
    .update(Buffer.from(canonicalizeAutoMovieJson(value), "utf8"))
    .digest("hex")}`;

/**
 * Mutate a copy of a runtime and recompute both digests, so the mutation is
 * observed by the check that owns that field rather than by the digest check.
 */
export const resealFilmEffect = (
  runtime: IAutoMovieCompiledFilmEffect,
  mutate: (draft: IAutoMovieCompiledFilmEffect) => void,
): IAutoMovieCompiledFilmEffect => {
  const draft = structuredClone(runtime);
  mutate(draft);
  draft.effect.digest = nodeCanonicalDigest({
    ...draft.effect,
    digest: undefined,
  });
  draft.digest = nodeCanonicalDigest({ ...draft, digest: undefined });
  return draft;
};

/** The closed refusal code a task throws, or `accepted`. */
export const filmEffectRefusal = (task: () => unknown): string => {
  try {
    task();
    return "accepted";
  } catch (error) {
    return error instanceof AutoMovieFilmEffectRuntimeError
      ? error.code
      : `unexpected: ${String(error)}`;
  }
};
