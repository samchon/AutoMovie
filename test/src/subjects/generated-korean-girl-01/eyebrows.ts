import { Vector3, createAutoMovieMeshDepthSampler } from "@automovie/engine";
import type { IAutoMovieModelPart } from "@automovie/interface";

import {
  portraitMix,
  portraitPart,
  portraitPoint,
  portraitSpline,
  portraitTube,
} from "../geometry";
import type { IControlMesh } from "../subdivideControlMesh";

/**
 * Fibre dimensions on the final forehead surface. Lengths use millimetres;
 * clearance is measured beyond the fibre radius along the local surface normal.
 * The width and location of the brow belong to its separate boundary binding.
 *
 * @author Samchon
 */
export interface IPortraitEyebrowProfile {
  /** Positive base fibre radius. */
  radius: number;
  /** Nonnegative radius increment for the deterministic three-fibre variation. */
  radiusStep: number;
  /** Fraction of radius lost towards the tip, in [0,1). */
  taper: number;
  /** Nonnegative clearance beyond the fibre radius. */
  clearance: number;
  /** Nonnegative mid-fibre arch above the surface. */
  arch: number;
  /** Signed outward bending distance; anatomical side supplies its direction. */
  outwardBend: number;
  /** Integral longitudinal segment count, from 1 through 32. */
  segments: number;
}

/** Authored brow fibre dimensions; these are rendering controls, not measured hair data. */
export const portraitEyebrowProfile: IPortraitEyebrowProfile = {
  // The source brow reads as a continuous soft band at the captured close
  // distance; retain individual fibres while giving the base enough width to
  // survive rasterisation beside the eye.
  radius: 0.05,
  radiusStep: 0.0075,
  // A gentler loss keeps the lateral ends legible instead of dissolving into
  // isolated dark points after the five longitudinal samples are rasterised.
  taper: 0.58,
  clearance: 0.03,
  // Lift remains shallow; it separates the enlarged fibres from the skin
  // without making a raised brow ridge or covering the upper lid.
  arch: 0.1,
  outwardBend: 1.2,
  segments: 5,
};

/** Refuse invalid fibre dimensions before fitting an eye or allocating brow meshes. */
export function assertPortraitEyebrowProfile(
  shape: IPortraitEyebrowProfile,
  fibres: number,
): void {
  if (
    !Number.isInteger(fibres) ||
    fibres < 0 ||
    fibres > 4096 ||
    ![
      shape.radius,
      shape.radiusStep,
      shape.taper,
      shape.clearance,
      shape.arch,
      shape.outwardBend,
    ].every(Number.isFinite) ||
    shape.radius <= 0 ||
    shape.radiusStep < 0 ||
    shape.taper < 0 ||
    shape.taper >= 1 ||
    shape.clearance < 0 ||
    shape.arch < 0 ||
    !Number.isFinite(
      shape.radius + 2 * shape.radiusStep + shape.clearance + shape.arch,
    ) ||
    !Number.isInteger(shape.segments) ||
    shape.segments < 1 ||
    shape.segments > 32
  )
    throw new Error(
      "Eyebrow fibres need finite dimensions, valid taper and bounded integral sampling.",
    );
}

/**
 * Build brow fibres against the actual refined skin. Boundary vertices define
 * their planar distribution; their interpolated depths are not a substitute for
 * surface contact between those vertices.
 *
 * This builder consumes the forehead surface; it does not construct the
 * supraorbital rim, brow soft-tissue pad, glabella or superior orbital sulcus.
 * Fibre arch is a hair dimension, not a brow-ridge projection. Their missing
 * form ownership is recorded separately in ../FACE-ANATOMY.md.
 *
 * A front-envelope query locates the skin at each fibre sample. Central height
 * differences estimate its local normal over one base fibre radius (at least
 * 0.001 mm). Radius, clearance and arch offset the centreline along that normal.
 * This keeps the cross section clear of a local tangent plane on sloping skin.
 * Curved-surface contact remains subject to the actual rendered inspection.
 *
 * The caller supplies millimetre skin coordinates and retained boundary IDs.
 * The acceleration structure uses engine metres; emitted parts use portraitPart
 * for their final metric conversion. Zero fibres produce no parts. Counts above
 * 4096 refuse rather than allocating an unbounded brow mesh population.
 */
