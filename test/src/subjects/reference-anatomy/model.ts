import type { IAutoMovieModel } from "@automovie/interface";

import {
  appendPortraitNeck,
  portraitNeckShape,
} from "../generated-korean-girl-01/cranium";
import { createPortraitMaterials } from "../generated-korean-girl-01/materials";
import { portraitCutBoundary } from "../generated-korean-girl-01/nose";
import {
  portraitNormals,
  portraitPart,
  portraitPatch,
  portraitPoint,
  portraitRegion,
} from "../geometry";
import { portraitEyeSphereIntersection } from "../portraitEyeSphere";
import { assertPortraitSkinTopology } from "../portraitSkinTopology";
import {
  type IPortraitSurfaceFit,
  createPortraitSurfaceFitter,
} from "../portraitSurfaceFit";
import { subdividePortraitQuads } from "../subdividePortraitQuads";
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
  /** Surface refinement, separate from anatomy; integer zero through three. */
  subdivisionRounds?: number;
}

/** Current unfitted anatomical prior; its values do not claim the target likeness. */
export const anatomicalStudyShape: IAnatomicalStudyShape = {
  youth: 0.6,
  smile: 0.55,
  jawOpen: 0.35,
  eyeDistance: 64,
  eyeHeight: 25,
  eyeDepth: 37,
  // The source eye-helper envelope at this normalized separation has a
  // transverse radius about 16.7 mm. This 16 mm globe is an authored fit to that
  // envelope; it is not a physiological radius inferred from the photograph.
  eyeRadius: 16,
  irisRadius: 6.4,
  pupilRadius: 2.55,
};

/**
 * Reconstruct a resident CC0 head with its connected lids, nasal cavities, oral
 * cavity, ears and upper neck. Skin coordinates and eye-joint anchors receive
 * the same weighted targets before one common normalization. No body below the
 * recorded crop, helper cubes or MPFB program logic enter the rendered model.
 *
 * Without a fit this remains the labelled anatomical prior. A supplied recorded
 * residual fits that same surface to image observations; the residual's source
 * and inferred depth retain separate provenance. Optical parts remain rigid.
 */
export function buildAnatomicalStudy(
  input: IAnatomicalStudyShape,
  fit?: IPortraitSurfaceFit,
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
  // Keep the original quad cage until the neck has been attached. Refining skin
  // first would leave the newly introduced neck rings outside the shared smooth
  // surface and retain the crop's stair-step boundary in the visible result.
  const smooth = subdividePortraitQuads(
    { positions: transformed, faces: basis.faces, groups: basis.faceGroups },
    0,
  );
  const cage = {
    positions: smooth.positions,
    indices: [] as number[],
    groups: [] as number[],
  };
  smooth.faces.forEach((face, i) => {
    cage.indices.push(face[0], face[1], face[2], face[0], face[2], face[3]);
    cage.groups.push(smooth.groups[i], smooth.groups[i]);
  });
  // The native crop is one open ring. Reverse its existing boundary direction
  // before adding neck faces, giving every shared edge opposite incident winding.
  const boundary = portraitCutBoundary(
    Array.from({ length: cage.indices.length / 3 }, (_v, i) =>
      cage.indices.slice(i * 3, i * 3 + 3),
    ),
  )
    .map((edge) => edge.a)
    .reverse();
  // An original crop corner may have only boundary neighbours. Incident face
  // centres still define its inward support, including an unrefined single-face
  // corner; averaging only non-boundary vertices would be undefined there.
  const sums = cage.positions.map(() => [0, 0, 0]),
    counts = new Uint32Array(cage.positions.length);
  for (let i = 0; i < cage.indices.length; i += 3) {
    const ids = cage.indices.slice(i, i + 3),
      centre = [0, 1, 2].map((a) =>
        ids.reduce((sum, id) => sum + cage.positions[id][a] / 3, 0),
      );
    for (const id of ids) {
      counts[id]++;
      for (let a = 0; a < 3; a++) sums[id][a] += centre[a];
    }
  }
  const exterior = boundary.map((id) => sums[id].map((v) => v / counts[id]));
  const proportion = shape.eyeDistance / 64;
  const section = (s: typeof portraitNeckShape.upper) => ({
    y: shape.eyeHeight + (s.y - 25) * proportion,
    width: s.width * proportion,
    front: s.front * proportion,
    back: s.back * proportion,
    centre: shape.eyeDepth + (s.centre - 37) * proportion,
  });
  const originalTriangleIndexCount = cage.indices.length;
  const crop = appendPortraitNeck(
    cage,
    { boundary, exterior },
    {
      upper: section(portraitNeckShape.upper),
      lower: section(portraitNeckShape.lower),
      crop: section(portraitNeckShape.crop),
    },
  );
  assertPortraitSkinTopology(cage, [crop]);
  // The neck writer emits two triangles [a,b,c], [b,d,c] per ring cell.
  // Recover that exact quad [a,b,d,c], then refine head, lip labels and neck
  // together. Shared edge points give the attachment one continuous limit
  // surface; normals alone cannot smooth a geometric fold at the crop.
  const joinedFaces = smooth.faces.map((face) => [...face]);
  const joinedGroups = [...smooth.groups];
  for (let i = originalTriangleIndexCount; i < cage.indices.length; i += 6) {
    joinedFaces.push([
      cage.indices[i],
      cage.indices[i + 1],
      cage.indices[i + 4],
      cage.indices[i + 2],
    ]);
    joinedGroups.push(0);
  }
  const refined = subdividePortraitQuads(
    { positions: cage.positions, faces: joinedFaces, groups: joinedGroups },
    shape.subdivisionRounds ?? 1,
  );
  cage.positions = refined.positions;
  cage.indices = [];
  cage.groups = [];
  refined.faces.forEach((face, i) => {
    cage.indices.push(face[0], face[1], face[2], face[0], face[2], face[3]);
    cage.groups.push(refined.groups[i], refined.groups[i]);
  });
  // Warp shared skin before material separation. Optical centres receive the
  // residual once; their globe surfaces stay rigid and keep their own radius.
  if (fit !== undefined) {
    const warp = createPortraitSurfaceFitter(fit);
    cage.positions = cage.positions.map(warp);
    for (let i = 0; i < centres.length; i++) centres[i] = warp(centres[i]);
  }
  const packed = cage.positions.flat(),
    normals = portraitNormals(packed, cage.indices);
  const parts = [];
  for (const [group, material] of [
    [0, "skin"],
    [1, "lips"],
  ] as const) {
    const indices = cage.indices.filter(
      (_v, i) => cage.groups[Math.floor(i / 3)] === group,
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
    const gaze = fit?.gazeOrigins?.[side];
    const irisCenter =
      gaze === undefined
        ? portraitPoint(x, y, z + shape.eyeRadius)
        : portraitEyeSphereIntersection(
            { center: portraitPoint(x, y, z), radius: shape.eyeRadius },
            portraitPoint(gaze[0], gaze[1], gaze[2]),
            portraitPoint(...(fit!.viewRay as [number, number, number])),
          );
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
                irisCenter.x + dx,
                irisCenter.y + dy,
                z +
                  Math.sqrt(
                    shape.eyeRadius ** 2 -
                      (irisCenter.x + dx - x) ** 2 -
                      (irisCenter.y + dy - y) ** 2,
                  ) +
                  lift,
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
