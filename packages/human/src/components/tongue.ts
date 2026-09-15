import type { IAutoMovieMesh, IAutoMovieVector3 } from "@automovie/interface";

import type { IAutoMovieHumanFaceExpression } from "../IAutoMovieHumanFaceDocument";
import {
  portraitNormals,
  portraitPart,
  portraitPoint,
} from "../geometry/geometry";
import type { IPortraitComponent } from "../geometry/portraitComponents";
import { resolveHumanFaceExpression } from "../humanFaceExpression";
import { posePortraitJawPoint } from "./jawPerformance";
import { attachPortraitOralMesh } from "./oralFrame";
import {
  type IPortraitTongueShape,
  assertPortraitTongueShape,
} from "./tongueShape";

const rows = 32,
  columns = 48;
const frontWeight = (v: number): number => 1 - v * v * (3 - 2 * v);
const fraction = (vertex: number): number =>
  vertex === 0
    ? 0
    : vertex === 1 + (rows - 1) * columns
      ? 1
      : (Math.floor((vertex - 1) / columns) + 1) / rows;

/**
 * Sample a closed tongue in a local millimetre frame. Sinusoidal cross-sections
 * join single anterior/posterior poles, with an upper-only median depression.
 * Raise offsets the centreline by sin(pi*v)^2; advance moves the anterior body
 * by one minus smoothstep(v), leaving the posterior endpoint fixed. A backwards
 * advance that would reverse the longitudinal parameterization is refused.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Constructs independent lingual volume rather than colouring the cavity back wall.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Produces closed indexed rings, shared poles and geometric normals from named lingual dimensions.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Separates observed shape from current dorsal and anterior displacement.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Applies endpoint-aware observed-relative tongue displacements without changing enamel or lips.
 */
export function buildPortraitTongue(
  shape: IPortraitTongueShape,
  performance: { raise: number; advance: number } = { raise: 0, advance: 0 },
): IAutoMovieMesh {
  assertPortraitTongueShape(shape);
  if (
    ![performance.raise, performance.advance].every(
      (v) => Number.isFinite(v) && Math.abs(v) <= 16,
    )
  )
    throw new Error(
      "Tongue performance differences must be finite in [-16,16] mm.",
    );
  if (shape.length <= 1.5 * Math.max(0, -performance.advance))
    throw new Error(
      "Tongue retraction must preserve a strictly descending longitudinal coordinate.",
    );
  const positions: number[] = [0, 0, performance.advance],
    indices: number[] = [];
  for (let row = 1; row < rows; row++) {
    const v = row / rows,
      r = Math.sin(Math.PI * v);
    for (let col = 0; col < columns; col++) {
      const a = (2 * Math.PI * col) / columns,
        x = shape.halfWidth * r * Math.cos(a);
      positions.push(
        x,
        shape.halfThickness * r * Math.sin(a) +
          (shape.dorsumRise + performance.raise) * r * r -
          shape.grooveDepth *
            Math.exp(-((x / shape.grooveWidth) ** 2)) *
            Math.max(0, Math.sin(a)) *
            r,
        -shape.length * v + performance.advance * frontWeight(v),
      );
    }
  }
  const back = positions.length / 3;
  positions.push(0, 0, -shape.length);
  for (let col = 0; col < columns; col++) {
    const next = (col + 1) % columns;
    indices.push(0, 1 + col, 1 + next);
    for (let row = 0; row < rows - 2; row++) {
      const a = 1 + row * columns + col,
        b = a + columns,
        c = 1 + row * columns + next,
        d = c + columns;
      indices.push(a, b, c, c, b, d);
    }
    indices.push(
      1 + (rows - 2) * columns + col,
      back,
      1 + (rows - 2) * columns + next,
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

/**
 * Attach a non-cutting tongue to the observed lower oral frame. The anterior
 * body follows the bound jaw, fading to a fixed posterior endpoint. Normals
 * are recomputed after this non-rigid motion. This is an authored kinematic
 * approximation, not muscular/hyoid simulation or a collision certificate.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Adds a separately finished lingual interior without cutting skin or moving teeth.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Uses the observed lower oral midpoint and shared orthonormal oral placement.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Carries the anterior tongue with the mandible independently of lip separation, smile and pucker.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Applies observed-relative dorsal elevation, anterior displacement and weighted mandibular rotation with a fixed posterior endpoint.
 */
export function createPortraitTongueComponent(
  inputSocket: {
    rightCorner: number;
    leftCorner: number;
    lowerLipMiddle: number;
  },
  inputShape: IPortraitTongueShape,
  inputHinge: IAutoMovieVector3,
  observation: IAutoMovieHumanFaceExpression,
  expression: IAutoMovieHumanFaceExpression,
): IPortraitComponent {
  const socket = structuredClone(inputSocket),
    shape = structuredClone(inputShape),
    hinge = structuredClone(inputHinge);
  const observed = resolveHumanFaceExpression(observation),
    current = resolveHumanFaceExpression(expression);
  posePortraitJawPoint(hinge, hinge, 0, 1);
  const local = buildPortraitTongue(shape, {
    raise: current.tongueRaise - observed.tongueRaise,
    advance: current.tongueAdvance - observed.tongueAdvance,
  });
  return {
    id: "tongue",
    fit: (host) => {
      if (
        Object.values(socket).some(
          (id) =>
            !Number.isInteger(id) || id < 0 || id >= host.positions.length,
        )
      )
        throw new Error("Tongue sockets must name resident host vertices.");
      const point = (id: number) =>
        portraitPoint(...(host.positions[id] as [number, number, number]));
      const placed = attachPortraitOralMesh(local, {
        rightCorner: point(socket.rightCorner),
        leftCorner: point(socket.leftCorner),
        origin: point(socket.lowerLipMiddle),
        up: { x: 0, y: 1, z: 0 },
        lift: -shape.drop,
        recess: shape.recess,
      });
      for (let i = 0; i < placed.positions.length; i += 3) {
        const p = posePortraitJawPoint(
          {
            x: placed.positions[i],
            y: placed.positions[i + 1],
            z: placed.positions[i + 2],
          },
          hinge,
          current.jawOpen - observed.jawOpen,
          frontWeight(fraction(i / 3)),
        );
        placed.positions.splice(i, 3, p.x, p.y, p.z);
      }
      placed.normals = portraitNormals(placed.positions, placed.indices!);
      return {
        constraints: [],
        cutFaces: [],
        attach: () => ({
          openings: [],
          finish: () => [
            portraitPart("tongue", structuredClone(placed), shape.material),
          ],
        }),
      };
    },
  };
}
