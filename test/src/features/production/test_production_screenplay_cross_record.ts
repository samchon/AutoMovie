import type {
  IAutoMovieAcceptanceScenario,
  IAutoMovieCompiledContractRealization,
  IAutoMovieDiagnostic,
  IAutoMovieScreenplayIndex,
  IAutoMovieShotContract,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

interface IGraph {
  production: unknown;
  models: ReadonlyMap<string, unknown>;
  world: { landmarks: Array<{ id: string }> } | null;
  formations: ReadonlyMap<string, unknown>;
  shots: ReadonlyMap<string, IAutoMovieShotContract>;
  acceptance: ReadonlyMap<string, IAutoMovieAcceptanceScenario>;
}

const { screenplayCrossRecordDiagnostics } = loadSourceModule<{
  screenplayCrossRecordDiagnostics: (props: {
    expectedProduction: string;
    screenplay: IAutoMovieScreenplayIndex | null;
    graph: IGraph;
    realizations: ReadonlyMap<string, IAutoMovieCompiledContractRealization>;
    currentAcceptanceEvidence: (scenario: string) => boolean;
  }) => IAutoMovieDiagnostic[];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/screenplayCrossRecordDiagnostics.ts",
  ),
);

const contract = (): IAutoMovieShotContract =>
  ({
    id: "SHOT-1",
    beat: "BEAT-1",
    source: { module: "src/shots/one.ts", export: "one" },
    evidence: [{ scene: "SCN-1", claim: "CLAIM-1" }],
    durationSeconds: 4,
    participants: [
      { kind: "actor", id: "MODEL-1" },
      { kind: "formation", id: "FORMATION-1" },
    ],
    opening: [],
    closing: [],
    camera: {},
    events: [],
    reviewFrames: [],
  }) as unknown as IAutoMovieShotContract;

const realization = (passed = true): IAutoMovieCompiledContractRealization =>
  ({
    version: 1,
    shot: "SHOT-1",
    opening: [{ id: "STATE-1", predicates: [], passed }],
    closing: [],
    events: [],
    camera: [],
    formations: [],
  }) as IAutoMovieCompiledContractRealization;

const screenplay = (): IAutoMovieScreenplayIndex =>
  ({
    version: 1,
    production: "PRODUCTION-1",
    treatment: { path: "treatment.md", sequences: [] },
    screenplay: {
      path: "screenplay.md",
      lock: {
        activatedBy: "agent-before-first-shot",
        reason: "The first shot exists.",
        sceneIds: ["SCN-1"],
      },
      scenes: [
        {
          id: "SCN-1",
          title: "One",
          status: "active",
          covers: [],
          location: "LOCATION-1",
          storyTime: "unknown",
          participants: [],
          disposition: null,
        },
      ],
    },
    catalog: {
      characters: [
        {
          id: "CHARACTER-1",
          name: "Character",
          evidence: [{ scene: "SCN-1" }],
          bindings: [{ kind: "model", id: "MODEL-1" }],
        },
      ],
      factions: [
        {
          id: "FACTION-1",
          name: "Faction",
          evidence: [{ scene: "SCN-1" }],
          bindings: [{ kind: "formation", id: "FORMATION-1" }],
        },
      ],
      locations: [
        {
          id: "LOCATION-1",
          name: "Location",
          evidence: [{ scene: "SCN-1" }],
          bindings: [{ kind: "world-landmark", id: "LANDMARK-1" }],
        },
      ],
    },
    continuity: [
      {
        id: "CLAIM-1",
        text: "The state holds.",
        verification: "geometry",
        proof: {
          owner: "geometry",
          shot: "SHOT-1",
          outcome: { kind: "opening", id: "STATE-1" },
        },
        evidence: [{ scene: "SCN-1" }],
      },
    ],
  }) as IAutoMovieScreenplayIndex;

const graph = (shot = contract()): IGraph => ({
  production: {},
  models: new Map([["MODEL-1", {}]]),
  world: { landmarks: [{ id: "LANDMARK-1" }, { id: "UNUSED" }] },
  formations: new Map([["FORMATION-1", {}]]),
  shots: new Map([["SHOT-1", shot]]),
  acceptance: new Map(),
});

const run = (props?: {
  screenplay?: IAutoMovieScreenplayIndex | null;
  graph?: IGraph;
  realization?: IAutoMovieCompiledContractRealization | null;
  current?: boolean;
}): IAutoMovieDiagnostic[] =>
  screenplayCrossRecordDiagnostics({
    expectedProduction: "PRODUCTION-1",
    screenplay:
      props?.screenplay === undefined ? screenplay() : props.screenplay,
    graph: props?.graph ?? graph(),
    realizations:
      props?.realization === null
        ? new Map()
        : new Map([["SHOT-1", props?.realization ?? realization()]]),
    currentAcceptanceEvidence: () => props?.current ?? true,
  });

const copy = (): IAutoMovieScreenplayIndex => structuredClone(screenplay());

