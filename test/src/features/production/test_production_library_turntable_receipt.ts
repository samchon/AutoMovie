import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import type {
  AutoMovieContentDigest,
  IAutoMovieDiagnostic,
  IAutoMovieLibraryReviewPopulation,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";
import {
  LIBRARY_MODEL,
  LIBRARY_MODEL_ANCHOR,
  LIBRARY_MODEL_OWNER,
  LIBRARY_MODEL_PLAN,
  LIBRARY_MODEL_SOURCE,
  LIBRARY_SOURCE,
  libraryAuthoring,
  libraryFixture,
  librarySourceModule,
} from "./libraryFixtures";

const consumer = loadSourceModule<{
  readAutoMovieLibraryReviewRequirements: (props: {
    authoring: IAutoMovieProductionEvidence;
    project: unknown;
    compileFingerprint: AutoMovieContentDigest;
  }) => IAutoMovieLibraryReviewPopulation;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/libraryReviewEvidenceConsumer.ts",
  ),
);

/** The one model the models design owner delivers, as its source publishes it. */
const BENCH = {
  id: LIBRARY_MODEL,
  name: "library fixture bench",
  origin: "generated",
  skeleton: null,
  materials: [],
  parts: [
    {
      id: "seat",
      name: null,
      geometry: {
        type: "primitive",
        shape: { type: "box", width: 1.6, height: 0.45, depth: 0.4 },
      },
      material: null,
      attachedBone: null,
      transform: null,
    },
  ],
  asset: null,
  body: null,
};

/** The models source module, registering the reviewed design owner it realizes. */
const modelSourceModule = (): string =>
  [
    'import type { IAutoMovieLibrarySourceOwner } from "@automovie/interface";',
    "",
    `const BENCH = ${JSON.stringify(BENCH, null, 2)};`,
    "",
    "export const models = {",
    `  design: ${JSON.stringify(LIBRARY_MODEL_OWNER)},`,
    "  build: () => ({ environments: [], models: [BENCH] }),",
    "} satisfies IAutoMovieLibrarySourceOwner;",
    "",
  ].join("\n");

/** One models review plan owing exactly one turntable observation. */
const modelPlan = (receipts: readonly unknown[]): string =>
  `${JSON.stringify(
    {
      version: 1,
      units: [
        {
          anchor: LIBRARY_MODEL_ANCHOR,
          sources: [LIBRARY_MODEL_SOURCE],
          observations: [
            {
              id: "plan-model-turntable",
              evidence: "turntable",
              model: LIBRARY_MODEL,
            },
          ],
          receipts,
        },
      ],
    },
    null,
    2,
  )}\n`;

/**
 * A library compile judges its own turntable receipt through its own bindings.
 *
 * The library path binds `modelExists`, `rigged`, and `fingerprint` to the
 * review-evidence consumer separately from the film path's. Every earlier test
 * that judged the consumer passed its own doubles, and a double stays true
 * wherever it is moved, so those three bindings were asserted by nothing.
 * `fingerprint` was in fact bound to a constant `null`, which made every
 * turntable receipt permanently uncurrent: a plan could name one, the record
 * command could write one, and the compiler answered "does not reopen"
 * forever. It also made the model question beside it unobservable, because no
 * answer it gave could change a verdict.
 *
 * Only a models design owner may plan a turntable at all -- every other branch
 * is refused that evidence kind by domain -- so this is the fixture that
 * reaches the case.
 *
 * Scenarios:
 *
 * 1. A planned turntable with no receipt is unpaid at its own address.
 * 2. A receipt carrying the compile's own current identity is read rather than
 *    reported missing or stale.
 * 3. A receipt naming a model the library did not publish is refused.
 */
