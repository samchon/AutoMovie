import { IMoticaSampledChannel, resolveDrivers } from "@motica/engine";
import {
  IMoticaAimDriver,
  IMoticaChannel,
  IMoticaCopyDriver,
  IMoticaDrivenDriver,
  IMoticaDriver,
  IMoticaNode,
  IMoticaTransform,
} from "@motica/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const IDENTITY: IMoticaTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

const node = (
  id: string,
  transform: IMoticaTransform = IDENTITY,
): IMoticaNode => ({
  id,
  name: null,
  parent: null,
  kind: "group",
  transform,
  mesh: null,
  camera: null,
  light: null,
  skin: null,
});

const byId = (...nodes: IMoticaNode[]): Map<string, IMoticaNode> =>
  new Map(nodes.map((n) => [n.id, n]));

const ptr = (p: string): IMoticaChannel => ({
  kind: "pointer",
  pointer: p,
  valueType: "scalar",
});

const seed = (
  entries: [string, IMoticaChannel, number[]][],
): Map<string, IMoticaSampledChannel> =>
  new Map(entries.map(([k, channel, value]) => [k, { channel, value }]));

const copy = (over: Partial<IMoticaCopyDriver>): IMoticaCopyDriver => ({
  type: "copy",
  owner: "o",
  source: "s",
  translation: false,
  rotation: false,
  scale: false,
  influence: 1,
  ...over,
});

const driven = (over: Partial<IMoticaDrivenDriver>): IMoticaDrivenDriver => ({
  type: "driven",
  output: ptr("/out"),
  source: ptr("/in"),
  inRange: [0, 10],
  outRange: [0, 100],
  clamp: false,
  ...over,
});

/**
 * The `copy` driver blends a source node's local TRS onto an owner, per
 * component, reading either the sampled override or the rest pose, and writing
 * either over an existing sample or a fresh one.
 *
 * Scenarios:
 *
 * 1. A full-influence copy of all three components from rest transforms: the
 *    owner's translation/scale lerp and rotation slerp land exactly on the
 *    source's rest values, written as fresh sampled channels.
 * 2. A translation-only copy at influence 0.5 between two _animated_ nodes reads
 *    both sides from the sampled map and overwrites the owner's existing sample
 *    — proving the rest-vs-sample and new-vs-existing branches both ways, and
 *    that the disabled rotation/scale components are left untouched.
 */
export const test_resolve_drivers_copy = (): void => {
  // 1. full copy from rest
  const owner = node("o", {
    translation: { x: 1, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 2, y: 2, z: 2 },
  });
  const s = Math.SQRT1_2;
  const source = node("s", {
    translation: { x: 5, y: 0, z: 0 },
    rotation: { x: 0, y: s, z: 0, w: s },
    scale: { x: 4, y: 4, z: 4 },
  });
  const sampled = seed([]);
  const deferred = resolveDrivers(
    [copy({ translation: true, rotation: true, scale: true })],
    sampled,
    byId(owner, source),
  );
  TestValidator.equals("no deferred drivers", deferred.length, 0);
  TestValidator.equals(
    "translation copied from rest",
    sampled.get("node:o:translation")!.value,
    [5, 0, 0],
  );
  TestValidator.equals(
    "scale copied from rest",
    sampled.get("node:o:scale")!.value,
    [4, 4, 4],
  );
  const rot = sampled.get("node:o:rotation")!.value;
  TestValidator.predicate(
    "rotation slerped to source rest",
    nclose(rot[1]!, s) && nclose(rot[3]!, s),
  );

  // 2. translation-only, influence 0.5, both sides animated, owner overwritten
  const sampled2 = seed([
    [
      "node:o2:translation",
      { kind: "node", node: "o2", path: "translation" },
      [10, 0, 0],
    ],
    [
      "node:s2:translation",
      { kind: "node", node: "s2", path: "translation" },
      [20, 0, 0],
    ],
  ]);
  resolveDrivers(
    [copy({ owner: "o2", source: "s2", translation: true, influence: 0.5 })],
    sampled2,
    byId(node("o2"), node("s2")),
  );
  TestValidator.equals(
    "translation blended at 0.5 over existing sample",
    sampled2.get("node:o2:translation")!.value,
    [15, 0, 0],
  );
  TestValidator.equals(
    "rotation left untouched when disabled",
    sampled2.has("node:o2:rotation"),
    false,
  );
};

/**
 * The `driven` driver range-remaps a source channel onto an output, with the
 * source-absent default, clamping, and the degenerate input range.
 *
 * Scenarios:
 *
 * 1. A present source remaps linearly: 5 on `[0,10]→[0,100]` is 50.
 * 2. An absent source falls back to `inRange[0]`, mapping to `outRange[0]`.
 * 3. With `clamp`, a source past the input range pins to the output bound (20 →
 *    100); without clamp it would extrapolate.
 * 4. A degenerate input range (`[5,5]`) maps to `outRange[0]` rather than dividing
 *    by zero.
 */
