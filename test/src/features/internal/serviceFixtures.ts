import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieServiceNetwork,
  IAutoMovieServiceNode,
  IAutoMovieServicePenetration,
  IAutoMovieServicePort,
  IAutoMovieServiceSegment,
  IAutoMovieServiceSystem,
  IAutoMovieVector3,
  IAutoMovieWetZone,
} from "@automovie/interface";

/**
 * A crude three-room bathhouse and the services that run through it.
 *
 * The building is deliberately three axis-aligned boxes and nothing else: it
 * exists so the service graph has real logical spaces to be contained by, real
 * boundaries to be drilled through and a real wet room to be tanked, not
 * because anybody would film it. Every dimension is a short decimal so a
 * hand-computed length, bound or clash is reproducible.
 *
 * Layout in metres, all three rooms `y` in `[0, 3]` and `z` in `[0, 5]`:
 *
 * - `bath` occupies `x` in `[0, 4]`
 * - `hall` occupies `x` in `[4, 7]`
 * - `plant` occupies `x` in `[7, 10]`
 *
 * The root space `works` declares no cells, so it is a purely semantic
 * container and only the three rooms locate anything.
 */
export const serviceEnvironment = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "bathhouse",
  units: "meter",
  buildings: [{ id: "unit", element: "root", space: "works" }],
  models: [],
  modelReferences: [],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      model: null,
      space: "works",
    },
  ],
  spaces: [
    { id: "works", kind: "building", parent: null, cells: [] },
    {
      id: "bath",
      kind: "room",
      parent: "works",
      cells: [boxCell("bath-cell", { x: 0, y: 0, z: 0 }, { x: 4, y: 3, z: 5 })],
    },
    {
      id: "hall",
      kind: "room",
      parent: "works",
      cells: [boxCell("hall-cell", { x: 4, y: 0, z: 0 }, { x: 7, y: 3, z: 5 })],
    },
    {
      id: "plant",
      kind: "room",
      parent: "works",
      cells: [
        boxCell("plant-cell", { x: 7, y: 0, z: 0 }, { x: 10, y: 3, z: 5 }),
      ],
    },
  ],
  boundaries: [
    {
      id: "bath-hall",
      kind: "wall",
      spaces: ["bath", "hall"],
      elements: [],
      face: partitionFace(4),
    },
    {
      id: "hall-plant",
      kind: "wall",
      spaces: ["hall", "plant"],
      elements: [],
      face: partitionFace(7),
    },
    { id: "bath-shell", kind: "wall", spaces: ["bath"], elements: [] },
    { id: "plant-shell", kind: "wall", spaces: ["plant"], elements: [] },
  ],
  openings: [
    {
      id: "service-chase",
      kind: "passage",
      boundary: "bath-hall",
      fill: null,
      profile: {
        outline: [
          { x: -1.5, y: 0 },
          { x: -0.5, y: 0 },
          { x: -0.5, y: 0.6 },
          { x: -1.5, y: 0.6 },
        ],
      },
    },
    { id: "plant-hatch", kind: "hatch", boundary: "hall-plant", fill: null },
  ],
  connectors: [],
  surfaces: [],
  walkable: [],
});

/**
 * The multi-discipline network serving {@link serviceEnvironment}.
 *
 * Seven systems share one graph: cold and hot water, waste and its vent,
 * lighting power, supply air and a sprinkler main. Each is three or four nodes
 * long on purpose — the point is that a sprinkler head and a floor gully are
 * the same record with different ports, not that the installation is complete.
 *
 * Runs are routed orthogonally in separated lanes so the fixture validates
 * clean, and every wall crossing cites its own sleeve at its own height.
 */
