import { portraitMix as mix } from "../geometry/geometry";
import type { IControlMesh } from "../geometry/subdivideControlMesh";
import {
  type IPortraitCraniumShape,
  resolvePortraitCraniumShape,
} from "./craniumShape";

// Clockwise boundary of the measured facial patch, starting at the forehead.
// These identities are shared with the face; duplicating their coordinates
// would leave the jaw and temples disconnected under subdivision.
const facialOval = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109,
];

/**
 * Read the lowest point on this version's facial-oval boundary. Both trait
 * interpretation and cranial continuation use this same attachment datum;
 * a singled-out chin landmark cannot substitute for an asymmetric lower oval.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Resolves chin-relative cranial envelopes against the resident face boundary.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-attachments Shares the actual cranial attachment datum between control interpretation and construction.
 */
export function portraitCranialChinHeight(
  positions: readonly (readonly number[])[],
): number {
  const heights = facialOval.map((id) => positions[id]?.[1]);
  if (!heights.every(Number.isFinite))
    throw new Error("The cranial boundary requires finite resident heights.");
  return Math.min(...heights);
}

/**
 * Continue the caller's facial boundary across the cranial vault and jaw.
 * Sagittal stations distinguish the forehead, crown, occiput and mandibular
 * underside. Their hidden-side dimensions are authored estimates, not recovered
 * measurements of the photographed person.
 *
 * The underside has an open collar from the submental region to the nape.
 * Its ordered boundary belongs to the neck builder, so the finished skin is one
 * surface rather than a closed head intersecting a separate cylinder.
 * The input retains the first 468 measured facial vertex identities.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Continues the facial oval into distinct cranial vault, occipital and mandibular envelopes.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Builds ordered sagittal sections and a shared posterior cap while leaving an oriented collar for the neck.
 */
