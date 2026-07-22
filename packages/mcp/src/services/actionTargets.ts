import { resolveTargetPoint } from "@automovie/engine";
import {
  IAutoMovieActionTarget,
  IAutoMovieVector3,
} from "@automovie/interface";

import { isRecord } from "../validators/primitives";

export type RuntimeSafeActionTarget = Extract<
  IAutoMovieActionTarget,
  { kind: "node" | "bone" | "point" | "group" | "direction" | "offscreen" }
>;

const isFiniteVector3 = (value: unknown): value is IAutoMovieVector3 =>
  isRecord(value) &&
  Number.isFinite(value.x) &&
  Number.isFinite(value.y) &&
  Number.isFinite(value.z);

export const isRuntimeSafeActionTarget = (
  target: unknown,
): target is RuntimeSafeActionTarget => {
  if (!isRecord(target)) return false;
  if (target.kind === "node") return typeof target.node === "string";
  if (target.kind === "bone")
    return typeof target.node === "string" && typeof target.bone === "string";
  if (target.kind === "point") return isFiniteVector3(target.point);
  if (target.kind === "group")
    return (
      Array.isArray(target.nodes) &&
      target.nodes.every((node) => typeof node === "string")
    );
  if (target.kind === "direction") return Number.isFinite(target.headingDeg);
  if (target.kind === "offscreen")
    return (
      target.edge === "left" ||
      target.edge === "right" ||
      target.edge === "forward" ||
      target.edge === "back"
    );
  return false;
};

export const resolveRuntimeSafeTargetPoint = (
  target: unknown,
  nodes: Map<string, IAutoMovieVector3>,
): IAutoMovieVector3 | null =>
  isRuntimeSafeActionTarget(target) ? resolveTargetPoint(target, nodes) : null;

export const targetNodeId = (target: unknown): string | null =>
  isRecord(target) &&
  (target.kind === "node" || target.kind === "bone") &&
  typeof target.node === "string"
    ? target.node
    : null;
