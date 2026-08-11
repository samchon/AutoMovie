/**
 * What a walkable/standable surface _is_ in the set: semantic labeling for the
 * space layer, not geometry. A `floor` is the ground plane of a room or lot; a
 * `platform` is a raised standable top (a table, a stage, a crate lid); a
 * `ramp` is a sloped connector whose height varies along one axis. The closed
 * union keeps structured output on the rails the way every other `AutoMovie*`
 * enum does; new kinds (stairs beyond the ramp approximation, water, …) are
 * additive.
 *
 * @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-finish-regions Exposes `AutoMovieSurfaceKind` as the portable data boundary for the interior floor finish regions requirement.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-floor-raised-floor-contract Types `AutoMovieSurfaceKind` for the interior space floor raised floor contract system contract.
 * @author Samchon
 */
export type AutoMovieSurfaceKind = "floor" | "platform" | "ramp";
