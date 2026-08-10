import { fluidSurfaceGeometry, simulateFluidDomain } from "@automovie/engine";
import { IAutoMovieFluidDomain } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { fluidDomain } from "../internal/fluidFixtures";
import {
  namedFacts,
  nclose,
  throwsError,
  vclose,
} from "../internal/predicates";

const pool = (props: {
  columns: number;
  rows: number;
  bed: number[];
  depth: number[];
  solid?: boolean[];
}): IAutoMovieFluidDomain =>
  fluidDomain({
    id: "reflecting-pool",
    grid: {
      columns: props.columns,
      rows: props.rows,
      cellX: 0.5,
      cellZ: 0.5,
      origin: { x: 2, y: 1, z: -3 },
    },
    solver: {
      fixedStepSeconds: 0.015625,
      gravity: 8,
      drag: 0,
      dryDepth: 0,
      referenceDepth: 1,
      maxSteps: 5_000,
    },
    bed: props.bed,
    depth: props.depth,
    solid: props.solid ?? new Array(props.columns * props.rows).fill(false),
  });

const at = (values: number[], index: number, stride: number, offset: number) =>
  values[index * stride + offset];

/**
 * The drawable free surface is derived from the solved depth field alone, and
 * agrees with it: vertex heights, bounds, normals, wet/dry triangulation, and
 * the per-vertex flow all restate the state rather than reinterpreting it.
 *
 * The renderer never builds water of its own, which is the only way the water a
 * camera sees and the depth field the mass balance was proven against can be
 * guaranteed to be the same statement.
 *
 * Scenarios:
 *
 * 1. A still flat pool: one vertex per cell at `origin.y + bed + depth`, every
 *    normal exactly `(0, 1, 0)`, UVs spanning `[0, 1]`, `6·(C−1)·(R−1)`
 *    indices, and bounds equal to the hand-computed corner cell centres.
 * 2. A surface tilted 0.5 vertically per metre horizontally has normals equal to
 *    the hand-computed `normalize(−0.5, 1, 0)`, at an interior vertex and at
 *    the lattice edge where the central difference degenerates to a one-sided
 *    one.
 * 3. A drained basin draws nothing: no indices, and `null` bounds — not a flat
 *    sheet lying on its own floor.
 * 4. A one-cell domain has no quad to draw and no slope to measure, so its single
 *    normal is exactly up and its UV is the degenerate `(0, 0)`.
 * 5. A pier in the pool removes exactly the four quads that touch it, in all four
 *    corner positions, and every remaining triangle is wet.
 * 6. The per-vertex flow equals the average of the four face velocities around the
 *    cell, taken from a genuinely moving state.
 * 7. A state solved from a different domain is refused rather than drawn. Two
 *    water features over two lattices is the ordinary case, so crossing them is
 *    the ordinary mistake, and the mistake reads depths that were never indexed
 *    for this grid — an empty pond nobody was told about. Its twin is the same
 *    lattice paired with its own state, which draws.
 */
