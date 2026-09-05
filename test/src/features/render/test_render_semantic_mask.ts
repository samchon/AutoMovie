import {
  AUTOMOVIE_SEMANTIC_MASK_MAX_ENTRIES,
  IAutoMovieRenderSubject,
  autoMovieSemanticMaskNodeIndex,
  deriveAutoMovieSemanticMask,
  resolveAutoMovieSemanticMask,
} from "@automovie/engine";
import { IAutoMovieScene, IAutoMovieSemanticMask } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";
import {
  buildingFixture,
  instanceSetFixture,
  modelsFixture,
  sceneFixture,
} from "../internal/renderFixtures";

/**
 * Semantic mask colours are a function of stable identity, never of scene
 * order.
 *
 * This is the whole reason the mask exists as evidence. The pass it replaces
 * coloured the Nth top-level child with the Nth ramp colour, so an entire
 * building read as one colour and inserting an unrelated prop repainted
 * everything after it. Both defects are pinned here as properties, not as
 * stored colour values: a snapshot of the palette would lock in whatever the
 * hash currently emits, while the contract is that the SAME id gets the SAME
 * colour whatever else the scene does.
 *
 * Scenarios:
 *
 * 1. Every addressable layer of a building gets its own entry, and the ownership
 *    chain runs leaf to building unit.
 * 2. A rendered colour resolves back to a door leaf, its door opening, the wall
 *    boundary, the room, the storey and the building unit.
 * 3. Colours are unique and never the reserved background.
 * 4. Reversing `scene.nodes` reproduces a byte-identical mask.
 * 5. Adding an unrelated prop leaves every pre-existing colour untouched, and the
 *    new node gets one of its own.
 * 6. Repeated instanced window slots are individually addressable.
 * 7. An instanced set too large for the bound keeps its set-level colour and is
 *    reported as unaddressed rather than approximated.
 * 8. More entities than the bound is refused instead of truncated.
 * 9. A scene ground, a water body, an orphan element and a boundary enclosing
 *    nothing all get well-formed entries.
 * 10. An unknown colour, a dangling owner and a cyclic owner each resolve without
 *     inventing an answer.
 */
