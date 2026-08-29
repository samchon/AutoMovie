import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import type {
  AutoMovieContentDigest,
  IAutoMovieBuiltEnvironment,
  IAutoMovieLibraryReviewPopulation,
  IAutoMovieLibraryReviewProjectReader,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { rectangularBuilding } from "../internal/envelopeFixtures";
import { namedFacts } from "../internal/predicates";

const consumer = require(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/libraryReviewEvidenceConsumer.ts",
  ),
) as {
  readAutoMovieLibraryReviewRequirements: (props: {
    authoring: IAutoMovieProductionEvidence;
    project: IAutoMovieLibraryReviewProjectReader;
    compileFingerprint: AutoMovieContentDigest;
    environments?: (props: {
      branch: string;
      owner: string;
      anchor: string;
    }) => readonly IAutoMovieBuiltEnvironment[];
  }) => IAutoMovieLibraryReviewPopulation;
};

const ROOT = "C:/automovie-library";
const DESIGN = "docs/spaces/hall.md";
const PLAN = "docs/spaces/hall.review.json";
const SOURCE = "src/spaces/hall.ts";
const ANCHOR = "hall-delivery";
const COMPILE = `sha256:${"1".repeat(64)}` as AutoMovieContentDigest;
const EAST = "building:hall-house/house/facade/wall-east";
const WEST = "building:hall-house/house/facade/wall-west";
const CONTEXT = "building:hall-house/house/context";
const UNDERSIDE = "building:hall-house/house/underside/floor-slab";

/**
 * The derived population reaches the review gate, or it reaches nothing.
 *
 * A closed observation set that only a unit test can see is a rule nobody is
 * held to. This opens the exact surface the compiler and the shipped authoring
 * command both call, hands it the topology one owner materialized, and reads
 * back what that owner now owes. It is the wiring, not the arithmetic: the
 * arithmetic has its own scenarios.
 *
 * The same call with the topology withheld is the other half of the same fact.
 * An owner whose compiler published no building has an empty required
 * population, and that is a statement about what was compiled rather than a
 * complete review, which is why the plan's own finite observations remain its
 * denominator either way.
 *
 * Scenarios:
 *
 * 1. With one building handed over, the owner's required population is the
 *    twenty-one observations that building's envelope and room derive, each
 *    addressed to the branch and H2 that owes it.
 * 2. The plan declaring one observation of its own is refused once for every
 *    derived observation it does not open, at that observation's own address.
 * 3. Opening two derived observations and waiving two more, each disclosed by
 *    one of the opened ones, removes exactly those four refusals, on two
 *    different grounds.
 * 4. That waiver moves the owner's plan digest, so excusing a face after the
 *    fact expires every receipt written against the owner it excused it on.
 * 5. With no topology handed over, the same owner requires nothing and the plan
 *    is not refused for shrinking a population that was never derived.
 * 6. The owner's four-part identity is otherwise unchanged by the topology,
 *    because a building the compiler published is not a byte of the plan the
 *    author wrote.
 */
