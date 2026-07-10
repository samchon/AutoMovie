import { IAutoMovieClip, IAutoMovieTrack } from "@automovie/interface";
import { applyObjectMotion } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { nclose } from "../internal/predicates";

const node = (
  path: "translation" | "rotation" | "scale",
  values: number[],
): IAutoMovieTrack => ({
  channel: { kind: "node", node: "prop", path },
  times: [0, 1],
  values,
  interpolation: "linear",
});

/**
 * `applyObjectMotion` is the render side of the engine's clip bakers: every
 * node channel the engine composes must land on the `THREE.Object3D` the same
 * way. Scale used to fall through silently (#1049) — a clip growing a prop 1→2
 * rendered rigid while every engine-side consumer (`sampleClip` width
 * validation, `resolveFrame` matrix composition) saw it at 1.5 mid-clip.
 *
 * Scenarios:
 *
 * 1. Translation, rotation, AND scale tracks all write onto the resolved object at
 *    the sampled instant (t=0.5 of a 1s clip: position (1,2,3), the 45° slerped
 *    quaternion, scale 1.5).
 * 2. An unresolved node and a non-node (pointer) channel are skipped without
 *    touching anything or throwing.
 * 3. The documented carry-over contract: a channel absent from the clip keeps the
 *    object's existing value (the helper owns no rest poses — hosts that swap
 *    clips restore staged bases themselves).
 */
export const test_viewer_apply_object_motion = (): void => {
  const s = Math.SQRT1_2;
  const clip: IAutoMovieClip = {
    id: "c",
    name: null,
    duration: 1,
    loop: false,
    tracks: [
      node("translation", [0, 0, 0, 2, 4, 6]),
      node("rotation", [0, 0, 0, 1, 0, s, 0, s]),
      node("scale", [1, 1, 1, 2, 2, 2]),
      {
        channel: { kind: "pointer", pointer: "/x", valueType: "scalar" },
        times: [0, 1],
        values: [0, 1],
        interpolation: "linear",
      },
      {
        channel: { kind: "node", node: "ghost", path: "translation" },
        times: [0, 1],
        values: [0, 0, 0, 9, 9, 9],
        interpolation: "linear",
      },
    ],
  };

  // 1. all three TRS channels write
  const prop = new THREE.Object3D();
  applyObjectMotion(clip, 0.5, (n) => (n === "prop" ? prop : undefined));
  const halfAngle = Math.PI / 8; // slerp(identity, 90°@Y, 0.5) = 45° about Y
  TestValidator.predicate(
    "translation, rotation, and scale all land on the object",
    nclose(prop.position.x, 1) &&
      nclose(prop.position.y, 2) &&
      nclose(prop.position.z, 3) &&
      nclose(prop.quaternion.y, Math.sin(halfAngle)) &&
      nclose(prop.quaternion.w, Math.cos(halfAngle)) &&
      nclose(prop.scale.x, 1.5) &&
      nclose(prop.scale.y, 1.5) &&
      nclose(prop.scale.z, 1.5),
  );

  // 2. unresolved node + pointer channel skipped (nothing throws, prop keeps
  //    its sampled state)
  TestValidator.predicate(
    "unresolved and non-node channels are skipped",
    nclose(prop.position.x, 1),
  );

  // 3. the carry-over contract: a scale-less clip leaves scale untouched
  const rigid: IAutoMovieClip = {
    ...clip,
    tracks: [node("translation", [0, 0, 0, 2, 4, 6])],
  };
  applyObjectMotion(rigid, 1, (n) => (n === "prop" ? prop : undefined));
  TestValidator.predicate(
    "a channel absent from the clip keeps the object's existing value",
    nclose(prop.position.x, 2) && nclose(prop.scale.x, 1.5),
  );
};