export const test_render_semantic_mask = (): void => {
  const subject = (): IAutoMovieRenderSubject => ({
    scene: sceneFixture(),
    models: modelsFixture(),
    environments: [buildingFixture()],
    instanceSets: [instanceSetFixture({ id: "windows", count: 12, chunks: 3 })],
    waterBodies: [
      {
        id: "atrium-pool",
        owner: "space:tower/ground-hall",
        nodes: ["pool-surface"],
        cells: null,
        particles: null,
        domain: null,
        material: null,
      },
    ],
  });
  const mask = deriveAutoMovieSemanticMask(subject());
  // "ABSENT" distinguishes an entry that is missing from one whose owner is
  // legitimately null; folding the two together would let a dropped entry pass
  // as a root.
  const owner = (id: string): string | null => {
    const entry = mask.entries.find((candidate) => candidate.id === id);
    return entry === undefined ? "ABSENT" : entry.owner;
  };

  TestValidator.equals(
    "every addressable layer of the building is an entry with the tightest owner",
    {
      building: owner("building:tower/unit-a"),
      rootSpace: owner("space:tower/site"),
      room: owner("space:tower/ground-hall"),
      facade: owner("boundary:tower/hall-facade"),
      door: owner("opening:tower/hall-door"),
      doorLeaf: owner("element:tower/hall-door-leaf"),
      wall: owner("element:tower/hall-wall"),
      slab: owner("element:tower/loft-slab"),
      shell: owner("element:tower/shell"),
      prop: owner("node:lantern"),
      water: owner("water-body:atrium-pool"),
      set: owner("instance-set:windows"),
      slot: owner("instance-slot:windows#7"),
    },
    {
      building: null,
      rootSpace: "building:tower/unit-a",
      room: "space:tower/ground",
      facade: "space:tower/ground-hall",
      door: "boundary:tower/hall-facade",
      doorLeaf: "opening:tower/hall-door",
      wall: "boundary:tower/hall-facade",
      slab: "element:tower/shell",
      shell: "building:tower/unit-a",
      prop: null,
      water: "space:tower/ground-hall",
      set: null,
      slot: "instance-set:windows",
    },
  );

  const leaf = mask.entries.find(
    (entry) => entry.id === "element:tower/hall-door-leaf",
  )!;
  const resolved = resolveAutoMovieSemanticMask(mask, leaf.color)!;
  TestValidator.equals(
    "a door pixel resolves to the door and everything containing it",
    {
      entry: resolved.entry.id,
      label: resolved.entry.label,
      nodes: resolved.entry.nodes,
      ancestors: resolved.ancestors.map((entry) => entry.id),
      labels: resolved.ancestors.map((entry) => entry.label),
    },
    {
      entry: "element:tower/hall-door-leaf",
      label: "door-leaf",
      nodes: ["tower/hall-door-leaf"],
      ancestors: [
        "opening:tower/hall-door",
        "boundary:tower/hall-facade",
        "space:tower/ground-hall",
        "space:tower/ground",
        "space:tower/site",
        "building:tower/unit-a",
      ],
      labels: ["door", "wall", "room", "storey", "building", null],
    },
  );

  TestValidator.equals(
    "the palette is collision-free, opaque hexadecimal, and never background",
    namedFacts([
      [
        "unique",
        () =>
          new Set(mask.entries.map((entry) => entry.color)).size ===
          mask.entries.length,
      ],
      [
        "format",
        () => mask.entries.every((entry) => /^#[0-9A-F]{6}$/.test(entry.color)),
      ],
      [
        "background reserved",
        () => mask.entries.every((entry) => entry.color !== mask.background),
      ],
      [
        "ascending",
        () =>
          mask.entries.every(
            (entry, index) =>
              index === 0 || mask.entries[index - 1]!.id < entry.id,
          ),
      ],
    ]),
    {
      unique: true,
      format: true,
      "background reserved": true,
      ascending: true,
    },
  );

  const reversed = deriveAutoMovieSemanticMask({
    ...subject(),
    scene: sceneFixture({ reversed: true }),
  });
  TestValidator.equals(
    "reversing the staged nodes reproduces a byte-identical mask",
    reversed.digest,
    mask.digest,
  );

  const grown = deriveAutoMovieSemanticMask({
    ...subject(),
    scene: sceneFixture({ extra: true }),
  });
  const before = new Map(
    mask.entries.map((entry) => [entry.id, entry.color] as const),
  );
  TestValidator.equals(
    "an unrelated prop repaints nothing and takes a colour of its own",
    namedFacts([
      [
        "existing colours held",
        () =>
          grown.entries
            .filter((entry) => before.has(entry.id))
            .every((entry) => before.get(entry.id) === entry.color),
      ],
      ["one new entry", () => grown.entries.length === mask.entries.length + 1],
      [
        "new entry addressable",
        () => grown.entries.some((entry) => entry.id === "node:crate"),
      ],
      [
        "still collision-free",
        () =>
          new Set(grown.entries.map((entry) => entry.color)).size ===
          grown.entries.length,
      ],
      ["digest moved", () => grown.digest !== mask.digest],
    ]),
    {
      "existing colours held": true,
      "one new entry": true,
      "new entry addressable": true,
      "still collision-free": true,
      "digest moved": true,
    },
  );

  const slots = mask.entries.filter((entry) => entry.slot !== null);
  TestValidator.equals(
    "each repeated window slot is individually addressable",
    {
      count: slots.length,
      distinct: new Set(slots.map((entry) => entry.color)).size,
      seventh: resolveAutoMovieSemanticMask(
        mask,
        mask.entries.find((entry) => entry.id === "instance-slot:windows#7")!
          .color,
      )!.entry.slot,
      unaddressed: mask.unaddressed,
    },
    {
      count: 12,
      distinct: 12,
      seventh: { instanceSet: "windows", index: 7 },
      unaddressed: [],
    },
  );

  const crowded = deriveAutoMovieSemanticMask({
    ...subject(),
    instanceSets: [
      instanceSetFixture({
        id: "windows",
        count: AUTOMOVIE_SEMANTIC_MASK_MAX_ENTRIES,
        chunks: 4,
      }),
    ],
  });
  TestValidator.equals(
    "a set too large for the bound stays addressable as a whole and says why",
    {
      slots: crowded.entries.filter((entry) => entry.slot !== null).length,
      set: crowded.entries.some((entry) => entry.id === "instance-set:windows"),
      gap: crowded.unaddressed.map((gap) => ({
        instanceSet: gap.instanceSet,
        slots: gap.slots,
        bounded: gap.reason.includes("bounded maximum"),
        actionable: gap.remedy.includes("split"),
      })),
    },
    {
      slots: 0,
      set: true,
      gap: [
        {
          instanceSet: "windows",
          slots: AUTOMOVIE_SEMANTIC_MASK_MAX_ENTRIES,
          bounded: true,
          actionable: true,
        },
      ],
    },
  );

  TestValidator.equals(
    "two claimants of one semantic id are refused rather than silently merged",
    throwsError(
      () =>
        deriveAutoMovieSemanticMask({
          scene: {
            ...sceneFixture(),
            nodes: [bulk("node:yard")],
            space: { id: "yard", surfaces: [], walkable: [] },
          },
          models: modelsFixture(),
        }),
      'two claimants of "node:yard"',
    ),
    true,
  );

  TestValidator.equals(
    "more entities than the bound is refused rather than truncated",
    throwsError(
      () =>
        deriveAutoMovieSemanticMask({
          scene: {
            ...sceneFixture(),
            nodes: Array.from(
              { length: AUTOMOVIE_SEMANTIC_MASK_MAX_ENTRIES + 1 },
              (_, index) => ({
                id: `bulk-${index}`,
                model: "prop-model",
                transform: {
                  translation: { x: 0, y: 0, z: 0 },
                  rotation: { x: 0, y: 0, z: 0, w: 1 },
                  scale: { x: 1, y: 1, z: 1 },
                },
                motion: null,
                pose: null,
              }),
            ),
          },
          models: modelsFixture(),
        }),
      "above the bounded maximum",
    ),
    true,
  );

  const edged = buildingFixture();
  edged.elements.push({
    id: "orphan",
    kind: "monolith",
    parent: null,
    transform: {
      translation: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
    model: null,
    space: null,
  });
  edged.boundaries.push({
    id: "floating",
    kind: "threshold",
    spaces: [],
    elements: [],
  });
  const edge = deriveAutoMovieSemanticMask({
    scene: {
      ...sceneFixture(),
      space: { id: "tower-ground", surfaces: [], walkable: [] },
    },
    models: modelsFixture(),
    environments: [edged],
  });
  const index = autoMovieSemanticMaskNodeIndex(edge);
  TestValidator.equals(
    "a ground, an orphan element and an unattached boundary all resolve",
    {
      ground: index.get("__automovie_space")?.id,
      groundLabel: index.get("__automovie_space")?.label,
      orphan: edge.entries.find((entry) => entry.id === "element:tower/orphan")
        ?.owner,
      floating: edge.entries.find(
        (entry) => entry.id === "boundary:tower/floating",
      )?.owner,
      wallByNode: index.get("tower/hall-wall")?.id,
    },
    {
      ground: "node:tower-ground",
      groundLabel: "space",
      orphan: null,
      floating: null,
      wallByNode: "element:tower/hall-wall",
    },
  );

  // Two ids that genuinely land on the same palette colour. The expectation is
  // the documented rule, not a stored colour: whichever id sorts first keeps
  // the colour it hashed to, and the other takes the next one. `node:c37680`
  // sorts before `node:c5678`.
  const alone = (id: string): string =>
    deriveAutoMovieSemanticMask({
      scene: { ...sceneFixture(), nodes: [bulk(id)] },
      models: modelsFixture(),
    }).entries[0]!.color;
  const together = deriveAutoMovieSemanticMask({
    scene: {
      ...sceneFixture(),
      nodes: [bulk("node:c5678"), bulk("node:c37680")],
    },
    models: modelsFixture(),
  });
  const base = alone("node:c37680");
  TestValidator.equals(
    "a genuine colour collision is broken by the ids themselves, not by order",
    {
      collide: alone("node:c5678") === base,
      winner: together.entries.find((entry) => entry.id === "node:c37680")
        ?.color,
      loser: together.entries.find((entry) => entry.id === "node:c5678")?.color,
      next: `#${(Number.parseInt(base.slice(1), 16) + 1)
        .toString(16)
        .toUpperCase()
        .padStart(6, "0")}`,
    },
    {
      collide: true,
      winner: base,
      loser: `#${(Number.parseInt(base.slice(1), 16) + 1)
        .toString(16)
        .toUpperCase()
        .padStart(6, "0")}`,
      next: `#${(Number.parseInt(base.slice(1), 16) + 1)
        .toString(16)
        .toUpperCase()
        .padStart(6, "0")}`,
    },
  );

  TestValidator.equals(
    "a colour nobody claimed, a dangling owner and a cycle never invent an answer",
    {
      unknown: resolveAutoMovieSemanticMask(mask, "#123456"),
      lowercase: resolveAutoMovieSemanticMask(mask, leaf.color.toLowerCase())!
        .entry.id,
      dangling: resolveAutoMovieSemanticMask(
        broken("space:tower/vanished"),
        "#ABCDEF",
      )!.ancestors.length,
      cyclic: resolveAutoMovieSemanticMask(cyclic(), "#ABCDEF")!.ancestors.map(
        (entry) => entry.id,
      ),
    },
    {
      unknown: null,
      lowercase: "element:tower/hall-door-leaf",
      dangling: 0,
      cyclic: ["b"],
    },
  );
};

/** One staged node whose semantic id is exactly `node:<id>`. */
const bulk = (semantic: string): IAutoMovieScene["nodes"][number] => ({
  id: semantic.slice("node:".length),
  model: "prop-model",
  transform: {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  motion: null,
  pose: null,
});

/** A hand-built mask whose single entry points at an owner that is not there. */
const broken = (owner: string): IAutoMovieSemanticMask => ({
  version: 2,
  protocol: "automovie.semantic-mask.v2",
  background: "#000000",
  entries: [
    {
      id: "a",
      kind: "node",
      label: null,
      color: "#ABCDEF",
      owner,
      nodes: [],
      slot: null,
    },
  ],
  unaddressed: [],
  digest: `sha256:${"0".repeat(64)}`,
});

/** A hand-built mask whose two entries own one another. */
const cyclic = (): IAutoMovieSemanticMask => {
  const mask = broken("b");
  mask.entries.push({
    id: "b",
    kind: "node",
    label: null,
    color: "#FEDCBA",
    owner: "a",
    nodes: [],
    slot: null,
  });
  return mask;
};
