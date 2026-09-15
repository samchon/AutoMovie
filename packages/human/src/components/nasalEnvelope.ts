import { Vector3 } from "@automovie/engine";

import { portraitNormals } from "../geometry/geometry";
import type { IControlMesh } from "../geometry/subdivideControlMesh";
import {
  portraitNasalRimJets,
  samplePortraitNasalEntry,
  samplePortraitNasalSection,
} from "./nasalAperture";

/**
 * One exterior-to-vestibule section around an ordered nasal opening.
 * Width, crest and roll are independent of the opening's fitted position.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Separates circumferential tissue width, crest position and inward roll instead of assigning one torus section to every nasal margin.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines an ordered unit-perimeter station with metric exterior dimensions and a signed shared-rim tangent angle.
 * @author Samchon
 */
export interface IPortraitNasalEnvelopeSection {
  /** Fraction in [0,1) from the first original cut-boundary vertex, in its winding. */
  at: number;
  /** Positive exterior attachment width, in mm. */
  width: number;
  /** Signed crest relief along the aperture section normal, in mm. */
  crest: number;
  /** Crest distance from the aperture as a fraction of width, strictly in (0,1). */
  crestPosition: number;
  /** Degrees from aperture-plane outward direction towards its outward normal. */
  roll: number;
}

/**
 * A complete cyclic exterior and vestibular envelope, evaluated after host
 * subdivision. Sections replace as one ordered population. One station is a
 * uniform section; multiple stations allow different alar, sill and columellar
 * shapes. Their values interpolate periodically with zero station derivatives,
 * without overshooting the supplied widths or crest positions.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Authors a connected nasal envelope with distinct local sections and shared skin-to-lining derivatives.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Keeps cyclic section data separate from the per-interval tessellation count and constructs it after general host refinement.
 * @author Samchon
 */
export interface IPortraitNasalEnvelope {
  /** Nonempty, strictly increasing stations, beginning at zero. */
  sections: readonly IPortraitNasalEnvelopeSection[];
  /** Samples per exterior interval and half-vestibule, integer 2..64. */
  segments: number;
}

/**
 * Fit one numerical envelope and return its refined-region appender. Original
 * aperture samples remain interpolated by a periodic cubic spatial curve; its
 * parameter is original edge ordinal, not physical arc length. Host refinement
 * may add boundary samples, but it never resculpts the new crest or vestibule.
 *
 * The caller reserves one disk with the returned outer points and supplies its
 * original IDs in the same cyclic order. The appender keeps the actual refined
 * outer boundary fixed, joins two Hermite exterior intervals to the shared rim
 * jet, then consumes the same jet in the recessed vestibule. Depth/axis come
 * solely from the caller's rotated cavity offset. This is authored surface
 * geometry, not a reconstructed airway or a self-intersection certificate.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Builds skin, rolled aperture and vestibule as one connected numerical surface without independently positioned lining.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Resolves cyclic original-to-refined boundary lineage, preserves resident attachment vertices and samples shared Hermite jets after subdivision.
 */