export const test_production_library_required_population_wiring = (): void => {
  const withBuilding = consumer.readAutoMovieLibraryReviewRequirements({
    authoring: authoring(),
    project: project(),
    compileFingerprint: COMPILE,
    environments: () => [rectangularBuilding()],
  });
  const withWaiver = consumer.readAutoMovieLibraryReviewRequirements({
    authoring: authoring(),
    project: project({
      observations: [
        { id: "plan-section-elevation", evidence: "artifact" },
        { id: WEST, evidence: "artifact" },
        { id: CONTEXT, evidence: "artifact" },
      ],
      waivers: [
        {
          observation: EAST,
          ground: "symmetry",
          disclosedBy: WEST,
          reason:
            "The east and west elevations are one authored panel mirrored about the hall's own centre line.",
        },
        {
          observation: UNDERSIDE,
          ground: "in-use-invisibility",
          disclosedBy: CONTEXT,
          reason:
            "The hall bears directly on grade, so the underside of its floor slab is not reachable by any observer of the work; the setting view shows it sitting on the ground.",
        },
      ],
    }),
    compileFingerprint: COMPILE,
    environments: () => [rectangularBuilding()],
  });
  const withoutBuilding = consumer.readAutoMovieLibraryReviewRequirements({
    authoring: authoring(),
    project: project(),
    compileFingerprint: COMPILE,
  });

  TestValidator.equals(
    "the handed-over building becomes what this owner owes",
    {
      count: withBuilding.required.length,
      branch: withBuilding.required[0]?.branch ?? null,
      owner: withBuilding.required[0]?.owner ?? null,
      first: withBuilding.required[0]?.id ?? null,
      last: withBuilding.required.at(-1)?.id ?? null,
    },
    {
      count: 21,
      branch: "spaces",
      owner: `${DESIGN}#${ANCHOR}`,
      first: "building:hall-house/house/context",
      last: "space:hall-house/hall/threshold-door-main",
    },
  );

  TestValidator.equals(
    "a plan opening one of them is refused for the twenty it does not",
    {
      refusals: withBuilding.diagnostics.length,
      codes: [
        ...new Set(
          withBuilding.diagnostics.map((diagnostic) => diagnostic.code),
        ),
      ],
      namesOneAddress: withBuilding.diagnostics.some(
        (diagnostic) =>
          diagnostic.target ===
          `library:spaces:${DESIGN}#${ANCHOR}:building:hall-house/house/facade/wall-east`,
      ),
      namesThePlan: withBuilding.diagnostics.every(
        (diagnostic) => diagnostic.path === PLAN,
      ),
    },
    {
      refusals: 21,
      codes: ["review-evidence-missing"],
      namesOneAddress: true,
      namesThePlan: true,
    },
  );

  TestValidator.equals(
    "opening two views and waiving two more removes exactly those four",
    namedFacts([
      [
        "seventeen derived observations remain unopened",
        () => withWaiver.diagnostics.length === 17,
      ],
      [
        "neither opened view is refused",
        () =>
          [WEST, CONTEXT].some((id) =>
            withWaiver.diagnostics.some((diagnostic) =>
              diagnostic.target.endsWith(id),
            ),
          ) === false,
      ],
      [
        "and neither is the mirrored elevation nor the buried underside",
        () =>
          [EAST, UNDERSIDE].some((id) =>
            withWaiver.diagnostics.some((diagnostic) =>
              diagnostic.target.endsWith(id),
            ),
          ) === false,
      ],
      [
        "while the waivers move the plan digest that expires receipts",
        () =>
          withWaiver.owners[0]?.identity.plan !==
          withBuilding.owners[0]?.identity.plan,
      ],
    ]),
    {
      "seventeen derived observations remain unopened": true,
      "neither opened view is refused": true,
      "and neither is the mirrored elevation nor the buried underside": true,
      "while the waivers move the plan digest that expires receipts": true,
    },
  );

  TestValidator.equals(
    "withholding the topology charges nothing and refuses nothing",
    namedFacts([
      [
        "an owner with no published building requires nothing",
        () => withoutBuilding.required.length === 0,
      ],
      [
        "and is not refused for a population that was never derived",
        () => withoutBuilding.diagnostics.length === 0,
      ],
      [
        "while its own finite plan still stands as its denominator",
        () =>
          withoutBuilding.owners[0]?.observations
            .map((entry) => entry.id)
            .join(",") === "plan-section-elevation",
      ],
      [
        "and the four-part identity is the same either way",
        () =>
          JSON.stringify(withBuilding.owners[0]?.identity) ===
          JSON.stringify(withoutBuilding.owners[0]?.identity),
      ],
    ]),
    {
      "an owner with no published building requires nothing": true,
      "and is not refused for a population that was never derived": true,
      "while its own finite plan still stands as its denominator": true,
      "and the four-part identity is the same either way": true,
    },
  );
};

/** One reviewed library carrying a single spaces owner. */
const authoring = (): IAutoMovieProductionEvidence => {
  const sourceBinding = {
    branch: "spaceSources",
    stage: "review",
    enforced: true,
    root: "src",
    files: ["src/spaces/**/*.ts"],
    symbols: ["spaces"],
    paths: [SOURCE],
  };
  return {
    root: ROOT,
    packageName: "library-test",
    description: "library test",
    configuration: {},
    manifest: { kind: "library" },
    designBranches: [
      { branch: "spaces", designStage: "review", sourceBinding },
    ],
    designOwners: [
      {
        branch: "spaces",
        path: DESIGN,
        title: "hall design",
        units: [
          { anchor: ANCHOR, title: "hall delivery", digest: "a".repeat(64) },
        ],
        sourceBinding,
      },
    ],
    contracts: [],
  } as unknown as IAutoMovieProductionEvidence;
};

/** A reader holding that owner's one source file and one observation plan. */
const project = (
  unit: {
    observations?: unknown[];
    waivers?: unknown[];
  } = {},
): IAutoMovieLibraryReviewProjectReader => {
  const prose = new Map<string, string>([
    [
      PLAN,
      JSON.stringify({
        version: 1,
        units: [
          {
            anchor: ANCHOR,
            sources: [SOURCE],
            observations: unit.observations ?? [
              { id: "plan-section-elevation", evidence: "artifact" },
            ],
            ...(unit.waivers === undefined ? {} : { waivers: unit.waivers }),
            receipts: [],
          },
        ],
      }),
    ],
  ]);
  const source = new Map<string, Uint8Array>([
    [SOURCE, Buffer.from("export const hall = true;\n", "utf8")],
  ]);
  return {
    root: ROOT,
    readProseDocument: (relative) => prose.get(relative) ?? null,
    readRenderFile: (relative) => {
      throw new Error(`missing render ${relative}`);
    },
    readSource: (relative) => {
      const value = source.get(relative);
      if (value === undefined) throw new Error(`missing source ${relative}`);
      return value;
    },
  };
};
