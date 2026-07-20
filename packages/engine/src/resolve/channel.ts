import { IAutoMovieChannel } from "@automovie/interface";

type IAutoMovieNodeChannel = Extract<IAutoMovieChannel, { kind: "node" }>;
type IAutoMoviePointerChannel = Extract<IAutoMovieChannel, { kind: "pointer" }>;

/**
 * Channel addressing helpers shared by the resolve passes.
 *
 * A channel ({@link IAutoMovieChannel}) is the universal animatable lvalue; the
 * sample / constrain passes key their results by a canonical string so a
 * track's value, a limit's bounds, and (later) a driver's output all collide on
 * the same channel.
 *
 * @author Samchon
 */

/**
 * Canonical key for a channel. Node channels and pointer channels live in
 * disjoint namespaces (`node:…` vs `ptr:…`) so they can never alias even if a
 * pointer string happened to look like a node path.
 */
export const channelKey = (channel: IAutoMovieChannel): string => {
  switch (channel.kind) {
    case "node":
      validateNodePath(channel.path);
      return `node:${channel.node}:${channel.path}`;
    case "pointer":
      validateChannelValueType(channel.valueType);
      return `ptr:${channel.pointer}`;
    default:
      return throwUnknownChannelKind(channel);
  }
};

/**
 * Whether a channel carries a rotation (a quaternion), which the sample pass
 * must interpolate with slerp rather than component-wise lerp, the glTF rule
 * for LINEAR rotation tracks.
 */
export const channelIsRotation = (channel: IAutoMovieChannel): boolean => {
  switch (channel.kind) {
    case "node":
      validateNodePath(channel.path);
      return channel.path === "rotation";
    case "pointer":
      validateChannelValueType(channel.valueType);
      return channel.valueType === "quaternion";
    default:
      return throwUnknownChannelKind(channel);
  }
};

const throwUnknownChannelKind = (channel: IAutoMovieChannel): never => {
  const kind = (channel as { kind: unknown }).kind;
  throw new Error(`unknown channel kind "${String(kind)}"`);
};

const validateNodePath = (path: IAutoMovieNodeChannel["path"]): void => {
  if (!NODE_CHANNEL_PATHS.has(path))
    throw new Error(`unknown channel path "${String(path)}"`);
};

const validateChannelValueType = (
  valueType: IAutoMoviePointerChannel["valueType"],
): void => {
  if (!CHANNEL_VALUE_TYPES.has(valueType))
    throw new Error(`unknown channel valueType "${String(valueType)}"`);
};

const NODE_CHANNEL_PATHS = new Set<IAutoMovieNodeChannel["path"]>([
  "translation",
  "rotation",
  "scale",
  "weights",
]);

const CHANNEL_VALUE_TYPES = new Set<IAutoMoviePointerChannel["valueType"]>([
  "scalar",
  "vec2",
  "vec3",
  "vec4",
  "quaternion",
  "weights",
]);
