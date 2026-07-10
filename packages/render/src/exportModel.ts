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
 * **Fidelity reductions against the live viewer (#1088).** A skinned mesh part
 * (`attachedBone: null` with `skin` data) exports as a STATIC mesh — no
 * `JOINTS_0`/`WEIGHTS_0`, no glTF skin — so it renders at its rest shape in
 * external viewers; only rigid `attachedBone` parts articulate in the export. A
 * mesh without authored normals exports SMOOTH vertex normals when indexed (the
 * same area-weighted computation the viewer's `computeVertexNormals` performs);
 * a non-indexed triangle soup omits `NORMAL`, and glTF's mandated flat shading
 * equals what the viewer computes for a soup anyway.
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
        // The live viewer renders `opacity` (three's material opacity) and
        // ignores baseColor.a, so `{opacity: 0.5, a: null}` was 50%
        // transparent live yet fully opaque exported (#1088) — fold opacity
        // into the one alpha glTF has.
        (m.baseColor.a ?? 1) * m.opacity,
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
      boneNodes.set(b.bone, setBoneRest(doc.createNode(b.bone), b.rest));
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
            // The viewer computes smooth vertex normals when none are
            // authored; omitting NORMAL here meant glTF-mandated flat
            // shading instead (#1088). Match the viewer for indexed meshes;
            // a non-indexed soup's computed normals ARE flat, which the
            // glTF default already provides.
            normals:
              part.geometry.mesh.normals ??
              (part.geometry.mesh.indices === null
                ? []
                : computeSmoothNormals(
                    part.geometry.mesh.positions,
                    part.geometry.mesh.indices,
                  )),
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

/**
 * Area-weighted smooth vertex normals over an indexed triangle list — the same
 * computation three's `computeVertexNormals` performs for the live viewer
 * (#1088): each triangle's unnormalized cross product accumulates onto its
 * three vertices (the magnitude IS the area weight), then each vertex normal is
 * normalized. A degenerate vertex (no area) stays zero rather than NaN.
 */
const computeSmoothNormals = (
  positions: number[],
  indices: number[],
): number[] => {
  const normals = new Array<number>(positions.length).fill(0);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i]!, indices[i + 1]!, indices[i + 2]!];
    const abx = positions[b * 3]! - positions[a * 3]!;
    const aby = positions[b * 3 + 1]! - positions[a * 3 + 1]!;
    const abz = positions[b * 3 + 2]! - positions[a * 3 + 2]!;
    const acx = positions[c * 3]! - positions[a * 3]!;
    const acy = positions[c * 3 + 1]! - positions[a * 3 + 1]!;
    const acz = positions[c * 3 + 2]! - positions[a * 3 + 2]!;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const v of [a, b, c]) {
      normals[v * 3] = normals[v * 3]! + nx;
      normals[v * 3 + 1] = normals[v * 3 + 1]! + ny;
      normals[v * 3 + 2] = normals[v * 3 + 2]! + nz;
    }
  }
  for (let v = 0; v < normals.length; v += 3) {
    const len = Math.hypot(normals[v]!, normals[v + 1]!, normals[v + 2]!);
    if (len === 0) continue;
    normals[v] = normals[v]! / len;
    normals[v + 1] = normals[v + 1]! / len;
    normals[v + 2] = normals[v + 2]! / len;
  }
  return normals;
};

/**
 * Apply a bone REST transform: rotation + translation only, unit scale — the
 * decision-309 rig convention (#1052, #1086). The engine's FK and the live
 * viewer both ignore bone-rest scale, so exporting it verbatim would let
 * external glTF viewers compose into every descendant a scale no automovie
 * renderer or validator ever saw. PART node scale stays first-class through
 * {@link setTRS} — parts are not rig bones on either side of the convention.
 */
const setBoneRest = (node: Node, rest: IAutoMovieTransform): Node =>
  node
    .setTranslation([
      rest.translation.x,
      rest.translation.y,
      rest.translation.z,
    ])
    .setRotation([
      rest.rotation.x,
      rest.rotation.y,
      rest.rotation.z,
      rest.rotation.w,
    ]);
