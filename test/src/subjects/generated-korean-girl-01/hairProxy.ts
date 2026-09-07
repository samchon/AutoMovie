import { createAutoMovieMeshDepthSampler } from "@automovie/engine";
import type { IAutoMovieMesh } from "@automovie/interface";

import {
  portraitNormals,
  portraitPart,
  portraitPatch,
  portraitPoint,
} from "../geometry";

/**
 * Coarse hairstyle mass for judging this face's silhouette. A scalp cap and a
 * continuous side/back curtain suggest the reference's long hair. The anatomical
 * left pinna, visible on the photograph's right, stays exposed above the curtain.
 * This is an explicitly unfinished proxy: no fibre model,
 * hairline detail, groom, simulation or scalp-hair parameter editor is implied.
 * All construction values are millimetres in the same head frame as the skin.
 * Clay inspection hides the hair finish so the underlying face stays reviewable.
 */
export function buildPortraitHairProxy(
  scalp?: readonly number[][],
  /** Optional actual head mesh in engine metres, supplying the coarse fringe attachment. */
  forehead?: IAutoMovieMesh,
) {
  // Fit the same coarse ellipsoid to the actual cranial envelope. A fixed cap
  // cannot follow another foundation or fitted head. Uniform expansion retains
  // the authored haircut and ear cutout while enclosing every supplied scalp
  // vertex above Y=20 mm. Three millimetres of radial margin cover coarse panel
  // interpolation; this is context geometry, not a scalp/hair collision solver.
  if (scalp?.some((p) => p.length !== 3 || !p.every(Number.isFinite)))
    throw new Error(
      "Hair attachment needs finite construction-millimetre XYZ points.",
    );
  let enclosure = 1;
  for (const [x, y, z] of scalp ?? [])
    if (y >= 20)
      enclosure = Math.max(
        enclosure,
        Math.hypot(x / 82, (y - 30) / 118, (z + 32) / 101) + 3 / 82,
      );
  const rx = 82 * enclosure,
    ry = 118 * enclosure,
    rz = 101 * enclosure;
  if (
    ![rx, ry, rz].every(
      (r) => Number.isFinite(r) && Number.isFinite(Math.fround(r / 1000)),
    )
  )
    throw new Error("Hair attachment exceeds its representable metric range.");

  const cap = portraitPatch(
    (u, v) => {
      const azimuth = 2 * Math.PI * u;
      const front = Math.max(0, Math.cos(azimuth));
      const earClearance = 50 - 160 * ((azimuth - Math.PI / 2) / 0.8) ** 2;
      const boundaryY = Math.max(25, -70 + 152 * front ** 2, earClearance);
      const polar = 0.002 + v * (Math.acos((boundaryY - 30) / ry) - 0.002);
      return portraitPoint(
        rx * Math.sin(polar) * Math.sin(azimuth),
        30 + ry * Math.cos(polar),
        -32 + rz * Math.sin(polar) * Math.cos(azimuth),
      );
    },
    48,
    24,
  );
  // The curtain starts at shared cap vertices. One continuous mesh removes
  // coplanar overlaps while the open front edge keeps the visible ear clear.
  let previous = Array.from({ length: 27 }, (_v, i) => 24 * 49 + 15 + i);
  const roots = previous.map((id) => cap.positions.slice(id * 3, id * 3 + 3));
  for (let row = 1; row <= 24; row++) {
    const v = row / 24,
      ring: number[] = [];
    for (let column = 0; column < roots.length; column++) {
      const root = roots[column],
        azimuth = ((15 + column) / 48) * 2 * Math.PI;
      const flow = 1.1 * Math.sin(18 * azimuth + v) * Math.sin(Math.PI * v);
      ring.push(cap.positions.length / 3);
      cap.positions.push(
        root[0] + v * ((rx + 7 + flow) * Math.sin(azimuth) - root[0]),
        root[1] + v * (-160 + 5 * Math.cos(3 * azimuth) - root[1]),
        root[2] + v * (-33 + (rz + flow) * Math.cos(azimuth) - root[2]),
      );
    }
    for (let i = 0; i < ring.length - 1; i++)
      cap.indices!.push(
        previous[i],
        previous[i + 1],
        ring[i],
        previous[i + 1],
        ring[i + 1],
        ring[i],
      );
    previous = ring;
  }
  if (forehead !== undefined) {
    const sample = createAutoMovieMeshDepthSampler(forehead, "z");
    // Nine broad panels supply the reference's forehead fringe. These are hair
    // clumps, not fibres: each tuple is [root X, tip X, tip Y, width] in mm.
    // Their tips stay near/above the brow region and well inside the ear's X
    // range. The cap, fringe and curtain share the same envelope and finish.
    const panels = [
      [-27, -34, 58, 6],
      [-20, -26, 54, 5.5],
      [-14, -19, 57, 6],
      [-8, -12, 51, 5.5],
      [-2, -5, 54, 5],
      [4, 4, 58, 5.5],
      [10, 12, 56, 5.5],
      [17, 22, 61, 6],
      [24, 32, 65, 6],
    ];
    for (const [rootX, tipX, tipY, width] of panels) {
      const panel = portraitPatch(
        (u, v) => {
          const taper = 0.06 + 0.94 * (1 - v) ** 0.75;
          const x = rootX + (tipX - rootX) * v * v + (u - 0.5) * width * taper;
          const y = 108 + (tipY - 108) * v;
          const hit = sample(x / 1000, y / 1000);
          if (hit === null)
            throw new Error(
              "Fringe panels require a supporting forehead surface.",
            );
          const skinZ = hit.maximum * 1000;
          if (!Number.isFinite(skinZ))
            throw new Error(
              "Fringe support exceeds its construction-millimetre range.",
            );
          // Extend the cap's virtual front ellipse below its cutout, then keep
          // at least 1.2 mm of anterior clearance from the actual forehead. The
          // small cross-panel arch gives each coarse clump volume without tubes.
          const envelopeZ =
            -32 + rz * Math.sqrt(1 - (x / rx) ** 2 - ((y - 30) / ry) ** 2);
          const arch = 0.65 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
          return portraitPoint(
            x,
            y,
            Math.max(envelopeZ + 0.12, skinZ + 1.2) + arch,
          );
        },
        6,
        20,
      );
      const offset = cap.positions.length / 3;
      cap.positions.push(...panel.positions);
      cap.indices!.push(...panel.indices!.map((i) => i + offset));
    }
  }
  cap.normals = portraitNormals(cap.positions, cap.indices!);
  return [portraitPart("hair-mass", cap, "hair")];
}
