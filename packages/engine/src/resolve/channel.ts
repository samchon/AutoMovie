import { IAutoMovieChannel } from "@automovie/interface";

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
export const channelKey = (channel: IAutoMovieChannel): string =>
  channel.kind === "node"
    ? `node:${channel.node}:${channel.path}`
    : `ptr:${channel.pointer}`;

/**
 * Whether a channel carries a rotation (a quaternion), which the sample pass
 * must interpolate with slerp rather than component-wise lerp — the glTF rule
 * for LINEAR rotation tracks.
 */
export const channelIsRotation = (channel: IAutoMovieChannel): boolean =>
  channel.kind === "node"
    ? channel.path === "rotation"
    : channel.valueType === "quaternion";
