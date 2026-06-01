/**
 * What a {@link IMoticaNode} is. Every node is a transform with an optional
 * payload; the kind tags which payload (if any) it carries.
 *
 * `group` is the load-bearing one: a group is just a node with children, so
 * moving or rotating the group moves the whole subtree, its local frame is the
 * pivot, and a limit on its rotation channel is a group-level range of motion.
 * Grouping needs no separate concept — it is the node graph itself.
 *
 * @author Samchon
 */
export type MoticaNodeKind = "group" | "bone" | "mesh" | "camera" | "light";