export const test_resolve_drivers_driven = (): void => {
  const run = (d: IMoticaDrivenDriver, src?: number): number[] => {
    const sampled =
      src === undefined ? seed([]) : seed([["ptr:/in", ptr("/in"), [src]]]);
    resolveDrivers([d], sampled, new Map());
    return sampled.get("ptr:/out")!.value;
  };

  TestValidator.equals("present source remaps", run(driven({}), 5), [50]);
  TestValidator.equals(
    "absent source uses inRange[0]",
    run(driven({ inRange: [2, 4], outRange: [7, 9] })),
    [7],
  );
  TestValidator.equals(
    "clamp pins past the range",
    run(driven({ clamp: true }), 20),
    [100],
  );
  TestValidator.equals(
    "degenerate input range maps to outRange[0]",
    run(driven({ inRange: [5, 5], outRange: [3, 9] }), 5),
    [3],
  );
};

/**
 * Dependency ordering: drivers run after the drivers that produce their inputs,
 * regardless of input order, and a driver shared by two dependents is visited
 * once. A non-value driver is deferred, not applied.
 *
 * Scenarios:
 *
 * 1. Chained driven keys `/x → /y → /z` submitted out of order ([B, A]) still
 *    resolve A before B, so `/z` sees A's computed `/y` (1 → 2 → 4) rather than
 *    an absent source.
 * 2. A driver `A` feeding two dependents `B` and `C` ([B, C, A]) resolves once;
 *    both dependents see its output.
 * 3. An `aim` driver is returned in `deferred` and never written.
 */
export const test_resolve_drivers_order = (): void => {
  // 1. chained, out of order
  const a = driven({
    source: ptr("/x"),
    output: ptr("/y"),
    inRange: [0, 1],
    outRange: [0, 2],
  });
  const b = driven({
    source: ptr("/y"),
    output: ptr("/z"),
    inRange: [0, 2],
    outRange: [0, 4],
  });
  const sampled = seed([["ptr:/x", ptr("/x"), [1]]]);
  resolveDrivers([b, a], sampled, new Map());
  TestValidator.equals(
    "chain resolves A before B",
    sampled.get("ptr:/z")!.value,
    [4],
  );
  TestValidator.equals(
    "intermediate computed",
    sampled.get("ptr:/y")!.value,
    [2],
  );

  // 2. shared dependency visited once, both dependents see it
  const sa = driven({
    source: ptr("/x"),
    output: ptr("/y"),
    inRange: [0, 1],
    outRange: [0, 5],
  });
  const sb = driven({
    source: ptr("/y"),
    output: ptr("/p"),
    inRange: [0, 5],
    outRange: [0, 1],
  });
  const sc = driven({
    source: ptr("/y"),
    output: ptr("/q"),
    inRange: [0, 5],
    outRange: [0, 2],
  });
  const sampled2 = seed([["ptr:/x", ptr("/x"), [1]]]);
  const aim: IMoticaAimDriver = {
    type: "aim",
    owner: "o",
    target: "t",
    aimAxis: { x: 0, y: 0, z: -1 },
    upAxis: { x: 0, y: 1, z: 0 },
    worldUp: { x: 0, y: 1, z: 0 },
    influence: 1,
  };
  const deferred = resolveDrivers([sb, sc, sa, aim], sampled2, new Map());
  TestValidator.equals(
    "dependent B sees shared output",
    sampled2.get("ptr:/p")!.value,
    [1],
  );
  TestValidator.equals(
    "dependent C sees shared output",
    sampled2.get("ptr:/q")!.value,
    [2],
  );
  TestValidator.equals("aim driver deferred", deferred.length, 1);
  TestValidator.equals(
    "aim is the deferred one",
    (deferred[0] as IMoticaDriver).type,
    "aim",
  );
};

/**
 * A dependency cycle among value drivers throws rather than looping.
 *
 * Scenario: `o`'s rotation copies from `s` while `s`'s rotation copies from `o`
 * — a back edge onto a driver still on the stack — so resolution rejects the
 * ill-formed rig.
 */
export const test_resolve_drivers_cycle = (): void => {
  const nodes = byId(node("o"), node("s"));
  const cyclic: IMoticaDriver[] = [
    copy({ owner: "o", source: "s", rotation: true }),
    copy({ owner: "s", source: "o", rotation: true }),
  ];
  let threw = false;
  try {
    resolveDrivers(cyclic, seed([]), nodes);
  } catch {
    threw = true;
  }
  TestValidator.equals("cyclic drivers throw", threw, true);
};
