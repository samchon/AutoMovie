import type {
  IAutoMovieProductionEvidence,
  IAutoMovieProductionEvidenceDesignOwner,
} from "@automovie/evidence";
import type {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMovieDiagnostic,
  IAutoMovieRenderBundleManifest,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  openAutoMovieProduction,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";

interface Identity {
  design: AutoMovieContentDigest;
  source: AutoMovieContentDigest;
  generated: AutoMovieContentDigest | null;
  plan: AutoMovieContentDigest;
}

interface RequirementOwner {
  branch: string;
  owner: string;
  identity: Identity;
  observations: Array<{
    id: string;
    evidence: "artifact" | "facts" | "turntable";
  }>;
}

interface Population {
  branches: string[];
  diagnostics: IAutoMovieDiagnostic[];
  owners: RequirementOwner[];
  receipts: unknown[];
  turntables: Array<{
    branch: string;
    owner: string;
    observation: string;
    model: string;
  }>;
}

interface ProjectReader {
  root: string;
  readProseDocument(path: string): string | null;
  readRenderFile(path: string): Uint8Array;
  readSource(path: string): Uint8Array;
}

interface ConsumerProps {
  authoring: IAutoMovieProductionEvidence;
  project: ProjectReader;
  scope: "design" | "source" | "review" | "final";
  compileFingerprint: AutoMovieContentDigest;
  modelExists: (model: string) => boolean;
  rigged: (model: string) => boolean;
  fingerprint: (
    target: IAutoMovieRenderBundleManifest["target"],
  ) => AutoMovieContentDigest | null;
  captured: (
    target: IAutoMovieRenderBundleManifest["target"],
    fingerprint: AutoMovieContentDigest,
  ) => ReadonlyArray<{ time: number; pass: AutoMovieGuidePass }>;
}

const consumer = require(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/libraryReviewEvidenceConsumer.ts",
  ),
) as {
  readAutoMovieLibraryReviewRequirements: (props: {
    authoring: IAutoMovieProductionEvidence;
    project: ProjectReader;
    compileFingerprint: AutoMovieContentDigest;
  }) => Population;
  libraryReviewEvidenceConsumerDiagnostics: (
    props: ConsumerProps,
  ) => IAutoMovieDiagnostic[];
};

const contentIdentity = require(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/contentIdentity.ts",
  ),
) as {
  canonicalAutoMovieJsonBytes: (value: unknown) => Uint8Array;
  digestAutoMovieBytes: (bytes: Uint8Array) => AutoMovieContentDigest;
};

const digest = (digit: string): AutoMovieContentDigest =>
  `sha256:${digit.repeat(64)}` as AutoMovieContentDigest;
const COMPILE = digest("1");
const CAPTURE = digest("2");
const branches = [
  "instances",
  "materials",
  "models",
  "motions",
  "spaces",
  "systems",
] as const;

const sourceBranch = (branch: string): string =>
  `${branch.slice(0, -1)}Sources`;
const designPath = (branch: string): string =>
  `docs/${branch}/${branch.slice(0, -1)}-owner.md`;
const sourcePath = (branch: string): string =>
  `src/${branch}/${branch.slice(0, -1)}Owner.ts`;
const reviewPath = (branch: string): string =>
  designPath(branch).replace(/\.md$/u, ".review.json");
const anchorOf = (branch: string): string => `${branch}-delivery`;

const owner = (branch: string): IAutoMovieProductionEvidenceDesignOwner => ({
  branch,
  path: designPath(branch),
  title: `${branch} design`,
  units: [
    {
      anchor: anchorOf(branch),
      title: `${branch} delivery`,
      digest: "a".repeat(64),
    },
  ],
  sourceBinding: {
    branch: sourceBranch(branch),
    stage: "review",
    enforced: true,
    root: "src",
    files: [`src/${branch}/**/*.ts`],
    symbols: [branch],
    paths: [sourcePath(branch), `src/${branch}/support.ts`],
  },
});

const authoring = (kind: "brief" | "film" | "library" = "library") =>
  ({
    root: "C:/automovie-library",
    packageName: "library-test",
    description: "library test",
    configuration: {},
    manifest: { kind },
    designBranches: branches.map((branch) => ({
      branch,
      designStage: "review",
      sourceBinding: owner(branch).sourceBinding,
    })),
    designOwners: branches.map(owner),
    contracts: [],
  }) as unknown as IAutoMovieProductionEvidence;

