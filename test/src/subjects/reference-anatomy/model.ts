import type { IAutoMovieModel } from "@automovie/interface";

import { createPortraitMaterials } from "../generated-korean-girl-01/materials";
import {
  portraitNormals,
  portraitPart,
  portraitPatch,
  portraitPoint,
  portraitRegion,
} from "../geometry";
import basis from "./mesh.json";

/**
 * Controls for the anatomical reference study, not a completed human editor.
 * The CC0 child/young endpoint blend is an authored prior and is not calibrated
 * to chronological age. Expression weights operate on the same connected skin.
 * Eye dimensions and placement use millimetres in the common head frame.
 * @author Samchon
 */
export interface IAnatomicalStudyShape {
  /** Child endpoint contribution, in [0,1]; the young contribution is its complement. */
  youth: number;
  /** Mouth-corner puller contribution, in [0,1]. */
  smile: number;
  /** Mouth-opening contribution, in [0,1]. */
  jawOpen: number;
  /** Positive distance between the eye joint centres. */
  eyeDistance: number;
  /** Height and anterior depth of their midpoint. */
  eyeHeight: number;
  eyeDepth: number;
  /** Positive globe radius; the two globes must remain separated. */
  eyeRadius: number;
  /** Positive iris radius, smaller than the globe. */
  irisRadius: number;
  /** Positive pupil radius, smaller than the iris. */
  pupilRadius: number;
}

/** Current unfitted anatomical prior; its values do not claim the target likeness. */
export const anatomicalStudyShape: IAnatomicalStudyShape = {
  youth: 0.6,
  smile: 0.55,
  jawOpen: 0.35,
  eyeDistance: 64,
  eyeHeight: 25,
  eyeDepth: 37,
  eyeRadius: 12.2,
  irisRadius: 5.7,
  pupilRadius: 2.55,
};

/**
 * Reconstruct a resident CC0 head with its connected lids, nasal cavities, oral
 * cavity, ears and upper neck. Skin coordinates and eye-joint anchors receive
 * the same weighted targets before one common normalization. No body below the
 * recorded crop, helper cubes or MPFB program logic enter the rendered model.
 *
 * This is an explicitly labelled reference study. The supplied photograph has
 * not been fitted to this surface. Primitive optical parts only make the eye
 * openings readable while the continuous surface is evaluated.
 */
export function buildAnatomicalStudy(
  input: IAnatomicalStudyShape,
): IAutoMovieModel {
  const shape = { ...input };
  if (
    ![shape.youth, shape.smile, shape.jawOpen].every(
      (v) => Number.isFinite(v) && v >= 0 && v <= 1,
    ) ||
    ![
      shape.eyeDistance,
      shape.eyeRadius,
      shape.irisRadius,
      shape.pupilRadius,
    ].every((v) => Number.isFinite(v) && v > 0) ||
    ![shape.eyeHeight, shape.eyeDepth].every(Number.isFinite) ||
    shape.pupilRadius >= shape.irisRadius ||
    shape.irisRadius >= shape.eyeRadius ||
    2 * shape.eyeRadius >= shape.eyeDistance
  )
    throw new Error(
      "Anatomical study controls need bounded weights, finite placement and ordered positive eye radii.",
    );
  const positions = basis.positions.map((p) => [...p]),
    eyes = basis.eyes.map((p) => [...p]);
  for (const [name, weight] of [
    ["child", shape.youth],
    ["young", 1 - shape.youth],
    ["smile", shape.smile],
    ["jawOpen", shape.jawOpen],
  ] as const) {
    const target = basis.morphs[name];
    for (const [id, x, y, z] of target.points)
      for (let axis = 0; axis < 3; axis++)
        positions[id][axis] += weight * [x, y, z][axis];
    for (let side = 0; side < 2; side++)
      for (let axis = 0; axis < 3; axis++)
        eyes[side][axis] += weight * target.eyes[side][axis];
  }
  const middle = [0, 1, 2].map((axis) => (eyes[0][axis] + eyes[1][axis]) / 2);
  const scale = shape.eyeDistance / (eyes[1][0] - eyes[0][0]);
  const target = [0, shape.eyeHeight, shape.eyeDepth];
  const transform = (p: number[]) =>
    p.map((v, axis) => (v - middle[axis]) * scale + target[axis]);
  const transformed = positions.map(transform),
    centres = eyes.map(transform);
  if (
    transformed.some(
      (p) =>
        !p.every(
          (v) => Number.isFinite(v) && Number.isFinite(Math.fround(v / 1000)),
        ),
    )
  )
    throw new Error(
      "Anatomical study coordinates exceed their representable range.",
    );
  const packed = transformed.flat(),
    normals = portraitNormals(packed, basis.indices);
  const parts = [];
  for (const [group, material] of [
    [0, "skin"],
    [1, "lips"],
  ] as const) {
    const indices = basis.indices.filter(
      (_v, i) => basis.groups[Math.floor(i / 3)] === group,
    );
    parts.push(
      portraitPart(
        "anatomical-" + material,
        portraitRegion(packed, normals, indices),
        material,
      ),
    );
  }
  for (let side = 0; side < 2; side++) {
    const [x, y, z] = centres[side];
    parts.push(
      portraitPart(
        "study-globe-" + side,
        portraitPatch(
          (u, v) => {
            const a = 2 * Math.PI * u,
              b = Math.PI * (v - 0.5);
            return portraitPoint(
              x + shape.eyeRadius * Math.sin(a) * Math.cos(b),
              y + shape.eyeRadius * Math.sin(b),
              z + shape.eyeRadius * Math.cos(a) * Math.cos(b),
            );
          },
          48,
          24,
        ),
        "sclera",
      ),
    );
    for (const [name, radius, lift] of [
      ["iris-1", shape.irisRadius, 0.04],
      ["pupil", shape.pupilRadius, 0.07],
    ] as const)
      parts.push(
        portraitPart(
          "study-" + name + "-" + side,
          portraitPatch(
            (u, v) => {
              const dx = radius * v * Math.cos(2 * Math.PI * u),
                dy = -radius * v * Math.sin(2 * Math.PI * u);
              return portraitPoint(
                x + dx,
                y + dy,
                z + Math.sqrt(shape.eyeRadius ** 2 - dx * dx - dy * dy) + lift,
              );
            },
            48,
            12,
          ),
          name,
        ),
      );
  }
  return {
    id: "cc0-anatomical-surface-study",
    name: "Unfitted CC0 anatomical surface study",
    origin: "generated",
    parts,
    materials: createPortraitMaterials(),
    skeleton: null,
    body: null,
    asset: null,
  };
}
