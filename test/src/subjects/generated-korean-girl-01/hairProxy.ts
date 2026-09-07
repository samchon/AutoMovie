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
export function buildPortraitHairProxy() {
  const cap = portraitPatch(
    (u, v) => {
      const azimuth = 2 * Math.PI * u;
      const front = Math.max(0, Math.cos(azimuth));
      const earClearance = 50 - 160 * ((azimuth - Math.PI / 2) / 0.8) ** 2;
      const boundaryY = Math.max(25, -70 + 152 * front ** 2, earClearance);
      const polar = 0.002 + v * (Math.acos((boundaryY - 30) / 118) - 0.002);
      return portraitPoint(
        82 * Math.sin(polar) * Math.sin(azimuth),
        30 + 118 * Math.cos(polar),
        -32 + 101 * Math.sin(polar) * Math.cos(azimuth),
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
        root[0] + v * ((89 + flow) * Math.sin(azimuth) - root[0]),
        root[1] + v * (-160 + 5 * Math.cos(3 * azimuth) - root[1]),
        root[2] + v * (-33 + (101 + flow) * Math.cos(azimuth) - root[2]),
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
