import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import type { IAutoMovieBuildProjectOutput } from "@automovie/interface";
import type { IAutoMovieProductionDesignGraph } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { productionModule, textDigest } from "./sourceStatusFixtures";

const { createAutoMovieProductionSourceStatus } = loadSourceModule<{
  createAutoMovieProductionSourceStatus(props: {
    project: object;
    builder: {
      lintSource(): {
        output: IAutoMovieBuildProjectOutput;
        documents: ReadonlyArray<{ path: string; content: string | null }>;
        revisionBound: boolean;
      };
    };
    authoringEvidence?: IAutoMovieProductionEvidence;
    currentAuthoringEvidence?: () => IAutoMovieProductionEvidence;
  }): () => IAutoMovieBuildProjectOutput;
}>(productionModule("createAutoMovieProductionSourceStatus.ts"));

/** A project root that does not exist, so its generated root cannot be listed. */
const ROOT = path.join(__dirname, "absent-source-status-project");

const GRAPH: IAutoMovieProductionDesignGraph = {
  production: null,
  models: new Map(),
  world: null,
  formations: new Map(),
  shots: new Map(),
  acceptance: new Map(),
};

const answerOf = (): IAutoMovieBuildProjectOutput => ({
  success: true,
  revision: 5,
  builder: {
    version: "unit",
    inputFingerprint: textDigest("unlisted project"),
  },
  diagnostics: [],
  materialized: [],
});

const projectOf = () => ({
  root: ROOT,
  productionId: "harbor",
  revision: () => 5,
  graph: () => GRAPH,
  readSource: (file: string): Uint8Array => {
    throw new Error(`Source "${file}" does not exist.`);
  },
  contentInputs: () => [],
  manifest: () => ({}),
  screenplayIndex: () => null,
  readProseDocument: () => null,
  generatedManifest: () => null,
  generatedRoot: () => path.join(ROOT, "generated", "harbor"),
  readGeneratedFile: (file: string): Uint8Array => {
    throw new Error(`Generated file "${file}" does not exist.`);
  },
});

/** Film evidence whose kind reads are counted, with no owner edges. */
const countedEvidence = (): {
  evidence: IAutoMovieProductionEvidence;
  reads: () => number;
} => {
  let reads = 0;
  const evidence = {} as IAutoMovieProductionEvidence;
  Object.defineProperty(evidence, "manifest", {
    get: () => {
      reads += 1;
      return { kind: "film" };
    },
  });
  Object.defineProperty(evidence, "sourceOwners", { value: [] });
  return { evidence, reads: () => reads };
};

/**
 * The composed status only reuses what it can read.
 *
 * The composition reads snapshots through the project handle and the builder's
 * own generated-root walk, and judges them against the evidence a compile
 * would read now: the live reader when one is supplied, otherwise the fixed
 * declaration. A builder-owned root that cannot be listed leaves no snapshot,
 * so every call runs the builder's gate and returns its answer.
 *
 * Scenarios:
 *
 * 1. With a live reader, an unlistable generated root runs the gate at both
 *    calls and judges each snapshot against the evidence the reader returns,
 *    never the fixed declaration.
 * 2. Without a live reader, the fixed declaration judges each snapshot and the
 *    gate still runs at both calls.
 */
export const test_production_source_status_composition = (): void => {
  const ANSWER = answerOf();
  const builderOf = () => {
    let runs = 0;
    return {
      builder: {
        lintSource: () => {
          runs += 1;
          return { output: ANSWER, documents: [], revisionBound: false };
        },
      },
      runs: () => runs,
    };
  };

  const liveBuilder = builderOf();
  const liveFixed = countedEvidence();
  const liveRead = countedEvidence();
  const liveStatus = createAutoMovieProductionSourceStatus({
    project: projectOf(),
    builder: liveBuilder.builder,
    authoringEvidence: liveFixed.evidence,
    currentAuthoringEvidence: () => liveRead.evidence,
  });
  const liveAnswers = [liveStatus(), liveStatus()];

  const fixedBuilder = builderOf();
  const fixed = countedEvidence();
  const fixedStatus = createAutoMovieProductionSourceStatus({
    project: projectOf(),
    builder: fixedBuilder.builder,
    authoringEvidence: fixed.evidence,
  });
  const fixedAnswers = [fixedStatus(), fixedStatus()];

  TestValidator.equals(
    "an unlistable generated root runs the gate at every call",
    {
      live: { runs: liveBuilder.runs(), answers: liveAnswers },
      fixed: { runs: fixedBuilder.runs(), answers: fixedAnswers },
    },
    {
      live: { runs: 2, answers: [ANSWER, ANSWER] },
      fixed: { runs: 2, answers: [ANSWER, ANSWER] },
    },
  );
  TestValidator.equals(
    "the live reader, when supplied, is what judges each snapshot",
    {
      liveReaderJudged: liveRead.reads() >= 2,
      liveFixedIgnored: liveFixed.reads() === 0,
      fixedJudged: fixed.reads() >= 2,
    },
    { liveReaderJudged: true, liveFixedIgnored: true, fixedJudged: true },
  );
};
