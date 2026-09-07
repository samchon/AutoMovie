import {
  mergeAutoMovieMeshes,
  tessellate,
  transformAutoMovieMesh,
  validateMeshTopology,
  validateModel,
} from "@automovie/engine";
import type { IAutoMovieModel } from "@automovie/interface";
import { Document } from "@gltf-transform/core";
import {
  KHRMaterialsClearcoat,
  KHRMaterialsIOR,
  KHRMaterialsTransmission,
  KHRMaterialsVolume,
} from "@gltf-transform/extensions";

/** Register this supported optical material set on every glTF reader and writer. */
export const portraitGltfExtensions = [
  KHRMaterialsClearcoat,
  KHRMaterialsIOR,
  KHRMaterialsTransmission,
  KHRMaterialsVolume,
];

/**
 * Convert a static AutoMovie portrait into portable glTF buffers and materials.
 * Metallic/roughness colour, emission, alpha modes and scalar optical material
 * fields are preserved. Rigs and texture resources are refused. Positive volume
 * thickness requires a closed manifold. Writers must register the exported
 * extension set; clients must support every optical extension used by a model.
 * This stays an experiment utility, not a product scene-export API.
 */
export function portraitDocument(model: IAutoMovieModel): Document {
  if (
    model.skeleton !== null ||
    model.materials.some((m) =>
      [
        m.baseColorTexture,
        m.metallicRoughnessTexture,
        m.normalTexture,
        m.occlusionTexture,
        m.emissiveTexture,
      ].some((binding) => binding !== null && binding !== undefined),
    )
  )
    throw new Error("Portrait export accepts static, untextured models.");
  const document = new Document();
  const buffer = document.createBuffer();
  const scene = document.createScene(model.id);
  document.getRoot().setDefaultScene(scene);
  for (const finish of model.materials) {
    const members = model.parts.filter((part) => part.material === finish.id);
    if (members.length === 0) continue;
    const meshes = members.map((part) => {
      const mesh =
        part.geometry.type === "mesh"
          ? part.geometry.mesh
          : {
              ...tessellate(part.geometry.shape),
              uvs: null,
              skin: null,
            };
      if (part.attachedBone !== null || mesh.skin !== null)
        throw new Error("Portrait export does not flatten bone bindings.");
      return transformAutoMovieMesh(
        mesh,
        part.transform === null
          ? {}
          : {
              translation: part.transform.translation,
              rotation: part.transform.rotation,
              scale: part.transform.scale,
            },
      );
    });
    const mesh = mergeAutoMovieMeshes(meshes);
    if (
      (finish.thickness ?? 0) > 0 &&
      !validateMeshTopology({ mesh, expectClosed: true }).success
    )
      throw new Error(
        "An optical volume needs closed, consistently wound geometry: " +
          finish.id,
      );
    const alphaModes = {
      opaque: "OPAQUE",
      mask: "MASK",
      blend: "BLEND",
    } as const;
    const material = document
      .createMaterial(finish.id)
      .setBaseColorFactor([
        finish.baseColor.r,
        finish.baseColor.g,
        finish.baseColor.b,
        finish.opacity,
      ])
      .setMetallicFactor(finish.metallic)
      .setRoughnessFactor(finish.roughness)
      .setDoubleSided(finish.doubleSided ?? false)
      .setEmissiveFactor(
        finish.emissive === null
          ? [0, 0, 0]
          : [finish.emissive.r, finish.emissive.g, finish.emissive.b],
      )
      .setAlphaMode(
        finish.alphaMode === undefined
          ? finish.opacity < 1
            ? "BLEND"
            : "OPAQUE"
          : alphaModes[finish.alphaMode],
      )
      .setAlphaCutoff(finish.alphaCutoff ?? 0.5);
    if (finish.transmission !== undefined || finish.thickness !== undefined)
      material.setExtension(
        "KHR_materials_transmission",
        document
          .createExtension(KHRMaterialsTransmission)
          .setRequired(true)
          .createTransmission()
          .setTransmissionFactor(finish.transmission ?? 0),
      );
    if (finish.ior !== undefined)
      material.setExtension(
        "KHR_materials_ior",
        document
          .createExtension(KHRMaterialsIOR)
          .setRequired(true)
          .createIOR()
          .setIOR(finish.ior),
      );
    if (finish.thickness !== undefined)
      material.setExtension(
        "KHR_materials_volume",
        document
          .createExtension(KHRMaterialsVolume)
          .setRequired(true)
          .createVolume()
          .setThicknessFactor(finish.thickness),
      );
    if (finish.clearcoat !== undefined)
      material.setExtension(
        "KHR_materials_clearcoat",
        document
          .createExtension(KHRMaterialsClearcoat)
          .setRequired(true)
          .createClearcoat()
          .setClearcoatFactor(finish.clearcoat),
      );
    const positions = document
      .createAccessor()
      .setType("VEC3")
      .setArray(new Float32Array(mesh.positions))
      .setBuffer(buffer);
    const indices = document
      .createAccessor()
      .setType("SCALAR")
      .setArray(new Uint32Array(mesh.indices!))
      .setBuffer(buffer);
    const primitive = document
      .createPrimitive()
      .setAttribute("POSITION", positions)
      .setIndices(indices)
      .setMaterial(material);
    if (mesh.normals !== null)
      primitive.setAttribute(
        "NORMAL",
        document
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(mesh.normals))
          .setBuffer(buffer),
      );
    scene.addChild(
      document
        .createNode(finish.id)
        .setMesh(document.createMesh(finish.id).addPrimitive(primitive)),
    );
  }
  if (
    model.parts.some(
      (part) => !model.materials.some((finish) => finish.id === part.material),
    )
  )
    throw new Error("Every portrait part must name a resident material.");
  const validation = validateModel({ model });
  if (!validation.success)
    throw new Error("Portrait model is invalid: " + JSON.stringify(validation));
  return document;
}
