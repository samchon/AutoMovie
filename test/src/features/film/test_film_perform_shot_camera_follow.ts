import { performShot, stageScene } from "@autofilm/engine";
import { IAutoFilmCameraAction } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { joint, keyframe, makeMotion, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const followFrame: IAutoFilmCameraAction = {
  verb: "frame",
  actor: "cam-main",
  start: 0,
  duration: "auto",
  framing: "medium",
  move: "follow",
  on: { kind: "node", node: "knightA" },
};

const performance = (frame: IAutoFilmCameraAction) =>
  makePerformanceWrite({
    draft: [
      {
        verb: "gesture",
        actor: "knightA",
        start: 0,
        duration: 1,
        kind: "wave",
      },
      frame,
    ],
    revise: { review: "unchanged.", final: null },
  });

/**
 * Pins the follow seam between the shot compiler and the camera grammar: the
 * subject's animated base is its placement plus the compiled clip's root
 * displacement, so a follow move tracks a traveling actor — and every fallback
 * (rootless clip, motionless subject, point subject) stays total.
 *
 * Scenarios:
 *
 * 1. KnightA's synthesized clip carries a root translation marching 1 m down +X; a
 *    `follow` frame (skeleton lookup null → default subject height) → the
 *    camera's first→last translation keys differ by ≈ 1 m in X (the bearing
 *    offset cancels in the difference).
 * 2. The same follow over a rootless clip (the shared synthesizer poses only an
 *    elbow) → the animated base never moves, so first and last keys coincide.
 * 3. A `static` frame on a point target (no node, no motion, default height) → a
 *    single-key locked camera clip.
 */
export const test_film_perform_shot_camera_follow = (): void => {
  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");

  const marching = performShot({
    script: makeScriptWrite(),
    staged,
    performance: performance(followFrame),
    synthesize: () =>
      makeMotion(
        [
          keyframe(
            0,
            makePose([joint("leftLowerArm", { flexion: 10 })], {
              translation: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            }),
          ),
          keyframe(
            1,
            makePose([joint("leftLowerArm", { flexion: 20 })], {
              translation: { x: 1, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            }),
          ),
        ],
        1,
      ),
    skeleton: () => null,
  });
  TestValidator.equals("marching succeeds", marching.success, true);
  if (marching.success !== true) return;
  const track = marching.shot.cameraMotion!.tracks[0]!;
  const first = track.values[0]!;
  const last = track.values[track.values.length - 3]!;
  TestValidator.predicate(
    "camera followed the root displacement",
    nclose(last - first, 1, 1e-6),
  );

  const rootless = performShot({
    script: makeScriptWrite(),
    staged,
    performance: performance(followFrame),
    synthesize: validSynthesizer,
    skeleton: () => null,
  });
  TestValidator.equals("rootless succeeds", rootless.success, true);
  if (rootless.success === true) {
    const t = rootless.shot.cameraMotion!.tracks[0]!;
    TestValidator.predicate(
      "rootless follow holds position",
      nclose(t.values[0]!, t.values[t.values.length - 3]!, 1e-9),
    );
  }

  const pointed = performShot({
    script: makeScriptWrite(),
    staged,
    performance: performance({
      ...followFrame,
      move: "static",
      on: { kind: "point", point: { x: 0, y: 0, z: 0.35 } },
    }),
    synthesize: validSynthesizer,
    skeleton: () => null,
  });
  TestValidator.equals("pointed succeeds", pointed.success, true);
  if (pointed.success === true)
    TestValidator.equals(
      "point subject locks a single key",
      pointed.shot.cameraMotion!.tracks[0]!.times.length,
      1,
    );
};
