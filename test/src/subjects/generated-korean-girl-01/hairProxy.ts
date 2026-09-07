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
export function buildPortraitHairProxy(scalp?: readonly number[][]) {
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
  cap.normals = portraitNormals(cap.positions, cap.indices!);
  return [portraitPart("hair-mass", cap, "hair")];
}
