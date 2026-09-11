import {
  AutoMovieContentDigest,
  IAutoMovieFilmTimeline,
} from "@automovie/interface";

import { autoMovieRenderDigest } from "../render/renderDigest";
import { canonicalizeAutoMovieJson } from "../text/canonicalizeAutoMovieJson";

/**
 * Identify the normalized edit state shared by planning and film effects.
 *
 * The digest is SHA-256 over the UTF-8 bytes of the protocol-tagged canonical
 * JSON v2 edit. The engine computes it without a Node built-in, and the bytes
 * and digest equal what the Node builder path produces for the same edit, so a
 * browser viewer and the render planner compare one identity.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-seek-reconstruction Binds persisted film effects to the exact current normalized edit.
 * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-canonical-fingerprint Gives the same edit one fingerprint in the browser viewer and the Node builder through one canonical text and one byte encoding.
 * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-current-stale Changes whenever the edit's clock, segments, omissions or tracks change, so a runtime or plan from another edit is stale.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#arbitrary-seek-reconstruction-contract Gives builder materialization and render planning one edit-identity algorithm.
 * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-sound-story-lifecycle-identity Folds the production, film and edit revision into each effect runtime's identity so an effect is addressed by its production lifecycle.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Folds the selected edit revision into the identity closure through canonical serialization.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-target-fingerprint-protocol Includes the edit protocol revision in the fingerprint input instead of relying on object spelling.
 */
export const productionFilmEffectEditFingerprint = (
  timeline: IAutoMovieFilmTimeline,
): AutoMovieContentDigest =>
  autoMovieRenderDigest(
    canonicalizeAutoMovieJson({
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
