import { sampleClip } from "@automovie/engine";
import { IAutoMovieClip } from "@automovie/interface";
import * as THREE from "three";

/**
 * Drive scene objects from a **world-space node clip**: a shot's `objectMotion`
 * (a projectile's baked flight, a prop following a bone) or its `cameraMotion`.
 * Sample the clip at `seconds` and write each node channel's translation /
 * rotation / scale straight onto the `THREE.Object3D` that `resolve` returns
 * for that node; a node with no object (or a non-node channel) is skipped. A
 * light change is not a node channel and never arrives here: it rides the
 * shot's `lightMotions` through {@link applyLightMotion}, and the artifact gate
 * refuses a pointer track on a transform clip so the two cannot be confused.
 *
 * This is the render side of the engine's clip bakers ({@link compileLaunch},
 * `compileAttach`, `cameraMove`): the object rides its clip each frame, no rig
 * involved. Feeding a shot's `objectMotions` and `cameraMotion` through the
 * same helper keeps every demo's projectile/prop/camera on one code path.
 *
 * Only channels the clip CARRIES are written: a channel absent from the current
 * clip keeps the object's existing value, so a host that swaps clips mid-scene
 * must restore staged bases itself (the engine's `resolveFrame` falls back to
 * rest instead: it owns node rests; this helper does not).
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
    // scale is a first-class engine channel (sampleClip validates width 3,
    // resolveFrame composes it into node matrices). Dropping it rendered
    // scaling props rigid while every engine consumer saw them grow (#1049)
    else if (channel.path === "scale")
      object.scale.set(value[0]!, value[1]!, value[2]!);
  }
};
