import type { IAutoMovieMesh } from "@automovie/interface";

import { portraitNormals } from "../geometry";

/**
 * Optional proximal contour on one side of a crown. Mesial faces the arch's
 * midline and distal faces away; the dental group supplies that local direction.
 * The contact crest and incisal corner are different anatomical responsibilities.
 * Omitted fields inherit the crown's basic contour rather than deleting a side.
 * @author Samchon
 */
export interface IPortraitDentalSideContour {
  /** Contact-crest height from incisal zero to cervical one, in (0,1); default 0.3. */
  contactHeight?: number;
  /** Side's cervical/maximal half-width ratio, in (0,1]; default crown cervicalWidth. */
  cervicalWidth?: number;
  /** Incisal corner rise in mm, in [0,height/2); default crown edgeRise. */
  incisalRise?: number;
}

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
  /** Independent proximal contours; omission preserves the basic symmetric formula. */
  contour?: {
    mesial?: IPortraitDentalSideContour;
    distal?: IPortraitDentalSideContour;
  };
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
  for (const side of [s.contour?.mesial, s.contour?.distal]) {
    const contact = side?.contactHeight ?? 0.3;
    const cervical = side?.cervicalWidth ?? s.cervicalWidth;
    const rise = side?.incisalRise ?? s.edgeRise;
    if (
      ![contact, cervical, rise].every(Number.isFinite) ||
      contact <= 0 ||
      contact >= 1 ||
      cervical <= 0 ||
      cervical > 1 ||
      rise < 0 ||
      rise >= s.height / 2
    )
      throw new Error(
        "Dental side contours need a bounded contact height, cervical ratio and incisal rise.",
      );
  }
}

/**
 * A closed crown loft with a narrow cervical end, broad body and thin cutting
 * edge. End caps share their ring identities. The sampled body reaches exactly
 * the declared local width. The row owns clearance after arch rotation; nominal
 * breadth alone does not separate the proximal surfaces. Hidden roots are not modelled.
 *
 * Optional side contours locate each contact crest independently. Their heights
 * join the regular sampling rows, so an unsampled authored crest cannot shrink
 * the delivered crown or silently change arch spacing. The row always supplies
 * mesialDirection (+1 or -1 along local X); a standalone crown defaults to +1.
 * Incisal rise is multiplied by x^2 and fades toward the cervical end, retaining
 * a continuous central edge even when the two proximal corners differ.
 */
export function buildPortraitDentalCrown(
  s: IPortraitDentalCrown,
  mesialDirection: number = 1,
): IAutoMovieMesh {
  assertPortraitDentalCrown(s);
  if (mesialDirection !== 1 && mesialDirection !== -1)
    throw new Error(
      "A dental crown needs mesial direction +1 or -1 in its local X frame.",
    );
  const columns = 32,
    positions: number[] = [],
    indices: number[] = [];
  const contours = [s.contour?.mesial, s.contour?.distal].map((side) => ({
    contactHeight: side?.contactHeight ?? 0.3,
    cervicalWidth: side?.cervicalWidth ?? s.cervicalWidth,
    incisalRise: side?.incisalRise ?? s.edgeRise,
  }));
  const levels = [
    ...new Set([
      ...Array.from({ length: 11 }, (_, i) => i / 10),
      ...contours.map((c) => c.contactHeight),
    ]),
  ].sort((a, b) => a - b);
  const rows = levels.length - 1;
  const rounded = (v: number) => Math.sign(v) * Math.abs(v) ** 0.45;
  for (let row = 0; row <= rows; row++) {
    const v = levels[row];
    const thickness =
      0.22 + 0.78 * Math.sin((Math.min(1, v / 0.4) * Math.PI) / 2);
    for (let column = 0; column < columns; column++) {
      const a = (column / columns) * 2 * Math.PI,
        x = rounded(Math.cos(a));
      const contour = contours[x * mesialDirection >= 0 ? 0 : 1];
      const breadth =
        v <= contour.contactHeight
          ? 0.92 + 0.08 * Math.sin(((v / contour.contactHeight) * Math.PI) / 2)
          : 1 -
            (1 - contour.cervicalWidth) *
              ((v - contour.contactHeight) / (1 - contour.contactHeight)) **
                1.4;
      positions.push(
        (s.width / 2) * breadth * x,
        -s.height / 2 +
          s.height * v +
          contour.incisalRise * x * x * (1 - v) ** 4,
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
