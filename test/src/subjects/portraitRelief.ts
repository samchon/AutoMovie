import type { IAutoMovieMeshDeformationField } from "@automovie/interface";

import type { IPortraitSurfaceLayer } from "./portraitSurface";

/**
 * One named anatomical support on the common skin. All vectors use millimetres
 * in the head frame. The binding follows the host after component replacement;
 * offset locates the support relative to that retained anatomical attachment.
 *
 * @author Samchon
 */
export interface IPortraitReliefRegion {
  /** Anatomical responsibility within this layer; unique and nonempty. */
  name: string;
  /** Retained skin vertex identity, owned by the subject. */
  anchor: number;
  /** XYZ offset of the support centre from the current attachment. */
  offset: [number, number, number];
  /** Positive XYZ support radii; the cubic envelope vanishes at their boundary. */
  radius: [number, number, number];
  /** Signed XYZ displacement at the centre. Zero is the unchanged host. */
  displacement: [number, number, number];
}

/**
 * One control of a narrow connected relief curve. The attachment remains a
 * resident skin vertex, while the offset locates the curve control in the
 * current fitted surface. Adjacent controls are sampled into overlapping
 * fields by the factory; this makes a philtral crest or similar section a
 * continuous authored path rather than a collection of unrelated blobs.
 *
 * @author Samchon
 */
export interface IPortraitReliefCurvePoint {
  /** Resident skin vertex used to follow component replacement. */
  anchor: number;
  /** XYZ offset from that live attachment, in construction millimetres. */
  offset: [number, number, number];
  /** Positive support radii around this control, in millimetres. */
  radius: [number, number, number];
  /** Signed displacement at this control, in millimetres. */
  displacement: [number, number, number];
}

/** One named curve with at least two controls and a shared surface owner. */
export interface IPortraitReliefCurve {
  /** Anatomical responsibility; unique within the layer. */
  name: string;
  /** Ordered controls from the curve root to its terminal attachment. */
  points: readonly IPortraitReliefCurvePoint[];
}

/**
 * Bind anatomical support envelopes to one final skin, with copied settings.
 * The engine owns the compact displacement kernel; this adapter owns attachment
 * identity and millimetre conversion. Neighbouring supports add before common
 * normals are recomputed, and the surface assembler protects open eye/mouth rims.
 * These envelopes model visible tissue relief, not separate internal organs.
 */
export function createPortraitReliefLayer(
  id: string,
  input: readonly IPortraitReliefRegion[],
): IPortraitSurfaceLayer {
  const regions = structuredClone(input);
  if (
    id.trim().length === 0 ||
    new Set(regions.map((r) => r.name)).size !== regions.length ||
    regions.some(
      (r) =>
        r.name.trim().length === 0 ||
        !Number.isInteger(r.anchor) ||
        r.anchor < 0 ||
        [r.offset, r.radius, r.displacement].some(
          (v) => v.length !== 3 || !v.every(Number.isFinite),
        ) ||
        r.radius.some((v) => v <= 0),
    )
  )
    throw new Error(
      "Anatomical relief needs named bindings, finite XYZ dimensions and positive radii.",
    );
  return {
    id,
    fields: (host) =>
      regions.flatMap((region): IAutoMovieMeshDeformationField[] => {
        const p = host.positions[region.anchor];
        if (p === undefined || p.length !== 3 || !p.every(Number.isFinite))
          throw new Error(
            "Anatomical relief needs a resident finite skin attachment.",
          );
        if (region.displacement.every((v) => v === 0)) return [];
        const center = p.map((v, i) => (v + region.offset[i]) / 1000);
        if (!center.every(Number.isFinite))
          throw new Error(
            "Anatomical relief centre exceeds its representable range.",
          );
        return [
          {
            center: { x: center[0], y: center[1], z: center[2] },
            radius: {
              x: region.radius[0] / 1000,
              y: region.radius[1] / 1000,
              z: region.radius[2] / 1000,
            },
            displacement: {
              x: region.displacement[0] / 1000,
              y: region.displacement[1] / 1000,
              z: region.displacement[2] / 1000,
            },
            stretch: { x: 0, y: 0, z: 0 },
          },
        ];
      }),
  };
}