interface MutableProject extends ProjectReader {
  prose: Map<string, string>;
  render: Map<string, Uint8Array>;
  source: Map<string, Uint8Array>;
}

const project = (): MutableProject => {
  const output: MutableProject = {
    root: "C:/automovie-library",
    prose: new Map(),
    render: new Map(),
    source: new Map(),
    readProseDocument: (relative) => output.prose.get(relative) ?? null,
    readRenderFile: (relative) => {
      const value = output.render.get(relative);
      if (value === undefined) throw new Error(`missing render ${relative}`);
      return value;
    },
    readSource: (relative) => {
      const value = output.source.get(relative);
      if (value === undefined) throw new Error(`missing source ${relative}`);
      return value;
    },
  };
  for (const branch of branches)
    output.source.set(
      sourcePath(branch),
      Buffer.from(`export const ${branch} = true;\r\n`, "utf8"),
    );
  output.prose.set("observations/space.svg", "<svg>space</svg>\n");
  output.render.set(
    "observations/material.png",
    Buffer.from("material-pixels", "utf8"),
  );
  return output;
};

const observation = (branch: string) => {
  if (branch === "models")
    return { id: "whole-model", evidence: "turntable", model: "chair" };
  if (branch === "spaces")
    return { id: "plan-section-elevation", evidence: "artifact" };
  if (branch === "materials")
    return { id: "surface-channels", evidence: "artifact" };
  return { id: `${branch}-facts`, evidence: "facts" };
};

const writePlans = (state: MutableProject): void => {
  for (const branch of branches)
    state.prose.set(
      reviewPath(branch),
      JSON.stringify({
        version: 1,
        units: [
          {
            anchor: anchorOf(branch),
            sources: [sourcePath(branch)],
            observations: [observation(branch)],
            receipts: [],
          },
        ],
      }),
    );
};

const evidenceFor = (branch: string) => {
  if (branch === "models") return { kind: "turntable", model: "chair" };
  if (branch === "spaces")
    return {
      kind: "artifact",
      root: "project",
      path: "observations/space.svg",
      digest: contentIdentity.digestAutoMovieBytes(
        Buffer.from("<svg>space</svg>\n", "utf8"),
      ),
    };
  if (branch === "materials")
    return {
      kind: "artifact",
      root: "render",
      path: "observations/material.png",
      digest: contentIdentity.digestAutoMovieBytes(
        Buffer.from("material-pixels", "utf8"),
      ),
    };
  const facts = { branch, observed: true, samples: [0, 0.5, 1] };
  return {
    kind: "facts",
    facts,
    digest: contentIdentity.digestAutoMovieBytes(
      contentIdentity.canonicalAutoMovieJsonBytes(facts),
    ),
  };
};

const payPlans = (state: MutableProject, binding = authoring()): Population => {
  const population = consumer.readAutoMovieLibraryReviewRequirements({
    authoring: binding,
    project: state,
    compileFingerprint: COMPILE,
  });
  for (const branch of branches) {
    const current = JSON.parse(state.prose.get(reviewPath(branch))!) as {
      version: 1;
      units: Array<{
        anchor: string;
        sources: string[];
        observations: unknown[];
        receipts: unknown[];
      }>;
    };
    const requirement = population.owners.find(
      (entry) => entry.branch === branch,
    );
    if (requirement === undefined) continue;
    current.units[0]!.receipts = [
      {
        observation: requirement.observations[0]!.id,
        evidence: evidenceFor(branch),
        identity: requirement.identity,
        runtimeIdentity: "playwright:chromium:1",
        verdict: "passed",
      },
    ];
    state.prose.set(reviewPath(branch), JSON.stringify(current));
  }
  return population;
};

const props = (
  state: MutableProject,
  binding: IAutoMovieProductionEvidence = authoring(),
): ConsumerProps => ({
  authoring: binding,
  project: state,
  scope: "review",
  compileFingerprint: COMPILE,
  modelExists: (model) => model === "chair",
  rigged: () => true,
  fingerprint: () => CAPTURE,
  captured: () => [
    { time: 0, pass: "beauty" },
    { time: 0, pass: "outline" },
  ],
});

