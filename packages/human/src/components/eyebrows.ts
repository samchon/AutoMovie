import { Vector3, createAutoMovieMeshDepthSampler } from "@automovie/engine";
import type { IAutoMovieModelPart } from "@automovie/interface";

import {
  portraitMix,
  portraitPart,
  portraitPatch,
  portraitPoint,
  portraitSpline,
  portraitTube,
} from "../geometry/geometry";
import type { IControlMesh } from "../geometry/subdivideControlMesh";
import {
  type IPortraitEyebrowFlowProfile,
  createPortraitEyebrowFlow,
} from "./eyebrowFlow";

/**
 * Fibre dimensions on the final forehead surface. Lengths use millimetres;
 * clearance is measured beyond the fibre radius along the local surface normal.
 * The width and location of the brow belong to its separate boundary binding.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Separates brow fibre dimensions and distribution from the underlying orbital skin form.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines millimetre strand radius, clearance and bend with bounded sampling, cross-brow root span and endpoint density fades.
 */
export interface IPortraitEyebrowProfile {
  /** Optional skin-following ribbon instead of an eight-sided tube; omission preserves tube geometry. */
  representation?: "ribbon";
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
  /** Optional minimum/maximum root position across the brow, lower zero to upper one; defaults to [0.1,0.22]. */
  rootBand?: readonly [number, number];
  /** Optional cross-brow fibre span in [0,1]; without flow it cannot exceed one minus the maximum root. Omission uses 0.26 to 0.34 along the brow. */
  span?: number;
  /** Optional medial/lateral density fade lengths as fractions of the brow arc, each in [0,0.5]. Omission retains every fibre. */
  endFade?: readonly [number, number];
  /** Optional unsigned 32-bit density seed. Presence selects thinning independent of root height; omission preserves the original coupled population for numerical replay. */
  densitySeed?: number;
  /** Optional complete longitudinal/cross-root flow; replaces span and outwardBend for emitted fibres. */
  flow?: IPortraitEyebrowFlowProfile;
}

/**
 * Authored brow fibre dimensions; these are rendering controls, not measured hair data.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Supplies reusable fibre dimensions for brows fitted to caller-owned skin.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Provides the default strand radius, taper, arch, bend and sample count; it does not supply a person's brow boundary.
 */
