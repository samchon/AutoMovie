import {
  IAutoMovieBone,
  IAutoMovieJointConstraint,
  IAutoMovieScene,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpGeometryContext,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const app = new AutoMovieApplication();

const restAt = (x: number, y: number, z: number): IAutoMovieBone["rest"] => ({
  ...IDENTITY_TRANSFORM,
  translation: { x, y, z },
});

/** Every axis wide open: the joint never decides the verdict. */
const FREE: IAutoMovieJointConstraint = {
  flexion: { min: -180, max: 180 },
  abduction: { min: -180, max: 180 },
  twist: { min: -180, max: 180 },
};

/**
 * A pure hinge: `flexion` as wide as {@link FREE}, `abduction` and `twist`
 * IMMOBILE. This is the elbow's real shape and the shape S-02's rig had; a
 * non-zero value on a `null` axis is a hard `rom` error, not a range miss.
 */
const HINGE: IAutoMovieJointConstraint = {
  flexion: { min: -180, max: 180 },
  abduction: null,
  twist: null,
};

const bone = (
  name: IAutoMovieBone["bone"],
  parent: IAutoMovieBone["parent"],
  rest: IAutoMovieBone["rest"],
  constraint: IAutoMovieJointConstraint | null = FREE,
): IAutoMovieBone => ({ bone: name, parent, rest, constraint });

/**
 * A left arm chain in the canonical T-pose, every joint unconstrained except
 * the elbow, whose constraint the caller chooses. Two rigs built from this
 * differ by exactly one property, which is what makes the negative twin a
 * twin.
 */
const armRig = (elbow: IAutoMovieJointConstraint): IAutoMovieSkeleton => ({
  id: "reach-rig",
  bones: [
    bone("hips", null, restAt(0, 1, 0)),
    bone("chest", "hips", restAt(0, 0.4, 0)),
    bone("leftUpperArm", "chest", restAt(0.2, 0, 0)),
    bone("leftLowerArm", "leftUpperArm", restAt(0.3, 0, 0), elbow),
    bone("leftHand", "leftLowerArm", restAt(0.25, 0, 0)),
  ],
});

/** A rig with no arm chain at all: reach cannot be measured. */
const armlessRig = (): IAutoMovieSkeleton => ({
  id: "reach-rig",
  bones: [bone("hips", null, restAt(0, 1, 0))],
});

const scene: IAutoMovieScene = {
  id: "scene-reach",
  name: null,
  nodes: [
    {
      id: "actor",
      model: "actor-model",
      transform: IDENTITY_TRANSFORM,
      motion: null,
      pose: null,
    },
  ],
  cameras: [],
  lights: [],
  space: null,
};

const contextFor = (
  skeleton: IAutoMovieSkeleton,
): IAutoMovieMcpGeometryContext => ({
  scene,
  models: [{ id: "actor-model", skeleton }],
  motions: {},
});

const reachOf = (skeleton: IAutoMovieSkeleton, point: IAutoMovieVector3) =>
  app.getReach({
    context: contextFor(skeleton),
    actor: "actor",
    target: { kind: "point", point },
  }).reach;

/**
 * `getReach` must run the gate its consumer runs, and say only what it can
 * establish (#1338).
 *
 * The oracle used to answer `reachable: true` on distance alone, so an author
 * following the surface's own "measure, then stage" doctrine staged against a
 * pose `perform` then refused with `error`-severity ROM violations, after the
 * staging and blocking the measurement existed to protect. The report now
 * carries the ROM verdict as its own per-arm answer: `reachable` stays the
 * distance question, `poseWithinRom` says whether the returned pose survives
 * the rig, and `romViolations` names the axes that break it.
 *
 * The verdict is scoped to the POSE, not to the arm, and that scope is load
 * bearing. The engine has one analytic two-bone solve; a candidate that breaks
 * ROM is not proof that no valid pose exists. Folding it into `reachable` was
 * tried and reverted: on the canonical humanoid the solve produces a
 * ROM-breaking pose for nearly every target, so the field went permanently
 * false and the tool became useless, which is a worse failure than the one
 * being fixed and asserts an impossibility the engine never established.
 *
 * Scenarios:
 *
 * 1. A hinge elbow with a target INSIDE the reach shell whose analytic solve needs
 *    off-hinge articulation: `reachable` stays true (the arm is long enough),
 *    `poseWithinRom` is false, and `romViolations` names the immobile axes at
 *    the same `$input.joints[i]` paths the perform gate reports, at `error`
 *    severity.
 * 2. Negative twin, one property away: the same rig with the elbow's axes opened
 *    reports `poseWithinRom: true` with no violations, so the ROM answer does
 *    not over-refuse. Every distance is bit-identical across the pair, proving
 *    the constraint alone flipped the verdict and the geometry did not move.
 * 3. Boundary, out of shell: a target past the arm's span keeps its positive
 *    `gap`, reports `reachable: false`, and still returns the documented
 *    "extends toward it" pose.
 * 4. Boundary, degenerate solve: a target ON the shoulder has no two-bone
 *    solution, so `pose` is null. Nothing can be claimed about a pose that does
 *    not exist, so `poseWithinRom` is false with an empty `romViolations`,
 *    while `reachable` still answers the distance question it can answer.
 * 5. Boundary, nothing to measure: an armless rig still answers `reach: null` with
 *    the unmeasurable reason rather than a confident geometric verdict.
 * 6. The distance verdict propagates to the top-level `reachable`.
 */
export const test_mcp_reach_rom_oracle = (): void => {
  // 1. inside the shell, outside the ROM
  const target: IAutoMovieVector3 = { x: 0.3, y: 1.2, z: 0.25 };
  const hinged = reachOf(armRig(HINGE), target);
  TestValidator.predicate(
    "a hinge elbow reports the target inside its shell",
    hinged !== null && hinged.left !== null && hinged.left.reachable,
  );
  TestValidator.predicate(
    "and refuses the POSE, naming the immobile axes",
    hinged !== null &&
      hinged.left !== null &&
      hinged.left.poseWithinRom === false &&
      hinged.left.pose !== null &&
      hinged.left.romViolations.length > 0 &&
      hinged.left.romViolations.every(
        (entry) =>
          entry.kind === "rom" &&
          entry.severity === "error" &&
          entry.path.startsWith("$input.joints["),
      ) &&
      hinged.left.romViolations.some((entry) =>
        entry.expected.includes("does not move in"),
      ),
  );
  // 6. the top-level field answers the distance question, and says so
  TestValidator.equals(
    "the report's reachable is the distance verdict, not the ROM one",
    hinged?.reachable,
    true,
  );

  // 2. NEGATIVE TWIN: same geometry, same target, elbow opened up
  const free = reachOf(armRig(FREE), target);
  TestValidator.predicate(
    "an unconstrained elbow holds the identical target's pose cleanly",
    free !== null &&
      free.left !== null &&
      free.left.reachable &&
      free.left.poseWithinRom &&
      free.left.romViolations.length === 0 &&
      free.reachable,
  );
  TestValidator.predicate(
    "the pair differs only in ROM: every distance is identical",
    hinged !== null &&
      free !== null &&
      hinged.left !== null &&
      free.left !== null &&
      nclose(hinged.left.targetDistance, free.left.targetDistance, 0) &&
      nclose(hinged.left.maximumDistance, free.left.maximumDistance, 0) &&
      nclose(hinged.left.gap, free.left.gap, 0),
  );

  // 3. BOUNDARY: past the shell
  const far = reachOf(armRig(FREE), { x: 9, y: 1.4, z: 0 });
  TestValidator.predicate(
    "a target past the span keeps its gap, its extended pose, and refuses",
    far !== null &&
      far.left !== null &&
      far.left.gap > 0 &&
      far.left.reachable === false &&
      far.left.pose !== null,
  );

  // 4. BOUNDARY: the degenerate solve, a target on the shoulder itself
  const shoulder = reachOf(armRig(FREE), { x: 0.2, y: 1.4, z: 0 });
  TestValidator.predicate(
    "a target on the shoulder has no solve, so nothing is claimed about one",
    shoulder !== null &&
      shoulder.left !== null &&
      shoulder.left.pose === null &&
      shoulder.left.reachable &&
      shoulder.left.poseWithinRom === false &&
      shoulder.left.romViolations.length === 0,
  );

  // 5. BOUNDARY: nothing to measure
  const armless = app.getReach({
    context: contextFor(armlessRig()),
    actor: "actor",
    target: { kind: "point", point: target },
  });
  TestValidator.predicate(
    "an armless rig stays unmeasurable rather than unreachable",
    armless.reach === null &&
      (armless.reason ?? "").includes("no measurable arm chain"),
  );
};