export function appendPortraitCranium(
  cage: IControlMesh,
  shape?: IPortraitCraniumShape,
): {
  boundary: number[];
  exterior: number[][];
} {
  const { positions, indices, groups } = cage;
  const chinY = portraitCranialChinHeight(positions);
  // Each station gives posterior depth, half-width, crown and lower envelope.
  // Separate lower controls let the jaw turn towards its angle while the vault
  // continues around the braincase. These are independent anatomical envelopes;
  // the chin does not scale towards the cranial centre with the posterior vault.
  const { stations, capDepth, transition, frame } = resolvePortraitCraniumShape(
    chinY,
    shape,
  );
  const angles = facialOval.map((id) =>
    Math.atan2(
      positions[id][0] / frame.width,
      (positions[id][1] - frame.centerY) / frame.height,
    ),
  );
  const sections = stations.map((station, row) =>
    angles.map((measured, column) => {
      // Facial landmarks are denser around the chin than around the forehead.
      // Hidden rings gradually approach equal angular spacing so the posterior
      // cap receives balanced cells. The measured oval and first station retain
      // their correspondence; the squared blend changes only the hidden vault.
      const regular = (2 * Math.PI * column) / angles.length;
      const difference = Math.atan2(
        Math.sin(measured - regular),
        Math.cos(measured - regular),
      );
      const angle =
        regular + difference * (1 - (row / (stations.length - 1)) ** 2);
      return [
        station.width * Math.sin(angle),
        mix(station.floor, station.crown, (1 + Math.cos(angle)) / 2),
        // The frontal vault turns above the forehead before the temporal wall
        // reaches the same posterior station. Crown depth varies with angle.
        mix(station.z, station.crownZ, Math.max(0, Math.cos(angle)) ** 2),
      ];
    }),
  );
  // One transition row leaves the observed oval gradually. This is a control
  // row for the common subdivision surface, not an extra overlapping shell.
  sections.unshift(
    facialOval.map((id, i) =>
      positions[id].map((value, axis) =>
        mix(value, sections[0][i][axis], transition),
      ),
    ),
  );
  const rings = [facialOval];
  for (const section of sections)
    rings.push(section.map((point) => positions.push(point) - 1));

  // The collar occupies a rectangular part of this control lattice. The common
  // Loop refinement rounds its corners after the neck has joined these vertices.
  const firstRow = 1,
    lastRow = 5,
    // Include the jaw-angle region in the collar. Its lateral vertices become
    // shared neck attachments rather than closed underside panels.
    firstColumn = 12,
    lastColumn = 24;
  for (let row = 1; row < rings.length; row++)
    for (let column = 0; column < facialOval.length; column++) {
      if (
        row > firstRow &&
        row <= lastRow &&
        column >= firstColumn &&
        column < lastColumn
      )
        continue;
      const next = (column + 1) % facialOval.length;
      indices.push(
        rings[row - 1][column],
        rings[row - 1][next],
        rings[row][column],
        rings[row - 1][next],
        rings[row][next],
        rings[row][column],
      );
      groups.push(0, 0);
    }
  const rear = rings[rings.length - 1];
  // A four-sided Coons patch closes the occiput. Its 9 by 9 cells distribute
  // curvature across shared quads, keeping cap valence suitable for Loop
  // subdivision while preserving every vertex of the surrounding ring.
  const cells = rear.length / 4;
  const grid: number[][] = [];
  for (let row = 0; row <= cells; row++) {
    const line: number[] = [];
    for (let column = 0; column <= cells; column++) {
      if (row === 0) line.push(rear[column]);
      else if (column === cells) line.push(rear[cells + row]);
      else if (row === cells) line.push(rear[3 * cells - column]);
      else if (column === 0) line.push(rear[(rear.length - row) % rear.length]);
      else {
        const u = column / cells,
          v = row / cells;
        const top = positions[rear[column]],
          bottom = positions[rear[3 * cells - column]];
        const left = positions[rear[rear.length - row]],
          right = positions[rear[cells + row]];
        const point = [0, 1, 2].map(
          (axis) =>
            mix(top[axis], bottom[axis], v) +
            mix(left[axis], right[axis], u) -
            mix(
              mix(positions[rear[0]][axis], positions[rear[cells]][axis], u),
              mix(
                positions[rear[3 * cells]][axis],
                positions[rear[2 * cells]][axis],
                u,
              ),
              v,
            ),
        );
        // Curvature belongs to physical head coordinates. A sine of the patch
        // coordinates gave the same skull a visible round plateau because the
        // Coons map compresses its parameter spacing near the boundary.
        const station = stations[stations.length - 1];
        const middle = (station.crown + station.floor) / 2;
        const height = (station.crown - station.floor) / 2;
        const radiusSquared =
          (point[0] / station.width) ** 2 + ((point[1] - middle) / height) ** 2;
        point[2] = station.z - capDepth * (1 - radiusSquared);
        line.push(positions.push(point) - 1);
      }
    }
    grid.push(line);
  }
  for (let row = 0; row < cells; row++)
    for (let column = 0; column < cells; column++) {
      indices.push(
        grid[row][column],
        grid[row][column + 1],
        grid[row + 1][column],
        grid[row][column + 1],
        grid[row + 1][column + 1],
        grid[row + 1][column],
      );
      groups.push(0, 0);
    }

  // Follow the missing patch's winding: anterior edge, one side, posterior
  // edge, other side. No duplicated corners means every seam has two faces.
  const collar: number[] = [];
  const exterior: number[][] = [];
  const addCollar = (row: number, column: number): void => {
    collar.push(rings[row][column]);
    const neighbours: number[][] = [];
    if (row === firstRow) neighbours.push(positions[rings[row - 1][column]]);
    if (row === lastRow) neighbours.push(positions[rings[row + 1][column]]);
    if (column === firstColumn)
      neighbours.push(positions[rings[row][column - 1]]);
    if (column === lastColumn)
      neighbours.push(positions[rings[row][column + 1]]);
    exterior.push(
      [0, 1, 2].map(
        (axis) =>
          neighbours.reduce((sum, point) => sum + point[axis], 0) /
          neighbours.length,
      ),
    );
  };
  for (let column = firstColumn; column <= lastColumn; column++)
    addCollar(firstRow, column);
  for (let row = firstRow + 1; row <= lastRow; row++)
    addCollar(row, lastColumn);
  for (let column = lastColumn - 1; column >= firstColumn; column--)
    addCollar(lastRow, column);
  for (let row = lastRow - 1; row > firstRow; row--)
    addCollar(row, firstColumn);
  return { boundary: collar, exterior };
}

