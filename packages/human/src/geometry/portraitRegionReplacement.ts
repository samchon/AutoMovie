import { portraitCutBoundary } from "../components/nose";
import type { IControlMesh } from "./subdivideControlMesh";

/**
 * A component's reserved region replaced after the host has refined its skin.
 * The append operation receives the actual oriented boundary and preserves its
 * resident vertex identities. It adds source geometry and its joining faces;
 * it does not move or remove surviving host vertices or unrelated faces.
 * An appender also extends any resident reference/RGB attributes in the same
 * vertex order. The head assembler pairs current and reference appenders.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Assigns a component a reserved refined-skin region and its owned appended geometry.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-attachments Binds one nonnegative region label to an append operation that receives the fixed oriented host boundary.
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
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Replaces independently reserved component regions without changing another region's attachment basis.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-attachments Resolves all distinct boundaries before one owned removal pass, preserves surviving vertices and appends each patch against its precomputed loop.
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
    ...(mesh.reference === undefined
      ? {}
      : { reference: mesh.reference.map((p) => [...p]) }),
    ...(mesh.colors === undefined
      ? {}
      : { colors: mesh.colors.map((p) => [...p]) }),
  };
  for (let face = 0; face < mesh.groups.length; face++)
    if (!groups.has(mesh.groups[face])) {
      cage.indices.push(...mesh.indices.slice(face * 3, face * 3 + 3));
      cage.groups.push(mesh.groups[face]);
    }
  for (const { replacement, boundary } of plans)
    replacement.append(cage, boundary);
  if (
    (cage.reference !== undefined &&
      cage.reference.length !== cage.positions.length) ||
    (cage.colors !== undefined && cage.colors.length !== cage.positions.length)
  )
    throw new Error(
      "A replacement must preserve aligned reference and colour attributes.",
    );
  return cage;
}
