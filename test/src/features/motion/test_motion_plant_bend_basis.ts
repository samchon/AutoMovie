import {
  IAutoMoviePlantChain,
  fitChainToTarget,
  indexSkeletonTopology,
  resolvePose,
} from "@automovie/engine";
import {
  IAutoMovieJointConstraint,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

const transform = (translation: IAutoMovieVector3): IAutoMovieTransform => ({
  translation,
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const BALL: IAutoMovieJointConstraint = {
  flexion: { min: -180, max: 180 },
  abduction: { min: -180, max: 180 },
  twist: { min: -180, max: 180 },
  swingDeg: 180,
};
const HINGE: IAutoMovieJointConstraint = {
  flexion: { min: -180, max: 180 },
  abduction: null,
  twist: null,
};
const CHAIN: IAutoMoviePlantChain = {
  effector: "leftFoot",
  upper: "leftUpperLeg",
  lower: "leftLowerLeg",
};

const skeleton = (
  id: string,
  lower: IAutoMovieVector3,
  foot: IAutoMovieVector3,
): IAutoMovieSkeleton => ({
  id,
  bones: [
    {
      bone: "hips",
      parent: null,
      rest: transform({ x: 0, y: 0, z: 0 }),
      constraint: null,
    },
    {
      bone: "leftUpperLeg",
      parent: "hips",
      rest: transform({ x: 0, y: 0, z: 0 }),
      constraint: BALL,
    },
    {
      bone: "leftLowerLeg",
      parent: "leftUpperLeg",
      rest: transform(lower),
      constraint: HINGE,
    },
    {
      bone: "leftFoot",
      parent: "leftLowerLeg",
      rest: transform(foot),
      constraint: null,
    },
  ],
});

const distance = (a: IAutoMovieVector3, b: IAutoMovieVector3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * Bend-basis construction remains finite when the declared hinge is parallel to
 * the reach axis, including the vertical case where the world-down fallback is
 * parallel too.
 *
 * The first rig reaches along +X with the default +X lower flexion axis, taking
 * the first orthogonal fallback. The second reaches down with a custom
 * world-down flexion axis, taking both fallbacks before +Z supplies the basis.
 * Its mirrored/non-neutral rest frame also proves the selected clinical angles
 * round-trip through the same rig tables used by FK. In both cases ROM clamping
 * may make the pin imperfect, but the search must stay finite and never make
 * the authored residual worse.
 */
export const test_motion_plant_bend_basis = (): void => {
  const cases = [
    {
      skeleton: skeleton(
        "parallel-horizontal",
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ),
      target: { x: 1, y: 0, z: 0 },
      jointAxes: undefined,
      restFrames: undefined,
    },
    {
      skeleton: skeleton(
        "parallel-vertical",
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ),
      target: { x: 0, y: -1, z: 0 },
      jointAxes: {
        leftLowerLeg: {
          flexion: { x: 0, y: -1, z: 0 },
          abduction: { x: 0, y: 0, z: 1 },
          twist: { x: -1, y: 0, z: 0 },
        },
      },
      restFrames: {
        leftLowerLeg: { flexion: { sign: -1 as const, neutral: 20 } },
      },
    },
  ] as const;

  for (const entry of cases) {
    const pose: IAutoMoviePose = {
      skeleton: entry.skeleton.id,
      root: transform({ x: 0, y: 0, z: 0 }),
      joints: [],
    };
    const topology = indexSkeletonTopology(entry.skeleton);
    const position = (candidate: IAutoMoviePose): IAutoMovieVector3 =>
      resolvePose(
        candidate,
        entry.skeleton,
        entry.jointAxes,
        entry.restFrames,
        topology,
      ).find((bone) => bone.bone === CHAIN.effector)!.worldPosition;
    const before = distance(position(pose), entry.target);
    const fitted = fitChainToTarget({
      skeleton: entry.skeleton,
      pose,
      chain: CHAIN,
      target: entry.target,
      topology,
      jointAxes: entry.jointAxes,
      restFrames: entry.restFrames,
    });
    const afterPosition = position(fitted);
    const after = distance(afterPosition, entry.target);
    TestValidator.predicate(
      `${entry.skeleton.id} bend basis stays finite and non-destructive`,
      Number.isFinite(afterPosition.x) &&
        Number.isFinite(afterPosition.y) &&
        Number.isFinite(afterPosition.z) &&
        after <= before + 1e-9,
    );
  }
};
