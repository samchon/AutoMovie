import { Vector3 } from "@automovie/engine";

import type { IControlMesh } from "../subdivideControlMesh";
import { portraitNasalRimJets } from "./nasalAperture";

/** Physical exterior skin section around one fitted nasal aperture, in mm. */
export interface IPortraitNasalRimSection {
  /** Positive width from the aperture to the surrounding skin attachment. */
  width: number;
  /** Signed crest projection along the outward aperture normal, in mm. */
  crest: number;
}

/**
 * Construct the exterior shoulder and crest from the same ordered aperture.
 * The caller supplies the sculpted skin normals before aperture fitting. The
 * opening plane normal describes a different surface and cannot substitute for
 * those exterior tangents. The existing rim-jet calculation supplies the frame.
 * The aperture itself is copied without resizing or moving. An outer offset
 * of width and a halfway crest separate its location from tissue thickness.
 * The resulting three rings are one connected skin section, not a torus mesh
 * placed over an unrelated hole. The caller owns host fitting and subdivision.
 */
export function createPortraitNasalRimSection(
  points: readonly (readonly number[])[],
  shape: IPortraitNasalRimSection,
  skinNormals: readonly (readonly number[])[],
): { outer: number[][]; crest: number[][]; rim: number[][] } {
  if (
    !Number.isFinite(shape.width) ||
    shape.width / 1000 <= 0 ||
    !Number.isFinite(shape.crest) ||
    points.length < 3 ||
    skinNormals.length !== points.length ||
    skinNormals.some((p) => p.length !== 3 || !p.every(Number.isFinite)) ||
    points.some((p) => p.length !== 3 || !p.every(Number.isFinite))
  )
    throw new Error(
      "A nasal rim section needs finite XYZ, positive width and finite crest projection.",
    );
  const rim = points.map((p) => [...p]);
  const normals = skinNormals.map((p) => {
    const n = Vector3.normalize(
      Vector3.create(...(p as [number, number, number])),
    );
    return [n.x, n.y, n.z];
  });
  const center = [0, 1, 2].map((axis) =>
    rim.reduce((sum, p) => sum + p[axis] / rim.length, 0),
  );
  const exterior = rim.map((p) => p.map((v, axis) => v + (v - center[axis])));
  const jets = portraitNasalRimJets(rim, normals, exterior);
  const outer = jets.map((j) =>
    j.point.map((v, axis) => v + shape.width * j.transverse[axis]),
  );
  const crest = jets.map((j, i) =>
    j.point.map(
      (v, axis) =>
        v +
        shape.width * 0.5 * j.transverse[axis] +
        shape.crest * normals[i][axis],
    ),
  );
  if (
    [...outer, ...crest].some((p) => !p.every(Number.isFinite)) ||
    outer.some((p, i) => p.every((v, axis) => v === rim[i][axis]))
  )
    throw new Error("A nasal rim section exceeds its representable frame.");
  return { outer, crest, rim };
}

/**
 * Attach an exterior section to resident outer IDs and return its inner loop.
 * The host supplies the band's skin material group. The returned loop is used
 * directly by vestibular lining and optional curve refinement, so there is no
 * second independently positioned aperture. All ring winding follows the cut.
 */
export function appendPortraitNasalRimSection(
  cage: IControlMesh,
  outer: readonly number[],
  section: ReturnType<typeof createPortraitNasalRimSection>,
  group: number,
): number[] {
  if (
    outer.length < 3 ||
    new Set(outer).size !== outer.length ||
    section.rim.length !== outer.length ||
    section.crest.length !== outer.length ||
    outer.some(
      (id) => !Number.isInteger(id) || id < 0 || id >= cage.positions.length,
    ) ||
    !Number.isInteger(group) ||
    group < 0 ||
    [...section.rim, ...section.crest].some(
      (p) => p.length !== 3 || !p.every(Number.isFinite),
    )
  )
    throw new Error(
      "A nasal skin band needs resident outer IDs and aligned finite rings.",
    );
  let previous = [...outer];
  for (const points of [section.crest, section.rim]) {
    const current = points.map((p) => {
      const id = cage.positions.length;
      cage.positions.push([...p]);
      return id;
    });
    for (let i = 0; i < outer.length; i++) {
      const j = (i + 1) % outer.length;
      cage.indices.push(
        previous[i],
        previous[j],
        current[i],
        previous[j],
        current[j],
        current[i],
      );
      cage.groups.push(group, group);
    }
    previous = current;
  }
  return previous;
}
