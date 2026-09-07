import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import type {
  AutoMovieContentDigest,
  IAutoMovieDiagnostic,
  IAutoMovieLibraryReviewPlanFile,
  IAutoMovieLibraryReviewPopulation,
  IAutoMovieLibraryReviewProjectReader,
} from "@automovie/interface";
import {
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import {
  type ILibraryPublicationFile,
  type ILibraryPublicationIO,
  createLibraryPublicationFixture,
} from "../internal/libraryReviewPublicationFixture";
import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";

interface IResolver {
  authoring: IAutoMovieProductionEvidence;
  project: IAutoMovieLibraryReviewProjectReader;
  compileFingerprint: AutoMovieContentDigest;
}
const consumer = loadSourceModule<{
  readAutoMovieLibraryReviewRequirements(
    props: IResolver,
  ): IAutoMovieLibraryReviewPopulation;
  libraryReviewEvidenceConsumerDiagnostics(
    props: IResolver & {
      scope: "design" | "source" | "review" | "final";
      modelExists: () => boolean;
      rigged: () => boolean;
      fingerprint: () => null;
      captured: () => [];
    },
  ): IAutoMovieDiagnostic[];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/libraryReviewEvidenceConsumer.ts",
  ),
);
const admission = loadSourceModule<{
  createLibraryReviewPublicationAdmissionReader(props: {
    project: IAutoMovieLibraryReviewProjectReader;
    target: string;
    before: ILibraryPublicationFile | null;
    pending: { path: string; file: ILibraryPublicationFile } | null;
    io: ILibraryPublicationIO;
  }): IAutoMovieLibraryReviewProjectReader;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/libraryReviewPublicationAdmission.ts",
  ),
);

/**
 * A pending physical publication is never consumed as a completed library review.
 *
 * Scenarios:
 *
 * 1. An unchanged sidecar with a current passed facts receipt closes review and final.
 * 2. Empty, malformed, unreadable and non-file pending entries refuse installed
 *    receipts, preserving the original read failure and addressed recovery reason.
 * 3. A pending entry appearing during the plan read refuses that same population.
 * 4. Missing first-authorship plans remain distinct from interrupted publication;
 *    source/design and non-library review remain outside this physical review gate.
 * 5. The real publisher can reread its unchanged population during admission,
 *    while failed finalization leaves the installed valid receipt unconsumable.
 */
