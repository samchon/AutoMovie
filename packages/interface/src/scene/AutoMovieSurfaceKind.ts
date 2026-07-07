/**
 * What a walkable/standable surface _is_ in the set — semantic labeling for the
 * space layer, not geometry. A `floor` is the ground plane of a room or lot; a
 * `platform` is a raised standable top (a table, a stage, a crate lid); a
 * `ramp` is a sloped connector whose height varies along one axis. The closed
 * union keeps structured output on the rails the way every other `AutoMovie*`
 * enum does; new kinds (stairs beyond the ramp approximation, water, …) are
 * additive.
 *
 * @author Samchon
 */
export type AutoMovieSurfaceKind = "floor" | "platform" | "ramp";
