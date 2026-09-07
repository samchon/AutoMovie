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
  radius: 0.035,
  radiusStep: 0.0075,
  taper: 0.8,
  clearance: 0.03,
  arch: 0.08,
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
    const start = 0.3 * ((i * 0.61803398875) % 1),
      end = 0.5 + 0.45 * ((i * 0.41421356237) % 1);
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
