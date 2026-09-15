import type { IAutoMovieMesh } from "@automovie/interface";

import { portraitNormals } from "../geometry/geometry";

/**
 * Interior room beyond the lip vestibule, independently of the visible aperture.
 * The two nonnegative expansions are millimetres along head X and Y. A smooth
 * depth transition preserves the actual rim; the existing posterior cap remains.
 * This is authored enclosure geometry, not measured palate or gingival anatomy.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Separates internal oral room from the visible lip aperture and tooth placement.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines finite transverse and vertical expansions with a positive vestibular transition depth.
 */
export interface IPortraitOralChamber {
  /** Additional transverse half-extent in mm, finite and nonnegative. */
  horizontalExpansion: number;
  /** Additional vertical half-extent in mm, finite and nonnegative. */
  verticalExpansion: number;
  /** Positive finite depth in mm at which expansion reaches its full weight. */
  transitionDepth: number;
}

/**
 * Admit oral lining depth and the fraction before its posterior taper. These
 * are authoring dimensions, not recovered palate or pharyngeal measurements.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Keeps the selected cavity's depth and wall shape explicit and finite.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Requires positive representable depth and a wall fraction in [0,0.95].
 */
export function assertPortraitOralLining(
  depth: number,
  wall: number,
  chamber?: IPortraitOralChamber,
): void {
  if (!Number.isFinite(1.8 * depth) || depth <= 0)
    throw new Error("Oral lining depth must be finite and positive.");
  if (!Number.isFinite(wall) || wall < 0 || wall > 0.95)
    throw new Error("Oral lining wall fraction must be in [0,0.95].");
  if (
    chamber !== undefined &&
    (![
      chamber.horizontalExpansion,
      chamber.verticalExpansion,
      chamber.transitionDepth,
    ].every(Number.isFinite) ||
      chamber.horizontalExpansion < 0 ||
      chamber.verticalExpansion < 0 ||
      chamber.transitionDepth <= 0)
  )
    throw new Error(
      "Oral chamber needs finite nonnegative expansions and a positive transition depth.",
    );
}

/**
 * Close the interior behind one actual refined lip boundary. The seed chooses
 * its oriented free cycle from a lip band that may also have an outer boundary.
 * Rim coordinates are copied exactly; no second lip spline estimates them.
 * Twenty-four depth rings keep the opening section until the authored fraction,
 * then taper to one posterior pole at 1.8 nominal depths behind the rim centre.
 * The lining reverses each skin boundary edge so its visible side faces inward.
 * Optional chamber dimensions expand X/Y behind the vestibule without moving
 * the rim or cap. Omission and two zero expansions preserve the original mesh.
 * This enclosure does not reconstruct gingiva or certify tissue clearance.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Constructs an explicit oral enclosure separately from teeth and tongue.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Samples a declared straight-wall fraction and posterior cosine taper in head millimetres.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Uses the final skin's actual attachment boundary after refinement and performance.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-attachments Traces the seeded free cycle, copies every refined rim point and opposes its skin-edge winding.
 */