/**
 * A horizontal neck section with independent anterior/posterior radii.
 * Distances are millimetres in the shared head frame.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Exposes transverse, anterior, posterior and axis controls for one cervical section.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines the metric cross-section used to sample the neck around its cranial attachment.
 */
export interface IPortraitNeckSection {
  /** Height of this section; sections descend from upper to lower to crop. */
  y: number;
  /** Positive transverse half-width. */
  width: number;
  /** Positive radius anterior to the section's axis. */
  front: number;
  /** Positive radius posterior to the section's axis. */
  back: number;
  /** Sagittal position of the cervical axis; positive Z points forwards. */
  centre: number;
}

/**
 * Authored cervical sections; changing the axis also changes collar mapping.
 * The crop is an open inspection boundary, not a shoulder or torso model.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Separates upper neck, lower neck and crop controls rather than representing the neck as a scaled sphere.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Supplies three ordered cervical sections for the shared head-to-neck surface.
 */
export interface IPortraitNeckShape {
  /**
   * Anterior submental bulge in mm, from 0 through 40; omission is zero.
   * Peaks halfway from collar to upper neck on the anterior meridian, fading
   * with squared positive cosine laterally. Both ends retain their tangents.
   * This authored surface envelope is not a measured fat thickness.
   */
  submentalProjection?: number;
  /** Upper cervical section below the complete cranial attachment. */
  upper: IPortraitNeckSection;
  /** Wider lower section above the crop. */
  lower: IPortraitNeckSection;
  /** Last open section. */
  crop: IPortraitNeckSection;
}

/**
 * Inferred neck sections in millimetres, centred behind the facial plane.
 * The posterior axis and separate anterior/posterior radii define the throat
 * and nape envelopes. These authored values are not measurements of the subject.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Provides provisional upper, lower and crop dimensions without claiming hidden anatomy was measured.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines the default cervical section values consumed by the neck assembler.
 */
export const portraitNeckShape: IPortraitNeckShape = {
  upper: { y: -107, width: 35, front: 33, back: 42, centre: -53 },
  lower: { y: -145, width: 43, front: 39, back: 45, centre: -53 },
  crop: { y: -150, width: 44, front: 39, back: 45, centre: -53 },
};

/**
 * Join the submental floor and posterior nape to an authored cropped neck.
 * The attachment rises towards the occiput. Anterior and posterior depths are
 * controlled separately and the lower neck widens towards its cropped base.
 * All vertices share the head's subdivision and normal field.
 * The collar must be the oriented opening returned by appendPortraitCranium.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Joins throat and nape to the head through controlled cervical sections on one skin surface.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Samples tangent-guided collar transitions and ordered neck rings using shared indices and material ownership.
 */
