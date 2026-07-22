const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const targetKindName = (target: unknown): string =>
  isRecord(target) && typeof target.kind === "string"
    ? target.kind
    : "malformed";

/**
 * What a positional target may be, stated once so every verb's refusal, on
 * every rung, teaches the same vocabulary. Cameras belong in the list because
 * the shared placement table (`scenePlacements`) resolves them (#1294).
 *
 * @author Samchon
 */
export const POSITIONAL_TARGET_SHAPE =
  "a node/bone/point/group, whose ids name placed actors, set pieces, or cameras";

/**
 * Why a positional target did not resolve to a world point, phrased as the
 * clause after "but".
 *
 * The discriminator is the fault only for a relative or unknown kind. A `node`
 * or `group` target names a legal kind and an id that is not placed, so echoing
 * the kind made one sentence list a node target as valid and reject it at the
 * same time, leaving the correction round nothing it could act on (#1294). Name
 * the id instead: it is the only thing the author can fix.
 *
 * Total over `unknown` because the callers differ in how much they have already
 * validated: the perform gate reaches here only past its own shape checks,
 * while the MCP geometry queries hand over whatever the agent sent.
 *
 * @author Samchon
 */
export const positionalTargetFault = (target: unknown): string => {
  if (isRecord(target)) {
    if (target.kind === "node")
      return `"${String(target.node)}" is not placed in the staged scene`;
    if (target.kind === "bone")
      return `bone "${String(target.bone)}" on "${String(target.node)}" does not resolve from a rigged staged actor`;
    if (target.kind === "group") {
      const members = Array.isArray(target.nodes) ? target.nodes : [];
      return members.length === 0
        ? "its group names no members"
        : `none of its group members are placed in the staged scene: ${members
            .map((node) => `"${String(node)}"`)
            .join(", ")}`;
    }
    if (target.kind === "point") {
      if (!isRecord(target.point))
        return "a point target carries no point to resolve";
      return "a point target must carry finite x/y/z coordinates";
    }
    if (target.kind === "direction" || target.kind === "offscreen")
      return `a target of kind "${target.kind}" is relative (a heading or a frame edge), so it names no place`;
  }
  return `"${targetKindName(target)}" is not a positional target kind`;
};
