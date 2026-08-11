/**
 * What a {@link IAutoMovieNode} is. Every node is a transform with an optional
 * payload; the kind tags which payload (if any) it carries.
 *
 * `group` is the load-bearing one: a group is just a node with children, so
 * moving or rotating the group moves the whole subtree, its local frame is the
 * pivot, and a limit on its rotation channel is a group-level range of motion.
 * Grouping needs no separate concept; it is the node graph itself.
 *
 * @evidence requirements/asset-authoring/rig-and-state.md#asset-state-motion-distinction Exposes `AutoMovieNodeKind` as the portable data boundary for the asset state motion distinction requirement.
 * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-state-motion-separation Types `AutoMovieNodeKind` for the asset spec state motion separation system contract.
 * @author Samchon
 */
export type AutoMovieNodeKind = "group" | "bone" | "mesh" | "camera" | "light";