export function appendPortraitNeck(
  cage: IControlMesh,
  collar: ReturnType<typeof appendPortraitCranium>,
  shape: IPortraitNeckShape = portraitNeckShape,
): number[] {
  const { positions, indices, groups } = cage;
  const projection =
    shape.submentalProjection === undefined ? 0 : shape.submentalProjection;
  if (!Number.isFinite(projection) || projection < 0 || projection > 40)
    throw new Error("Submental projection must be from zero through 40 mm.");
  const roots = collar.boundary.map((id) => positions[id]);
  if (
    roots.length < 3 ||
    [shape.upper, shape.lower, shape.crop].some(
      (section) =>
        !Object.values(section).every(Number.isFinite) ||
        section.width <= 0 ||
        section.front <= 0 ||
        section.back <= 0,
    ) ||
    !(
      shape.crop.y < shape.lower.y &&
      shape.lower.y < shape.upper.y &&
      shape.upper.y < Math.min(...roots.map((point) => point[1]))
    )
  )
    throw new Error(
      "Neck sections need finite positive radii and descending heights below their attachment.",
    );
  const angles = roots.map(([x, , z]) => Math.atan2(x, z - shape.upper.centre));
  const section = ({
    y,
    width,
    front,
    back,
    centre,
  }: IPortraitNeckSection): number[][] =>
    angles.map((angle) => {
      const cosine = Math.cos(angle);
      return [
        width * Math.sin(angle),
        y,
        centre + (cosine >= 0 ? front : back) * cosine,
      ];
    });
  const upper = section(shape.upper);
  const lower = section(shape.lower);
  const crop = section(shape.crop);
  // Each collar vertex follows a cubic curve to the upper cervical section.
  // The first handle follows the adjacent head tangent; the second aligns with
  // the upper-to-lower neck direction. Sampling that curve provides a coherent
  // transition around the oblique collar before common skin subdivision.
  const handles = roots.map((root, i) => {
    const incoming = root.map(
      (value, axis) => value - collar.exterior[i][axis],
    );
    const length = Math.hypot(...incoming);
    if (length === 0)
      throw new Error(
        "A neck attachment needs a nonzero incoming surface tangent.",
      );
    // A long neck must not amplify small lateral changes in the head tangent
    // into deep radial grooves. Limit the first guide by its adjacent head
    // spacing as well as by the remaining distance to the cervical section.
    let span = Math.min(
      0.5 * length,
      0.25 * Math.hypot(...root.map((value, axis) => upper[i][axis] - value)),
    );
    const depth = upper[i][2] - root[2];
    // Where the incoming tangent already faces the target depth, keep its
    // handle short of that target. This preserves the tangent direction while
    // preventing a backtracking upper-neck curve.
    if (incoming[2] * depth > 0)
      span = Math.min(span, 0.8 * Math.abs((depth * length) / incoming[2]));
    const drop = root[1] - upper[i][1];
    if (incoming[1] < 0)
      span = Math.min(span, (0.4 * drop * length) / -incoming[1]);
    const outgoing = lower[i].map((value, axis) => value - upper[i][axis]);
    const outgoingLength = Math.hypot(...outgoing);
    const approach = Math.min(
      0.25 * Math.hypot(...root.map((value, axis) => upper[i][axis] - value)),
      (0.4 * drop * outgoingLength) / -outgoing[1],
    );
    return {
      first: root.map(
        (value, axis) => value + (span * incoming[axis]) / length,
      ),
      second: upper[i].map(
        (value, axis) => value - (approach * outgoing[axis]) / outgoingLength,
      ),
    };
  });
  let previous = collar.boundary;
  const addRing = (points: number[][]): void => {
    const ring = points.map((point) => positions.push(point) - 1);
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      indices.push(
        previous[i],
        previous[j],
        ring[i],
        previous[j],
        ring[j],
        ring[i],
      );
      groups.push(0, 0);
    }
    previous = ring;
  };
  // Evaluate the Bezier curve into skin rings; its tangent handles are control
  // points and do not enter the mesh. Sample the lower neck at comparable
  // spacing with an incoming direction matching the final Bezier derivative.
  for (let row = 1; row <= 12; row++) {
    const t = row / 12,
      s = 1 - t;
    addRing(
      roots.map((root, i) => {
        const point = root.map(
          (value, axis) =>
            value * s ** 3 +
            3 * handles[i].first[axis] * s * s * t +
            3 * handles[i].second[axis] * s * t * t +
            upper[i][axis] * t ** 3,
        );
        // A compact quartic adds only anterior volume and has zero value and
        // derivative at both joins. Omission preserves the original arithmetic.
        if (projection !== 0)
          point[2] +=
            projection *
            16 *
            t *
            t *
            s *
            s *
            Math.max(0, Math.cos(angles[i])) ** 2;
        return point;
      }),
    );
  }
  for (const [from, to, count] of [
    [upper, lower, 8],
    [lower, crop, 2],
  ] as const)
    for (let row = 1; row <= count; row++)
      addRing(
        from.map((point, i) =>
          point.map((value, axis) => mix(value, to[i][axis], row / count)),
        ),
      );
  return previous;
}