export function createPortraitNasalEnvelope(
  inputPoints: readonly (readonly number[])[],
  inputNormals: readonly (readonly number[])[],
  input: IPortraitNasalEnvelope,
  inputOffset: readonly number[],
  contraction: number,
): {
  outer: number[][];
  append: (
    cage: IControlMesh,
    boundary: readonly number[],
    seeds: readonly number[],
    skinGroup: number,
    liningGroup: number,
  ) => void;
} {
  if (
    !Number.isInteger(input.segments) ||
    input.segments < 2 ||
    input.segments > 64 ||
    input.sections.length === 0 ||
    input.sections[0].at !== 0 ||
    input.sections.some(
      (s, i) =>
        ![s.at, s.width, s.crest, s.crestPosition, s.roll].every(
          Number.isFinite,
        ) ||
        s.at < 0 ||
        s.at >= 1 ||
        (i !== 0 && s.at <= input.sections[i - 1].at) ||
        s.width <= 0 ||
        s.crestPosition <= 0 ||
        s.crestPosition >= 1,
    ) ||
    inputPoints.length < 3 ||
    inputNormals.length !== inputPoints.length ||
    [...inputPoints, ...inputNormals, inputOffset].some(
      (p) => p.length !== 3 || !p.every(Number.isFinite),
    ) ||
    !Number.isFinite(contraction) ||
    contraction <= 0 ||
    contraction >= 1
  )
    throw new Error(
      "A nasal envelope needs ordered finite sections, positive widths, unit crest positions and 2..64 samples per interval.",
    );
  const points = inputPoints.map((p) => [...p]);
  const normals = inputNormals.map((p) => unit(p));
  const offset = [...inputOffset],
    depth = Math.hypot(...offset);
  if (!Number.isFinite(depth) || depth === 0)
    throw new Error("A nasal envelope needs finite nonzero cavity travel.");
  const sections = input.sections.map((s) => ({ ...s })),
    segments = input.segments;
  const section = (phase: number): IPortraitNasalEnvelopeSection => {
    const next = sections.findIndex((s) => s.at > phase);
    const right = next === -1 ? sections[0] : sections[next];
    const left = sections[next === -1 ? sections.length - 1 : next - 1];
    const fraction =
      (phase - left.at) / ((next === -1 ? 1 : right.at) - left.at);
    const t = fraction * fraction * (3 - 2 * fraction);
    const mix = (a: number, b: number) => (1 - t) * a + t * b;
    return {
      at: phase,
      width: mix(left.width, right.width),
      crest: mix(left.crest, right.crest),
      crestPosition: mix(left.crestPosition, right.crestPosition),
      roll: mix(left.roll, right.roll),
    };
  };
  const frames = (rim: number[][], skinNormals: number[][]) => {
    const center = [0, 1, 2].map((axis) =>
      rim.reduce((sum, p) => sum + p[axis] / rim.length, 0),
    );
    return portraitNasalRimJets(
      rim,
      skinNormals,
      rim.map((p) => p.map((v, axis) => v + (v - center[axis]))),
    );
  };
  const jets = frames(points, normals);
  const outer = jets.map((jet, i) =>
    jet.point.map(
      (v, axis) => v + section(i / jets.length).width * jet.transverse[axis],
    ),
  );
  if (
    outer.some(
      (p, i) =>
        !p.every(Number.isFinite) ||
        p.every((v, axis) => v === points[i][axis]),
    )
  )
    throw new Error(
      "A nasal envelope attachment exceeds its representable frame.",
    );
  return {
    outer,
    append: (cage, boundary, seeds, skinGroup, liningGroup) => {
      const factor = boundary.length / points.length;
      const start = boundary.indexOf(seeds[0]);
      if (
        seeds.length !== points.length ||
        new Set(seeds).size !== seeds.length ||
        !Number.isInteger(factor) ||
        factor < 1 ||
        start < 0 ||
        new Set(boundary).size !== boundary.length ||
        boundary.some(
          (id) =>
            !Number.isInteger(id) || id < 0 || id >= cage.positions.length,
        ) ||
        seeds.some(
          (id, i) => boundary[(start + i * factor) % boundary.length] !== id,
        ) ||
        [skinGroup, liningGroup].some((g) => !Number.isInteger(g) || g < 0)
      )
        throw new Error(
          "A nasal envelope needs corresponding oriented original/refined boundary identities and registered groups.",
        );
      const ordered = boundary.map(
        (_, i) => boundary[(start + i) % boundary.length],
      );
      const count = ordered.length;
      const rim = ordered.map((_, i) => cyclic(points, i / count));
      // The exterior skin can turn through the aperture plane. Its normals
      // therefore cannot orient the entire rolled rim: projecting them there
      // can change sign around one closed opening. The separately owned inward
      // cavity axis supplies one continuous aperture frame on both sides.
      const rimNormals = ordered.map(() => offset.map((v) => -v / depth));
      const rimJets = frames(rim, rimNormals);
      const outerPoints = ordered.map((id) => cage.positions[id]);
      const packedNormals = portraitNormals(
        cage.positions.flat(),
        cage.indices,
      );
      const outerJets = frames(
        outerPoints,
        ordered.map((id) => packedNormals.slice(id * 3, id * 3 + 3)),
      );
      const origin = [0, 1, 2].map((axis) =>
        rim.reduce((sum, p) => sum + p[axis] / count, 0),
      );
      const floor = origin.map((v, axis) => v + offset[axis]);
      const frame = { origin, inward: offset };
      const columns = rimJets.map((jet, i) => {
        const profile = section(i / count),
          angle = ((profile.roll % 360) * Math.PI) / 180;
        const normal = Vector3.cross(
          Vector3.create(...(jet.transverse as [number, number, number])),
          Vector3.create(...(jet.tangent as [number, number, number])),
        );
        const sectionNormal = [normal.x, normal.y, normal.z];
        const rolled = jet.transverse.map(
          (v, axis) =>
            Math.cos(angle) * v + Math.sin(angle) * sectionNormal[axis],
        );
        const crest = jet.point.map(
          (v, axis) =>
            v +
            profile.width * profile.crestPosition * jet.transverse[axis] +
            profile.crest * sectionNormal[axis],
        );
        const middle = {
          point: crest,
          derivative: jet.transverse.map((v) => -v),
        };
        return {
          jet: { ...jet, transverse: rolled },
          middle,
          outer: {
            point: outerPoints[i],
            derivative: outerJets[i].transverse.map((v) => -v),
          },
          end: { point: jet.point, derivative: rolled.map((v) => -v) },
          first: profile.width * (1 - profile.crestPosition),
          last: profile.width * profile.crestPosition,
        };
      });
      const added: number[][] = [],
        indices: number[] = [],
        groups: number[] = [];
      let previous = ordered;
      const ring = (positions: number[][], group: number) => {
        const current = positions.map((point) => {
          const id = cage.positions.length + added.length;
          added.push(point);
          return id;
        });
        for (let i = 0; i < count; i++) {
          const j = (i + 1) % count;
          indices.push(
            previous[i],
            previous[j],
            current[i],
            previous[j],
            current[j],
            current[i],
          );
          groups.push(group, group);
        }
        previous = current;
      };
      for (const interval of [0, 1])
        for (let row = 1; row <= segments; row++)
          ring(
            columns.map((c) =>
              interval === 0
                ? samplePortraitNasalSection(
                    c.outer,
                    c.middle,
                    c.first,
                    row / segments,
                  ).point
                : samplePortraitNasalSection(
                    c.middle,
                    c.end,
                    c.last,
                    row / segments,
                  ).point,
            ),
            skinGroup,
          );
      for (let row = 1; row < 2 * segments; row++)
        ring(
          columns.map(
            (c) =>
              samplePortraitNasalEntry(
                c.jet,
                frame,
                depth,
                contraction,
                row / (2 * segments),
              ).point,
          ),
          liningGroup,
        );
      const pole = cage.positions.length + added.length;
      added.push(floor);
      for (let i = 0; i < count; i++) {
        indices.push(previous[i], previous[(i + 1) % count], pole);
        groups.push(liningGroup);
      }
      // The head assembler runs paired appenders on the appearance reference
      // before sampling RGB; those source coordinates must not be invented here.
      cage.positions.push(...added);
      cage.indices.push(...indices);
      cage.groups.push(...groups);
    },
  };
}

function unit(p: readonly number[]): number[] {
  const n = Vector3.normalize(
    Vector3.create(...(p as [number, number, number])),
  );
  if (Vector3.length(n) === 0 || ![n.x, n.y, n.z].every(Number.isFinite))
    throw new Error("A nasal envelope needs nonzero finite surface normals.");
  return [n.x, n.y, n.z];
}

function cyclic(points: readonly number[][], phase: number): number[] {
  const at = phase * points.length,
    index = Math.floor(at),
    t = at - index;
  const p = (i: number) => points[(i + points.length) % points.length];
  return samplePortraitNasalSection(
    {
      point: p(index),
      derivative: p(index + 1).map((v, axis) => (v - p(index - 1)[axis]) / 2),
    },
    {
      point: p(index + 1),
      derivative: p(index + 2).map((v, axis) => (v - p(index)[axis]) / 2),
    },
    1,
    t,
  ).point;
}
