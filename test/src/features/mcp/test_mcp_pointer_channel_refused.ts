import {
  IAutoMovieChannel,
  IAutoMovieClip,
  IAutoMovieScene,
  IAutoMovieShot,
} from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { hasViolation, violationCount } from "../internal/predicates";

const app = new AutoMovieApplication();

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [
    {
      id: "candle",
      model: "prop-model",
      transform: IDENTITY_TRANSFORM,
      motion: null,
      pose: null,
    },
  ],
  cameras: [
    {
      id: "camera",
      transform: IDENTITY_TRANSFORM,
      fovY: 45,
      near: 0.1,
      far: 100,
    },
    {
      id: "camera-alt",
      transform: IDENTITY_TRANSFORM,
      fovY: 35,
      near: 0.1,
      far: 100,
    },
  ],
  lights: [
    {
      id: "glow",
      type: "point",
      transform: IDENTITY_TRANSFORM,
      color: { r: 1, g: 0.8, b: 0.5, a: null, hex: null },
      intensity: 1.4,
      range: 0,
    },
  ],
  space: null,
};

/** A one-track clip over `channel`, timed inside a three-second beat. */
const clip = (id: string, channel: IAutoMovieChannel): IAutoMovieClip => ({
  id,
  name: null,
  duration: 3,
  loop: false,
  tracks: [
    {
      channel,
      times: [0, 1.55, 1.65, 3],
      values:
        channel.kind === "node"
          ? [0, 0, 0, 0.5, 0, 0, 0.5, 0, 0, 1, 0, 0]
          : [1.4, 1.4, 0.04, 0.04],
      interpolation: "linear",
    },
  ],
});

const NODE_CHANNEL: IAutoMovieChannel = {
  kind: "node",
  node: "candle",
  path: "translation",
};

/** The exact channel S-03's external agent committed for the candle blowout. */
const POINTER_CHANNEL: IAutoMovieChannel = {
  kind: "pointer",
  pointer: "/lights/0/intensity",
  valueType: "scalar",
};

const shotWith = (motions: IAutoMovieClip[]): IAutoMovieShot => ({
  id: "shot:the-beat",
  name: null,
  scene: scene.id,
  camera: "camera",
  cameraMotion: null,
  performances: [],
  objectMotions: motions,
  duration: 3,
});

/**
 * A committed artifact must be honored by the pipeline or refused at validation
 * (#1339).
 *
 * S-03 authored the candle going out as an `objectMotions` track on the pointer
 * channel `/lights/0/intensity`. `validateShot` passed it clean, `commitShot`
 * wrote it to disk, and `getShot` read it back unchanged, while every applier
 * (`resolveFrame`, the viewer's `applyObjectMotion`) skips a non-node channel
 * by construction. The film never dimmed. That is a false green on the one gate
 * the guide corpus tells an agent to trust, so the artifact contract now
 * refuses a track the pipeline cannot perform, naming the supported set.
 *
 * The gate is scoped to CLIP TRACKS. A prop profile's driver channels are the
 * other user of `IAutoMovieChannel`, and the driver graph does read pointer
 * keys, so `forgeProp` must stay unaffected.
 *
 * The rule is not "pointers are wrong" but "a field admits exactly what its own
 * applier writes". A shot's `lightMotions` does carry light pointers, because
 * the engine's lighting pass writes them (#1348); every clip slot in THIS
 * scenario still refuses one, because `applyObjectMotion` still does not.
 * `test_mcp_shot_light_motions` owns the other half.
 *
 * The probes are direct in-process calls, one of them an `as`-cast payload: the
 * stdio transport adds typia's structural gate on top (it refuses an unknown
 * `kind` before the validator sees it), but the artifact contract must be total
 * on its own, because the project store re-validates stored clips on READ where
 * no transport gate exists.
 *
 * Scenarios:
 *
 * 1. Positive: a node-channel object motion validates clean and commits, so the
 *    gate does not refuse what the pipeline honors.
 * 2. Negative twin, one property away: the same clip on the pointer channel is
 *    refused with a `type` violation located at the track's own
 *    `objectMotions[0].tracks[0].channel.kind`, and the message names the
 *    supported kind rather than only rejecting.
 * 3. The refusal reaches the commit gate too, not only the read-only validator:
 *    `commitShot` leaves the slate untouched.
 * 4. Boundary, every clip-bearing slot: `cameraMotion` and a `coverage` take's
 *    `cameraMotion` carry the same gate, since a shot has three places a clip
 *    can hide and a per-slot fix is the whack-a-mole this contract exists to
 *    end.
 * 5. Boundary, an unknown discriminator: a channel whose `kind` is neither arm of
 *    the union reports the same located violation rather than passing through,
 *    so the gate is a whitelist of what the pipeline honors and not a blacklist
 *    of the one arm that was observed failing.
 * 6. Regression: a prop profile's `driven` driver still accepts a pointer source,
 *    because a driver is where a pointer channel IS resolved.
 */