/**
 * Bind narrow anatomical section curves to one final skin. Each segment gets
 * three interior samples and shares its endpoint with the next segment. The
 * interpolation is deliberately linear in the live attachment frame: the
 * engine's compact radial kernel supplies the smooth overlap, while the
 * authored controls retain the curve's measured end points and tangent scale.
 * Empty curves are identity; zero displacement controls are retained only as
 * interpolation anchors, so a curve can fade into an unchanged host.
 */
export function createPortraitReliefCurveLayer(
  id: string,
  input: readonly IPortraitReliefCurve[],
): IPortraitSurfaceLayer {
  const curves = structuredClone(input);
  if (
    id.trim().length === 0 ||
    new Set(curves.map((curve) => curve.name)).size !== curves.length ||
    curves.some(
      (curve) =>
        curve.name.trim().length === 0 ||
        curve.points.length < 2 ||
        curve.points.length > 32 ||
        curve.points.some(
          (point) =>
            !Number.isInteger(point.anchor) ||
            point.anchor < 0 ||
            [point.offset, point.radius, point.displacement].some(
              (v) => v.length !== 3 || !v.every(Number.isFinite),
            ) ||
            point.radius.some((v) => v <= 0),
        ),
    )
  )
    throw new Error(
      "Anatomical relief curves need named controls, finite dimensions and positive radii.",
    );
  return {
    id,
    fields: (host) =>
      curves.flatMap((curve) => {
        const controls = curve.points.map((point) => {
          const attachment = host.positions[point.anchor];
          if (
            attachment === undefined ||
            attachment.length !== 3 ||
            !attachment.every(Number.isFinite)
          )
            throw new Error(
              "Anatomical relief curves need resident finite skin attachments.",
            );
          const centre = point.offset.map(
            (value, axis) => attachment[axis] + value,
          );
          if (!centre.every(Number.isFinite))
            throw new Error(
              "Anatomical relief curve centre exceeds its representable range.",
            );
          return { ...point, centre };
        });
        const result: IAutoMovieMeshDeformationField[] = [];
        for (let i = 0; i < controls.length - 1; i++) {
          const a = controls[i],
            b = controls[i + 1];
          for (let sample = 0; sample < 3; sample++) {
            const t = sample / 3,
              interpolate = (
                axis: 0 | 1 | 2,
                values: "radius" | "displacement",
              ) => a[values][axis] * (1 - t) + b[values][axis] * t;
            result.push({
              center: {
                x: (a.centre[0] * (1 - t) + b.centre[0] * t) / 1000,
                y: (a.centre[1] * (1 - t) + b.centre[1] * t) / 1000,
                z: (a.centre[2] * (1 - t) + b.centre[2] * t) / 1000,
              },
              radius: {
                x: interpolate(0, "radius") / 1000,
                y: interpolate(1, "radius") / 1000,
                z: interpolate(2, "radius") / 1000,
              },
              displacement: {
                x: interpolate(0, "displacement") / 1000,
                y: interpolate(1, "displacement") / 1000,
                z: interpolate(2, "displacement") / 1000,
              },
              stretch: { x: 0, y: 0, z: 0 },
            });
          }
        }
        const last = controls.at(-1)!;
        if (last.displacement.some((value) => value !== 0))
          result.push({
            center: {
              x: last.centre[0] / 1000,
              y: last.centre[1] / 1000,
              z: last.centre[2] / 1000,
            },
            radius: {
              x: last.radius[0] / 1000,
              y: last.radius[1] / 1000,
              z: last.radius[2] / 1000,
            },
            displacement: {
              x: last.displacement[0] / 1000,
              y: last.displacement[1] / 1000,
              z: last.displacement[2] / 1000,
            },
            stretch: { x: 0, y: 0, z: 0 },
          });
        return result;
      }),
  };
}
