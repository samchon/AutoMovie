import { createPortraitEyeComponent } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";
import {
  portraitEyelashEyeFixture,
  portraitEyelashFixture,
  portraitEyelashRingCenter,
} from "../internal/portraitEyelashFixture";
import { vclose } from "../internal/predicates";

/**
 * Opening from a partly closed observation reverses lash transport; gaze is
 * not a substitute for lid motion.
 *
 * Scenarios:
 * 1. Matching observed/current closure with a nonzero gaze leaves the authored
 *    straight lash anterior, at its final attached root.
 * 2. Reopening the same observation turns the lash upwards and keeps its root
 *    distinct from the reference root; the other eye is not constructed here.
 */
export const test_subject_lash_reopen = (): void => {
  const source = coarseHumanFaceFixture("lash-reopen");
  const build = (blink: number) => {
    const result = portraitEyelashEyeFixture(
      createPortraitEyeComponent(
        source.basis.bindings.eyes.left,
        {
          ...source.basis.recipe.eye,
          upperLashProfile: portraitEyelashFixture(),
        },
        { blink, observedBlink: 0.4, yaw: 10, pitch: 5 },
      ),
      source.basis.host,
    );
    const geometry = result.parts.find(
      (part) => part.id === "left-upper-lash-0",
    )!.geometry;
    if (geometry.type !== "mesh") throw new Error("Expected a lash mesh.");
    return {
      root: portraitEyelashRingCenter(geometry.mesh, 0),
      tip: portraitEyelashRingCenter(geometry.mesh, 12),
    };
  };
  const observed = build(0.4),
    open = build(0);
  TestValidator.predicate(
    "gaze does not transport the lash",
    vclose(
      observed.tip,
      { ...observed.root, z: observed.root.z + 0.008 },
      1e-10,
    ),
  );
  TestValidator.predicate(
    "opening turns upwards",
    open.tip.y > open.root.y + 0.0001,
  );
  TestValidator.predicate(
    "root follows the opening",
    open.root.y > observed.root.y,
  );
};