export const portraitEyebrowProfile: IPortraitEyebrowProfile = {
  // Provisional fibre dimensions preserve a visible strand at close range.
  // A subject supplies its own density, distribution and optical judgement.
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

/**
 * Refuse invalid fibre dimensions before fitting an eye or allocating brow meshes.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Refuses impossible strand dimensions and populations before brow mesh construction.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Checks finite radii, taper, bounded segments and roots/spans inside the supporting brow, including optional endpoint fades.
 */
export function assertPortraitEyebrowProfile(
  shape: IPortraitEyebrowProfile,
  fibres: number,
): void {
  if (shape.representation !== undefined && shape.representation !== "ribbon")
    throw new Error(
      "Eyebrow representation must be ribbon or omitted for tubes.",
    );
  if (shape.flow !== undefined) createPortraitEyebrowFlow(shape.flow);
  if (
    shape.densitySeed !== undefined &&
    (!Number.isInteger(shape.densitySeed) ||
      shape.densitySeed < 0 ||
      shape.densitySeed > 0xffffffff)
  )
    throw new Error("Eyebrow density seed must be an unsigned 32-bit integer.");
  const roots = shape.rootBand ?? [0.1, 0.22];
  const maximumSpan = shape.span ?? 0.34;
  const ends = shape.endFade ?? [0, 0];
  if (
    ends.length !== 2 ||
    ends.some((value) => !Number.isFinite(value) || value < 0 || value > 0.5)
  )
    throw new Error("Eyebrow endpoint fades must be two fractions in [0,0.5].");
  if (
    roots.length !== 2 ||
    !roots.every(Number.isFinite) ||
    roots[0] < 0 ||
    roots[1] < roots[0] ||
    roots[1] > 1 ||
    !Number.isFinite(maximumSpan) ||
    maximumSpan < 0 ||
    maximumSpan > 1 ||
    (shape.flow === undefined && roots[1] + maximumSpan > 1)
  )
    throw new Error(
      "Eyebrow root band and fibre span must remain inside the supporting brow.",
    );
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
 * Fibre arch is a hair dimension, not a brow-ridge projection. Orbital support
 * and the host's authored skin layers own those surrounding tissue forms.
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
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Constructs individually rooted eyebrow fibres on the final forehead surface.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Queries the skin depth and local normal per strand sample, applies anatomical outward bend and deterministic density thinning, and emits metric parts.
 */
export function buildPortraitEyebrow(
  skin: IControlMesh,
  binding: { side: "left" | "right"; upper: number[]; lower: number[] },
  fibres: number,
  input: IPortraitEyebrowProfile = portraitEyebrowProfile,
): IAutoMovieModelPart[] {
  const shape = structuredClone(input);
  assertPortraitEyebrowProfile(shape, fibres);
  if (fibres === 0) return [];
  const flow =
    shape.flow === undefined
      ? undefined
      : createPortraitEyebrowFlow(shape.flow);
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
  // Existing documents retain their exact thinning population. A supplied seed
  // chooses an independent sequence and a stable phase without random state.
  const densityStep =
    shape.densitySeed === undefined ? 0.61803398875 : Math.SQRT2;
  const densityPhase =
    shape.densitySeed === undefined
      ? 0
      : (Math.imul(shape.densitySeed, 0x9e3779b1) >>> 0) / 0x100000000;
  const parts: IAutoMovieModelPart[] = [];
  for (let i = 0; i < fibres; i++) {
    const u = (i + 0.5) / fibres,
      a = portraitSpline(bottom, u),
      b = portraitSpline(top, u);
    // Distribute roots within the authored band, then use its complete flow or
    // the basic upward/outward sweep. Density is independent of fibre radius.
    const rootBand = shape.rootBand ?? [0.1, 0.22];
    const anatomical = binding.side === "left" ? u : 1 - u;
    const ends = shape.endFade ?? [0, 0];
    const fade = (distance: number, reach: number): number => {
      if (reach === 0) return 1;
      const t = Math.min(1, distance / reach);
      return t * t * (3 - 2 * t);
    };
    const envelope = fade(anatomical, ends[0]) * fade(1 - anatomical, ends[1]);
    // Thin the population, not the radius: sub-resolution tube rings collapse
    // under the model's geometric weld tolerance. Each retained hair keeps its
    // independently authored physical radius and longitudinal taper.
    if (((i + 0.5) * densityStep + densityPhase) % 1 >= envelope) continue;
    const rootFraction = (i * 0.61803398875) % 1;
    const start = rootBand[0] + (rootBand[1] - rootBand[0]) * rootFraction;
    const direction = flow?.(
      anatomical,
      rootBand[0] === rootBand[1] ? 0.5 : rootFraction,
    );
    const end =
      direction?.tip ??
      start + (shape.span ?? 0.26 + 0.08 * Math.sin(Math.PI * u));
    const outwardBend = direction?.outwardBend ?? shape.outwardBend;
    if (
      Math.hypot(
        (b.x - a.x) * (end - start) + outward * outwardBend,
        (b.y - a.y) * (end - start),
      ) === 0
    )
      throw new Error("An eyebrow fibre needs a nonzero path along the skin.");
    const radius = (t: number) =>
      (shape.radius + (i % 3) * shape.radiusStep) * (1 - shape.taper * t);
    const projected = (t: number) => {
      const v = portraitMix(start, end, t);
      return portraitPoint(
        portraitMix(a.x, b.x, v) + outward * outwardBend * t * t,
        portraitMix(a.y, b.y, v),
        0,
      );
    };
    const curve = (t: number) => {
      const point = projected(t);
      return contact(
        point.x,
        point.y,
        radius(t) + shape.clearance + shape.arch * Math.sin(Math.PI * t),
      );
    };
    const fibre =
      shape.representation === undefined
        ? portraitTube(curve, radius, shape.segments)
        : portraitPatch(
            (u, t) => {
              const center = projected(t);
              const before = projected(Math.max(0, t - 0.001)),
                after = projected(Math.min(1, t + 0.001));
              const across = Vector3.normalize(
                portraitPoint(before.y - after.y, after.x - before.x, 0),
              );
              if (across.x === 0 && across.y === 0)
                throw new Error(
                  "Eyebrow ribbon needs a nonzero projected tangent.",
                );
              return contact(
                center.x + across.x * radius(t) * (2 * u - 1),
                center.y + across.y * radius(t) * (2 * u - 1),
                shape.clearance +
                  shape.arch * Math.sin(Math.PI * t) +
                  radius(t),
              );
            },
            1,
            shape.segments,
          );
    parts.push(portraitPart(`${binding.side}-brow-hair-${i}`, fibre, "brows"));
  }
  return parts;
}