export const serviceNetwork = (
  overrides: Partial<IAutoMovieServiceNetwork> = {},
): IAutoMovieServiceNetwork => ({
  version: 1,
  id: "bathhouse-services",
  units: "meter",
  environment: "bathhouse",
  systems: [
    system({
      id: "cold",
      discipline: "plumbing",
      medium: "cold-water",
      unit: "cubic-meter-per-second",
      flow: "from-root",
      root: "cold-main",
      capacity: 0.01,
    }),
    system({
      id: "hot",
      discipline: "plumbing",
      medium: "hot-water",
      unit: "cubic-meter-per-second",
      flow: "from-root",
      root: "hot-main",
      capacity: 0.01,
    }),
    system({
      id: "waste",
      discipline: "drainage",
      medium: "waste-water",
      unit: "cubic-meter-per-second",
      flow: "to-root",
      root: "stack",
      capacity: 0.02,
    }),
    system({
      id: "vent",
      discipline: "drainage",
      medium: "vent-air",
      unit: "cubic-meter-per-second",
      flow: "to-root",
      root: "vent-head",
      capacity: 0.01,
    }),
    system({
      id: "lighting",
      discipline: "electrical",
      medium: "electric-power",
      unit: "watt",
      flow: "from-root",
      root: "panel",
      capacity: 2000,
    }),
    system({
      id: "air",
      discipline: "hvac",
      medium: "supply-air",
      unit: "cubic-meter-per-second",
      flow: "from-root",
      root: "ahu",
      capacity: 1,
    }),
    system({
      id: "fire",
      discipline: "fire",
      medium: "fire-water",
      unit: "cubic-meter-per-second",
      flow: "from-root",
      root: "fire-main",
      capacity: 0.05,
    }),
  ],
  nodes: [
    node({
      id: "cold-main",
      kind: "source",
      space: "plant",
      element: "root",
      position: { x: 8, y: 2.5, z: 1 },
      ports: [
        port({
          id: "cold-main-out",
          system: "cold",
          medium: "cold-water",
          direction: "out",
          section: 0.002,
          position: { x: 8, y: 2.5, z: 1 },
        }),
      ],
    }),
    node({
      id: "hot-main",
      kind: "source",
      space: "plant",
      position: { x: 8, y: 2.5, z: 1.4 },
      ports: [
        port({
          id: "hot-main-out",
          system: "hot",
          medium: "hot-water",
          direction: "out",
          section: 0.002,
          position: { x: 8, y: 2.5, z: 1.4 },
        }),
      ],
    }),
    node({
      id: "stack",
      kind: "source",
      space: "plant",
      position: { x: 9, y: 0.1, z: 1 },
      ports: [
        port({
          id: "stack-in",
          system: "waste",
          medium: "waste-water",
          direction: "in",
          section: 0.004,
          position: { x: 9, y: 0.1, z: 1 },
        }),
      ],
    }),
    node({
      id: "vent-head",
      kind: "source",
      space: "plant",
      position: { x: 9, y: 2.8, z: 2 },
      ports: [
        port({
          id: "vent-head-in",
          system: "vent",
          medium: "vent-air",
          direction: "in",
          position: { x: 9, y: 2.8, z: 2 },
        }),
      ],
    }),
    node({
      id: "panel",
      kind: "source",
      space: "plant",
      position: { x: 8.5, y: 2.95, z: 3 },
      maintenance: {
        min: { x: -0.4, y: -2.6, z: -0.8 },
        max: { x: 0.4, y: 0.05, z: 0 },
      },
      ports: [
        port({
          id: "panel-out",
          system: "lighting",
          medium: "electric-power",
          unit: "watt",
          direction: "out",
          position: { x: 8.5, y: 2.95, z: 3 },
        }),
      ],
    }),
    node({
      id: "ahu",
      kind: "equipment",
      space: "plant",
      position: { x: 8, y: 2.7, z: 4.5 },
      maintenance: {
        min: { x: -0.5, y: -2.5, z: -0.5 },
        max: { x: 0.5, y: 0.3, z: 0.5 },
      },
      ports: [
        port({
          id: "ahu-out",
          system: "air",
          medium: "supply-air",
          direction: "out",
          section: 0.05,
          position: { x: 8, y: 2.7, z: 4.5 },
        }),
      ],
    }),
    node({
      id: "fire-main",
      kind: "source",
      space: "plant",
      position: { x: 9.5, y: 2.6, z: 2 },
      ports: [
        port({
          id: "fire-main-out",
          system: "fire",
          medium: "fire-water",
          direction: "out",
          section: 0.003,
          position: { x: 9.5, y: 2.6, z: 2 },
        }),
      ],
    }),
    node({
      id: "hall-diffuser",
      kind: "terminal",
      space: "hall",
      position: { x: 5.5, y: 2.7, z: 4.5 },
      ports: [
        port({
          id: "hall-diffuser-in",
          system: "air",
          medium: "supply-air",
          direction: "in",
          demand: 0.05,
          section: 0.05,
          position: { x: 5.5, y: 2.7, z: 4.5 },
        }),
      ],
    }),
    node({
      id: "bath-valve",
      kind: "valve",
      space: "bath",
      position: { x: 3.5, y: 2.5, z: 1 },
      state: { name: "open", opening: 1 },
      ports: [
        port({
          id: "bath-valve-in",
          system: "cold",
          medium: "cold-water",
          direction: "in",
          section: 0.002,
          position: { x: 3.5, y: 2.5, z: 1 },
        }),
        port({
          id: "bath-valve-out",
          system: "cold",
          medium: "cold-water",
          direction: "out",
          section: 0.002,
          position: { x: 3.5, y: 2.5, z: 1 },
        }),
      ],
    }),
    node({
      id: "basin",
      kind: "fixture",
      space: "bath",
      position: { x: 1, y: 0.9, z: 1 },
      ports: [
        port({
          id: "basin-cold",
          system: "cold",
          medium: "cold-water",
          direction: "in",
          demand: 0.0002,
          section: 0.002,
          position: { x: 1, y: 0.9, z: 1 },
        }),
        port({
          id: "basin-hot",
          system: "hot",
          medium: "hot-water",
          direction: "in",
          demand: 0.0002,
          section: 0.002,
          position: { x: 1, y: 0.9, z: 1.4 },
        }),
        port({
          id: "basin-waste",
          system: "waste",
          medium: "waste-water",
          direction: "out",
          demand: 0.0004,
          section: 0.004,
          position: { x: 1, y: 0.6, z: 1 },
        }),
        port({
          id: "basin-vent",
          system: "vent",
          medium: "vent-air",
          direction: "out",
          position: { x: 1, y: 1.2, z: 1 },
        }),
      ],
    }),
    node({
      id: "waste-tee",
      kind: "junction",
      space: "bath",
      position: { x: 2, y: 0.1, z: 1 },
      ports: [
        port({
          id: "tee-basin",
          system: "waste",
          medium: "waste-water",
          direction: "in",
          section: 0.004,
          position: { x: 2, y: 0.1, z: 1 },
        }),
        port({
          id: "tee-gully",
          system: "waste",
          medium: "waste-water",
          direction: "in",
          section: 0.004,
          position: { x: 2, y: 0.1, z: 1 },
        }),
        port({
          id: "tee-out",
          system: "waste",
          medium: "waste-water",
          direction: "out",
          section: 0.004,
          position: { x: 2, y: 0.1, z: 1 },
        }),
      ],
    }),
    node({
      id: "floor-gully",
      kind: "fixture",
      space: "bath",
      position: { x: 2.5, y: 0.1, z: 3 },
      ports: [
        port({
          id: "gully-waste",
          system: "waste",
          medium: "waste-water",
          direction: "out",
          demand: 0.0006,
          section: 0.004,
          position: { x: 2.5, y: 0.1, z: 3 },
        }),
      ],
    }),
    node({
      id: "sprinkler-head",
      kind: "terminal",
      space: "bath",
      position: { x: 2, y: 2.6, z: 2 },
      ports: [
        port({
          id: "sprinkler-in",
          system: "fire",
          medium: "fire-water",
          direction: "in",
          demand: 0.001,
          section: 0.003,
          position: { x: 2, y: 2.6, z: 2 },
        }),
      ],
    }),
    node({
      id: "bath-light",
      kind: "terminal",
      space: "bath",
      position: { x: 2, y: 2.95, z: 3 },
      ports: [
        port({
          id: "bath-light-in",
          system: "lighting",
          medium: "electric-power",
          unit: "watt",
          direction: "in",
          demand: 60,
          position: { x: 2, y: 2.95, z: 3 },
        }),
      ],
    }),
  ],
  segments: [
    segment({
      id: "cold-run",
      system: "cold",
      from: "cold-main-out",
      to: "bath-valve-in",
      route: [
        { x: 8, y: 2.5, z: 1 },
        { x: 3.5, y: 2.5, z: 1 },
      ],
      radius: 0.025,
      section: 0.002,
      penetrations: ["cold-plant-hall", "cold-bath-hall"],
    }),
    segment({
      id: "cold-branch",
      system: "cold",
      from: "bath-valve-out",
      to: "basin-cold",
      route: [
        { x: 3.5, y: 2.5, z: 1 },
        { x: 1, y: 2.5, z: 1 },
        { x: 1, y: 0.9, z: 1 },
      ],
      radius: 0.02,
      section: 0.002,
    }),
    segment({
      id: "hot-run",
      system: "hot",
      from: "hot-main-out",
      to: "basin-hot",
      route: [
        { x: 8, y: 2.5, z: 1.4 },
        { x: 1, y: 2.5, z: 1.4 },
        { x: 1, y: 0.9, z: 1.4 },
      ],
      radius: 0.02,
      section: 0.002,
      penetrations: ["hot-plant-hall", "hot-bath-hall"],
    }),
    segment({
      id: "waste-basin",
      system: "waste",
      from: "basin-waste",
      to: "tee-basin",
      route: [
        { x: 1, y: 0.6, z: 1 },
        { x: 1, y: 0.1, z: 1 },
        { x: 2, y: 0.1, z: 1 },
      ],
      radius: 0.05,
      section: 0.004,
    }),
    segment({
      id: "waste-gully",
      system: "waste",
      from: "gully-waste",
      to: "tee-gully",
      route: [
        { x: 2.5, y: 0.1, z: 3 },
        { x: 2, y: 0.1, z: 3 },
        { x: 2, y: 0.1, z: 1 },
      ],
      radius: 0.05,
      section: 0.004,
    }),
    segment({
      id: "waste-main",
      system: "waste",
      from: "tee-out",
      to: "stack-in",
      route: [
        { x: 2, y: 0.1, z: 1 },
        { x: 9, y: 0.1, z: 1 },
      ],
      radius: 0.05,
      section: 0.004,
      penetrations: ["waste-bath-hall", "waste-hall-plant"],
    }),
    segment({
      id: "vent-run",
      system: "vent",
      from: "basin-vent",
      to: "vent-head-in",
      route: [
        { x: 1, y: 1.2, z: 1 },
        { x: 1, y: 2.8, z: 1 },
        { x: 1, y: 2.8, z: 2 },
        { x: 9, y: 2.8, z: 2 },
      ],
      radius: 0.03,
      section: 0.001,
      penetrations: ["vent-bath-hall", "vent-plant-hall"],
    }),
    segment({
      id: "sprinkler-run",
      system: "fire",
      from: "fire-main-out",
      to: "sprinkler-in",
      route: [
        { x: 9.5, y: 2.6, z: 2 },
        { x: 2, y: 2.6, z: 2 },
      ],
      radius: 0.025,
      section: 0.003,
      penetrations: ["fire-plant-hall", "fire-bath-hall"],
    }),
    segment({
      id: "lighting-run",
      system: "lighting",
      from: "panel-out",
      to: "bath-light-in",
      route: [
        { x: 8.5, y: 2.95, z: 3 },
        { x: 2, y: 2.95, z: 3 },
      ],
      radius: 0.015,
      section: 0.0005,
      penetrations: ["power-plant-hall", "power-bath-hall"],
    }),
    segment({
      id: "air-run",
      system: "air",
      from: "ahu-out",
      to: "hall-diffuser-in",
      route: [
        { x: 8, y: 2.7, z: 4.5 },
        { x: 5.5, y: 2.7, z: 4.5 },
      ],
      radius: 0.15,
      section: 0.05,
      penetrations: ["air-hall-plant"],
    }),
  ],
  penetrations: [
    sleeve({
      id: "cold-plant-hall",
      boundary: "hall-plant",
      position: { x: 7, y: 2.5, z: 1 },
      radius: 0.05,
    }),
    sleeve({
      id: "cold-bath-hall",
      boundary: "bath-hall",
      position: { x: 4, y: 2.5, z: 1 },
      radius: 0.05,
    }),
    sleeve({
      id: "hot-plant-hall",
      boundary: "hall-plant",
      position: { x: 7, y: 2.5, z: 1.4 },
      radius: 0.05,
    }),
    sleeve({
      id: "hot-bath-hall",
      boundary: "bath-hall",
      position: { x: 4, y: 2.5, z: 1.4 },
      radius: 0.05,
    }),
    sleeve({
      id: "waste-hall-plant",
      boundary: "hall-plant",
      position: { x: 7, y: 0.1, z: 1 },
      radius: 0.08,
    }),
    sleeve({
      id: "waste-bath-hall",
      boundary: "bath-hall",
      opening: "service-chase",
      position: { x: 4, y: 0.1, z: 1 },
      radius: 0.08,
    }),
    sleeve({
      id: "vent-plant-hall",
      boundary: "hall-plant",
      position: { x: 7, y: 2.8, z: 2 },
      radius: 0.06,
    }),
    sleeve({
      id: "vent-bath-hall",
      boundary: "bath-hall",
      position: { x: 4, y: 2.8, z: 2 },
      radius: 0.06,
    }),
    sleeve({
      id: "fire-plant-hall",
      boundary: "hall-plant",
      position: { x: 7, y: 2.6, z: 2 },
      radius: 0.05,
    }),
    sleeve({
      id: "fire-bath-hall",
      boundary: "bath-hall",
      position: { x: 4, y: 2.6, z: 2 },
      radius: 0.05,
    }),
    sleeve({
      id: "power-plant-hall",
      boundary: "hall-plant",
      position: { x: 7, y: 2.95, z: 3 },
      radius: 0.04,
    }),
    sleeve({
      id: "power-bath-hall",
      boundary: "bath-hall",
      position: { x: 4, y: 2.95, z: 3 },
      radius: 0.04,
    }),
    sleeve({
      id: "air-hall-plant",
      boundary: "hall-plant",
      position: { x: 7, y: 2.7, z: 4.5 },
      radius: 0.2,
      sealed: false,
    }),
  ],
  zones: [
    wetZone({
      id: "bath-zone",
      space: "bath",
      grade: "wet",
      membrane: ["bath-hall", "bath-shell"],
      upturn: 1.8,
      slope: 0.02,
      drains: ["floor-gully"],
      thresholds: ["bath-hall"],
    }),
    wetZone({
      id: "plant-zone",
      space: "plant",
      grade: "damp",
      membrane: ["plant-shell"],
      upturn: 0.1,
      slope: 0.01,
      thresholds: ["hall-plant"],
    }),
  ],
  ...overrides,
});