const diagnose = (
  mutate?: (
    state: MutableProject,
    binding: IAutoMovieProductionEvidence,
  ) => void,
): IAutoMovieDiagnostic[] => {
  const state = project();
  const binding = authoring();
  writePlans(state);
  payPlans(state, binding);
  mutate?.(state, binding);
  return consumer.libraryReviewEvidenceConsumerDiagnostics(
    props(state, binding),
  );
};

const compilerProbe = (): {
  directFilmLibraryDiagnostics: IAutoMovieDiagnostic[];
  openedLibraryDiagnostics: IAutoMovieDiagnostic[];
} => {
  const fixture = productionFixture();
  try {
    const library = authoring();
    (library as unknown as { root: string }).root = fixture.root;
    (library as unknown as { designOwners: unknown[] }).designOwners = [];
    const film = authoring("film");
    (film as unknown as { root: string }).root = fixture.root;
    return {
      openedLibraryDiagnostics: openAutoMovieProduction({
        projectRoot: fixture.root,
        authoringEvidence: library,
      })
        .compiler.lint({ scope: "review" })
        .diagnostics.filter((entry) => entry.target.startsWith("library:")),
      directFilmLibraryDiagnostics: new AutoMovieProductionCompiler(
        AutoMovieProductionProject.openReadOnly(fixture.root),
        film,
      )
        .lint({ scope: "review" })
        .diagnostics.filter((entry) => entry.target.startsWith("library:")),
    };
  } finally {
    fixture.dispose();
  }
};

/**
 * The compiler-facing consumer closes every active library design owner against
 * a finite, current observation while preserving film and brief semantics.
 *
 * Scenarios:
 *
 * 1. Model, space, material, instance, motion, and system plans expose exact
 *    current identities; fixed turntables, artifacts, and facts pay them.
 * 2. Design, source, compile, plan, artifact, runtime, or view changes make the
 *    exact owner or observation fail rather than trusting a receipt assertion.
 * 3. Missing, malformed, duplicate, unbound, or unreadable plans and sources
 *    fail closed at their exact graph-derived branch or H2 address.
 * 4. An active empty branch and an unreviewed design/source branch cannot pass.
 * 5. Film, brief, design, and source scopes stay outside the library gate, so
 *    unused film recipes and disabled residue acquire no observation tax.
 */
