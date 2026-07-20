import {
  IAutoMovieChannel,
  IAutoMovieCopyDriver,
  IAutoMovieDrivenDriver,
  IAutoMovieDriver,
  IAutoMovieNode,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { channelKey } from "./channel";
import { evaluateDrivenCurve } from "./drivenCurve";
import { IAutoMovieSampledChannel } from "./sampleClip";

/** The two channel-space drivers this pass resolves (no world transform needed). */
type ValueDriver = IAutoMovieCopyDriver | IAutoMovieDrivenDriver;

const VALUE_DRIVER_TYPES = new Set<unknown>(["copy", "driven"]);
const DEFERRED_DRIVER_TYPES = new Set<unknown>([
  "aim",
  "ik",
  "parent",
  "spring",
]);

/**
 * The DRIVE pass for **channel-space** drivers: relationships that compute one
 * channel purely from other channels, with no world-transform dependency:
 * `copy` (mirror/follow a node's local TRS) and `driven` (range-remap one
 * channel onto another). They are resolved in dependency order over a
 * topological DAG (so a copy-of-a-copy or a chained driven key settles in one
 * pass), mutating the sampled channel map in place between SAMPLE and
 * CONSTRAIN.
 *
 * The world-space / stateful drivers (`parent`, `aim`, `ik`, `spring`) need the
 * composed hierarchy or cross-frame state, so they are **not** resolved here.
 * They are returned as `deferred` (never silently dropped) for the world-space
 * driver pass that runs after an initial compose.
 *
 * A dependency cycle among the value drivers (A copies from B while B copies
 * from A) throws rather than looping; the rig is ill-formed.
 *
 * @author Samchon
 */
export const resolveDrivers = (
  drivers: IAutoMovieDriver[],
  sampled: Map<string, IAutoMovieSampledChannel>,
  nodesById: Map<string, IAutoMovieNode>,
): IAutoMovieDriver[] => {
  const value: ValueDriver[] = [];
  const deferred: IAutoMovieDriver[] = [];
  for (const d of drivers) {
    const type = (d as { type?: unknown }).type;
    if (VALUE_DRIVER_TYPES.has(type)) value.push(d as ValueDriver);
    else if (DEFERRED_DRIVER_TYPES.has(type)) deferred.push(d);
    else throw new Error(`unknown driver type "${String(type)}"`);
  }

  for (const d of topoSort(value))
    if (d.type === "copy") applyCopy(d, sampled, nodesById);
    else applyDriven(d, sampled);

  return deferred;
};

// dependency ordering

const trsKeys = (
  node: string,
  flags: { translation: boolean; rotation: boolean; scale: boolean },
): string[] => {
  const keys: string[] = [];
  if (flags.translation) keys.push(`node:${node}:translation`);
  if (flags.rotation) keys.push(`node:${node}:rotation`);
  if (flags.scale) keys.push(`node:${node}:scale`);
  return keys;
};

const outputsOf = (d: ValueDriver): string[] =>
  d.type === "copy" ? trsKeys(d.owner, d) : [channelKey(d.output)];

const inputsOf = (d: ValueDriver): string[] =>
  d.type === "copy" ? trsKeys(d.source, d) : [channelKey(d.source)];

/**
 * Order value drivers so every driver runs after the drivers that produce its
 * inputs (DFS topological sort). A back edge onto a driver still being visited
 * is a dependency cycle and throws.
 */
const topoSort = (drivers: ValueDriver[]): ValueDriver[] => {
  const outs = drivers.map(outputsOf);
  const ins = drivers.map(inputsOf);
  const deps = drivers.map((_, j) =>
    drivers
      .map((__, i) => i)
      .filter((i) => i !== j && outs[i]!.some((k) => ins[j]!.includes(k))),
  );

  const color = new Array<number>(drivers.length).fill(0); // 0 white, 1 gray, 2 black
  const order: ValueDriver[] = [];
  const visit = (j: number): void => {
    if (color[j] === 2) return;
    if (color[j] === 1) throw new Error("driver dependency cycle");
    color[j] = 1;
    for (const i of deps[j]!) visit(i);
    color[j] = 2;
    order.push(drivers[j]!);
  };
  for (let j = 0; j < drivers.length; ++j) visit(j);
  return order;
};

// copy

const applyCopy = (
  d: IAutoMovieCopyDriver,
  sampled: Map<string, IAutoMovieSampledChannel>,
  nodesById: Map<string, IAutoMovieNode>,
): void => {
  validateCopyFlag(d.translation, "translation");
  validateCopyFlag(d.rotation, "rotation");
  validateCopyFlag(d.scale, "scale");
  validateCopyInfluence(d.influence);
  if (d.translation) writeBlend(d, "translation", false, sampled, nodesById);
  if (d.rotation) writeBlend(d, "rotation", true, sampled, nodesById);
  if (d.scale) writeBlend(d, "scale", false, sampled, nodesById);
};

const validateCopyFlag = (
  value: boolean,
  label: "translation" | "rotation" | "scale",
): void => {
  if (typeof value !== "boolean")
    throw new Error(
      `copy driver ${label} flag must be boolean, but was ${value}`,
    );
};

const validateCopyInfluence = (influence: number): void => {
  if (!Number.isFinite(influence))
    throw new Error(
      `copy driver influence must be finite, but was ${influence}`,
    );
  if (influence < 0)
    throw new Error(
      `copy driver influence must be between 0 and 1, but was ${influence}`,
    );
  if (influence > 1)
    throw new Error(
      `copy driver influence must be between 0 and 1, but was ${influence}`,
    );
};

const writeBlend = (
  d: IAutoMovieCopyDriver,
  path: "translation" | "rotation" | "scale",
  isRotation: boolean,
  sampled: Map<string, IAutoMovieSampledChannel>,
  nodesById: Map<string, IAutoMovieNode>,
): void => {
  const owner = readTRS(d.owner, "owner", path, sampled, nodesById);
  const source = readTRS(d.source, "source", path, sampled, nodesById);
  const result = isRotation
    ? slerpArray(owner, source, d.influence)
    : lerpArray(owner, source, d.influence);
  setChannel(
    sampled,
    `node:${d.owner}:${path}`,
    { kind: "node", node: d.owner, path },
    result,
  );
};

/** Current value of a node TRS channel: the sampled override, else rest pose. */
const readTRS = (
  node: string,
  role: "owner" | "source",
  path: "translation" | "rotation" | "scale",
  sampled: Map<string, IAutoMovieSampledChannel>,
  nodesById: Map<string, IAutoMovieNode>,
): number[] => {
  const nodeDef = nodesById.get(node);
  if (nodeDef === undefined)
    throw new Error(`copy driver ${role} node "${node}" was not provided`);
  const hit = sampled.get(`node:${node}:${path}`);
  if (hit !== undefined) {
    validateCopySampledValue(role, path, hit.value);
    return hit.value;
  }
  const t = nodeDef.transform;
  if (path === "translation")
    return [t.translation.x, t.translation.y, t.translation.z];
  if (path === "rotation")
    return [t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w];
  return [t.scale.x, t.scale.y, t.scale.z];
};

const validateCopySampledValue = (
  role: "owner" | "source",
  path: "translation" | "rotation" | "scale",
  value: number[],
): void => {
  const expected = COPY_SAMPLE_WIDTHS[path];
  if (!Array.isArray(value))
    throw new Error(`copy driver ${role} ${path} value must be an array`);
  if (value.length !== expected)
    throw new Error(
      `copy driver ${role} ${path} value must contain exactly ${expected} entries, but had ${value.length}`,
    );
};

const COPY_SAMPLE_WIDTHS = {
  translation: 3,
  rotation: 4,
  scale: 3,
} as const;

// driven

const applyDriven = (
  d: IAutoMovieDrivenDriver,
  sampled: Map<string, IAutoMovieSampledChannel>,
): void => {
  validateDrivenOutputChannel(d.output, sampled);
  const src = sampled.get(channelKey(d.source));
  const source =
    src !== undefined ? readDrivenSourceValue(src.value) : undefined;
  if (source !== undefined) validateDrivenFinite("source value", source);
  const y =
    d.curve !== null && d.curve !== undefined
      ? evaluateDrivenCurve(source, d.curve)
      : remapDriven(d, source);
  setChannel(sampled, channelKey(d.output), d.output, [y]);
};

/**
 * A driven driver computes ONE scalar (the interface contract: "one scalar
 * channel computed from another"), so its output must be a scalar-width
 * channel. Node TRS channels are rejected outright: composing `[y]` into world
 * matrices downstream is silent NaN poisoning with no violation (#1055). Node
 * `weights` is variable-width, so it is judged by the width actually in play
 * (#1100): an already-sampled multi-morph array must not be narrowed to `[y]`,
 * while a width-1 array (or an unsampled channel, where the driver CREATES the
 * scalar weights exactly as a width-1 clip track would) is the classic
 * single-morph corrective driver and folds into `resolveFrame`'s weights. (A
 * scalar JSON pointer is NOT a remedy for in-engine consumers: pointer channels
 * never fold into node outputs.) Mirrors the width gate `readDrivenSourceValue`
 * applies to the source.
 */
const validateDrivenOutputChannel = (
  output: IAutoMovieChannel,
  sampled: Map<string, IAutoMovieSampledChannel>,
): void => {
  if (output.kind === "node") {
    if (output.path !== "weights")
      throw new Error(
        `driven driver output must be a scalar channel, but addressed node "${output.node}" ${output.path}; a width-1 write into a TRS channel would NaN-poison the composed world matrices`,
      );
    const existing = sampled.get(channelKey(output));
    if (existing !== undefined && existing.value.length !== 1)
      throw new Error(
        `driven driver output "node:${output.node}:weights" must stay scalar-width, but the sampled weights carry ${existing.value.length} morph targets: a scalar write would silently narrow them`,
      );
    return;
  }
  if (output.valueType !== "scalar")
    throw new Error(
      `driven driver output must be a scalar channel, but pointer "${output.pointer}" has valueType "${output.valueType}"`,
    );
};

const readDrivenSourceValue = (value: number[]): number => {
  validateDrivenSourceValue(value);
  return value[0]!;
};

const validateDrivenSourceValue = (value: number[]): void => {
  if (!Array.isArray(value))
    throw new Error("driven driver source value must be an array");
  if (value.length !== 1)
    throw new Error(
      `driven driver source value must contain exactly 1 entry, but had ${value.length}`,
    );
};

const validateDrivenClamp = (clamp: boolean): void => {
  if (typeof clamp !== "boolean")
    throw new Error(`driven driver clamp must be boolean, but was ${clamp}`);
};

const validateDrivenRange = (
  inRange: [number, number],
  outRange: [number, number],
): void => {
  validateDrivenRangeTuple("inRange", inRange);
  validateDrivenRangeTuple("outRange", outRange);
  validateDrivenFinite("inRange[0]", inRange[0]);
  validateDrivenFinite("inRange[1]", inRange[1]);
  validateDrivenFinite("outRange[0]", outRange[0]);
  validateDrivenFinite("outRange[1]", outRange[1]);
};

const validateDrivenRangeTuple = (
  label: "inRange" | "outRange",
  range: [number, number],
): void => {
  if (!Array.isArray(range))
    throw new Error(`driven driver ${label} must be an array`);
  if (range.length !== 2)
    throw new Error(
      `driven driver ${label} must contain exactly 2 entries, but had ${range.length}`,
    );
};

const validateDrivenFinite = (label: string, value: number): void => {
  if (!Number.isFinite(value))
    throw new Error(`driven driver ${label} must be finite, but was ${value}`);
};

const remapDriven = (
  d: IAutoMovieDrivenDriver,
  source: number | undefined,
): number => {
  const { inRange, outRange } = d;
  if (inRange === undefined || outRange === undefined)
    throw new Error(
      "driven driver without a curve requires inRange and outRange",
    );
  validateDrivenRange(inRange, outRange);
  if (d.clamp !== undefined) validateDrivenClamp(d.clamp);
  return remap(source ?? inRange[0], inRange, outRange, d.clamp ?? false);
};

const remap = (
  x: number,
  [i0, i1]: [number, number],
  [o0, o1]: [number, number],
  clamp: boolean,
): number => {
  const t = i1 === i0 ? 0 : (x - i0) / (i1 - i0);
  const tc = clamp ? Math.min(1, Math.max(0, t)) : t;
  return o0 + (o1 - o0) * tc;
};

// shared

const setChannel = (
  sampled: Map<string, IAutoMovieSampledChannel>,
  key: string,
  channel: IAutoMovieSampledChannel["channel"],
  value: number[],
): void => {
  const existing = sampled.get(key);
  if (existing !== undefined) existing.value = value;
  else sampled.set(key, { channel, value });
};

const lerpArray = (a: number[], b: number[], t: number): number[] =>
  a.map((v, i) => v + (b[i]! - v) * t);

const slerpArray = (a: number[], b: number[], t: number): number[] => {
  const q = Quaternion.slerp(
    { x: a[0]!, y: a[1]!, z: a[2]!, w: a[3]! },
    { x: b[0]!, y: b[1]!, z: b[2]!, w: b[3]! },
    t,
  );
  return [q.x, q.y, q.z, q.w];
};
