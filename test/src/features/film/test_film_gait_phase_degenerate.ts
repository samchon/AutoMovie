import { resolveBeatEnd } from "@automovie/engine";
import {
  IAutoMovieGaitCycle,
  IAutoMovieMotion,
  IAutoMovieScene,
  IAutoMovieShot,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  IDENTITY_TRANSFORM,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const withCycle = (gaitCycle: IAutoMovieGaitCycle): IAutoMovieMotion => ({
  ...makeMotion(
    [
      keyframe(0, makePose([joint("leftUpperLeg", { flexion: 0 })])),
      keyframe(1, makePose([joint("leftUpperLeg", { flexion: 20 })])),
    ],
    1,
  ),
  id: "clip",
  gaitCycle,
});

const scene: IAutoMovieScene = {
  id: "scene",
  name: null,
  nodes: [
    {
      id: "hero",
      model: "hero",
      transform: IDENTITY_TRANSFORM,
      motion: null,
      pose: null,
    },
  ],
  cameras: [],
  lights: [],
};

const shot: IAutoMovieShot = {
  id: "shot:beat-1",
  name: null,
  scene: "scene",
  camera: "cam",
  cameraMotion: null,
  performances: [{ node: "hero", motion: "clip", startOffset: 0 }],
  objectMotions: [],
  duration: 0.5,
};

const phaseOf = (gaitCycle: IAutoMovieGaitCycle): number | null =>
  resolveBeatEnd({
    beat: "beat-1",
    scene,
    shot,
    motions: [withCycle(gaitCycle)],
  }).actors.find((a) => a.node === "hero")!.gaitPhase;

/**
 * A carried gait cycle is authoritative for the beat-end stride phase — and its
 * degenerate forms answer null (matching the degenerate-duration rule of the
 * legacy loop path), never NaN or a bogus phase.
 *
 * Scenarios:
 *
 * 1. A valid carried cycle wins over `loop: false`: phase = (phaseAt + t) mod
 *    period, normalized into [0, period) — (0.7 + 0.5) mod 0.8 = 0.4.
 * 2. A zero, negative, or non-finite period answers null.
 * 3. A non-finite phaseAt answers null.
 */
export const test_film_gait_phase_degenerate = (): void => {
  const phase = phaseOf({ period: 0.8, phaseAt: 0.7 });
  TestValidator.predicate(
    "valid cycle: (0.7 + 0.5) mod 0.8 = 0.4",
    phase !== null && nclose(phase, 0.4),
  );

  TestValidator.equals(
    "zero period answers null",
    phaseOf({ period: 0, phaseAt: 0 }),
    null,
  );
  TestValidator.equals(
    "negative period answers null",
    phaseOf({ period: -1, phaseAt: 0 }),
    null,
  );
  TestValidator.equals(
    "non-finite period answers null",
    phaseOf({ period: Number.POSITIVE_INFINITY, phaseAt: 0 }),
    null,
  );
  TestValidator.equals(
    "non-finite phaseAt answers null",
    phaseOf({ period: 1, phaseAt: Number.NaN }),
    null,
  );
};
