import { IAutoMovieFaceTemplate } from "@automovie/interface";
import type { Document, Primitive } from "@gltf-transform/core";

/**
 * Extract an {@link IAutoMovieFaceTemplate} from a parsed glTF/GLB
 * {@link Document} — the import side of the face editor.
 *
 * A face asset carries its editable shape as glTF morph targets on one
 * primitive: `POSITION` is the resting face and each target holds per-vertex
 * deltas under a parameter name (an `identity` likeness plus the semantic
 * sliders). This mapper finds the first morphed primitive and rewrites it into
 * the flat-array template the engine's `morphFace` consumes, resolving target
 * names from the targets themselves with the `mesh.extras.targetNames`
 * convention (what three.js and most exporters write) as the fallback.
 *
 * Structural defects make the asset unusable for deterministic morphing, so
 * they throw rather than degrade: a document with no morphed primitive, a
 * morphed primitive without `POSITION`, a target that cannot be named, a target
 * without `POSITION` deltas, or a delta array whose length disagrees with the
 * resting face.
 *
 * @author Samchon
 */
export const ingestFaceTemplate = (doc: Document): IAutoMovieFaceTemplate => {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const targetList = prim.listTargets();
      if (targetList.length === 0) continue;
      return templateOf(
        prim,
        (mesh.getExtras() as { targetNames?: unknown }).targetNames,
      );
    }
  throw new Error("document has no primitive with morph targets");
};

const templateOf = (
  prim: Primitive,
  extraNames: unknown,
): IAutoMovieFaceTemplate => {
  const posAccessor = prim.getAttribute("POSITION");
  if (posAccessor === null)
    throw new Error("morphed primitive has no POSITION attribute");
  const positionArray = posAccessor.getArray();
  if (positionArray === null)
    throw new Error("morphed primitive POSITION accessor has no array data");
  const positions = Array.from(positionArray, Number);

  const fallback: unknown[] = Array.isArray(extraNames) ? extraNames : [];
  const targets: Record<string, number[]> = {};
  prim.listTargets().forEach((target, i) => {
    const name =
      target.getName() || (typeof fallback[i] === "string" ? fallback[i] : "");
    if (name === "")
      throw new Error(
        `morph target #${i} has no name (neither a target name nor mesh.extras.targetNames)`,
      );
    const deltaAccessor = target.getAttribute("POSITION");
    if (deltaAccessor === null)
      throw new Error(`morph target "${name}" has no POSITION deltas`);
    const deltaArray = deltaAccessor.getArray();
    if (deltaArray === null)
      throw new Error(
        `morph target "${name}" POSITION accessor has no array data`,
      );
    const delta = Array.from(deltaArray, Number);
    if (delta.length !== positions.length)
      throw new Error(
        `morph target "${name}" has ${delta.length} components, expected ${positions.length}`,
      );
    targets[name as string] = delta;
  });
  return { positions, targets };
};
