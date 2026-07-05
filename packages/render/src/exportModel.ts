import { tessellate } from "@automovie/engine";
import { IAutoMovieModel, IAutoMovieTransform } from "@automovie/interface";
import { Document, Material, Node, NodeIO } from "@gltf-transform/core";

/**
 * Serialize an {@link IAutoMovieModel} AST into a binary glTF (`.glb`) byte
 * buffer — the **export** half of automovie's glTF round-trip (ingest is the
 * import half).
 *
 * The model's skeleton becomes a glTF node hierarchy (one node per bone, parent
 * links preserved, rest transforms intact). Each part is tessellated — a
 * primitive through the engine's {@link tessellate}, a mesh passed through — and
 * attached as a mesh node: a rigid part is parented to its `attachedBone` node
 * so the exported file articulates by rotating those bone nodes (no skinning
 * needed), everything else sits at the scene root. Materials map onto glTF's
 * metallic-roughness model, which {@link IAutoMovieMaterial} already mirrors.
 *
 * The result is a self-contained `.glb` (geometry embedded in one buffer) that
 * any glTF viewer — or automovie's own ingest — can load. Geometry that the
 * engine only approximates (a capsule tessellates to its bounding cylinder)
 * exports at that fidelity.
 *
 * @author Samchon
 */
export const exportModelToGLB = async (
  model: IAutoMovieModel,
): Promise<Uint8Array> => {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(model.name ?? model.id);

  // ── materials → glTF metallic-roughness ──
  const materials = new Map<string, Material>();
  for (const m of model.materials) {
    const mat = doc
      .createMaterial(m.name ?? m.id)
      .setBaseColorFactor([
        m.baseColor.r,
        m.baseColor.g,
        m.baseColor.b,
        m.baseColor.a ?? 1,
      ])
      .setMetallicFactor(m.metallic)
      .setRoughnessFactor(m.roughness);
    if (m.emissive !== null)
      mat.setEmissiveFactor([m.emissive.r, m.emissive.g, m.emissive.b]);
    if (m.opacity < 1) mat.setAlphaMode("BLEND");
    materials.set(m.id, mat);
  }

  // ── skeleton → node hierarchy ──
  const boneNodes = new Map<string, Node>();
  if (model.skeleton !== null) {
    for (const b of model.skeleton.bones)
      boneNodes.set(b.bone, setTRS(doc.createNode(b.bone), b.rest));
    for (const b of model.skeleton.bones) {
      const node = boneNodes.get(b.bone)!;
      if (b.parent === null) {
        scene.addChild(node);
        continue;
      }
      const parent = boneNodes.get(b.parent);
      if (parent === undefined)
        throw new Error(
          `skeleton bone "${b.bone}" references missing parent "${b.parent}"`,
        );
      parent.addChild(node);
    }
  }

  // ── parts → mesh nodes ──
  for (const part of model.parts) {
    const t =
      part.geometry.type === "primitive"
        ? tessellate(part.geometry.shape)
        : {
            positions: part.geometry.mesh.positions,
            normals: part.geometry.mesh.normals ?? [],
            indices: part.geometry.mesh.indices ?? [],
          };

    const prim = doc
      .createPrimitive()
      .setAttribute(
        "POSITION",
        doc
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(t.positions))
          .setBuffer(buffer),
      );
    if (t.normals.length !== 0)
      prim.setAttribute(
        "NORMAL",
        doc
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(t.normals))
          .setBuffer(buffer),
      );
    if (t.indices.length !== 0)
      prim.setIndices(
        doc
          .createAccessor()
          .setType("SCALAR")
          .setArray(new Uint32Array(t.indices))
          .setBuffer(buffer),
      );
    if (part.material !== null) {
      const mat = materials.get(part.material);
      if (mat === undefined)
        throw new Error(
          `part "${part.id}" references missing material "${part.material}"`,
        );
      prim.setMaterial(mat);
    }

    const label = part.name ?? part.id;
    const node = setTRS(
      doc.createNode(label).setMesh(doc.createMesh(label).addPrimitive(prim)),
      part.transform,
    );
    if (part.attachedBone === null) {
      scene.addChild(node);
      continue;
    }
    const boneNode = boneNodes.get(part.attachedBone);
    if (boneNode === undefined)
      throw new Error(
        `part "${part.id}" references missing attachedBone "${part.attachedBone}"`,
      );
    boneNode.addChild(node);
  }

  return new NodeIO().writeBinary(doc);
};

/** Apply an automovie TRS transform onto a glTF node (no-op for `null`). */
const setTRS = (node: Node, t: IAutoMovieTransform | null): Node => {
  if (t === null) return node;
  return node
    .setTranslation([t.translation.x, t.translation.y, t.translation.z])
    .setRotation([t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w])
    .setScale([t.scale.x, t.scale.y, t.scale.z]);
};
