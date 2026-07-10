import {
  IAutoMovieJointAxes,
  IAutoMovieRestFrame,
  resolvePose,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMoviePose,
  IAutoMovieSkeleton,
} from "@automovie/interface";

import { IAutoMovieModelObject, applyTransform } from "./buildModel";

/**
 * Apply a {@link IAutoMoviePose} to a built model by running the engine's
 * forward kinematics and writing each bone's local rotation onto the
 * corresponding `THREE.Bone`. The pose's root transform (if any) is applied to
 * the model root.
 *
 * The engine owns the math (semantic angles → quaternions), so the viewer only
 * copies results onto `three.js` objects — keeping rendering a thin, swappable
 * layer over the deterministic core.
 *
 * `restFrames` optionally reads each joint angle as **clinical** and maps it
 * into the rig's rest-relative space before articulating (e.g. abduction 180
 * raises either arm overhead regardless of side); omit it to treat the pose's
 * angles as raw rig-space, the historical behaviour.
 *
 * Returns the skeleton bones the FK resolved but the model's bone map does not
 * carry (#1051). A deliberately partial imported map (a VRM without toes)
 * reports its unmapped bones every call — the host compares against what it
 * MEANT to map, so a typo in the bone map is distinguishable from an
 * intentional gap instead of both silently not articulating.
 *
 * @author Samchon
 */
export const applyPose = (
  target: IAutoMovieModelObject,
  pose: IAutoMoviePose,
  skeleton: IAutoMovieSkeleton,
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>,
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>,
): AutoMovieHumanoidBone[] => {
  const skipped: AutoMovieHumanoidBone[] = [];
  for (const r of resolvePose(pose, skeleton, jointAxes, restFrames)) {
    const bone = target.bones.get(r.bone);
    if (bone === undefined) {
      skipped.push(r.bone);
      continue;
    }
    bone.quaternion.set(
      r.localRotation.x,
      r.localRotation.y,
      r.localRotation.z,
      r.localRotation.w,
    );
  }
  // A null root means "at the node's staged base" — the engine's convention
  // (`resolvePose`/`animatedBaseAt` default it to identity, #1046). Keeping
  // the previous pose's root here would strand the model at the LAST rooted
  // pose (e.g. a walk's destination) when a gesture clip with null roots
  // takes over.
  applyTransform(target.object, pose.root ?? IDENTITY_ROOT);
  return skipped;
};

const IDENTITY_ROOT = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};
