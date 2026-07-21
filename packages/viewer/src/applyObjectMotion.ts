import { sampleClip } from "@automovie/engine";
import { IAutoMovieClip } from "@automovie/interface";
import * as THREE from "three";

/**
 * Drive scene objects from a **world-space node clip**: a shot's `objectMotion`
 * (a projectile's baked flight, a prop following a bone) or its `cameraMotion`.
 * Sample the clip at `seconds` and write each node channel straight onto the
 * `THREE.Object3D` that `resolve` returns for that node: translation, rotation,
 * and scale onto the object's transform, `weights` onto the morph influences of
 * every morphable mesh beneath it. A node with no object (or a non-node
 * channel) is skipped. A light change is not a node channel and never arrives
 * here: it rides the shot's `lightMotions` through {@link applyLightMotion},
 * and the artifact gate refuses a pointer track on a transform clip so the two
 * cannot be confused.
 *
 * The paths are matched by an EXHAUSTIVE switch, not by an `if` chain with a
 * tail: `weights` fell off that chain's end for as long as the channel existed,
 * and the next path added to the union would have fallen off it the same way
 * (#1357). A switch with no `default` fails to compile when the union grows,
 * which is the same mechanism `LIGHT_CHANNEL_PROPERTIES` uses to tie the
 * admitted set to the applied one.
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
    switch (channel.path) {
      case "translation":
        object.position.set(value[0]!, value[1]!, value[2]!);
        break;
      case "rotation":
        object.quaternion.set(value[0]!, value[1]!, value[2]!, value[3]!);
        break;
      // scale is a first-class engine channel (sampleClip validates width 3,
      // resolveFrame composes it into node matrices). Dropping it rendered
      // scaling props rigid while every engine consumer saw them grow (#1049)
      case "scale":
        object.scale.set(value[0]!, value[1]!, value[2]!);
        break;
      case "weights":
        applyMorphWeights(object, value);
        break;
    }
  }
};

/**
 * Write a sampled `weights` vector onto every morphable mesh under `object`.
 *
 * The fourth node path was the last one this helper dropped in silence (#1357):
 * the artifact gate accepts a `weights` track, `resolveFrame` interpolates it
 * into its `weights` output, and the render left the mesh at whatever it
 * already had, so a committed clip that morphs a prop validated clean and
 * changed nothing on screen. Same class as `scale` before #1049.
 *
 * The vector is INDEXED, not named: entry `i` drives morph target `i`, the glTF
 * order the mesh was built or imported with. That is the only convention
 * available here, because a track addresses a node rather than a channel name,
 * and it is deliberately different from {@link applyExpression}, which drives
 * semantic ARKit/preset channels BY NAME on an expression sink.
 *
 * A mesh with no morph targets is skipped, and a vector longer than a mesh's
 * influence array writes the entries that exist: a clip authored against one
 * model must not throw when a host swaps in another, the same tolerance the
 * unresolved-node case above already has.
 */
const applyMorphWeights = (object: THREE.Object3D, value: number[]): void => {
  object.traverse((child) => {
    const influences = (child as THREE.Mesh).morphTargetInfluences;
    if (influences === undefined) return;
    const count = Math.min(influences.length, value.length);
    for (let i = 0; i < count; ++i) influences[i] = value[i]!;
  });
};