/** One distribution system, defaulted to a cold water supply. */
export const system = (
  overrides: Partial<IAutoMovieServiceSystem> = {},
): IAutoMovieServiceSystem => ({
  id: "cold",
  discipline: "plumbing",
  medium: "cold-water",
  unit: "cubic-meter-per-second",
  flow: "from-root",
  root: "cold-main",
  capacity: 0.01,
  ...overrides,
});

/** One network node, defaulted to a bare junction with no state or envelope. */
export const node = (
  overrides: Partial<IAutoMovieServiceNode> = {},
): IAutoMovieServiceNode => ({
  id: "junction",
  kind: "junction",
  space: "bath",
  element: null,
  position: { x: 0, y: 0, z: 0 },
  ports: [],
  state: null,
  maintenance: null,
  ...overrides,
});

/** One typed port, defaulted to a demand-free cold water inlet. */
export const port = (
  overrides: Partial<IAutoMovieServicePort> = {},
): IAutoMovieServicePort => ({
  id: "port",
  system: "cold",
  medium: "cold-water",
  direction: "in",
  unit: "cubic-meter-per-second",
  demand: 0,
  section: null,
  position: { x: 0, y: 0, z: 0 },
  ...overrides,
});

/** One run, defaulted to a two-point cold water pipe citing no sleeve. */
export const segment = (
  overrides: Partial<IAutoMovieServiceSegment> = {},
): IAutoMovieServiceSegment => ({
  id: "run",
  system: "cold",
  from: "cold-main-out",
  to: "basin-cold",
  route: [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
  ],
  radius: 0.02,
  section: 0.002,
  penetrations: [],
  ...overrides,
});