export const test_fluid_surface_geometry = (): void => {
  const flat = pool({
    columns: 4,
    rows: 4,
    bed: new Array(16).fill(0),
    depth: new Array(16).fill(0.5),
  });
  const still = fluidSurfaceGeometry({
    domain: flat,
    state: simulateFluidDomain(flat, 0),
  });
  TestValidator.equals(
    "a still flat pool restates the depth field exactly",
    namedFacts([
      ["vertexCount", () => still.mesh.positions.length === 16 * 3],
      [
        "vertexHeights",
        () =>
          Array.from({ length: 16 }, (_, k) =>
            nclose(at(still.mesh.positions, k, 3, 1), 1.5),
          ).every(Boolean),
      ],
      [
        "firstVertex",
        () =>
          vclose(
            {
              x: still.mesh.positions[0],
              y: still.mesh.positions[1],
              z: still.mesh.positions[2],
            },
            { x: 2.25, y: 1.5, z: -2.75 },
          ),
      ],
      [
        "normalsUp",
        () =>
          Array.from({ length: 16 }, (_, k) =>
            vclose(
              {
                x: at(still.mesh.normals ?? [], k, 3, 0),
                y: at(still.mesh.normals ?? [], k, 3, 1),
                z: at(still.mesh.normals ?? [], k, 3, 2),
              },
              { x: 0, y: 1, z: 0 },
            ),
          ).every(Boolean),
      ],
      [
        "uvSpan",
        () =>
          nclose((still.mesh.uvs ?? [])[0], 0) &&
          nclose((still.mesh.uvs ?? [])[1], 0) &&
          nclose((still.mesh.uvs ?? [])[31], 1),
      ],
      ["indexCount", () => (still.mesh.indices ?? []).length === 6 * 3 * 3],
      [
        "bounds",
        () =>
          still.bounds !== null &&
          vclose(still.bounds.min, { x: 2.25, y: 1.5, z: -2.75 }) &&
          vclose(still.bounds.max, { x: 3.75, y: 1.5, z: -1.25 }),
      ],
      ["flowStill", () => still.flow.every((value) => value === 0)],
      ["step", () => still.step === 0 && still.domain === "reflecting-pool"],
    ]),
    {
      vertexCount: true,
      vertexHeights: true,
      firstVertex: true,
      normalsUp: true,
      uvSpan: true,
      indexCount: true,
      bounds: true,
      flowStill: true,
      step: true,
    },
  );

  const tiltedBed = Array.from({ length: 9 }, (_, k) => (k % 3) * 0.25);
  const tilted = pool({
    columns: 3,
    rows: 3,
    bed: tiltedBed,
    depth: new Array(9).fill(0.5),
  });
  const slope = fluidSurfaceGeometry({
    domain: tilted,
    state: simulateFluidDomain(tilted, 0),
  });
  const expected = {
    x: -0.5 / Math.sqrt(1.25),
    y: 1 / Math.sqrt(1.25),
    z: 0,
  };
  TestValidator.equals(
    "a tilted surface carries the hand-computed normal",
    namedFacts([
      [
        "interior",
        () =>
          vclose(
            {
              x: at(slope.mesh.normals ?? [], 4, 3, 0),
              y: at(slope.mesh.normals ?? [], 4, 3, 1),
              z: at(slope.mesh.normals ?? [], 4, 3, 2),
            },
            expected,
          ),
      ],
      [
        "edge",
        () =>
          vclose(
            {
              x: at(slope.mesh.normals ?? [], 3, 3, 0),
              y: at(slope.mesh.normals ?? [], 3, 3, 1),
              z: at(slope.mesh.normals ?? [], 3, 3, 2),
            },
            expected,
          ),
      ],
    ]),
    { interior: true, edge: true },
  );

  const drained = pool({
    columns: 4,
    rows: 4,
    bed: new Array(16).fill(0),
    depth: new Array(16).fill(0),
  });
  const nothing = fluidSurfaceGeometry({
    domain: drained,
    state: simulateFluidDomain(drained, 0),
  });
  const single = pool({ columns: 1, rows: 1, bed: [0], depth: [0.5] });
  const alone = fluidSurfaceGeometry({
    domain: single,
    state: simulateFluidDomain(single, 0),
  });
  TestValidator.equals(
    "a drained basin and a one-cell domain draw nothing",
    namedFacts([
      ["drainedEmpty", () => (nothing.mesh.indices ?? []).length === 0],
      ["drainedBounds", () => nothing.bounds === null],
      ["drainedVertices", () => nothing.mesh.positions.length === 48],
      ["singleEmpty", () => (alone.mesh.indices ?? []).length === 0],
      ["singleVertex", () => alone.mesh.positions.length === 3],
      [
        "singleNormal",
        () =>
          vclose(
            {
              x: (alone.mesh.normals ?? [])[0],
              y: (alone.mesh.normals ?? [])[1],
              z: (alone.mesh.normals ?? [])[2],
            },
            { x: 0, y: 1, z: 0 },
          ),
      ],
      [
        "singleUv",
        () =>
          nclose((alone.mesh.uvs ?? [])[0], 0) &&
          nclose((alone.mesh.uvs ?? [])[1], 0),
      ],
    ]),
    {
      drainedEmpty: true,
      drainedBounds: true,
      drainedVertices: true,
      singleEmpty: true,
      singleVertex: true,
      singleNormal: true,
      singleUv: true,
    },
  );

  const solid = new Array(16).fill(false);
  solid[5] = true;
  const depth = new Array(16).fill(0.5);
  depth[5] = 0;
  const pier = pool({
    columns: 4,
    rows: 4,
    bed: new Array(16).fill(0),
    depth,
    solid,
  });
  const around = fluidSurfaceGeometry({
    domain: pier,
    state: simulateFluidDomain(pier, 0),
  });
  TestValidator.equals(
    "a pier removes exactly the quads that touch it",
    namedFacts([
      ["quadCount", () => (around.mesh.indices ?? []).length === 6 * 5],
      [
        "noPierVertex",
        () => (around.mesh.indices ?? []).every((index) => index !== 5),
      ],
    ]),
    { quadCount: true, noPierVertex: true },
  );

  const moving = pool({
    columns: 4,
    rows: 4,
    bed: new Array(16).fill(0),
    depth: [
      0.5, 0.5, 0.25, 0.25, 0.5, 0.5, 0.25, 0.25, 0.5, 0.5, 0.25, 0.25, 0.5,
      0.5, 0.25, 0.25,
    ],
  });
  const state = simulateFluidDomain(moving, 20);
  const flowing = fluidSurfaceGeometry({ domain: moving, state });
  TestValidator.equals(
    "the per-vertex flow is the cell-centred face average",
    namedFacts([
      [
        "matchesFaces",
        () =>
          Array.from({ length: 16 }, (_, cell) => {
            const row = Math.floor(cell / 4);
            const column = cell % 4;
            const west = row * 5 + column;
            const south = row * 4 + column;
            return (
              nclose(
                flowing.flow[cell * 2],
                (state.velocityX[west] + state.velocityX[west + 1]) / 2,
                0,
              ) &&
              nclose(
                flowing.flow[cell * 2 + 1],
                (state.velocityZ[south] + state.velocityZ[south + 4]) / 2,
                0,
              )
            );
          }).every(Boolean),
      ],
      ["actuallyFlowing", () => flowing.flow.some((value) => value !== 0)],
      ["step", () => flowing.step === 20],
    ]),
    { matchesFaces: true, actuallyFlowing: true, step: true },
  );

  const other = fluidDomain({ id: "other-pool" });
  TestValidator.equals(
    "a surface is derived from its own domain's state or from none",
    namedFacts([
      [
        "foreignState",
        () =>
          throwsError(
            () =>
              fluidSurfaceGeometry({
                domain: moving,
                state: simulateFluidDomain(other, 0),
              }),
            ["reflecting-pool", "other-pool"],
          ),
      ],
      [
        "ownState",
        () =>
          throwsError(() =>
            fluidSurfaceGeometry({
              domain: moving,
              state: simulateFluidDomain(moving, 0),
            }),
          ) === false,
      ],
    ]),
    { foreignState: true, ownState: true },
  );
};
