import {
  IAutoMovieSampledChannel,
  resolveDrivers,
  resolveFrame,
} from "@automovie/engine";
import {
  IAutoMovieChannel,
  IAutoMovieDrivenDriver,
  IAutoMovieNode,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const node = (id: string): IAutoMovieNode => ({
  id,
  name: null,
  parent: null,
  kind: "mesh",
  transform: {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  mesh: "m",
  camera: null,
  light: null,
  skin: null,
});

const weightsChannel = (id: string): IAutoMovieChannel => ({
  kind: "node",
  node: id,
  path: "weights",
});

const driven = (
  over: Partial<IAutoMovieDrivenDriver>,
): IAutoMovieDrivenDriver => ({
  type: "driven",
  output: weightsChannel("k"),
  source: { kind: "pointer", pointer: "/in", valueType: "scalar" },
  inRange: [0, 1],
  outRange: [0.6, 1],
  clamp: false,
  ...over,
});

/**
 * The driven output gate is width-aware for node `weights` (#1100): the
 * corrective-morph driver (`node:X:weights` on a single-morph node) is
 * genuinely scalar-width and folds into `resolveFrame`'s weights, so rejecting
 * every node output was a capability regression whose suggested remedy (a
 * scalar JSON pointer) never folds into node outputs at all. TRS outputs stay
 * banned (#1055's NaN-poisoning rationale holds only for multi-component matrix
 * inputs), and an already-sampled MULTI-morph weights array still refuses the
 * narrowing write.
 *
 * Scenarios:
 *
 * 1. End-to-end: a driven driver writing `node:k:weights` with no sampled weights
 *    CREATES the scalar channel (exactly as a width-1 clip track would) and
 *    `resolveFrame` folds it into `weights`: the classic corrective-morph
 *    driver works again.
 * 2. A sampled width-1 weights channel is overwritten in place (the driver
 *    replaces the clip's value).
 * 3. Negative twin: sampled THREE-morph weights refuse the scalar write, naming
 *    the narrowing.
 * 4. Negative twin: a TRS output still rejects with the NaN-poisoning rationale.
 */
export const test_resolve_drivers_driven_weights = (): void => {
  // 1. unsampled weights: the driver creates the scalar channel and it folds
  const out = resolveFrame({
    nodes: [node("k")],
    clip: null,
    limits: [],
    drivers: [driven({})],
    seconds: 0,
  });
  TestValidator.equals(
    "a driven weights output folds into resolveFrame's weights",
    out.weights.get("k"),
    [0.6],
  );

  // 2. sampled width-1 weights are overwritten in place
  const single = new Map<string, IAutoMovieSampledChannel>([
    ["node:k:weights", { channel: weightsChannel("k"), value: [0.2] }],
  ]);
  resolveDrivers([driven({})], single, new Map([["k", node("k")]]));
  TestValidator.equals(
    "a width-1 sampled weights channel takes the driven value",
    single.get("node:k:weights")!.value,
    [0.6],
  );

  // 3. negative twin: multi-morph weights refuse the narrowing write
  const multi = new Map<string, IAutoMovieSampledChannel>([
    ["node:k:weights", { channel: weightsChannel("k"), value: [0.2, 0.5, 1] }],
  ]);
  TestValidator.predicate(
    "multi-morph sampled weights refuse a scalar driven write",
    throwsError(
      () => resolveDrivers([driven({})], multi, new Map([["k", node("k")]])),
      ["node:k:weights", "3 morph targets", "narrow"],
    ),
  );

  // 4. negative twin: TRS outputs keep the NaN-poisoning ban
  TestValidator.predicate(
    "a TRS output still rejects as non-scalar",
    throwsError(
      () =>
        resolveDrivers(
          [driven({ output: { kind: "node", node: "k", path: "scale" } })],
          new Map(),
          new Map([["k", node("k")]]),
        ),
      ["driven driver output", "scalar", "scale", "NaN-poison"],
    ),
  );
};