/**
 * Prove the screenplay against active production, design and current evidence.
 *
 * Scenarios:
 * 1. Exact production, first-shot lock, three binding families and a passed exact outcome succeed.
 * 2. Wrong production, null lock, missing, mistyped, dangling and reused bindings fail.
 * 3. A staged actor or formation must trace back to the matching story catalog.
 * 4. Geometry and review proof require an exact cited outcome and current evidence.
 */
export const test_production_screenplay_cross_record = (): void => {
  const wrongProduction = copy();
  wrongProduction.production = "production-1";
  const noLock = copy();
  noLock.screenplay.lock = null;
  const noBinding = copy();
  noBinding.catalog.characters[0]!.bindings = [];
  const wrongKind = copy();
  wrongKind.catalog.characters[0]!.bindings = [
    { kind: "formation", id: "FORMATION-1" },
  ];
  const missingTarget = copy();
  missingTarget.catalog.characters[0]!.bindings = [
    { kind: "model", id: "MODEL-MISSING" },
  ];
  const repeatedTarget = copy();
  repeatedTarget.catalog.characters.push({
    id: "CHARACTER-2",
    name: "Second",
    evidence: [{ scene: "SCN-1" }],
    bindings: [{ kind: "model", id: "MODEL-1" }],
  });
  const unboundShot = contract();
  unboundShot.participants = [{ kind: "actor", id: "MODEL-OTHER" }];
  const noCitation = contract();
  noCitation.evidence = [{ scene: "SCN-1" }];
  const reviewProof = copy();
  reviewProof.continuity[0]!.verification = "frame-review";
  reviewProof.continuity[0]!.proof = {
    owner: "frame-review",
    scenario: "ACCEPT-1",
  };
  const reviewGraph = graph();
  reviewGraph.acceptance = new Map([
    [
      "ACCEPT-1",
      {
        id: "ACCEPT-1",
        target: { kind: "shot", id: "SHOT-1" },
        criterion: {
          kind: "frame",
          frame: "FRAME-1",
          pass: "beauty",
          expectation: "The state is visible.",
        },
        required: true,
        evidence: [{ scene: "SCN-1", claim: "CLAIM-1" }],
      },
    ],
  ]);
  const code = (diagnostics: IAutoMovieDiagnostic[], value: string): boolean =>
    diagnostics.some((diagnostic) => diagnostic.code === value);

  TestValidator.equals(
    "screenplay cross-record truth is exact and current",
    namedFacts([
      ["nullIndexIsEmpty", () => run({ screenplay: null }).length === 0],
      ["exactCrossRecordPasses", () => run().length === 0],
      [
        "productionIdentityIsExact",
        () =>
          code(
            run({ screenplay: wrongProduction }),
            "screenplay-production-mismatch",
          ),
      ],
      [
        "firstShotRequiresLock",
        () => code(run({ screenplay: noLock }), "screenplay-lock-missing"),
      ],
      [
        "requiredBindingCannotBeEmpty",
        () =>
          code(run({ screenplay: noBinding }), "screenplay-binding-missing"),
      ],
      [
        "bindingKindIsClosed",
        () =>
          code(
            run({ screenplay: wrongKind }),
            "screenplay-binding-kind-invalid",
          ),
      ],
      [
        "bindingTargetMustExist",
        () =>
          code(
            run({ screenplay: missingTarget }),
            "screenplay-binding-target-absent",
          ),
      ],
      [
        "downstreamIdentityIsUnique",
        () =>
          code(
            run({ screenplay: repeatedTarget }),
            "screenplay-binding-target-repeated",
          ),
      ],
      [
        "shotParticipantMustBeCast",
        () =>
          code(
            run({ graph: graph(unboundShot) }),
            "screenplay-binding-missing",
          ),
      ],
      [
        "geometryProofNeedsClaimCitation",
        () =>
          code(
            run({ graph: graph(noCitation) }),
            "screenplay-continuity-proof-absent",
          ),
      ],
      [
        "geometryProofMustPass",
        () =>
          code(
            run({ realization: realization(false) }),
            "screenplay-continuity-proof-failed",
          ),
      ],
      [
        "reviewProofWithCurrentEvidencePasses",
        () => run({ screenplay: reviewProof, graph: reviewGraph }).length === 0,
      ],
      [
        "historicalReviewProofIsStale",
        () =>
          code(
            run({
              screenplay: reviewProof,
              graph: reviewGraph,
              current: false,
            }),
            "screenplay-continuity-proof-not-current",
          ),
      ],
    ]),
    {
      nullIndexIsEmpty: true,
      exactCrossRecordPasses: true,
      productionIdentityIsExact: true,
      firstShotRequiresLock: true,
      requiredBindingCannotBeEmpty: true,
      bindingKindIsClosed: true,
      bindingTargetMustExist: true,
      downstreamIdentityIsUnique: true,
      shotParticipantMustBeCast: true,
      geometryProofNeedsClaimCitation: true,
      geometryProofMustPass: true,
      reviewProofWithCurrentEvidencePasses: true,
      historicalReviewProofIsStale: true,
    },
  );
};
