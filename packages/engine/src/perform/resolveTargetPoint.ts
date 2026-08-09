import {
  IAutoMovieActionTarget,
  IAutoMovieVector3,
} from "@automovie/interface";

/**
 * Resolve a **staged positional** action target (`node`, `point`, or `group`)
 * to a single world point, given the world positions of the scene's nodes:
 *
 * - `node` → that node's world position (or `null` if it is not in the frame);
 * - `point` → the literal point;
 * - `group` → the centroid of its resolvable members (`null` if none resolve).
 *
 * A group may also name formations, and each supplied formation counts as one
 * member here: a mass is stored as one compact record, so it has one place, and
 * weighting it by its member count would drag the centroid of "the captain and
 * his company" onto the company and off the captain. This point is the answer
 * for the questions a point answers — is the target reachable, how far apart
 * are two things. What a CAMERA frames is not one of them: a mass has an extent
 * and the framing path measures it rather than collapsing it here.
 *
 * Returns `null` for the **relative** targets (`direction`, `offscreen`) and a
 * live `bone` target: headings / frame edges need the actor's facing or the
 * camera, while a bone needs the shot-clock motion and rig. Those resolve
 * elsewhere, not here. This is the geometry primitive the harness's reach /
 * distance queries and the locomote traveller share.
 *
 * @param formations World points for the formations a group may name. A caller
 *   that holds no formation geometry omits it, and a group naming one resolves
 *   from its nodes alone — never from a formation whose place this caller could
 *   not know.
 * @author Samchon
 */
export const resolveTargetPoint = (
  target: IAutoMovieActionTarget,
  nodes: Map<string, IAutoMovieVector3>,
  formations?: ReadonlyMap<string, IAutoMovieVector3>,
): IAutoMovieVector3 | null => {
  if (target.kind === "node") return nodes.get(target.node) ?? null;
  if (target.kind === "point") return target.point;
  if (target.kind === "group") {
    const points = [
      ...target.nodes.map((id) => nodes.get(id)),
      ...(target.formations ?? []).map((id) => formations?.get(id)),
    ].filter((p): p is IAutoMovieVector3 => p !== undefined);
    if (points.length === 0) return null;
    const sum = points.reduce(
      (a, p) => ({ x: a.x + p.x, y: a.y + p.y, z: a.z + p.z }),
      { x: 0, y: 0, z: 0 },
    );
    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
      z: sum.z / points.length,
    };
  }
  return null; // direction / offscreen: relative, not a positional point
};