export const test_mcp_pointer_channel_refused = (): void => {
  // 1. POSITIVE: the pipeline honors node channels, so they pass
  const honored = app.validateShot({
    shot: shotWith([clip("candleSlide", NODE_CHANNEL)]),
    scene,
  }).validation;
  TestValidator.equals(
    "a node-channel object motion validates clean",
    honored.success,
    true,
  );

  // 2. NEGATIVE TWIN: identical clip, channel swapped
  const refused = app.validateShot({
    shot: shotWith([clip("candleGlowFade", POINTER_CHANNEL)]),
    scene,
  }).validation;
  TestValidator.predicate(
    "a pointer track is refused at its own channel",
    hasViolation(
      refused,
      "type",
      "$input.shot.objectMotions[0].tracks[0].channel.kind",
    ),
  );
  TestValidator.predicate(
    "and the refusal names the supported kind",
    refused.success === false &&
      refused.violations.some(
        (entry) =>
          entry.expected.includes('must be "node"') &&
          entry.expected.includes("pointer"),
      ),
  );
  TestValidator.equals(
    "the pointer track is the only complaint",
    violationCount(refused),
    1,
  );

  // 3. the commit gate carries it, not only the read-only validator
  const committed = app.commitShot({
    slate: {
      script: {
        logline: "a candle goes out",
        theme: "the dark after",
        cast: [],
        beats: [
          {
            id: "the-beat",
            name: "the blowout",
            summary: "LI blows the candle out",
            durationHint: 3,
          },
        ],
      },
      scene,
      shots: [],
      beatEnds: [],
      notes: [],
      film: null,
    },
    shot: shotWith([clip("candleGlowFade", POINTER_CHANNEL)]),
  });
  TestValidator.equals(
    "commitShot refuses the same artifact",
    committed.committed,
    false,
  );
  TestValidator.equals("and persists nothing", committed.state.shots.length, 0);

  // 4. BOUNDARY: every slot a clip can occupy
  const cameraMotion = app.validateShot({
    shot: {
      ...shotWith([]),
      cameraMotion: clip("camDrift", POINTER_CHANNEL),
    },
    scene,
  }).validation;
  TestValidator.predicate(
    "a pointer cameraMotion track is refused too",
    hasViolation(
      cameraMotion,
      "type",
      "$input.shot.cameraMotion.tracks[0].channel.kind",
    ),
  );
  const coverage = app.validateShot({
    shot: {
      ...shotWith([]),
      coverage: [
        {
          camera: "camera-alt",
          cameraMotion: clip("takeDrift", POINTER_CHANNEL),
          cameraIntent: [],
        },
      ],
    },
    scene,
  }).validation;
  TestValidator.predicate(
    "a coverage take's pointer track is refused too",
    hasViolation(coverage, "type", "cameraMotion.tracks[0].channel.kind"),
  );

  // 5. BOUNDARY: an unknown discriminator is not a third accepted arm
  const unknown = app.validateShot({
    shot: shotWith([
      clip("weird", {
        kind: "material",
      } as unknown as IAutoMovieChannel),
    ]),
    scene,
  }).validation;
  TestValidator.predicate(
    "an unknown channel kind reports at the same path",
    hasViolation(
      unknown,
      "type",
      "$input.shot.objectMotions[0].tracks[0].channel.kind",
    ),
  );

  // 6. REGRESSION: a driver's pointer source is a different question
  const driven = app.forgeProp({
    spec: {
      node: "lever",
      model: {
        id: "lever",
        name: null,
        origin: "generated",
        skeleton: null,
        body: null,
        materials: [],
        parts: [
          {
            id: "arm",
            name: null,
            geometry: {
              type: "primitive",
              shape: { type: "box", width: 0.1, height: 0.4, depth: 0.1 },
            },
            material: null,
            attachedBone: null,
            transform: null,
          },
        ],
        asset: null,
      },
      articulation: null,
    },
  }).forged;
  TestValidator.equals(
    "a rigid prop still forges (the driver path is untouched)",
    driven.success,
    true,
  );
};
