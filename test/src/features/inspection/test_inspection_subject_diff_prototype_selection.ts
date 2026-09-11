import {
  diffAutoMovieSubjects,
  instanceSlot,
  materializeCompiledInstanceSet,
  productionRuntimeModelId,
} from "@automovie/engine";
import {
  IAutoMovieCompiledInstanceSet,
  IAutoMovieSubjectDiff,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";
import {
  subjectInspectionArtifact,
  subjectInspectionModel,
} from "../internal/subjectInspectionFixtures";

const PROTOTYPES = [
  { id: "tall", modelRecipe: "tall-tree", weight: 2 },
  { id: "short", modelRecipe: "shrub", weight: 1 },
];

/** The runtime model each prototype draws, the base recipe's default included. */
const MODEL = {
  default: productionRuntimeModelId("tree"),
  tall: productionRuntimeModelId("tall-tree"),
  short: productionRuntimeModelId("shrub"),
};
type PrototypeId = keyof typeof MODEL;
const PROTOTYPE_IDS = Object.keys(MODEL) as PrototypeId[];

const VARIATION = {
  scale: { min: 1, max: 1 },
  palette: ["#336633"],
  traits: [],
};

/** Members in a row drawing the default, tall and short prototypes 1:2:1. */
const orchard = (count: number, seed: number): IAutoMovieCompiledInstanceSet =>
  materializeCompiledInstanceSet({
    instanceSet: {
      id: "orchard",
      modelRecipe: "tree",
      prototypes: PROTOTYPES,
      count,
      layout: {
        kind: "grid",
        rows: 1,
        columns: count,
        spacing: { x: 1, z: 1 },
      },
      anchor: { x: 0, y: 0, z: 0 },
      facingDeg: 0,
      seed,
      variation: VARIATION,
    },
    world: { routes: [] },
  });

/** One explicit member, compiled naming "tall" and then edited to name `prototype`. */
const statue = (
  prototype: string,
  seed = 11,
): IAutoMovieCompiledInstanceSet => {
  const compiled = structuredClone(
    materializeCompiledInstanceSet({
      instanceSet: {
        id: "statue",
        modelRecipe: "tree",
        prototypes: PROTOTYPES,
        count: 1,
        layout: {
          kind: "explicit",
          transforms: [
            {
              id: "one",
              translation: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
              prototype: "tall",
            },
          ],
        },
        anchor: { x: 0, y: 0, z: 0 },
        facingDeg: 0,
        seed,
        variation: VARIATION,
      },
      world: { routes: [] },
    }),
  );
  if (compiled.layout.kind === "explicit")
    compiled.layout.transforms[0]!.prototype = prototype;
  return compiled;
};

/** One member whose prototype table holds an entry nothing can read. */
const unreadable = (explicit: boolean): IAutoMovieCompiledInstanceSet => {
  const set = explicit ? statue("tall") : orchard(1, 11);
  return {
    ...set,
    prototypes: [
      null,
    ] as unknown as IAutoMovieCompiledInstanceSet["prototypes"],
  };
};

/** Diff two revisions of one set whose prototype models all grow a metre taller. */
const diffOf = (
  before: IAutoMovieCompiledInstanceSet,
  after: IAutoMovieCompiledInstanceSet,
): IAutoMovieSubjectDiff => {
  const revision = (
    name: string,
    height: number,
    set: IAutoMovieCompiledInstanceSet,
  ) =>
    subjectInspectionArtifact({
      revision: name,
      models: PROTOTYPE_IDS.map((id) =>
        subjectInspectionModel({
          id: MODEL[id],
          min: { x: -0.5, y: 0, z: -0.5 },
          max: { x: 0.5, y: height, z: 0.5 },
        }),
      ),
      nodes: [],
      instanceSets: [set],
      environment: null,
    });
  return diffAutoMovieSubjects(
    revision("before", 1, before),
    revision("after", 2, after),
  );
};

/** How many members the diff counts as drawing each prototype's model. */
const drawnCounts = (
  set: IAutoMovieCompiledInstanceSet,
): Record<PrototypeId, number> => {
  const diff = diffOf(set, set);
  return Object.fromEntries(
    PROTOTYPE_IDS.map((id) => [
      id,
      diff.reshaped.find((change) => change.id === `prototype:${MODEL[id]}`)
        ?.fanout.instances ?? 0,
    ]),
  ) as Record<PrototypeId, number>;
};

const prototypeChanges = (
  before: IAutoMovieCompiledInstanceSet,
  after: IAutoMovieCompiledInstanceSet,
): number | undefined =>
  diffOf(before, after).reshaped.find(
    (change) => change.id === `instance-set:${before.id}`,
  )?.fanout.prototypeChanges;

/**
 * A structural diff draws each member's prototype as the member regenerator
 * does, and reads only a missing prototype as a tolerated answer.
 *
 * The diff reports the prototypes an instance set's members draw only as counts:
 * how many members draw a reshaped prototype's model, and how many slots changed
 * prototype between revisions. Growing a set one member at a time turns those
 * counts back into one answer per member, which is compared with the member
 * regenerator slot by slot, and the shares a large set is counted drawing are
 * compared with its declared weights, which no implementation supplies. An
 * explicit member naming a prototype its table lacks is counted as that missing
 * prototype, and any other failure of the draw reaches the caller.
 *
 * Scenarios:
 *
 * 1. Each of 24 members is counted as drawing the prototype its regenerated
 *    member draws, and those members draw all three prototypes.
 * 2. Two thousand members are counted drawing default, tall and short in about
 *    the 1:2:1 their weights declare.
 * 3. Reseeding a 200-member set reports as many prototype changes as there are
 *    slots whose regenerated member draws a different prototype, which is some of
 *    them and not all.
 * 4. An explicit member moved from a present prototype to a missing one, or from
 *    one missing name to another, is one change, and the same missing name in
 *    both revisions is none.
 * 5. A prototype table holding an unreadable entry fails the diff through the
 *    weighted draw and through an explicit member's lookup alike, instead of
 *    being counted as a missing prototype.
 */
export const test_inspection_subject_diff_prototype_selection = (): void => {
  const row = orchard(24, 5);
  const counts = [
    { default: 0, tall: 0, short: 0 },
    ...Array.from({ length: row.count }, (_, slot) =>
      drawnCounts({ ...row, count: slot + 1 }),
    ),
  ];
  const regenerated = Array.from(
    { length: row.count },
    (_, slot) => instanceSlot(row, slot).prototype,
  );
  TestValidator.equals(
    "each member the diff counts draws the prototype its regenerator draws",
    Array.from({ length: row.count }, (_, slot): string | undefined =>
      PROTOTYPE_IDS.find(
        (id) => counts[slot + 1]![id] - counts[slot]![id] === 1,
      ),
    ),
    regenerated,
  );

  const crowd = drawnCounts(orchard(2_000, 9));
  const before = orchard(200, 11);
  const after = orchard(200, 12);
  const reseeded = Array.from(
    { length: before.count },
    (_, slot) => slot,
  ).filter(
    (slot) =>
      instanceSlot(before, slot).prototype !==
      instanceSlot(after, slot).prototype,
  ).length;
  TestValidator.equals(
    "the diff's counts follow the declared weights and the regenerated members",
    namedFacts([
      ["allDrawn", () => new Set(regenerated).size === 3],
      [
        "everyMemberCounted",
        () => crowd.default + crowd.tall + crowd.short === 2_000,
      ],
      ["defaultShare", () => Math.abs(crowd.default / 2_000 - 0.25) < 0.04],
      ["tallShare", () => Math.abs(crowd.tall / 2_000 - 0.5) < 0.04],
      ["shortShare", () => Math.abs(crowd.short / 2_000 - 0.25) < 0.04],
      [
        "reseeded",
        () =>
          prototypeChanges(before, after) === reseeded &&
          reseeded > 0 &&
          reseeded < before.count,
      ],
    ]),
    {
      allDrawn: true,
      everyMemberCounted: true,
      defaultShare: true,
      tallShare: true,
      shortShare: true,
      reseeded: true,
    },
  );

  TestValidator.equals(
    "only a missing prototype is tolerated, and as its own name",
    namedFacts([
      [
        "presentToMissing",
        () => prototypeChanges(statue("tall"), statue("ghost")) === 1,
      ],
      [
        "missingToMissing",
        () => prototypeChanges(statue("ghost"), statue("phantom")) === 1,
      ],
      [
        "sameMissing",
        () => prototypeChanges(statue("ghost"), statue("ghost", 12)) === 0,
      ],
      [
        "weightedDrawFails",
        () =>
          throwsError(
            () => diffOf(unreadable(false), { ...unreadable(false), seed: 12 }),
            "reading 'weight'",
          ),
      ],
      [
        "explicitLookupFails",
        () =>
          throwsError(
            () => diffOf(unreadable(true), { ...unreadable(true), seed: 12 }),
            "reading 'id'",
          ),
      ],
    ]),
    {
      presentToMissing: true,
      missingToMissing: true,
      sameMissing: true,
      weightedDrawFails: true,
      explicitLookupFails: true,
    },
  );
};