export const test_production_library_review_evidence_consumer = (): void => {
  const compiler = compilerProbe();
  const state = project();
  const binding = authoring();
  writePlans(state);
  const unpaid = consumer.readAutoMovieLibraryReviewRequirements({
    authoring: binding,
    project: state,
    compileFingerprint: COMPILE,
  });
  payPlans(state, binding);
  const complete = consumer.libraryReviewEvidenceConsumerDiagnostics(
    props(state, binding),
  );
  const sourceChanged = diagnose((changed) =>
    changed.source.set(sourcePath("motions"), Buffer.from("changed", "utf8")),
  );
  const designChanged = diagnose((_changed, changedBinding) => {
    const target = changedBinding.designOwners.find(
      (entry) => entry.branch === "systems",
    )!;
    (target.units[0] as { digest: string }).digest = "b".repeat(64);
  });
  const planChanged = diagnose((changed) => {
    changed.source.set("src/spaces/support.ts", Buffer.from("support", "utf8"));
    const plan = JSON.parse(changed.prose.get(reviewPath("spaces"))!);
    plan.units[0].sources.push("src/spaces/support.ts");
    changed.prose.set(reviewPath("spaces"), JSON.stringify(plan));
  });
  const artifactChanged = diagnose((changed) =>
    changed.render.set(
      "observations/material.png",
      Buffer.from("new pixels", "utf8"),
    ),
  );
  const missingViewState = project();
  writePlans(missingViewState);
  payPlans(missingViewState);
  const missingViews = consumer.libraryReviewEvidenceConsumerDiagnostics({
    ...props(missingViewState),
    captured: () => [{ time: 0, pass: "beauty" }],
  });
  const noModel = consumer.libraryReviewEvidenceConsumerDiagnostics({
    ...props(missingViewState),
    modelExists: () => false,
  });
  const emptyBranchBinding = authoring();
  (emptyBranchBinding.designOwners as IAutoMovieProductionEvidenceDesignOwner[]) =
    emptyBranchBinding.designOwners.filter(
      (entry) => entry.branch !== "materials",
    );
  const emptyBranchState = project();
  writePlans(emptyBranchState);
  payPlans(emptyBranchState, emptyBranchBinding);
  const emptyBranch = consumer.libraryReviewEvidenceConsumerDiagnostics(
    props(emptyBranchState, emptyBranchBinding),
  );
  const unreviewed = authoring();
  (unreviewed.designBranches[0] as { designStage: string }).designStage =
    "evidence";
  (unreviewed.designBranches[1]!.sourceBinding as { stage: string }).stage =
    "evidence";
  (
    unreviewed.designBranches[2]!.sourceBinding as { enforced: boolean }
  ).enforced = false;
  const unreviewedState = project();
  writePlans(unreviewedState);
  const unreviewedDiagnostics =
    consumer.libraryReviewEvidenceConsumerDiagnostics(
      props(unreviewedState, unreviewed),
    );
  const malformedState = project();
  writePlans(malformedState);
  malformedState.prose.set(reviewPath("models"), "{");
  malformedState.prose.set(
    reviewPath("spaces"),
    JSON.stringify({ version: 2 }),
  );
  malformedState.prose.delete(reviewPath("systems"));
  const malformed = consumer.readAutoMovieLibraryReviewRequirements({
    authoring: binding,
    project: malformedState,
    compileFingerprint: COMPILE,
  });
  const invalidState = project();
  writePlans(invalidState);
  const invalidPlan = JSON.parse(
    invalidState.prose.get(reviewPath("motions"))!,
  );
  invalidPlan.units[0].sources = [
    "",
    sourcePath("motions"),
    sourcePath("motions"),
    "src\\motions\\bad.ts",
    "src/models/modelOwner.ts",
    "src/motions/support.ts",
  ];
  invalidPlan.units[0].observations[0].model = "not-a-turntable";
  invalidState.prose.set(reviewPath("motions"), JSON.stringify(invalidPlan));
  const missingSource = invalidState.source.delete("src/motions/support.ts");
  const invalidModelPlan = JSON.parse(
    invalidState.prose.get(reviewPath("models"))!,
  );
  invalidModelPlan.units[0].observations[0].model = " ";
  invalidState.prose.set(
    reviewPath("models"),
    JSON.stringify(invalidModelPlan),
  );
  const duplicateUnitPlan = JSON.parse(
    invalidState.prose.get(reviewPath("instances"))!,
  );
  duplicateUnitPlan.units.push(duplicateUnitPlan.units[0]);
  invalidState.prose.set(
    reviewPath("instances"),
    JSON.stringify(duplicateUnitPlan),
  );
  const missingUnitPlan = JSON.parse(
    invalidState.prose.get(reviewPath("materials"))!,
  );
  missingUnitPlan.units[0].anchor = "another-owner";
  invalidState.prose.set(
    reviewPath("materials"),
    JSON.stringify(missingUnitPlan),
  );
  const invalid = consumer.readAutoMovieLibraryReviewRequirements({
    authoring: binding,
    project: invalidState,
    compileFingerprint: COMPILE,
  });
  const wrongRoot = consumer.libraryReviewEvidenceConsumerDiagnostics({
    ...props(state, binding),
    project: { ...state, root: "C:/other-project" },
  });
  const nonLibraryRequirements =
    consumer.readAutoMovieLibraryReviewRequirements({
      authoring: authoring("film"),
      project: state,
      compileFingerprint: COMPILE,
    });

  TestValidator.equals(
    "library authoring truth is consumed by one current finite review gate",
    namedFacts([
      [
        "exactDerivedPopulation",
        () =>
          unpaid.branches.join(",") === branches.join(",") &&
          unpaid.owners.length === branches.length &&
          unpaid.turntables[0]?.model === "chair" &&
          unpaid.receipts.length === 0,
      ],
      ["allDomainEvidenceComplete", () => complete.length === 0],
      [
        "compilerAndOpenApiRunTheSameLibraryGate",
        () =>
          compiler.openedLibraryDiagnostics.length === branches.length &&
          compiler.openedLibraryDiagnostics.every((entry) =>
            entry.message.includes("selects no design owner"),
          ) &&
          compiler.directFilmLibraryDiagnostics.length === 0,
      ],
      [
        "sourceChangeStalesExactOwner",
        () =>
          sourceChanged.some(
            (entry) =>
              entry.target.includes("motions") &&
              entry.message.includes("stale"),
          ),
      ],
      [
        "designChangeStalesExactOwner",
        () =>
          designChanged.some(
            (entry) =>
              entry.target.includes("systems") &&
              entry.message.includes("stale"),
          ),
      ],
      [
        "planChangeStalesExactOwner",
        () =>
          planChanged.some(
            (entry) =>
              entry.target.includes("spaces") &&
              entry.message.includes("stale"),
          ),
      ],
      [
        "artifactDigestIsReopened",
        () =>
          artifactChanged.some(
            (entry) =>
              entry.target.includes("materials") &&
              entry.message.includes("does not reopen"),
          ),
      ],
      [
        "turntableNeedsEveryCanonicalView",
        () =>
          missingViews.some(
            (entry) =>
              entry.target.includes("models") &&
              entry.message.includes("does not reopen"),
          ),
      ],
      [
        "turntableNeedsCompiledModel",
        () =>
          noModel.some(
            (entry) =>
              entry.target.includes("models") &&
              entry.message.includes("does not reopen"),
          ),
      ],
      [
        "activeEmptyBranchRefused",
        () =>
          emptyBranch.some(
            (entry) =>
              entry.target === "library:materials" &&
              entry.message.includes("selects no design owner"),
          ),
      ],
      [
        "unreviewedBranchesRefused",
        () =>
          unreviewedDiagnostics.filter((entry) =>
            entry.message.includes("rather than review"),
          ).length === 1 &&
          unreviewedDiagnostics.filter((entry) =>
            entry.message.includes("no enforced reviewed source lineage"),
          ).length === 2,
      ],
      [
        "missingMalformedAndWrongVersionPlansRefused",
        () =>
          malformed.diagnostics.some((entry) =>
            entry.message.includes("not readable JSON"),
          ) &&
          malformed.diagnostics.some((entry) =>
            entry.message.includes("exact version-1 schema"),
          ) &&
          malformed.diagnostics.some((entry) =>
            entry.message.includes("has no adjacent finite observation plan"),
          ),
      ],
      ["missingSourceWasExercised", () => missingSource === false],
      [
        "invalidSourcesPlansAndKindsRefused",
        () =>
          [
            "empty, non-POSIX, or duplicate source address",
            "outside the active manifest-derived",
            "cannot reopen source",
            "carries a model field",
            "names no compiled model",
            "has 2 matching unit plans",
            "has 0 matching unit plans",
          ].every((phrase) =>
            invalid.diagnostics.some((entry) => entry.message.includes(phrase)),
          ),
      ],
      [
        "foreignAuthoringSnapshotRefused",
        () =>
          wrongRoot[0]?.target === "library:authoring-binding" &&
          wrongRoot[0]?.message.includes("compiler project") === true,
      ],
      [
        "filmBriefAndEarlierScopesRemainUnchanged",
        () =>
          nonLibraryRequirements.owners.length === 0 &&
          consumer.libraryReviewEvidenceConsumerDiagnostics({
            ...props(state, authoring("film")),
          }).length === 0 &&
          consumer.libraryReviewEvidenceConsumerDiagnostics({
            ...props(state, authoring("brief")),
          }).length === 0 &&
          consumer.libraryReviewEvidenceConsumerDiagnostics({
            ...props(state),
            scope: "design",
          }).length === 0 &&
          consumer.libraryReviewEvidenceConsumerDiagnostics({
            ...props(state),
            scope: "source",
          }).length === 0,
      ],
    ]),
    {
      exactDerivedPopulation: true,
      allDomainEvidenceComplete: true,
      compilerAndOpenApiRunTheSameLibraryGate: true,
      sourceChangeStalesExactOwner: true,
      designChangeStalesExactOwner: true,
      planChangeStalesExactOwner: true,
      artifactDigestIsReopened: true,
      turntableNeedsEveryCanonicalView: true,
      turntableNeedsCompiledModel: true,
      activeEmptyBranchRefused: true,
      unreviewedBranchesRefused: true,
      missingMalformedAndWrongVersionPlansRefused: true,
      missingSourceWasExercised: true,
      invalidSourcesPlansAndKindsRefused: true,
      foreignAuthoringSnapshotRefused: true,
      filmBriefAndEarlierScopesRemainUnchanged: true,
    },
  );
};