/** One sleeve, defaulted to a sealed bare cored hole. */
export const sleeve = (
  overrides: Partial<IAutoMovieServicePenetration> = {},
): IAutoMovieServicePenetration => ({
  id: "sleeve",
  boundary: "bath-hall",
  opening: null,
  position: { x: 4, y: 1, z: 1 },
  radius: 0.1,
  sealed: true,
  ...overrides,
});

/** One wet zone, defaulted to a dry region with nothing declared. */
export const wetZone = (
  overrides: Partial<IAutoMovieWetZone> = {},
): IAutoMovieWetZone => ({
  id: "zone",
  space: "bath",
  grade: "dry",
  membrane: [],
  upturn: 0,
  slope: 0,
  drains: [],
  thresholds: [],
  ...overrides,
});

/** Replace one node of a network by id, keeping declaration order. */
export const withNode = (
  network: IAutoMovieServiceNetwork,
  id: string,
  edit: (node: IAutoMovieServiceNode) => IAutoMovieServiceNode,
): IAutoMovieServiceNetwork => ({
  ...network,
  nodes: network.nodes.map((candidate) =>
    candidate.id === id ? edit(candidate) : candidate,
  ),
});

/** Replace one port of a network by id, keeping declaration order. */
export const withPort = (
  network: IAutoMovieServiceNetwork,
  id: string,
  edit: (port: IAutoMovieServicePort) => IAutoMovieServicePort,
): IAutoMovieServiceNetwork => ({
  ...network,
  nodes: network.nodes.map((node) => ({
    ...node,
    ports: node.ports.map((candidate) =>
      candidate.id === id ? edit(candidate) : candidate,
    ),
  })),
});

