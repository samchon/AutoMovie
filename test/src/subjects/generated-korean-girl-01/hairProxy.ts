import { createAutoMovieMeshDepthSampler } from "@automovie/engine";
import type { IAutoMovieMesh } from "@automovie/interface";

import {
  portraitNormals,
  portraitPart,
  portraitPatch,
  portraitPoint,
} from "../geometry";

/** Subject-owned continuous hair-cap controls. */
export interface IPortraitHairShape {
  /** Signed frontal radians; positive moves the deepest fringe toward +X. */
  fringeBias?: number;
}

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
  /** Optional side attachments in mm, enlarging lateral clearance without growing the skull cap vertically. */
  sideAttachments: readonly (readonly number[])[] = [],
  /** Optional subject fit for the continuous frontal boundary. */
  shape: IPortraitHairShape = {},
) {
  // Fit the same coarse ellipsoid to the actual cranial envelope. A fixed cap
  // cannot follow another foundation or fitted head. Uniform expansion retains
  // the authored haircut and ear cutout while enclosing every supplied scalp
  // vertex above Y=20 mm. Three millimetres of radial margin cover coarse panel
  // interpolation; this is context geometry, not a scalp/hair collision solver.
  if (
    [...(scalp ?? []), ...sideAttachments].some(
      (p) => p.length !== 3 || !p.every(Number.isFinite),
    )
  )
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
  let rx = 82 * enclosure;
  const ry = 118 * enclosure,
    rz = 101 * enclosure;
  // Side attachments require width, not a uniformly larger cranium. Solve the
  // same ellipsoid inequality for rx while keeping scalp-owned ry/rz fixed.
  // A point outside that YZ domain cannot be enclosed by lateral expansion and
  // is refused rather than silently changing another dimension's owner.
  for (const [x, y, z] of sideAttachments) {
    const remaining = 1 - ((y - 30) / ry) ** 2 - ((z + 32) / rz) ** 2;
    if (remaining <= 0)
      throw new Error(
        "Hair side attachments must lie inside the scalp's height and depth domain.",
      );
    rx = Math.max(rx, Math.abs(x) / Math.sqrt(remaining) + 3);
  }
  if (
    ![rx, ry, rz].every(
      (r) => Number.isFinite(r) && Number.isFinite(Math.fround(r / 1000)),
    )
  )
    throw new Error("Hair attachment exceeds its representable metric range.");

  const support =
    forehead === undefined
      ? undefined
      : createAutoMovieMeshDepthSampler(forehead, "z");
  const fringeBias = shape.fringeBias ?? 0;
  if (!Number.isFinite(fringeBias) || Math.abs(fringeBias) > 0.45)
    throw new Error(
      "Hair fringe bias must be a finite angular offset within 0.45 radians.",
    );
  // The lower cap edge is a boundary between the frontal hairline and the
  // temporal/ear clearance. A hard maximum makes that boundary change slope
  // at the winning branch, which reads as a blunt polygonal notch in the
  // three-quarter view. This compact smooth maximum stays exactly on either
  // owner outside the transition band and uses a cubic easing inside it; the
  // hairline therefore keeps its measured clearance while its tangent turns
  // continuously through the temple.
  const smoothMaximum = (a: number, b: number, transition: number): number => {
    const weight = Math.max(0, Math.min(1, 0.5 + (a - b) / (2 * transition)));
    const eased = weight * weight * (3 - 2 * weight);
    return eased * a + (1 - eased) * b;
  };
  const capColumns = 96;
  const capRows = 24;
  const curtainStart = 30;
  const curtainRootCount = 27;
  // The central fringe is the cap's own boundary. A separate overlapping sheet
  // would preserve a second cap beneath it and cast a false attachment ridge.
  // Its compact angular influence retains the temples and exposed left ear.
  const cap = portraitPatch(
    (u, v) => {
      const azimuth = 2 * Math.PI * u;
      const front = Math.max(0, Math.cos(azimuth));
      const earClearance = 50 - 160 * ((azimuth - Math.PI / 2) / 0.8) ** 2;
      const angle = Math.atan2(Math.sin(azimuth), Math.cos(azimuth));
      const lateral = Math.min(1, Math.abs(angle - fringeBias) / 0.65);
      const fringe = support === undefined ? 0 : (1 - lateral * lateral) ** 2;
      const frontalBoundary = -70 + 152 * front ** 2;
      const boundaryY =
        smoothMaximum(smoothMaximum(25, frontalBoundary, 8), earClearance, 8) -
        fringe * (19 + 2 * Math.cos(12 * angle));
      const polar = 0.002 + v * (Math.acos((boundaryY - 30) / ry) - 0.002);
      const point = portraitPoint(
        rx * Math.sin(polar) * Math.sin(azimuth),
        30 + ry * Math.cos(polar),
        -32 + rz * Math.sin(polar) * Math.cos(azimuth),
      );
      if (support !== undefined && fringe > 0 && point.y < 108) {
        const hit = support(point.x / 1000, point.y / 1000);
        if (hit === null)
          throw new Error(
            "The central fringe requires a supporting forehead surface.",
          );
        const skinZ = hit.maximum * 1000;
        if (!Number.isFinite(skinZ))
          throw new Error(
            "Fringe support exceeds its construction-millimetre range.",
          );
        // Blend over the complete root-to-tip section, keeping zero slope at
        // its root. The tip shares the live forehead's 1.2 mm clearance.
        const t = Math.max(0, Math.min(1, (108 - point.y) / (108 - boundaryY)));
        const blend = fringe * t * t * (3 - 2 * t);
        point.z = Math.max(
          point.z * (1 - blend) + (skinZ + 1.2) * blend,
          skinZ + 1.2,
        );
      }
      return point;
    },
    capColumns,
    capRows,
  );
  // The curtain starts at shared cap vertices. One continuous mesh removes
  // coplanar overlaps while the open front edge keeps the visible ear clear.
  let previous = Array.from(
    { length: curtainRootCount },
    (_v, i) => capRows * (capColumns + 1) + curtainStart + 2 * i,
  );
  const roots = previous.map((id) => cap.positions.slice(id * 3, id * 3 + 3));
  for (let row = 1; row <= capRows; row++) {
    const v = row / capRows,
      ring: number[] = [];
    for (let column = 0; column < roots.length; column++) {
      const root = roots[column],
        azimuth = ((curtainStart + 2 * column) / capColumns) * 2 * Math.PI;
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
  cap.normals = portraitNormals(cap.positions, cap.indices!);
  return [portraitPart("hair-mass", cap, "hair")];
}
