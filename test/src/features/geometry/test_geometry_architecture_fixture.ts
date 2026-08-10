import {
  IAutoMovieMeshAssembly,
  IAutoMovieMeshPart,
  IAutoMovieProfilePoint,
  buildAutoMoviePolyhedron,
  buildAutoMovieWall,
  extrudeAutoMovieProfile,
  inspectAutoMovieMeshTopology,
  mergeAutoMovieMeshParts,
  revolveAutoMovieProfile,
  transformAutoMovieMesh,
} from "@automovie/engine";
import { IAutoMovieMesh, IAutoMovieQuaternion } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

/** The axis-aligned bounds of a mesh, as `[min, max]` per axis. */
const bounds = (mesh: IAutoMovieMesh): Array<[number, number]> =>
  [0, 1, 2].map((axis) => {
    const values = mesh.positions.filter((_, index) => index % 3 === axis);
    return [Math.min(...values), Math.max(...values)] as [number, number];
  });

/** Shoelace area of a simple polygon, the oracle a prism volume rests on. */
const area = (ring: readonly IAutoMovieProfilePoint[]): number =>
  Math.abs(
    ring.reduce((sum, point, index) => {
      const next = ring[(index + 1) % ring.length]!;
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );

/** A rectangle profile, the one shape every rectilinear member starts from. */
const rectangle = (
  x: number,
  y: number,
  width: number,
  height: number,
): IAutoMovieProfilePoint[] => [
  { x, y },
  { x: x + width, y },
  { x: x + width, y: y + height },
  { x, y: y + height },
];

/** A box in the XZ ground plane: a rectangle prism laid down on its face. */
const slab = (width: number, height: number, depth: number): IAutoMovieMesh =>
  transformAutoMovieMesh(
    extrudeAutoMovieProfile({
      profile: rectangle(-width / 2, -depth / 2, width, depth),
      depth: height,
    }),
    { rotation: { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 } },
  );

const yaw = (radians: number): IAutoMovieQuaternion => ({
  x: 0,
  y: Math.sin(radians / 2),
  z: 0,
  w: Math.cos(radians / 2),
});

/** A voussoir ring on optional piers, composed from convex quads only. */
const arch = (props: {
  span: number;
  rise: number;
  thickness: number;
  depth: number;
  springing: number;
  segments: number;
}): { assembly: IAutoMovieMeshAssembly; volume: number } => {
  const inner = props.span / 2;
  const outer = inner + props.thickness;
  const at = (
    step: number,
  ): [IAutoMovieProfilePoint, IAutoMovieProfilePoint] => {
    const angle = (step / props.segments) * Math.PI;
    return [
      {
        x: -inner * Math.cos(angle),
        y: props.springing + props.rise * Math.sin(angle),
      },
      {
        x: -outer * Math.cos(angle),
        y: props.springing + (props.rise + props.thickness) * Math.sin(angle),
      },
    ];
  };
  const parts: IAutoMovieMeshPart[] = [];
  let volume = 0;
  for (let step = 0; step < props.segments; ++step) {
    const [innerFrom, outerFrom] = at(step);
    const [innerTo, outerTo] = at(step + 1);
    const quad = [innerFrom, innerTo, outerTo, outerFrom];
    volume += area(quad) * props.depth;
    parts.push({
      id: `voussoir-${step + 1}`,
      mesh: extrudeAutoMovieProfile({ profile: quad, depth: props.depth }),
    });
  }
  if (props.springing > 0)
    for (const [name, left] of [
      ["left", -outer],
      ["right", inner],
    ] as const) {
      const pier = rectangle(left, 0, props.thickness, props.springing);
      volume += area(pier) * props.depth;
      parts.push({
        id: `pier-${name}`,
        mesh: extrudeAutoMovieProfile({ profile: pier, depth: props.depth }),
      });
    }
  return { assembly: mergeAutoMovieMeshParts(parts), volume };
};

/** A row of faceted shafts, one revolve reused by placement. */
const colonnade = (props: {
  count: number;
  spacing: number;
  radius: number;
  height: number;
  segments: number;
}): IAutoMovieMeshAssembly => {
  const shaft = revolveAutoMovieProfile({
    profile: [
      { x: 0, y: 0 },
      { x: props.radius, y: 0 },
      { x: props.radius, y: props.height },
      { x: 0, y: props.height },
    ],
    segments: props.segments,
  });
  const span = (props.count - 1) * props.spacing;
  return mergeAutoMovieMeshParts(
    Array.from({ length: props.count }, (_, index) => ({
      id: `column-${index + 1}`,
      mesh: shaft,
      transform: {
        translation: { x: index * props.spacing - span / 2, y: 0, z: 0 },
      },
    })),
  );
};

/** A ridged roof: gable at `ridgeInset` zero, hip at any positive inset. */
const roof = (props: {
  width: number;
  depth: number;
  height: number;
  ridgeInset: number;
}): IAutoMovieMesh => {
  const b0 = { x: -props.width / 2, y: 0, z: -props.depth / 2 };
  const b1 = { x: props.width / 2, y: 0, z: -props.depth / 2 };
  const b2 = { x: props.width / 2, y: 0, z: props.depth / 2 };
  const b3 = { x: -props.width / 2, y: 0, z: props.depth / 2 };
  const r0 = {
    x: 0,
    y: props.height,
    z: -props.depth / 2 + props.ridgeInset,
  };
  const r1 = { x: 0, y: props.height, z: props.depth / 2 - props.ridgeInset };
  return buildAutoMoviePolyhedron([
    [b0, b1, b2, b3],
    [b1, r0, r1, b2],
    [b3, r1, r0, b0],
    [b0, r0, b1],
    [b2, r1, b3],
  ]);
};

/** A flight of treads and risers, straight at zero turn and helical beyond. */
const stair = (props: {
  steps: number;
  rise: number;
  run: number;
  width: number;
  turnDeg: number;
  innerRadius: number;
}): IAutoMovieMeshAssembly => {
  const treadThickness = props.rise * 0.2;
  const riserHeight = props.rise - treadThickness;
  const riserDepth = props.run * 0.15;
  const tread = slab(props.width, treadThickness, props.run);
  const riser = slab(props.width, riserHeight, riserDepth);
  const parts: IAutoMovieMeshPart[] = [];
  for (let step = 0; step < props.steps; ++step) {
    const angle = ((props.turnDeg * step) / props.steps) * (Math.PI / 180);
    const radius = props.innerRadius + props.width / 2;
    const centre =
      props.turnDeg === 0
        ? { x: 0, z: (step + 0.5) * props.run }
        : {
            x: Math.sin(angle) * radius,
            z: Math.cos(angle) * radius - radius,
          };
    const top = (step + 1) * props.rise;
    parts.push({
      id: `tread-${step + 1}`,
      mesh: tread,
      transform: {
        translation: { x: centre.x, y: top - treadThickness / 2, z: centre.z },
        rotation: yaw(angle),
      },
    });
    parts.push({
      id: `riser-${step + 1}`,
      mesh: riser,
      transform: {
        translation: {
          x: centre.x,
          y: top - treadThickness - riserHeight / 2,
          z: centre.z - props.run / 2,
        },
        rotation: yaw(angle),
      },
    });
  }
  return mergeAutoMovieMeshParts(parts);
};

/** A beam lattice closed by a panel: every beam generated, never copied. */
const cofferedCeiling = (props: {
  width: number;
  depth: number;
  rows: number;
  columns: number;
  beam: number;
  drop: number;
  panel: number;
}): IAutoMovieMeshAssembly => {
  const across = (index: number, count: number, span: number): number =>
    (index / count) * (span - props.beam) - (span - props.beam) / 2;
  const parts: IAutoMovieMeshPart[] = [
    {
      id: "panel",
      mesh: slab(props.width, props.panel, props.depth),
      transform: { translation: { x: 0, y: props.panel / 2, z: 0 } },
    },
  ];
  for (let column = 0; column <= props.columns; ++column)
    parts.push({
      id: `beam-x-${column + 1}`,
      mesh: slab(props.beam, props.drop, props.depth),
      transform: {
        translation: {
          x: across(column, props.columns, props.width),
          y: -props.drop / 2,
          z: 0,
        },
      },
    });
  for (let row = 0; row <= props.rows; ++row)
    parts.push({
      id: `beam-z-${row + 1}`,
      mesh: slab(props.width, props.drop, props.beam),
      transform: {
        translation: {
          x: 0,
          y: -props.drop / 2,
          z: across(row, props.rows, props.depth),
        },
      },
    });
  return mergeAutoMovieMeshParts(parts);
};

/** A jointed tile field, one group per tile. */
const tiledFloor = (props: {
  rows: number;
  columns: number;
  tile: number;
  joint: number;
  thickness: number;
}): IAutoMovieMeshAssembly => {
  const pitch = props.tile + props.joint;
  const width = props.columns * pitch - props.joint;
  const depth = props.rows * pitch - props.joint;
  const unit = slab(props.tile, props.thickness, props.tile);
  const parts: IAutoMovieMeshPart[] = [];
  for (let row = 0; row < props.rows; ++row)
    for (let column = 0; column < props.columns; ++column)
      parts.push({
        id: `tile-${row + 1}-${column + 1}`,
        mesh: unit,
        transform: {
          translation: {
            x: column * pitch + props.tile / 2 - width / 2,
            y: 0,
            z: row * pitch + props.tile / 2 - depth / 2,
          },
        },
      });
  return mergeAutoMovieMeshParts(parts);
};

/**
 * A code-only fixture builds a building's members from the kernel alone.
 *
 * This is the acceptance the kernel exists for: an opening wall, an arch, a
 * column row, gable and hip roofs, straight and helical stairs, a barrel vault,
 * a coffered ceiling, and a tiled floor, every one of them generated from loops
 * and utilities and never from an authored vertex array. The members live here
 * and not in the engine on purpose: the engine ships operations a customer
 * composes, not a catalogue of components they were going to author anyway.
 *
 * Every expectation is hand math on the authored dimensions — shoelace area
 * times depth, the analytic n-gon prism, the prismatoid volume of a ridged
 * solid — so a builder that drifts is caught by arithmetic rather than by a
 * re-recorded snapshot.
 *
 * Scenarios:
 *
 * 1. An arch on piers merges `segments + 2` groups whose volume equals the sum of
 *    its voussoir and pier prisms, and reaches exactly its authored extrados.
 * 2. The same builder at zero springing is a barrel vault: the ring alone, no
 *    piers, extruded to its length.
 * 3. A column row places one revolve `count` times; the assembly volume is `count`
 *    analytic n-gon prisms and the row spans `(count − 1) · spacing`.
 * 4. A gable roof is watertight with volume `w·h·d/2`, and a hip roof with the
 *    same eaves integrates its shrinking rectangle section to `w·h·(d/2 −
 *    inset/3)`.
 * 5. A straight flight rises `steps · rise` over `steps · run`; a helical flight
 *    of the same steps holds the same total volume while turning.
 * 6. A coffered ceiling generates `1 + (rows + 1) + (columns + 1)` members and a
 *    tiled floor `rows · columns`, each spanning its authored field.
 * 7. An opening wall composes with the members and keeps its own volume.
 */
export const test_geometry_architecture_fixture = (): void => {
  const ringed = arch({
    span: 3,
    rise: 1.5,
    thickness: 0.4,
    depth: 0.6,
    springing: 2,
    segments: 6,
  });
  const archBounds = bounds(ringed.assembly.mesh);
  TestValidator.equals(
    "an arch on piers merges its voussoirs and piers at the authored extrados",
    namedFacts([
      ["groups", () => ringed.assembly.groups.length === 6 + 2],
      [
        "ids",
        () =>
          ringed.assembly.groups.at(-1)!.id === "pier-right" &&
          ringed.assembly.groups[0]!.id === "voussoir-1",
      ],
      [
        "volume",
        () =>
          nclose(
            inspectAutoMovieMeshTopology(ringed.assembly.mesh).volume,
            ringed.volume,
            1e-12,
          ),
      ],
      ["span", () => nclose(archBounds[0]![1], 3 / 2 + 0.4, 1e-12)],
      ["crown", () => nclose(archBounds[1]![1], 2 + 1.5 + 0.4, 1e-12)],
      ["springing", () => nclose(archBounds[1]![0], 0, 1e-12)],
      [
        "depth",
        () => nclose(archBounds[2]![1] - archBounds[2]![0], 0.6, 1e-12),
      ],
    ]),
    {
      groups: true,
      ids: true,
      volume: true,
      span: true,
      crown: true,
      springing: true,
      depth: true,
    },
  );

  const vault = arch({
    span: 4,
    rise: 2,
    thickness: 0.3,
    depth: 8,
    springing: 0,
    segments: 8,
  });
  TestValidator.equals(
    "the same builder at zero springing is a barrel vault of pure ring",
    namedFacts([
      ["groups", () => vault.assembly.groups.length === 8],
      [
        "volume",
        () =>
          nclose(
            inspectAutoMovieMeshTopology(vault.assembly.mesh).volume,
            vault.volume,
            1e-12,
          ),
      ],
      [
        "length",
        () => {
          const box = bounds(vault.assembly.mesh);
          return nclose(box[2]![1] - box[2]![0], 8, 1e-12);
        },
      ],
    ]),
    { groups: true, volume: true, length: true },
  );

  const row = colonnade({
    count: 4,
    spacing: 2.5,
    radius: 0.3,
    height: 4,
    segments: 12,
  });
  const ngon = (12 / 2) * 0.3 * 0.3 * Math.sin((2 * Math.PI) / 12);
  const rowBounds = bounds(row.mesh);
  TestValidator.equals(
    "a column row is one revolve placed four times, of four n-gon prisms",
    namedFacts([
      ["groups", () => row.groups.length === 4],
      [
        "volume",
        () =>
          nclose(
            inspectAutoMovieMeshTopology(row.mesh).volume,
            4 * ngon * 4,
            1e-9,
          ),
      ],
      [
        "span",
        () =>
          nclose(rowBounds[0]![1] - rowBounds[0]![0], 3 * 2.5 + 2 * 0.3, 1e-9),
      ],
      ["height", () => nclose(rowBounds[1]![1], 4, 1e-12)],
    ]),
    { groups: true, volume: true, span: true, height: true },
  );

  const gable = roof({ width: 6, depth: 10, height: 2.5, ridgeInset: 0 });
  const hip = roof({ width: 6, depth: 10, height: 2.5, ridgeInset: 2 });
  TestValidator.equals(
    "a gable and a hip roof share their eaves and differ by the prismatoid rule",
    namedFacts([
      ["gableClosed", () => inspectAutoMovieMeshTopology(gable).watertight],
      ["hipClosed", () => inspectAutoMovieMeshTopology(hip).watertight],
      [
        "gableVolume",
        () =>
          nclose(
            inspectAutoMovieMeshTopology(gable).volume,
            (6 * 2.5 * 10) / 2,
            1e-12,
          ),
      ],
      [
        "hipVolume",
        () =>
          nclose(
            inspectAutoMovieMeshTopology(hip).volume,
            6 * 2.5 * (10 / 2 - 2 / 3),
            1e-12,
          ),
      ],
      [
        "eaves",
        () =>
          JSON.stringify(bounds(gable)[0]) === JSON.stringify(bounds(hip)[0]),
      ],
    ]),
    {
      gableClosed: true,
      hipClosed: true,
      gableVolume: true,
      hipVolume: true,
      eaves: true,
    },
  );

  const straight = stair({
    steps: 5,
    rise: 0.18,
    run: 0.28,
    width: 1.1,
    turnDeg: 0,
    innerRadius: 0,
  });
  const helical = stair({
    steps: 5,
    rise: 0.18,
    run: 0.28,
    width: 1.1,
    turnDeg: 90,
    innerRadius: 0.2,
  });
  const stepVolume =
    1.1 * 0.28 * (0.18 * 0.2) + 1.1 * (0.18 * 0.8) * (0.28 * 0.15);
  const straightBounds = bounds(straight.mesh);
  TestValidator.equals(
    "a straight flight rises over its going and a helical flight keeps its stock",
    namedFacts([
      ["groups", () => straight.groups.length === 2 * 5],
      ["helicalGroups", () => helical.groups.length === 2 * 5],
      ["top", () => nclose(straightBounds[1]![1], 5 * 0.18, 1e-12)],
      ["going", () => nclose(straightBounds[2]![1], 5 * 0.28, 1e-12)],
      [
        "width",
        () => nclose(straightBounds[0]![1] - straightBounds[0]![0], 1.1, 1e-12),
      ],
      [
        "volume",
        () =>
          nclose(
            inspectAutoMovieMeshTopology(straight.mesh).volume,
            5 * stepVolume,
            1e-12,
          ),
      ],
      [
        "helicalVolume",
        () =>
          nclose(
            inspectAutoMovieMeshTopology(helical.mesh).volume,
            5 * stepVolume,
            1e-12,
          ),
      ],
      ["turns", () => bounds(helical.mesh)[0]![1] > straightBounds[0]![1]],
    ]),
    {
      groups: true,
      helicalGroups: true,
      top: true,
      going: true,
      width: true,
      volume: true,
      helicalVolume: true,
      turns: true,
    },
  );

  const ceiling = cofferedCeiling({
    width: 6,
    depth: 4,
    rows: 3,
    columns: 4,
    beam: 0.2,
    drop: 0.3,
    panel: 0.1,
  });
  const floor = tiledFloor({
    rows: 3,
    columns: 5,
    tile: 0.6,
    joint: 0.02,
    thickness: 0.02,
  });
  const floorBounds = bounds(floor.mesh);
  TestValidator.equals(
    "a coffered ceiling and a tiled floor generate every member from their counts",
    namedFacts([
      ["ceilingGroups", () => ceiling.groups.length === 1 + 4 + 5],
      ["floorGroups", () => floor.groups.length === 3 * 5],
      [
        "floorWidth",
        () =>
          nclose(
            floorBounds[0]![1] - floorBounds[0]![0],
            5 * 0.62 - 0.02,
            1e-12,
          ),
      ],
      [
        "floorDepth",
        () =>
          nclose(
            floorBounds[2]![1] - floorBounds[2]![0],
            3 * 0.62 - 0.02,
            1e-12,
          ),
      ],
      [
        "floorVolume",
        () =>
          nclose(
            inspectAutoMovieMeshTopology(floor.mesh).volume,
            3 * 5 * 0.6 * 0.6 * 0.02,
            1e-12,
          ),
      ],
      ["ceilingDrop", () => nclose(bounds(ceiling.mesh)[1]![0], -0.3, 1e-12)],
    ]),
    {
      ceilingGroups: true,
      floorGroups: true,
      floorWidth: true,
      floorDepth: true,
      floorVolume: true,
      ceilingDrop: true,
    },
  );

  const walled = mergeAutoMovieMeshParts([
    {
      id: "wall",
      mesh: buildAutoMovieWall({
        width: 6,
        height: 3,
        depth: 0.25,
        openings: [
          { id: "door", x: 0.5, y: 0, width: 1, height: 2.1 },
          { id: "window", x: 3, y: 1, width: 1.2, height: 1 },
        ],
      }),
    },
    {
      id: "roof",
      mesh: gable,
      transform: { translation: { x: 0, y: 1.5, z: 0 } },
    },
  ]);
  TestValidator.equals(
    "an opening wall composes with a roof and keeps its own volume",
    namedFacts([
      ["groups", () => walled.groups.length === 2],
      [
        "volume",
        () =>
          nclose(
            inspectAutoMovieMeshTopology(walled.mesh).volume,
            (6 * 3 - 1 * 2.1 - 1.2 * 1) * 0.25 + (6 * 2.5 * 10) / 2,
            1e-12,
          ),
      ],
      [
        "attributes",
        () => walled.mesh.normals !== null && walled.mesh.uvs === null,
      ],
    ]),
    { groups: true, volume: true, attributes: true },
  );
};
