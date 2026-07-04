import { sampleClip } from "@automovie/engine";
import { IAutoMovieClip } from "@automovie/interface";
import * as THREE from "three";

/**
 * Drive scene objects from a **world-space node clip** — a shot's
 * `objectMotion` (a projectile's baked flight, a prop following a bone) or its
 * `cameraMotion`. Sample the clip at `seconds` and write each node channel's
 * translation / rotation straight onto the `THREE.Object3D` that `resolve`
 * returns for that node; a node with no object (or a non-node channel) is
 * skipped.
 *
 * This is the render side of the engine's clip bakers ({@link compileLaunch},
 * `compileAttach`, `cameraMove`): the object rides its clip each frame, no rig
 * involved. Feeding a shot's `objectMotions` and `cameraMotion` through the
 * same helper keeps every demo's projectile/prop/camera on one code path.
 *
 * @author Samchon
 */
export const applyObjectMotion = (
  clip: IAutoMovieClip,
  seconds: number,
  resolve: (node: string) => THREE.Object3D | undefined,
): void => {
  for (const { channel, value } of sampleClip(clip, seconds).values()) {
    if (channel.kind !== "node") continue;
    const object = resolve(channel.node);
    if (object === undefined) continue;
    if (channel.path === "translation")
      object.position.set(value[0]!, value[1]!, value[2]!);
    else if (channel.path === "rotation")
      object.quaternion.set(value[0]!, value[1]!, value[2]!, value[3]!);
  }
};