export function buildPortraitEyebrow(
  skin: IControlMesh,
  binding: { side: "left" | "right"; upper: number[]; lower: number[] },
  fibres: number,
  input: IPortraitEyebrowProfile = portraitEyebrowProfile,
): IAutoMovieModelPart[] {
  const shape = { ...input };
  assertPortraitEyebrowProfile(shape, fibres);
  if (fibres === 0) return [];
  if (
    (binding.side !== "left" && binding.side !== "right") ||
    binding.upper.length < 2 ||
    binding.lower.length < 2 ||
    [...binding.upper, ...binding.lower].some(
      (id) => !Number.isInteger(id) || id < 0 || id >= skin.positions.length,
    )
  )
    throw new Error(
      "Eyebrow boundaries need a side and resident skin identities.",
    );
  const mesh = portraitPart(
    "brow-attachment-basis",
    {
      positions: skin.positions.flat(),
      indices: skin.indices,
      normals: null,
      uvs: null,
      skin: null,
    },
    "skin",
  ).geometry.mesh;
  const sample = createAutoMovieMeshDepthSampler(mesh, "z");
  const depth = (x: number, y: number): number => {
    const hit = sample(x / 1000, y / 1000);
    if (hit === null)
      throw new Error(
        "Eyebrow fibres must remain over their supporting skin surface.",
      );
    return hit.maximum * 1000;
  };
  const epsilon = Math.max(0.001, shape.radius);
  const contact = (x: number, y: number, offset: number) => {
    const z = depth(x, y);
    const dx = (depth(x + epsilon, y) - depth(x - epsilon, y)) / (2 * epsilon);
    const dy = (depth(x, y + epsilon) - depth(x, y - epsilon)) / (2 * epsilon);
    const normal = Vector3.normalize(portraitPoint(-dx, -dy, 1));
    return portraitPoint(
      x + normal.x * offset,
      y + normal.y * offset,
      z + normal.z * offset,
    );
  };
  const landmark = (id: number) =>
    portraitPoint(...(skin.positions[id] as [number, number, number]));
  const top = binding.upper.map(landmark),
    bottom = binding.lower.map(landmark);
  const outward = binding.side === "left" ? 1 : -1;
  const parts: IAutoMovieModelPart[] = [];
  for (let i = 0; i < fibres; i++) {
    const u = (i + 0.5) / fibres,
      a = portraitSpline(bottom, u),
      b = portraitSpline(top, u);
    // A brow hair grows from the lower edge through a short upward/outward
    // sweep. The former independent start/end fractions sampled most of the
    // full lower-to-upper span, so the close view read as a dense picket fence
    // of vertical lines. Keep a small deterministic root variation, then let
    // the authored side bend carry the visible direction of the fibres.
    const start = 0.1 + 0.12 * ((i * 0.61803398875) % 1),
      end = start + 0.26 + 0.08 * Math.sin(Math.PI * u);
    if (
      Math.hypot(
        (b.x - a.x) * (end - start) + outward * shape.outwardBend,
        (b.y - a.y) * (end - start),
      ) === 0
    )
      throw new Error("An eyebrow fibre needs a nonzero path along the skin.");
    const radius = (t: number) =>
      (shape.radius + (i % 3) * shape.radiusStep) * (1 - shape.taper * t);
    const fibre = portraitTube(
      (t) => {
        const v = portraitMix(start, end, t);
        return contact(
          portraitMix(a.x, b.x, v) + outward * shape.outwardBend * t * t,
          portraitMix(a.y, b.y, v),
          radius(t) + shape.clearance + shape.arch * Math.sin(Math.PI * t),
        );
      },
      radius,
      shape.segments,
    );
    parts.push(portraitPart(`${binding.side}-brow-hair-${i}`, fibre, "brows"));
  }
  return parts;
}