/** Replace one segment of a network by id, keeping declaration order. */
export const withSegment = (
  network: IAutoMovieServiceNetwork,
  id: string,
  edit: (segment: IAutoMovieServiceSegment) => IAutoMovieServiceSegment,
): IAutoMovieServiceNetwork => ({
  ...network,
  segments: network.segments.map((candidate) =>
    candidate.id === id ? edit(candidate) : candidate,
  ),
});

/** Replace one penetration of a network by id, keeping declaration order. */
export const withSleeve = (
  network: IAutoMovieServiceNetwork,
  id: string,
  edit: (sleeve: IAutoMovieServicePenetration) => IAutoMovieServicePenetration,
): IAutoMovieServiceNetwork => ({
  ...network,
  penetrations: network.penetrations.map((candidate) =>
    candidate.id === id ? edit(candidate) : candidate,
  ),
});

/** Replace one wet zone of a network by id, keeping declaration order. */
export const withZone = (
  network: IAutoMovieServiceNetwork,
  id: string,
  edit: (zone: IAutoMovieWetZone) => IAutoMovieWetZone,
): IAutoMovieServiceNetwork => ({
  ...network,
  zones: network.zones.map((candidate) =>
    candidate.id === id ? edit(candidate) : candidate,
  ),
});

/** Replace one system of a network by id, keeping declaration order. */
export const withSystem = (
  network: IAutoMovieServiceNetwork,
  id: string,
  edit: (system: IAutoMovieServiceSystem) => IAutoMovieServiceSystem,
): IAutoMovieServiceNetwork => ({
  ...network,
  systems: network.systems.map((candidate) =>
    candidate.id === id ? edit(candidate) : candidate,
  ),
});

