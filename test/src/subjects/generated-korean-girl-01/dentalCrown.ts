import type { IAutoMovieMesh } from "@automovie/interface";

import { portraitNormals } from "../geometry";

/**
 * Local enamel dimensions in millimetres. +Y points towards the gingiva and +Z
 * towards the lip. The cervical ratio and cutting-edge rise distinguish crown
 * profiles independently of the dental arch's spacing and orientation.
 * @author Samchon
 */
export interface IPortraitDentalCrown {
  /** Maximum transverse width. */
  width: number;
  /** Total vertical height. */
  height: number;
  /** Maximum half-depth. */
  depth: number;
  /** Cervical width divided by maximum width, in (0,1]. */
  cervicalWidth: number;
  /** Cutting-edge corners' rise above the centre, in [0,height/2). */
  edgeRise: number;
}

/** Refuse crown profiles before they can alter the row's physical clearances. */
export function assertPortraitDentalCrown(s: IPortraitDentalCrown): void {
  if (
    ![s.width, s.height, s.depth, s.cervicalWidth, s.edgeRise].every(
      Number.isFinite,
    ) ||
    s.width <= 0 ||
    s.height <= 0 ||
    s.depth <= 0 ||
    s.cervicalWidth <= 0 ||
    s.cervicalWidth > 1 ||
    s.edgeRise < 0 ||
    s.edgeRise >= s.height / 2
  )
    throw new Error(
      "Dental crowns need positive dimensions, bounded cervical width and cutting-edge rise.",
    );
}

/**
 * A closed crown loft with a narrow cervical end, broad body and thin cutting
 * edge. End caps share their ring identities. The sampled body reaches exactly
 * the declared width, preserving arch clearance. Hidden roots are not modelled.
 */
export function buildPortraitDentalCrown(
  s: IPortraitDentalCrown,
): IAutoMovieMesh {
  assertPortraitDentalCrown(s);
  const columns = 32,
    rows = 10,
    positions: number[] = [],
    indices: number[] = [];
  const rounded = (v: number) => Math.sign(v) * Math.abs(v) ** 0.45;
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    const breadth =
      v <= 0.3
        ? 0.92 + 0.08 * Math.sin(((v / 0.3) * Math.PI) / 2)
        : 1 - (1 - s.cervicalWidth) * ((v - 0.3) / 0.7) ** 1.4;
    const thickness =
      0.22 + 0.78 * Math.sin((Math.min(1, v / 0.4) * Math.PI) / 2);
    for (let column = 0; column < columns; column++) {
      const a = (column / columns) * 2 * Math.PI,
        x = rounded(Math.cos(a));
      positions.push(
        (s.width / 2) * breadth * x,
        -s.height / 2 + s.height * v + s.edgeRise * x * x * (1 - v) ** 4,
        -s.depth * thickness * rounded(Math.sin(a)),
      );
    }
  }
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const a = row * columns + column,
        b = row * columns + ((column + 1) % columns),
        c = a + columns,
        d = b + columns;
      indices.push(a, b, c, b, d, c);
    }
  const bottom = positions.length / 3;
  positions.push(0, -s.height / 2, 0, 0, s.height / 2, 0);
  for (let column = 0; column < columns; column++) {
    const next = (column + 1) % columns;
    indices.push(
      bottom,
      next,
      column,
      bottom + 1,
      rows * columns + column,
      rows * columns + next,
    );
  }
  return {
    positions,
    indices,
    normals: portraitNormals(positions, indices),
    uvs: null,
    skin: null,
  };
}
