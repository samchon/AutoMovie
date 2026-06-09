import { IAutoFilmModel, IAutoFilmTransform } from "@autofilm/interface";
import { exportModelToGLB } from "@autofilm/render";
import { NodeIO } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

const T = (): IAutoFilmTransform => ({
  translation: { x: 0, y: 1, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/** A rigged character: skeleton (root + child) + primitive parts + a material. */
const CHARACTER: IAutoFilmModel = {
  id: "char",
  name: "character",
  origin: "generated",
  skeleton: {
    id: "rig",
    bones: [
      { bone: "hips", parent: null, rest: T(), constraint: null },
      { bone: "spine", parent: "hips", rest: T(), constraint: null },
    ],
  },
  materials: [
    {
      id: "skin",
      name: "skin",
      baseColor: { r: 0.8, g: 0.6, b: 0.5, a: null, hex: null },
      metallic: 0,
      roughness: 0.7,
      emissive: null,
      opacity: 1,
      baseColorTexture: null,
    },
  ],
  parts: [
    {
      id: "head",
      name: "head",
      geometry: { type: "primitive", shape: { type: "sphere", radius: 0.12 } },
      material: "skin",
      attachedBone: "hips",
      transform: T(),
    },
    {
      id: "torso",
      name: "torso",
      geometry: {
        type: "primitive",
        shape: { type: "capsule", radius: 0.1, height: 0.4 },
      },
      material: "skin",
      attachedBone: "spine",
      transform: T(),
    },
  ],
  asset: null,
};

/** A skeletonless object: a raw mesh part (no normals/indices), no material. */
const OBJECT: IAutoFilmModel = {
  id: "obj",
  name: null,
  origin: "imported",
  skeleton: null,
  materials: [
    {
      id: "glass",
      name: null,
      baseColor: { r: 0.2, g: 0.4, b: 0.9, a: 0.5, hex: null },
      metallic: 0.1,
      roughness: 0.2,
      emissive: { r: 0.1, g: 0.1, b: 0.1, a: 1, hex: null },
      opacity: 0.5,
      baseColorTexture: null,
    },
  ],
  parts: [
    {
      id: "tri",
      name: null,
      geometry: {
        type: "mesh",
        mesh: {
          positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
          normals: null,
          uvs: null,
          indices: null,
          skin: null,
        },
      },
      material: null,
      attachedBone: null,
      transform: null,
    },
    {
      // a mesh that DOES carry normals + indices (the ?? left operands)
      id: "quad",
      name: null,
      geometry: {
        type: "mesh",
        mesh: {
          positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
          normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
          uvs: null,
          indices: [0, 1, 2, 0, 2, 3],
          skin: null,
        },
      },
      material: null,
      attachedBone: null,
      transform: null,
    },
  ],
  asset: null,
};

/**
 * The AST → glTF binary export (`exportModelToGLB`), the export half of the
 * glTF round-trip. Pins that a model's skeleton becomes a node hierarchy, its
 * parts become mesh nodes (rigid parts parented to their bone), and its
 * materials map onto glTF metallic-roughness — verified by reading the emitted
 * `.glb` back with an independent glTF reader.
 *
 * Scenarios:
 *
 * 1. The bytes are a valid binary glTF: non-empty and prefixed with the `glTF`
 *    magic.
 * 2. A rigged character round-trips: one node per bone plus one per part, the
 *    child bone parented under the root bone, a mesh per part carrying
 *    POSITION
 *
 *    - NORMAL + indices, and the one material attached.
 * 3. A skeletonless object with a raw, non-indexed, norm-less mesh and no material
 *    exports the bare positions only (no NORMAL, no indices, no material
 *    binding) — the negative twin of the character's every branch.
 * 4. The transparent/emissive material on the object becomes a BLEND material with
 *    an emissive factor.
 */
export const test_render_export_glb = async (): Promise<void> => {
  const io = new NodeIO();

  // 1. valid GLB magic
  const glb = await exportModelToGLB(CHARACTER);
  TestValidator.predicate("glb is non-empty", glb.length > 0);
  TestValidator.equals(
    "glb magic 'glTF'",
    [glb[0], glb[1], glb[2], glb[3]],
    [0x67, 0x6c, 0x54, 0x46],
  );

  // 2. character round-trips with skeleton + parts
  const charDoc = await io.readBinary(glb);
  const charRoot = charDoc.getRoot();
  TestValidator.equals(
    "character node count = bones + parts",
    charRoot.listNodes().length,
    4,
  );
  TestValidator.equals(
    "character mesh per part",
    charRoot.listMeshes().length,
    2,
  );
  TestValidator.equals(
    "character material count",
    charRoot.listMaterials().length,
    1,
  );
  const hips = charRoot.listNodes().find((n) => n.getName() === "hips")!;
  TestValidator.predicate(
    "spine is parented under hips",
    hips.listChildren().some((c) => c.getName() === "spine"),
  );
  const headMesh = charRoot.listMeshes().find((m) => m.getName() === "head")!;
  const headPrim = headMesh.listPrimitives()[0]!;
  TestValidator.predicate(
    "head primitive has POSITION",
    headPrim.getAttribute("POSITION") !== null,
  );
  TestValidator.predicate(
    "head primitive has NORMAL",
    headPrim.getAttribute("NORMAL") !== null,
  );
  TestValidator.predicate(
    "head primitive is indexed",
    headPrim.getIndices() !== null,
  );
  TestValidator.predicate(
    "head primitive has a material",
    headPrim.getMaterial() !== null,
  );

  // 3 & 4. skeletonless object: bare mesh, no material binding, BLEND material
  const objDoc = await io.readBinary(await exportModelToGLB(OBJECT));
  const objRoot = objDoc.getRoot();
  TestValidator.equals(
    "object node count = parts only",
    objRoot.listNodes().length,
    2,
  );
  const triMesh = objRoot.listMeshes().find((m) => m.getName() === "tri")!;
  const tri = triMesh.listPrimitives()[0]!;
  TestValidator.predicate(
    "raw mesh has POSITION",
    tri.getAttribute("POSITION") !== null,
  );
  TestValidator.equals(
    "raw mesh has no NORMAL",
    tri.getAttribute("NORMAL"),
    null,
  );
  TestValidator.equals("raw mesh is non-indexed", tri.getIndices(), null);
  TestValidator.equals("raw mesh has no material", tri.getMaterial(), null);
  const mat = objRoot.listMaterials()[0]!;
  TestValidator.equals(
    "emissive/transparent → BLEND",
    mat.getAlphaMode(),
    "BLEND",
  );
  TestValidator.predicate(
    "emissive factor set",
    mat.getEmissiveFactor()[0] > 0,
  );
};
