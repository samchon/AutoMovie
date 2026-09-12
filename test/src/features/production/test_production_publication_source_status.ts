import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import type {
  AutoMovieContentDigest,
  IAutoMovieBuildProjectOutput,
  IAutoMovieGeneratedManifest,
} from "@automovie/interface";
import type { IAutoMovieProductionDesignGraph } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";
import {
  SOURCE_FAILURE,
  createSourceStatusWorld,
  fingerprintOf,
  productionModule,
  textDigest,
} from "./sourceStatusFixtures";

const { productionPublicationInputFingerprint } = loadSourceModule<{
  productionPublicationInputFingerprint(
    project: object,
    currentAuthoringEvidence?: () => IAutoMovieProductionEvidence,
    sourceStatus?: () => IAutoMovieBuildProjectOutput,
  ): AutoMovieContentDigest;
}>(productionModule("productionPublicationSnapshot.ts"));

const GRAPH: IAutoMovieProductionDesignGraph = {
  production: null,
  models: new Map(),
  world: null,
  formations: new Map(),
  shots: new Map(),
  acceptance: new Map(),
};

/** A project store whose publication state follows one in-memory world. */
const projectOf = (world: ReturnType<typeof createSourceStatusWorld>) => ({
  revision: () => world.state.revision,
  projectStateRecords: () => ({
    incarnation: Buffer.from("harbor incarnation 1", "utf8"),
  }),
  manifest: () => ({ projectId: "harbor", formatVersion: 2 }),
  graph: () => GRAPH,
  generatedManifest: (): IAutoMovieGeneratedManifest => ({
    version: 1,
    builder: { packageVersion: "0.1.0", protocolVersion: "unit" },
    inputFingerprint: fingerprintOf(world.state.compiled),
    files: [
      {
        path: "shots/opening.json",
        owner: "builder",
        digest: textDigest(world.state.generated),
        sourceTargets: ["shot:opening"],
      },
    ],
  }),
  readGeneratedFile: () => Buffer.from(world.state.generated, "utf8"),
});

/**
 * A terminal publication's repeated input checks share one retained gate answer.
 *
 * A publication fingerprints its inputs when it takes its snapshot and again on
 * each side of the commit lock, and each fingerprint includes a successful
 * current source compile. With the project's retained source status, the three
 * fingerprints of an unchanged project agree while the gate runs once. A source
 * edit and compile between them must move the fingerprint through a new run, an
 * invalid source must refuse with the gate's own diagnostics, and a publication
 * without a retained status keeps reading the live authoring evidence first.
 *
 * Scenarios:
 *
 * 1. A snapshot and two lock-side checks of an unchanged project give one
 *    fingerprint and run the gate once.
 * 2. A compiled source edit between the snapshot and a check runs the gate once
 *    more and moves the fingerprint.
 * 3. An invalid current source refuses the fingerprint with its diagnostic.
 * 4. Without a retained status, a failing live authoring reader propagates its
 *    error before any builder runs.
 */
export const test_production_publication_source_status = (): void => {
  const world = createSourceStatusWorld();
  const status = world.status();
  const project = projectOf(world);
  const fingerprint = () =>
    productionPublicationInputFingerprint(project, undefined, status);
  const snapshot = fingerprint();
  const runsAtSnapshot = world.counts.evaluations;
  const checks = [fingerprint(), fingerprint()];
  TestValidator.equals(
    "an unchanged publication takes one gate run for all three checks",
    { runsAtSnapshot, checks, runsAfterChecks: world.counts.evaluations },
    { runsAtSnapshot: 1, checks: [snapshot, snapshot], runsAfterChecks: 1 },
  );

  world.state.source = "export const opening = defineShot({ beats: 5 });\n";
  world.compile();
  const moved = fingerprint();
  TestValidator.equals(
    "a compiled source edit moves the fingerprint through one new run",
    { moved: moved !== snapshot, runs: world.counts.evaluations },
    { moved: true, runs: 2 },
  );

  world.state.source = "export const opening = defineShot(undefined);\n";
  world.state.valid = false;
  TestValidator.equals(
    "an invalid current source refuses with its diagnostic",
    throwsError(fingerprint, [
      "requires a successful current source compile",
      SOURCE_FAILURE.message,
    ]),
    true,
  );

  TestValidator.equals(
    "a failing live reader propagates before any builder runs",
    throwsError(
      () =>
        productionPublicationInputFingerprint(project, () => {
          throw new Error("evidence graph unavailable");
        }),
      "evidence graph unavailable",
    ),
    true,
  );
};
