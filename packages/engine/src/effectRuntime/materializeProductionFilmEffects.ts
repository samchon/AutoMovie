import {
  IAutoMovieCompiledFilmEffect,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionFrameRate,
  IAutoMovieWorldDesign,
} from "@automovie/interface";

import { productionFrameBoundaryToSeconds } from "../film/productionTimebase";
import { autoMovieRenderDigest } from "../render/renderDigest";
import { canonicalizeAutoMovieJson } from "../text/canonicalizeAutoMovieJson";
import { AutoMovieFilmEffectRuntimeError } from "./AutoMovieFilmEffectRuntimeError";
import { IAutoMovieFilmEffectCurrentIdentity } from "./IAutoMovieFilmEffectCurrentIdentity";
import { IAutoMovieShotEffectFilmInterval } from "./IAutoMovieShotEffectFilmInterval";
import { materializeCompiledEffects } from "./materializeCompiledEffects";
import { productionFilmEffectFrameRate } from "./productionFilmEffectFrameRate";
import { sortProductionFilmEffectCues } from "./sortProductionFilmEffectCues";
import { validateProductionFilmEffectIdentity } from "./validateProductionFilmEffectIdentity";

/**
 * Materialize normalized film cues into current, deterministic effect streams.
 *
 * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Makes an accepted film cue observable through the existing bounded runtime.
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-seek-reconstruction Derives every stream from current content identities rather than playback history.
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-platform-determinism Fixes iteration order and canonical serialization of the materialized runtime so a platform difference surfaces as an identity change rather than silent drift.
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
  validateProductionFilmEffectIdentity(props.identity);
  const frameRate = productionFilmEffectFrameRate(
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
  return sortProductionFilmEffectCues(props.effects).map(
    (cue): IAutoMovieCompiledFilmEffect => {
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
      // One validated cue materializes exactly one effect: the zone was resolved
      // and the recipe admitted above, so the engine has nothing left to refuse.
      const effect = materializeCompiledEffects({
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
            start: productionFrameBoundaryToSeconds({
              frame: cue.startFrame,
              frameRate,
            }),
            end: productionFrameBoundaryToSeconds({
              frame: endFrame,
              frameRate,
            }),
            intensity: { from: cue.intensity, to: cue.intensity },
          },
        ],
      })[0]!;
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
        digest: autoMovieRenderDigest(canonicalizeAutoMovieJson(core)),
      };
    },
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
