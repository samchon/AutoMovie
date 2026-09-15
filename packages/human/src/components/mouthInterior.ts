/**
 * Finish the oral interior from the assembler's actual refined lip boundaries.
 * createPortraitMouthComponent calls this after common surface refinement;
 * direct callers keep the established buildPortraitMouth API via mouth.ts.
 * Source coordinates, cavity distances and crown sizes are head millimetres
 * (+Z anterior). Geometry helpers convert the resulting parts to model metres.
 * Caller arrays are read only; crown buffers are newly owned and placed here.
 * First admit an optional connected lining, then omit a closed performed cavity,
 * then place any legacy static crowns along the shared arc. Performed dentition
 * belongs to separate components. A different final rim invalidates this output;
 * an admitted enclosure does not prove clearance against tongue or enamel.
 */
import type {
  IAutoMovieModelPart,
  IAutoMovieVector3,
} from "@automovie/interface";

import {
  portraitSpline as interpolate,
  portraitMix as mix,
  portraitPoint as p,
  portraitPatch as patch,
  portraitPart,
} from "../geometry/geometry";
import { createPortraitDentalArc } from "./dentalArc";
import { buildPortraitDentalCrown } from "./dentalCrown";
import type { IPortraitMouthShape, IPortraitMouthSocket } from "./mouth";
import type { IPortraitMouthPerformance } from "./mouthPerformance";
import {
  assertPortraitOralLining,
  buildPortraitOralLining,
} from "./oralLining";

type Point = IAutoMovieVector3;
const pi = Math.PI;

/**
 * Recess the mouth interior behind the photographed lip opening, then place
 * the supplied upper crowns along that opening's curved dental arch. Central crowns
 * are wider and taller; side crowns turn with the arch to remain behind the
 * mouth corners. Widths are authored estimates, in millimetres, not dental data.
 * Lips themselves remain in the shared facial mesh, preserving their skin join.
 * Selecting cavityWall requires final skin indices and replaces the detached
 * backdrop with an enclosure joined to every actual refined oral-rim vertex.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Constructs a recessed oral interior and optional individually sized upper crowns behind the refined opening.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Selects the legacy backdrop or actual-rim enclosure, omits a fully closed performed cavity and rotates each legacy crown and its normals along the common arch.
 */
export function buildPortraitMouth(
  source: number[][],
  socket: IPortraitMouthSocket,
  shape: IPortraitMouthShape,
  performance?: IPortraitMouthPerformance,
  skinIndices?: readonly number[],
): IAutoMovieModelPart[] {
  if (shape.cavityWall !== undefined || shape.cavityChamber !== undefined)
    assertPortraitOralLining(
      shape.cavityDepth,
      shape.cavityWall!,
      shape.cavityChamber,
    );
  const parts: IAutoMovieModelPart[] = [];
  const add = (
    id: string,
    mesh: Parameters<typeof portraitPart>[1],
    finish: string,
  ): void => {
    parts.push(portraitPart(id, mesh, finish));
  };
  const landmark = (id: number): Point =>
    p(source[id][0], source[id][1], source[id][2]);
  const cavity = "mouth-interior",
    enamel = "teeth";
  const mouthUpper = socket.upper.map(landmark);
  const mouthLower = socket.lower.map(landmark);
  if (
    performance === undefined ||
    mouthUpper.some(
      (point, i) =>
        point.x !== mouthLower[i].x ||
        point.y !== mouthLower[i].y ||
        point.z !== mouthLower[i].z,
    )
  ) {
    if (shape.cavityWall !== undefined && skinIndices === undefined)
      throw new Error("Oral lining requires the actual refined lip triangles.");
    add(
      "oral-cavity",
      shape.cavityWall !== undefined
        ? buildPortraitOralLining(
            { positions: source, indices: skinIndices! },
            socket.upper[0],
            shape.cavityDepth,
            shape.cavityWall,
            shape.cavityChamber,
          )
        : patch(
            (u, v) => {
              const top = interpolate(mouthUpper, u),
                bottom = interpolate(mouthLower, u);
              return p(
                mix(bottom.x, top.x, v),
                mix(bottom.y, top.y, v),
                mix(bottom.z, top.z, v) -
                  shape.cavityDepth * (1 + 0.8 * Math.sin(pi * v)),
              );
            },
            100,
            30,
          ),
      cavity,
    );
  }
  if (shape.crowns.length === 0) return parts;
  // Width is enamel size, not a pitch on the head's X axis. Walk the arch in
  // millimetres so rotating the side teeth cannot create artificial diastemata.
  const rowLength =
    shape.crowns.reduce((sum, crown) => sum + crown.width, 0) +
    shape.toothGap * (shape.crowns.length - 1);
  const arch = createPortraitDentalArc(mouthUpper, rowLength);
  let cursor = arch.center + shape.dentalOffset - rowLength / 2;
  for (let i = 0; i < shape.crowns.length; i++) {
    const { width, height } = shape.crowns[i];
    const distance = cursor + width / 2;
    const { position: at, tangent } = arch.sample(distance);
    cursor += width + shape.toothGap;
    const angleY = -Math.atan2(tangent.z, tangent.x);
    const crown = buildPortraitDentalCrown(
      {
        width,
        height,
        depth: shape.dentalDepth,
        cervicalWidth: shape.crowns[i].cervicalWidth ?? 0.78,
        edgeRise: shape.crowns[i].edgeRise ?? 0.035 * height,
        contour: shape.crowns[i].contour,
      },
      distance <= arch.center ? 1 : -1,
    );
    // Placement and normals use the same rigid arch rotation. The local crown
    // profile therefore cannot silently change measured interdental clearance.
    for (let vertex = 0; vertex < crown.positions.length; vertex += 3) {
      const x = crown.positions[vertex],
        y = crown.positions[vertex + 1],
        z = crown.positions[vertex + 2];
      crown.positions[vertex] =
        at.x + Math.cos(angleY) * x + Math.sin(angleY) * z;
      crown.positions[vertex + 1] = at.y - shape.dentalDrop + y;
      crown.positions[vertex + 2] =
        at.z - shape.dentalRecess - Math.sin(angleY) * x + Math.cos(angleY) * z;
      const nx = crown.normals![vertex],
        nz = crown.normals![vertex + 2];
      crown.normals![vertex] = Math.cos(angleY) * nx + Math.sin(angleY) * nz;
      crown.normals![vertex + 2] =
        -Math.sin(angleY) * nx + Math.cos(angleY) * nz;
    }
    add(`tooth-${i}`, crown, enamel);
  }
  return parts;
}
