import type {
  AutoMovieSurfacePatternGenerator,
  IAutoMoviePatternPoint,
  IAutoMovieSurfacePattern,
  IAutoMovieSurfacePatternZone,
} from "@automovie/engine";

/**
 * Builders for surface-pattern declarations.
 *
 * Nothing here is a bond catalogue. `stackBond` is one line of authored program
 * standing in for whatever a production writes, kept in one place only so the
 * cases below can differ by the one property each of them is about.
 */
export const rectangle = (
  minU: number,
  minV: number,
  maxU: number,
  maxV: number,
): IAutoMoviePatternPoint[] => [
  { u: minU, v: minV },
  { u: maxU, v: minV },
  { u: maxU, v: maxV },
  { u: minU, v: maxV },
];

/** One square module per lattice cell, filling the cell exactly. */
export const stackBond =
  (size: number, grainDeg = 0): AutoMovieSurfacePatternGenerator =>
  ({ column, row, origin }) => [
    {
      id: `t-${column}-${row}`,
      center: { u: origin.u + size / 2, v: origin.v + size / 2 },
      size: { u: size, v: size },
      rotationDeg: 0,
      grainDeg,
    },
  ];

export const zone = (
  overrides: Partial<IAutoMovieSurfacePatternZone> = {},
): IAutoMovieSurfacePatternZone => ({
  id: "field",
  region: rectangle(0, 0, 2, 1),
  origin: { u: 0, v: 0 },
  period: { u: 0.5, v: 0.5 },
  reach: { u: 0.5, v: 0.5 },
  material: "tile-surface",
  generate: stackBond(0.5),
  ...overrides,
});

export const pattern = (
  overrides: Partial<IAutoMovieSurfacePattern> = {},
): IAutoMovieSurfacePattern => ({
  id: "floor",
  zones: [zone()],
  exclusions: [],
  joint: 0,
  jointTolerance: 0,
  adjacency: 0,
  minimumPiece: 0.25,
  grainToleranceDeg: null,
  seed: 7,
  variants: 1,
  ...overrides,
});
