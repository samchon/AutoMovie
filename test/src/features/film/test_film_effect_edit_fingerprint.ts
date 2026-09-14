import { productionFilmEffectEditFingerprint } from "@automovie/engine";
import type { IAutoMovieFilmTimeline } from "@automovie/interface";
import {
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";

import { filmEffectCue, filmEffectTimeline } from "./filmEffectRuntimeFixtures";

/**
 * The film edit fingerprint is one identity in the browser and in Node.
 *
 * The viewer compares this fingerprint against the one the builder persisted,
 * so a byte or hash difference between the engine's pure path and the Node
 * builder path would refuse every current film. Expectations come from the
 * edit protocol itself: its canonical text written by hand for a minimal edit,
 * `node:crypto` over those bytes, and the Node production digest over the
 * protocol's declared fields.
 *
 * Scenarios:
 *
 * 1. A minimal edit's fingerprint equals `node:crypto` over its hand-written
 *    canonical protocol text and the Node production digest of the protocol
 *    object.
 * 2. A full edit with a segment and two effect cues gets one fingerprint from
 *    the engine and from the Node production digest.
 * 3. The compile input, source digest and builder are outside the edit and
 *    leave the fingerprint unchanged, while total frames, a segment source
 *    frame, a cue intensity, or an explicit frame rate each change it.
 */
export const test_film_effect_edit_fingerprint = (): void => {
  const nodeProtocolDigest = (
    timeline: IAutoMovieFilmTimeline,
  ): `sha256:${string}` =>
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
  const minimal: IAutoMovieFilmTimeline = {
    ...filmEffectTimeline([]),
    id: "f",
    totalFrames: 1,
    segments: [],
  };
  const text =
    '{"fps":24,"id":"f","omissions":[],"protocol":"automovie.production-render-edit.v2","segments":[],"totalFrames":1,"tracks":{"audio":[],"captions":[],"effects":[]}}';
  TestValidator.equals(
    "a minimal edit hashes its hand-written canonical protocol text",
    [productionFilmEffectEditFingerprint(minimal), nodeProtocolDigest(minimal)],
    [
      `sha256:${createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex")}`,
      `sha256:${createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex")}`,
    ],
  );

  const base = filmEffectTimeline();
  const fingerprint = productionFilmEffectEditFingerprint(base);
  TestValidator.equals(
    "a full edit has one fingerprint through the engine and through Node",
    fingerprint,
    nodeProtocolDigest(base),
  );
  TestValidator.equals(
    "only edit fields move the fingerprint",
    {
      compileInput:
        productionFilmEffectEditFingerprint({
          ...base,
          inputFingerprint: `sha256:${"e".repeat(64)}`,
        }) === fingerprint,
      sourceDigest:
        productionFilmEffectEditFingerprint({
          ...base,
          sourceDigest: `sha256:${"e".repeat(64)}`,
        }) === fingerprint,
      builder:
        productionFilmEffectEditFingerprint({ ...base, builder: "other" }) ===
        fingerprint,
      totalFrames:
        productionFilmEffectEditFingerprint({ ...base, totalFrames: 49 }) ===
        fingerprint,
      sourceFrame:
        productionFilmEffectEditFingerprint({
          ...base,
          segments: [{ ...base.segments[0]!, sourceInFrame: 1 }],
        }) === fingerprint,
      intensity:
        productionFilmEffectEditFingerprint({
          ...base,
          tracks: {
            ...base.tracks,
            effects: [
              filmEffectCue({ intensity: 0.25 }),
              base.tracks.effects[1]!,
            ],
          },
        }) === fingerprint,
      frameRate:
        productionFilmEffectEditFingerprint({
          ...base,
          frameRate: { numerator: 24, denominator: 1 },
        }) === fingerprint,
    },
    {
      compileInput: true,
      sourceDigest: true,
      builder: true,
      totalFrames: false,
      sourceFrame: false,
      intensity: false,
      frameRate: false,
    },
  );
};
