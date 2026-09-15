import {
  mergeAutoMovieMeshes,
  readAutoMovieImageFacts,
  tessellate,
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

import { placePortraitMesh, portraitMeshBuffers } from "./portraitMeshBuffers";

/**
 * Register this supported optical material set on every glTF reader and writer.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-export Names the clearcoat, refraction, transmission and volume extensions required to carry supported facial optics.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-export Supplies the four glTF-Transform extension classes registered by the portrait writer and its compatible readers.
 */
export const portraitGltfExtensions = [
  KHRMaterialsClearcoat,
  KHRMaterialsIOR,
  KHRMaterialsTransmission,
  KHRMaterialsVolume,
];

/**
 * Convert a static AutoMovie portrait into portable glTF buffers and materials.
 * Metallic/roughness colour, emission, alpha modes and scalar optical material
 * fields and resident PNG base-colour and normal textures are preserved.
 * External images, other texture slots and rigs are refused. PNG headers and positive extents
 * are inspected here; the receiving image decoder owns payload decoding.
 * Positive volume
 * thickness requires a closed manifold. Writers must register the exported
 * extension set; clients must support every optical extension used by a model.
 * Geometry and closed optical volumes are checked again at the actual Float32
 * output boundary; a valid double-precision source can lose a face on export.
 * This is a static facial-asset exporter, not a general scene-export API.
 * Prefer exportHumanFace for portable bytes. This low-level Document must be
 * written by the same glTF-Transform module instance that created it; mixing
 * CommonJS and ES-module instances can discard its geometry during writing.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-export Converts resident static facial parts and supported materials into portable glTF without silently flattening rigs or textures.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-export Groups transformed parts by material, validates final Float32 topology and optical closure, and creates indexed accessors with required material extensions.
 */
export function portraitDocument(model: IAutoMovieModel): Document {
  if (
    model.skeleton !== null ||
    model.materials.some((m) =>
      [m.metallicRoughnessTexture, m.occlusionTexture, m.emissiveTexture].some(
        (binding) => binding !== null && binding !== undefined,
      ),
    )
  )
    throw new Error(
      "Portrait export accepts static models with resident base-colour and normal PNG only.",
    );
  const document = new Document();
  const buffer = document.createBuffer();
  const scene = document.createScene(model.id);
  const textures = new Map<string, ReturnType<Document["createTexture"]>>();
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
      return placePortraitMesh(
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
    const packed = portraitMeshBuffers(mesh);
    // Quantization can merge separate edges even while every individual face
    // retains its area. Check all final material groups for manifold/winding
    // agreement; only a positive optical thickness additionally requires closure.
    if (
      !validateMeshTopology({
        mesh: { ...mesh, positions: Array.from(packed.positions) },
        expectClosed: (finish.thickness ?? 0) > 0,
      }).success
    )
      throw new Error(
        "Portrait Float32 material geometry must preserve its required topology: " +
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
    for (const slot of ["baseColorTexture", "normalTexture"] as const) {
      const binding = finish[slot];
      if (binding === null || binding === undefined) continue;
      if (
        typeof binding !== "string" ||
        !binding.startsWith("data:image/png;base64,")
      )
        throw new Error(
          "Portrait textures must be resident PNG data URIs with default UV0 sampling.",
        );
      if (
        mesh.uvs === null ||
        mesh.uvs.length !== (mesh.positions.length / 3) * 2 ||
        !mesh.uvs.every(Number.isFinite)
      )
        throw new Error(
          "Textured portrait groups require complete finite UV0 coordinates.",
        );
      let texture = textures.get(binding);
      if (texture === undefined) {
        const bytes = Uint8Array.from(atob(binding.slice(22)), (c) =>
          c.charCodeAt(0),
        );
        const facts = readAutoMovieImageFacts(bytes);
        if (
          bytes.length < 33 ||
          facts?.mediaType !== "image/png" ||
          facts.width <= 0 ||
          facts.height <= 0
        )
          throw new Error(
            "Portrait resident texture must contain a positive-size PNG header.",
          );
        texture = document
          .createTexture()
          .setImage(bytes)
          .setMimeType("image/png");
        textures.set(binding, texture);
      }
      if (slot === "baseColorTexture") {
        material.setBaseColorTexture(texture);
        material.getBaseColorTextureInfo()!.setWrapS(33071).setWrapT(33071);
      } else {
        material
          .setNormalTexture(texture)
          .setNormalScale(finish.normalScale ?? 1);
        material.getNormalTextureInfo()!.setWrapS(33071).setWrapT(33071);
      }
    }
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
      .setArray(packed.positions)
      .setBuffer(buffer);
    const indices = document
      .createAccessor()
      .setType("SCALAR")
      .setArray(packed.indices)
      .setBuffer(buffer);
    const primitive = document
      .createPrimitive()
      .setAttribute("POSITION", positions)
      .setIndices(indices)
      .setMaterial(material);
    if (packed.normals !== null)
      primitive.setAttribute(
        "NORMAL",
        document
          .createAccessor()
          .setType("VEC3")
          .setArray(packed.normals)
          .setBuffer(buffer),
      );
    if (mesh.colors !== undefined)
      primitive.setAttribute(
        "COLOR_0",
        document
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(mesh.colors))
          .setBuffer(buffer),
      );
    if (mesh.uvs !== null) {
      const uvs = new Float32Array(mesh.uvs);
      if (
        uvs.length !== (packed.positions.length / 3) * 2 ||
        !uvs.every(Number.isFinite)
      )
        throw new Error(
          "Portrait UV0 must remain complete and finite at Float32 precision.",
        );
      primitive.setAttribute(
        "TEXCOORD_0",
        document
          .createAccessor()
          .setType("VEC2")
          .setArray(uvs)
          .setBuffer(buffer),
      );
    }
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
