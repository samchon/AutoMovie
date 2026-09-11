import { portraitCutBoundary } from "./generated-korean-girl-01/nose";
import type { IControlMesh } from "./subdivideControlMesh";

/**
 * A component's reserved region replaced after the host has refined its skin.
 * The append operation receives the actual oriented boundary and preserves its
 * resident vertex identities. It adds source geometry and its joining faces;
 * it does not move or remove surviving host vertices or unrelated faces.
 *
 * @author Samchon
 */
export interface IPortraitRegionReplacement {
  /** Unique reserved face-region label, inherited through host subdivision. */
  group: number;
  /** Append owned millimetre geometry against the fixed refined host boundary. */
  append: (cage: IControlMesh, boundary: readonly number[]) => void;
}

/**
 * Resolve every reserved boundary before applying any component replacement.
 * Regions must be distinct and present with one oriented loop. Removal occurs
 * once on an owned mesh; appending one patch cannot change another's boundary
 * basis. Empty replacements preserve the input object exactly.
 */
export function applyPortraitRegionReplacements(
  mesh: IControlMesh,
  replacements: readonly IPortraitRegionReplacement[],
): IControlMesh {
  if (replacements.length === 0) return mesh;
  const groups = new Set(replacements.map((r) => r.group));
  if (
    groups.size !== replacements.length ||
    replacements.some((r) => !Number.isInteger(r.group) || r.group < 0)
  )
    throw new Error(
      "Deferred portrait regions need distinct nonnegative labels.",
    );
  const plans = replacements.map((replacement) => ({
    replacement,
    boundary: portraitCutBoundary(
      mesh.groups.flatMap((group, face) =>
        group === replacement.group
          ? [mesh.indices.slice(face * 3, face * 3 + 3)]
          : [],
      ),
    ).map((edge) => edge.a),
  }));
  const cage: IControlMesh = {
    positions: mesh.positions.map((p) => [...p]),
    indices: [],
    groups: [],
  };
  for (let face = 0; face < mesh.groups.length; face++)
    if (!groups.has(mesh.groups[face])) {
      cage.indices.push(...mesh.indices.slice(face * 3, face * 3 + 3));
      cage.groups.push(mesh.groups[face]);
    }
  for (const { replacement, boundary } of plans)
    replacement.append(cage, boundary);
  return cage;
}