export const test_production_library_review_pending_publication = (): void => {
  const root = "C:/library-pending-unit";
  const design = "docs/systems/controller.md";
  const target = "docs/systems/controller.review.json";
  const pending = `${target}.pending`;
  const source = "src/systems/controller.ts";
  const binding = {
    branch: "systemSources",
    stage: "review",
    enforced: true,
    root: "src",
    files: ["src/systems/**/*.ts"],
    symbols: ["systems"],
    paths: [source],
  };
  const authoring = {
    root,
    manifest: { kind: "library" },
    designBranches: [
      { branch: "systems", designStage: "review", sourceBinding: binding },
    ],
    designOwners: [
      {
        branch: "systems",
        path: design,
        units: [{ anchor: "controller", digest: "a".repeat(64) }],
        sourceBinding: binding,
      },
    ],
  } as unknown as IAutoMovieProductionEvidence;
  const plan: IAutoMovieLibraryReviewPlanFile = {
    version: 1,
    units: [
      {
        anchor: "controller",
        sources: [source],
        observations: [{ id: "state", evidence: "facts" }],
        receipts: [],
      },
    ],
  };
  const files = new Map([[target, JSON.stringify(plan)]]);
  let afterRead = (): void => {};
  let readFailure: Error | undefined;
  const project: IAutoMovieLibraryReviewProjectReader = {
    root,
    readProseDocument: (relative) => {
      if (relative === pending && readFailure !== undefined) throw readFailure;
      const text = files.get(relative) ?? null;
      if (relative === target) afterRead();
      return text;
    },
    readSource: () => Buffer.from("export const controller = true;\n"),
    readRenderFile: () => {
      throw new Error("no render artifact is required");
    },
  };
  const props: IResolver = {
    authoring,
    project,
    compileFingerprint: `sha256:${"b".repeat(64)}` as AutoMovieContentDigest,
  };
  const read = () => consumer.readAutoMovieLibraryReviewRequirements(props);
  const diagnostics = (scope: "design" | "source" | "review" | "final") =>
    consumer.libraryReviewEvidenceConsumerDiagnostics({
      ...props,
      scope,
      modelExists: () => false,
      rigged: () => false,
      fingerprint: () => null,
      captured: () => [],
    });
  const facts = { state: "closed" };
  plan.units[0]!.receipts.push({
    observation: "state",
    identity: read().owners[0]!.identity,
    evidence: {
      kind: "facts",
      facts,
      digest: digestAutoMovieBytes(canonicalAutoMovieJsonBytes(facts)),
    },
    runtimeIdentity: "unit:controller:1",
    pose: null,
    measurements: {},
    verdict: "passed",
  });
  files.set(target, JSON.stringify(plan));
  TestValidator.equals("current completed review", diagnostics("review"), []);
  TestValidator.equals("current completed final", diagnostics("final"), []);
  const refuse = (reason: string): void => {
    const population = read();
    TestValidator.equals(
      "pending contributes no completed receipts",
      population.receipts,
      [],
    );
    TestValidator.equals(
      "pending reason survives population and both review scopes",
      [population.diagnostics, diagnostics("review"), diagnostics("final")].map(
        (items) =>
          items.some(
            (item) =>
              item.code === "review-evidence-missing" &&
              item.path === target &&
              item.message.includes(reason),
          ),
      ),
      [true, true, true],
    );
  };
  for (const marker of ["", "not JSON", '{"version":1}']) {
    files.set(pending, marker);
    refuse(pending);
  }
  TestValidator.equals(
    "first compile does not require completed observations",
    [diagnostics("design"), diagnostics("source")],
    [[], []],
  );
  for (const kind of ["film", "brief"] as const) {
    props.authoring = {
      ...authoring,
      manifest: { ...authoring.manifest, kind },
    };
    TestValidator.equals(
      "timed productions ignore library publication residue",
      diagnostics("review"),
      [],
    );
  }
  props.authoring = authoring;
  files.delete(pending);
  project.proseDocumentExists = (relative) => relative === pending;
  refuse(pending); // Directory or dangling-link entry with no readable text.
  project.proseDocumentExists = () => false;
  TestValidator.equals(
    "safe physical absence accepts the sidecar",
    diagnostics("review"),
    [],
  );
  files.set(pending, "late marker after physical existence read");
  refuse(pending);
  files.delete(pending);
  project.proseDocumentExists = () => {
    throw new Error("pending ancestor replaced");
  };
  refuse("pending ancestor replaced");
  delete project.proseDocumentExists;
  readFailure = new Error("pending descriptor is unreadable");
  refuse("pending descriptor is unreadable");
  readFailure = undefined;
  afterRead = () => files.set(pending, "arrived during plan read");
  refuse(pending);
  afterRead = () => {};
  files.delete(pending);
  files.delete(target);
  TestValidator.equals(
    "first authorship keeps the missing-plan diagnosis",
    read().diagnostics.map((item) =>
      item.message.includes("no adjacent finite observation plan"),
    ),
    [true],
  );
  files.set(pending, "interrupted initial publication");
  refuse(pending);
  for (const finalizationFails of [false, true]) {
    const before = {
      identity: "approved",
      version: "1",
      source: JSON.stringify(plan),
    };
    const fixture = createLibraryPublicationFixture(before, target);
    props.project = {
      ...project,
      readProseDocument: (relative) =>
        fixture.files.get(relative)?.source ?? null,
    };
    const expected = read();
    const admitted: IAutoMovieLibraryReviewPopulation[] = [];
    if (finalizationFails)
      fixture.hook((event) => {
        if (event.kind === "move" && event.target?.endsWith(".completed"))
          throw new Error("cannot finalize publication");
      });
    const publish = () =>
      fixture.run((ownedPending) => {
        admitted.push(
          consumer.readAutoMovieLibraryReviewRequirements({
            ...props,
            project: admission.createLibraryReviewPublicationAdmissionReader({
              project: props.project,
              target,
              before,
              pending: ownedPending,
              io: fixture.io,
            }),
          }),
        );
      }, `${before.source}\n`);
    if (finalizationFails)
      TestValidator.equals(
        "the publisher reports incomplete finalization",
        throwsError(publish, "cannot finalize publication"),
        true,
      );
    else
      TestValidator.equals("the publisher completes", publish(), "published");
    TestValidator.equals(
      "both real admissions reopen the same valid population",
      admitted,
      [expected, expected],
    );
    TestValidator.equals(
      "valid successor bytes were installed",
      props.project.readProseDocument(target),
      `${before.source}\n`,
    );
    if (finalizationFails) refuse(pending);
    else
      TestValidator.equals(
        "settled successor closes final",
        diagnostics("final"),
        [],
      );
  }
};