export function buildPortraitOralLining(
  surface: {
    positions: readonly (readonly number[])[];
    indices: readonly number[];
  },
  seed: number,
  depth: number,
  wall: number,
  chamber?: IPortraitOralChamber,
): IAutoMovieMesh {
  assertPortraitOralLining(depth, wall, chamber);
  if (
    surface.indices.length % 3 !== 0 ||
    surface.indices.some(
      (id) => !Number.isInteger(id) || id < 0 || id >= surface.positions.length,
    )
  )
    throw new Error("Oral lining needs resident complete skin triangles.");
  const edges = new Map<string, { a: number; b: number; count: number }>();
  for (let i = 0; i < surface.indices.length; i += 3) {
    const face = surface.indices.slice(i, i + 3);
    if (new Set(face).size !== 3)
      throw new Error("Oral lining skin triangles need distinct vertices.");
    for (let j = 0; j < 3; j++) {
      const a = face[j],
        b = face[(j + 1) % 3];
      const key = `${Math.min(a, b)}/${Math.max(a, b)}`;
      const edge = edges.get(key);
      if (edge === undefined) edges.set(key, { a, b, count: 1 });
      else {
        if (edge.count === 2 || edge.a === a)
          throw new Error(
            "Oral lining skin must have manifold, opposed edges.",
          );
        edge.count++;
      }
    }
  }
  const next = new Map<number, number>();
  for (const edge of edges.values())
    if (edge.count === 1) {
      if (next.has(edge.a))
        throw new Error("Oral lining skin boundary must not branch.");
      next.set(edge.a, edge.b);
    }
  if (!next.has(seed))
    throw new Error("Oral lining seed must lie on a free skin boundary.");
  // Opposed internal edges cancel each triangle's incoming/outgoing balance.
  // Unique outgoing free edges therefore also have unique incoming edges:
  // every remaining connected boundary is a cycle, including this seed's.
  const boundary = [seed];
  for (let id = next.get(seed)!; id !== seed; id = next.get(id)!)
    boundary.push(id);
  const rim = boundary.map((id) => surface.positions[id]);
  if (rim.some((p) => p.length !== 3 || !p.every(Number.isFinite)))
    throw new Error("Oral lining rim must contain finite XYZ points.");
  for (let i = 0; i < rim.length; i++)
    if (rim[i].every((v, axis) => v === rim[(i + 1) % rim.length][axis]))
      throw new Error("Oral lining rim edges must have positive length.");
  const count = rim.length,
    rows = 24;
  const center = [0, 1, 2].map((axis) =>
    rim.reduce((sum, p) => sum + p[axis] / count, 0),
  );
  const positions = rim.flatMap((p) => [...p]),
    indices: number[] = [];
  const expanded =
    chamber !== undefined &&
    (chamber.horizontalExpansion !== 0 || chamber.verticalExpansion !== 0);
  const extents = expanded
    ? [0, 1].map((axis) =>
        Math.max(...rim.map((p) => Math.abs(p[axis] - center[axis]))),
      )
    : undefined;
  if (
    extents !== undefined &&
    extents.some((v) => !Number.isFinite(v) || v <= 0)
  )
    throw new Error(
      "Oral chamber needs positive finite projected rim extents.",
    );
  for (let row = 1; row < rows; row++) {
    const v = row / rows;
    const radius = Math.cos(
      (Math.PI * Math.max(0, (v - wall) / (1 - wall))) / 2,
    );
    for (const p of rim) {
      positions.push(
        (1 - radius) * center[0] + radius * p[0],
        (1 - radius) * center[1] + radius * p[1],
        (1 - radius) * center[2] + radius * p[2] - 1.8 * depth * v,
      );
      if (expanded) {
        const t = Math.min(1, (1.8 * depth * v) / chamber.transitionDepth),
          weight = radius * t * t * (3 - 2 * t),
          at = positions.length - 3;
        positions[at] +=
          weight *
          ((p[0] - center[0]) / extents![0]) *
          chamber.horizontalExpansion;
        positions[at + 1] +=
          weight *
          ((p[1] - center[1]) / extents![1]) *
          chamber.verticalExpansion;
      }
    }
  }
  const pole = positions.length / 3;
  positions.push(center[0], center[1], center[2] - 1.8 * depth);
  if (!positions.every(Number.isFinite))
    throw new Error("Oral lining exceeds representable coordinates.");
  for (let col = 0; col < count; col++) {
    const after = (col + 1) % count;
    for (let row = 0; row < rows - 1; row++) {
      const a = row * count + col,
        b = a + count;
      const c = row * count + after,
        d = c + count;
      indices.push(a, b, c, c, b, d);
    }
    indices.push((rows - 1) * count + col, pole, (rows - 1) * count + after);
  }
  return {
    positions,
    indices,
    normals: portraitNormals(positions, indices),
    uvs: null,
    skin: null,
  };
}