export const test_production_library_turntable_receipt = (): void => {
  const fixture = libraryFixture();
  try {
    // The spaces owner keeps its building and stops publishing the bench, so
    // exactly one owner delivers the model the models branch is reviewed on.
    fixture.write(LIBRARY_SOURCE, librarySourceModule({ models: "[]" }));
    fixture.write(LIBRARY_MODEL_SOURCE, modelSourceModule());
    fixture.write(LIBRARY_MODEL_PLAN, modelPlan([]));
    const currentAuthoringEvidence = () =>
      libraryAuthoring({ root: fixture.root, models: true });
    const authoring = currentAuthoringEvidence();
    const compiled = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
      authoring,
      currentAuthoringEvidence,
    ).compile({ scope: "source" });
    const lint = (): IAutoMovieDiagnostic[] =>
      new AutoMovieProductionCompiler(
        AutoMovieProductionProject.openReadOnly(fixture.root),
        currentAuthoringEvidence(),
        currentAuthoringEvidence,
      )
        .lint({ scope: "review" })
        .diagnostics.filter(
          (entry) =>
            entry.target.includes("plan-model-turntable") ||
            entry.target === `asset:${LIBRARY_MODEL}`,
        );
    const unpaid = lint();

    // The identity comes from the product's own reader with the compile's own
    // published fingerprint, never from digests spelled a second time here: a
    // receipt this file computed by hand would prove that this file can do
    // arithmetic and nothing about what the compiler accepts.
    const pay = (model: string): IAutoMovieDiagnostic[] => {
      const population = consumer.readAutoMovieLibraryReviewRequirements({
        authoring,
        project: AutoMovieProductionProject.openReadOnly(fixture.root),
        compileFingerprint: compiled.compiler.inputFingerprint,
      });
      const owner = population.owners.find(
        (entry) => entry.branch === "models",
      )!;
      fixture.write(
        LIBRARY_MODEL_PLAN,
        modelPlan([
          {
            observation: "plan-model-turntable",
            evidence: { kind: "turntable", model },
            identity: owner.identity,
            runtimeIdentity: "playwright:chromium:1",
            pose: null,
            measurements: {},
            verdict: "passed",
          },
        ]),
      );
      return lint();
    };
    const published = pay(LIBRARY_MODEL);
    // A design-scope compile publishes nothing, so it has no generated manifest
    // to resolve a render target against and binds a fingerprint that answers
    // none. It is the scope that takes that branch, and it still reports the
    // population: design does not enforce receipts, so the paid turntable is
    // neither charged nor judged here.
    const designScope = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.openReadOnly(fixture.root),
      currentAuthoringEvidence(),
      currentAuthoringEvidence,
    )
      .lint({ scope: "design" })
      .diagnostics.filter((entry) =>
        entry.target.includes("plan-model-turntable"),
      );
    const absent = pay("no-such-model");

    const says = (
      diagnostics: readonly IAutoMovieDiagnostic[],
      fragment: string,
    ): boolean => diagnostics.some((entry) => entry.message.includes(fragment));

    TestValidator.equals(
      "a library compile judges its own turntable receipt through its own bindings",
      namedFacts([
        ["theSourceCompileSucceeded", () => compiled.success],
        [
          "aPlannedTurntableWithNoReceiptIsUnpaid",
          () => says(unpaid, "has no turntable receipt"),
        ],
        [
          "aCurrentIdentityIsReadRatherThanReportedMissing",
          () =>
            says(published, "has no turntable receipt") === false &&
            says(published, "is stale") === false,
        ],
        [
          "designScopeBindsNoFingerprintAndChargesNothing",
          () => designScope.length === 0,
        ],
        [
          "aReceiptNamingAnotherModelIsRefused",
          () => says(absent, "does not reopen"),
        ],
        [
          // The asset review is the half that says which views are owed, and
          // it can only speak when the render target is addressable. While the
          // library path returned a constant null fingerprint nothing here was
          // addressable, so a library staged a model, planned its turntable,
          // and was told nothing at all about the views it never captured.
          "theOwedTurntableViewsAreNamed",
          () =>
            published.some(
              (entry) =>
                entry.target === `asset:${LIBRARY_MODEL}` &&
                entry.message.includes('"turntable-front" (beauty)') &&
                entry.message.includes('"turntable-back" (beauty)'),
            ),
        ],
      ]),
      {
        theSourceCompileSucceeded: true,
        aPlannedTurntableWithNoReceiptIsUnpaid: true,
        aCurrentIdentityIsReadRatherThanReportedMissing: true,
        designScopeBindsNoFingerprintAndChargesNothing: true,
        aReceiptNamingAnotherModelIsRefused: true,
        theOwedTurntableViewsAreNamed: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
