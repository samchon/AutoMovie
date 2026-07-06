import {
  IAutoMovieCopyDriver,
  IAutoMovieDrivenDriver,
  IAutoMovieDriver,
  IAutoMovieNode,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { channelKey } from "./channel";
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
 * The DRIVE pass for **channel-space** drivers — relationships that compute one
 * channel purely from other channels, with no world-transform dependency:
 * `copy` (mirror/follow a node's local TRS) and `driven` (range-remap one
 * channel onto another). They are resolved in dependency order over a
 * topological DAG (so a copy-of-a-copy or a chained driven key settles in one
 * pass), mutating the sampled channel map in place between SAMPLE and
 * CONSTRAIN.
 *
 * The world-space / stateful drivers (`parent`, `aim`, `ik`, `spring`) need the
 * composed hierarchy or cross-frame state, so they are **not** resolved here —
 * they are returned as `deferred` (never silently dropped) for the world-space
 * driver pass that runs after an initial compose.
 *
 * A dependency cycle among the value drivers (A copies from B while B copies
 * from A) throws rather than looping — the rig is ill-formed.
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

// ── dependency ordering ──────────────────────────────────────────────────────

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

// ── copy ─────────────────────────────────────────────────────────────────────

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

// ── driven ───────────────────────────────────────────────────────────────────

const applyDriven = (
  d: IAutoMovieDrivenDriver,
  sampled: Map<string, IAutoMovieSampledChannel>,
): void => {
  validateDrivenClamp(d.clamp);
  if (d.curve == null) validateDrivenRange(d);
  else validateDrivenCurve(d.curve);
  const src = sampled.get(channelKey(d.source));
  const x = src !== undefined ? readDrivenSourceValue(src.value) : d.inRange[0];
  validateDrivenFinite("source value", x);
  const y =
    d.curve != null
      ? evalCurve(x, d.curve)
      : remap(x, d.inRange, d.outRange, d.clamp);
  setChannel(sampled, channelKey(d.output), d.output, [y]);
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

const validateDrivenRange = (d: IAutoMovieDrivenDriver): void => {
  validateDrivenRangeTuple("inRange", d.inRange);
  validateDrivenRangeTuple("outRange", d.outRange);
  validateDrivenFinite("inRange[0]", d.inRange[0]);
  validateDrivenFinite("inRange[1]", d.inRange[1]);
  validateDrivenFinite("outRange[0]", d.outRange[0]);
  validateDrivenFinite("outRange[1]", d.outRange[1]);
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

const validateDrivenCurve = (curve: [number, number][]): void => {
  if (!Array.isArray(curve))
    throw new Error("driven driver curve must be an array");
  if (curve.length === 0)
    throw new Error("driven driver curve must contain at least one point");

  let previousX: number | null = null;
  for (let i = 0; i < curve.length; ++i) {
    const point = curve[i]!;
    validateDrivenCurvePoint(i, point);
    const [x, y] = point;
    validateDrivenFinite(`curve[${i}].x`, x);
    validateDrivenFinite(`curve[${i}].y`, y);
    if (previousX !== null && x <= previousX)
      throw new Error(
        `driven driver curve x values must be strictly increasing, but point ${i} was ${x} after ${previousX}`,
      );
    previousX = x;
  }
};

const validateDrivenCurvePoint = (
  index: number,
  point: [number, number],
): void => {
  if (!Array.isArray(point))
    throw new Error(`driven driver curve[${index}] point must be an array`);
  if (point.length !== 2)
    throw new Error(
      `driven driver curve[${index}] point must contain exactly 2 entries, but had ${point.length}`,
    );
};

const validateDrivenFinite = (label: string, value: number): void => {
  if (!Number.isFinite(value))
    throw new Error(`driven driver ${label} must be finite, but was ${value}`);
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

/**
 * Piecewise-linear evaluation of a driven `curve` (points sorted by source
 * `x`): the output is interpolated within a segment and held flat before the
 * first point and after the last — the nonlinear driven-key mapping.
 */
const evalCurve = (x: number, pts: [number, number][]): number => {
  if (x <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; ++i) {
    const [x1, y1] = pts[i]!;
    if (x <= x1) {
      const [x0, y0] = pts[i - 1]!;
      return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
    }
  }
  return pts[pts.length - 1]![1];
};

// ── shared ───────────────────────────────────────────────────────────────────

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
