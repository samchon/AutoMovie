import { IAutoMovieModel } from "@automovie/interface";
import { exportModelToGLB } from "@automovie/render";
import { NodeIO } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

/** A rig whose hips rest carries a non-unit scale (a common VRM import). */
const MODEL: IAutoMovieModel = {
  id: "scaled",
  name: "scaled",
  origin: "imported",
  body: null,
  skeleton: {
    id: "rig",
    bones: [
      {
        bone: "hips",
        parent: null,
        rest: {
          translation: { x: 0, y: 1, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1.02, y: 1.02, z: 1.02 },
        },
        constraint: null,
      },
    ],
  },
  materials: [],
  parts: [
    {
      id: "lamp",
      name: "lamp",
      geometry: { type: "primitive", shape: { type: "sphere", radius: 0.1 } },
      material: null,
      attachedBone: "hips",
      transform: {
        translation: { x: 0, y: 0.2, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 2, y: 3, z: 4 },
      },
    },
  ],
  asset: null,
};

/**
 * Exported bone nodes follow the decision-309 rig convention (#1086): the
 * engine's FK and the live viewer compose bone-rest ROTATION + TRANSLATION only
 * (#1052), so the exporter must not bake rest scale onto glTF bone nodes:
 * external viewers compose node scale into every descendant, and a VRM-style
 * rig with slight non-unit rest scales would render a scaled body no automovie
 * renderer or validator ever saw. PART node scale stays first-class: parts are
 * not rig bones on either side of the convention.
 *
 * Scenarios (hips rest scale 1.02, attached part scale (2,3,4)):
 *
 * 1. The exported hips node carries unit scale while its rest translation and
 *    rotation survive verbatim.
 * 2. Negative twin: the attached part's node keeps its authored (2,3,4) scale and
 *    its own translation.
 */
export const test_render_export_rest_scale = async (): Promise<void> => {
  const glb = await exportModelToGLB(MODEL);
  const doc = await new NodeIO().readBinary(glb);
  const nodes = new Map(
    doc
      .getRoot()
      .listNodes()
      .map((node) => [node.getName(), node]),
  );

  // 1. the bone node drops rest scale, keeps rotation + translation
  const hips = nodes.get("hips")!;
  TestValidator.equals(
    "the exported bone carries unit scale",
    [...hips.getScale()],
    [1, 1, 1],
  );
  TestValidator.equals(
    "the bone rest translation survives",
    [...hips.getTranslation()],
    [0, 1, 0],
  );
  TestValidator.equals(
    "the bone rest rotation survives",
    [...hips.getRotation()],
    [0, 0, 0, 1],
  );

  // 2. negative twin: the part node's scale is first-class
  const lamp = nodes.get("lamp")!;
  TestValidator.equals(
    "the attached part keeps its authored scale",
    [...lamp.getScale()],
    [2, 3, 4],
  );
  TestValidator.equals(
    "the part translation survives",
    [...lamp.getTranslation()],
    [0, 0.2, 0],
  );
};
