import { createAutoMovieMeshDepthSampler } from "@automovie/engine";

import { portraitPart } from "../geometry";
import { createPortraitControlLayer } from "../portraitControlLayer";
import type { IPortraitSurfaceLayer } from "../portraitSurface";

/**
 * One transverse upper-orbit section at a subject-owned brow datum. Distances
 * are head-frame millimetres; positive projection is anterior. The brow datum
 * and the samples above/below it follow the actual shared skin, not the hairs.
 * @author Samchon
 */
export interface IPortraitOrbitalSupportStation {
  /** Stable station identity within this eye's support group. */
  name: string;
  /** Retained skin vertex on the brow arc, supplied by the subject. */
  anchor: number;
  /** Height/projection of the forehead transition above the brow datum. */
  forehead: { height: number; projection: number };
  /** Requested movement of the brow-pad support at its skin datum. */
  browProjection: number;
  /** Positive distance below the datum and signed sulcus surface projection. */
  sulcus: { descent: number; projection: number };
}

/**
 * Optional upper-orbit form, separate from brow fibres and aperture dimensions.
 * Stations state the forehead/brow/sulcus relationship together. Their target
 * movements are solved as one group, so a stationary forehead sample constrains
 * the neighbouring brow instead of silently receiving its summed inflation.
 * Omission of the whole layer keeps the existing head surface.
 * @author Samchon
 */
export interface IPortraitOrbitalSupportShape {
  /** Positive common interpolation support radius in millimetres. */
  radius: number;
  /** One through 32 independently placed sections; explicit empty is invalid. */
  stations: readonly IPortraitOrbitalSupportStation[];
}

/**
 * Resolve an upper-orbit section group on resident skin. Every offset sample
 * first queries the actual surface height; the same point is then the control
 * solver's target. No hidden offset depth or independently guessed attachment
 * can attenuate the requested support before the common surface mask.
 *
 * This defines a compact displacement field over existing skin, not internal
 * bone anatomy or a complete volumetric tissue reconstruction. Open-lid masking
 * remains owned by the surface assembler; brow fibres consume the final skin.
 */
export function createPortraitOrbitalSupport(
  side: "left" | "right",
  input: IPortraitOrbitalSupportShape,
): IPortraitSurfaceLayer {
  const shape = structuredClone(input);
  if (
    (side !== "left" && side !== "right") ||
    shape.stations.length < 1 ||
    shape.stations.length > 32 ||
    new Set(shape.stations.map((s) => s.name)).size !== shape.stations.length ||
    !Number.isFinite(shape.radius) ||
    shape.radius / 1000 <= 0 ||
    shape.stations.some(
      (s) =>
        s.name.trim().length === 0 ||
        !Number.isInteger(s.anchor) ||
        s.anchor < 0 ||
        ![
          s.forehead.height,
          s.forehead.projection,
          s.browProjection,
          s.sulcus.descent,
          s.sulcus.projection,
        ].every(Number.isFinite) ||
        s.forehead.height <= 0 ||
        s.sulcus.descent <= 0,
    )
  )
    throw new Error(
      "Orbital support needs a side, distinct stations, finite sections and positive support distances.",
    );
  const id = `${side}-orbital-support`;
  return {
    id,
    fields: (host) => {
      for (const station of shape.stations) {
        const datum = host.positions[station.anchor];
        if (
          datum === undefined ||
          datum.length !== 3 ||
          !datum.every(Number.isFinite)
        )
          throw new Error(
            "Orbital support requires a finite resident brow datum.",
          );
      }
      const skin = createAutoMovieMeshDepthSampler(
        portraitPart(
          "orbital-section-basis",
          {
            positions: host.positions.flat(),
            indices: [...host.indices],
            normals: null,
            uvs: null,
            skin: null,
          },
          "skin",
        ).geometry.mesh,
        "z",
      );
      const controls = shape.stations.flatMap((station) => {
        const datum = host.positions[station.anchor];
        return (
          [
            ["forehead", station.forehead.height, station.forehead.projection],
            ["brow", 0, station.browProjection],
            ["sulcus", -station.sulcus.descent, station.sulcus.projection],
          ] as const
        ).map(([role, offset, projection]) => {
          const y = datum[1] + offset;
          const hit = skin(datum[0] / 1000, y / 1000);
          if (hit === null)
            throw new Error(
              "Every orbital section sample must lie on supporting skin.",
            );
          return {
            name: `${station.name}/${role}`,
            anchor: station.anchor,
            offset: [0, offset, hit.maximum * 1000 - datum[2]],
            displacement: [0, 0, projection],
          };
        });
      });
      return createPortraitControlLayer(id, shape.radius, controls).fields(
        host,
      );
    },
  };
}