/**
 * The face of a cross partition standing at one world `x`.
 *
 * The frame is a quarter turn about world `+Y`, so the boundary's own local
 * `+X` runs along world `-Z`, its local `+Y` is world up, and its local `+Z` is
 * the outward normal along world `+X`. A world point on the partition therefore
 * reads as `(-z, y, 0)` in the boundary's own metres, which is the arithmetic
 * every sleeve placed on it is checked with.
 */
const partitionFace = (x: number) => ({
  origin: { x, y: 0, z: 0 },
  rotation: {
    x: 0,
    y: Math.SQRT1_2,
    z: 0,
    w: Math.SQRT1_2,
  },
  outline: [
    { x: -5, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 3 },
    { x: -5, y: 3 },
  ],
  thickness: 0.2,
});

/** An axis-aligned convex cell, the shape a logical volume is built from. */
const boxCell = (
  id: string,
  min: IAutoMovieVector3,
  max: IAutoMovieVector3,
): IAutoMovieBuiltEnvironment["spaces"][number]["cells"][number] => ({
  id,
  planes: [
    { normal: { x: 1, y: 0, z: 0 }, offset: max.x },
    { normal: { x: -1, y: 0, z: 0 }, offset: -min.x },
    { normal: { x: 0, y: 1, z: 0 }, offset: max.y },
    { normal: { x: 0, y: -1, z: 0 }, offset: -min.y },
    { normal: { x: 0, y: 0, z: 1 }, offset: max.z },
    { normal: { x: 0, y: 0, z: -1 }, offset: -min.z },
  ],
});
