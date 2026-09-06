import type {
  AutoMovieContentDigest,
  IAutoMovieCompileProjectOutput,
  IAutoMovieDiagnostic,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";

type Snapshot<Population> = {
  compilation: IAutoMovieCompileProjectOutput;
  population: Population;
};
const runtime = loadSourceModule<{
  readLibraryReviewAuthoring: <
    Authoring extends { manifest: { kind: unknown } },
  >(
    read: () => Authoring,
  ) => Authoring;
  readCurrentLibraryReview: <Authoring, Population>(props: {
    readAuthoring: () => Authoring;
    compile: (
      authoring: Authoring,
      current: () => Authoring,
    ) => IAutoMovieCompileProjectOutput;
    population: (
      authoring: Authoring,
      fingerprint: AutoMovieContentDigest,
    ) => Population;
  }) => Snapshot<Population>;
  assertCurrentLibraryReview: <Population>(props: {
    expected: Snapshot<Population>;
    read: () => Snapshot<Population>;
  }) => void;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/libraryReviewCurrentness.ts",
  ),
);
const FIRST: AutoMovieContentDigest = `sha256:${"a".repeat(64)}`;
const SECOND: AutoMovieContentDigest = `sha256:${"b".repeat(64)}`;

/**
 * Library observations retain one successful compile and exact current plan.
 *
 * Scenarios:
 *
 * 1. An unchanged source forwards its live reader, preserves warning diagnostics,
 *    and publishes only after a second matching read.
 * 2. Invalid or missing source, missing/stale/tampered generated output, and a
 *    compiler input race preserve their exact failure before topology is read.
 * 3. A target edit during population inspection refuses mixed authoring state.
 * 4. A new valid source with identical observation ids, a changed plan, and a
 *    failed final check leave the supplied publication callback uncalled.
 * 5. A reader exception and an empty unchanged population retain their distinct
 *    error and success outcomes without any filesystem or compiler fixture.
 * 6. Every reopened reader checks library admission, including a kind change
 *    after an earlier successful library read and an unselected null kind.
 */
export const test_cli_library_review_currentness = (): void => {
  let kind: string | null = "library";
  const readKind = () =>
    runtime.readLibraryReviewAuthoring(() => ({ manifest: { kind } }));
  TestValidator.equals(
    "library reader preserves admitted evidence",
    readKind(),
    { manifest: { kind: "library" } },
  );
  kind = "film";
  TestValidator.equals(
    "later nonlibrary selection is refused",
    throwsError(readKind, 'not "film"'),
    true,
  );
  kind = null;
  TestValidator.equals(
    "unselected library kind is refused",
    throwsError(readKind, "not null"),
    true,
  );
  let source = FIRST;
  let target = "reviewed-target";
  let plan = "plan-one";
  let failure: IAutoMovieDiagnostic | undefined;
  let populationReads = 0;
  let publications = 0;
  let forwarded = false;
  let changeDuringPopulation = false;
  const warning: IAutoMovieDiagnostic = {
    code: "review-evidence-missing",
    category: "warning",
    phase: "review",
    target: "library",
    path: null,
    message: "Open the declared views.",
  };
  const readAuthoring = () => ({ source, target });
  const read = () =>
    runtime.readCurrentLibraryReview({
      readAuthoring,
      compile: (authoring, current): IAutoMovieCompileProjectOutput => {
        forwarded =
          current === readAuthoring && current().source === authoring.source;
        return {
          success: failure === undefined,
          revision: 1,
          compiler: { version: "unit", inputFingerprint: source },
          diagnostics: failure === undefined ? [warning] : [failure],
          materialized: [],
        };
      },
      population: (authoring, fingerprint) => {
        populationReads += 1;
        TestValidator.equals(
          "topology receives the checked source",
          fingerprint,
          authoring.source,
        );
        if (changeDuringPopulation) target = "changed-target";
        return {
          owners: [{ observation: "same-observation", plan }],
          fingerprint,
        };
      },
    });
  const initial = read();
  const publish = (): void => {
    runtime.assertCurrentLibraryReview({ expected: initial, read });
    publications += 1;
  };
  TestValidator.equals("live reader reaches compiler", forwarded, true);
  TestValidator.equals(
    "successful compile warnings remain visible",
    initial.compilation.diagnostics,
    [warning],
  );
  publish();
  TestValidator.equals("unchanged basis publishes", publications, 1);
  const failures: IAutoMovieDiagnostic["code"][] = [
    "source-execution-failed",
    "source-path-missing",
    "generated-manifest-missing",
    "generated-stale",
    "generated-tampered",
    "compile-input-changed",
  ];
  for (const code of failures) {
    failure = {
      code,
      category: "error",
      phase: "source",
      target: "owner",
      path: "src/owner.ts",
      message: `Repair ${code} before observation.`,
    };
    const before = populationReads;
    TestValidator.equals(
      `${code} preserves the actual compiler diagnostic`,
      throwsError(read, JSON.stringify([failure])),
      true,
    );
    TestValidator.equals(
      `${code} never reads old topology`,
      populationReads,
      before,
    );
    TestValidator.equals(
      `${code} refuses before publication`,
      throwsError(publish, code),
      true,
    );
  }
  failure = undefined;
  changeDuringPopulation = true;
  TestValidator.equals(
    "target race refuses mixed state",
    throwsError(read, "authoring changed"),
    true,
  );
  changeDuringPopulation = false;
  target = "reviewed-target";
  source = SECOND;
  TestValidator.equals(
    "valid new source cannot inherit same-id observation",
    throwsError(publish, "changed before publication"),
    true,
  );
  source = FIRST;
  plan = "plan-two";
  TestValidator.equals(
    "plan replacement refuses publication",
    throwsError(publish, "changed before publication"),
    true,
  );
  TestValidator.equals(
    "all refused observations leave sidecars untouched",
    publications,
    1,
  );
  TestValidator.equals(
    "reader failures retain their cause",
    throwsError(
      () =>
        runtime.assertCurrentLibraryReview({
          expected: initial,
          read: () => {
            throw new Error("reader unavailable");
          },
        }),
      "reader unavailable",
    ),
    true,
  );
  const empty = {
    compilation: initial.compilation,
    population: [] as string[],
  };
  runtime.assertCurrentLibraryReview({
    expected: empty,
    read: () => ({ ...empty, population: [] }),
  });
};
