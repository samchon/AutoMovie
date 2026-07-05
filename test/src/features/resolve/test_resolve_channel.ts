import { channelIsRotation, channelKey } from "@automovie/engine";
import { IAutoMovieChannel } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const node = (
  id: string,
  path: "translation" | "rotation" | "scale" | "weights",
): IAutoMovieChannel => ({ kind: "node", node: id, path });

const pointer = (
  ptr: string,
  valueType: "scalar" | "vec2" | "vec3" | "vec4" | "quaternion" | "weights",
): IAutoMovieChannel => ({ kind: "pointer", pointer: ptr, valueType });

/**
 * Canonical channel keys and the rotation test that decides slerp vs lerp.
 *
 * Scenarios:
 *
 * 1. A node channel keys to `node:{id}:{path}`; a pointer channel keys to
 *    `ptr:{pointer}`. The two namespaces are disjoint, so a node and a pointer
 *    can never collide.
 * 2. `channelIsRotation` is true exactly for a node `rotation` path and a pointer
 *    whose `valueType` is `quaternion`; every other node path and pointer type
 *    is false — both sides of each discriminator.
 * 3. Unknown channel discriminator values reject instead of falling through to
 *    pointer behavior.
 * 4. Unknown node `path` and pointer `valueType` tags reject instead of being
 *    keyed or treated as non-rotation data.
 */
export const test_resolve_channel = (): void => {
  // 1. keys
  TestValidator.equals(
    "node key",
    channelKey(node("hips", "rotation")),
    "node:hips:rotation",
  );
  TestValidator.equals(
    "pointer key",
    channelKey(pointer("/cameras/0/fovY", "scalar")),
    "ptr:/cameras/0/fovY",
  );

  // 2. rotation discrimination — both kinds, both outcomes
  TestValidator.equals(
    "node rotation is rotation",
    channelIsRotation(node("hips", "rotation")),
    true,
  );
  TestValidator.equals(
    "node translation is not rotation",
    channelIsRotation(node("hips", "translation")),
    false,
  );
  TestValidator.equals(
    "pointer quaternion is rotation",
    channelIsRotation(pointer("/nodes/0/rotation", "quaternion")),
    true,
  );
  TestValidator.equals(
    "pointer scalar is not rotation",
    channelIsRotation(pointer("/materials/0/metallic", "scalar")),
    false,
  );

  const forged = {
    kind: "bone",
    pointer: "/bad",
    valueType: "scalar",
  } as unknown as IAutoMovieChannel;
  TestValidator.predicate(
    "unknown channel kind rejects keying",
    throwsError(() => channelKey(forged), ["channel kind", "bone"]),
  );
  TestValidator.predicate(
    "unknown channel kind rejects rotation check",
    throwsError(() => channelIsRotation(forged), ["channel kind", "bone"]),
  );

  const forgedPath = {
    kind: "node",
    node: "hips",
    path: "visibility",
  } as unknown as IAutoMovieChannel;
  TestValidator.predicate(
    "unknown node path rejects keying",
    throwsError(() => channelKey(forgedPath), ["channel path", "visibility"]),
  );
  TestValidator.predicate(
    "unknown node path rejects rotation check",
    throwsError(
      () => channelIsRotation(forgedPath),
      ["channel path", "visibility"],
    ),
  );

  const forgedValueType = {
    kind: "pointer",
    pointer: "/nodes/0/rotation",
    valueType: "matrix",
  } as unknown as IAutoMovieChannel;
  TestValidator.predicate(
    "unknown pointer value type rejects keying",
    throwsError(
      () => channelKey(forgedValueType),
      ["channel valueType", "matrix"],
    ),
  );
  TestValidator.predicate(
    "unknown pointer value type rejects rotation check",
    throwsError(
      () => channelIsRotation(forgedValueType),
      ["channel valueType", "matrix"],
    ),
  );
};
