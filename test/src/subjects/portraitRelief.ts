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
