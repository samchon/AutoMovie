import type {
  AutoMovieContentDigest,
  IAutoMovieBuildProjectOutput,
  IAutoMovieDiagnostic,
} from "@automovie/interface";
import { digestAutoMovieBytes } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";

const runtime = loadSourceModule<{
  readProductionPublicationInputFingerprint: <Authoring>(props: {
    snapshot: Readonly<Record<string, unknown>>;
    currentAuthoringEvidence?: () => Authoring;
    compile: (
      authoring: Authoring | undefined,
      current: (() => Authoring) | undefined,
    ) => Pick<
      IAutoMovieBuildProjectOutput,
      "success" | "builder" | "diagnostics"
    >;
  }) => AutoMovieContentDigest;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/productionPublicationSnapshot.ts",
  ),
);

/**
 * Terminal snapshots reopen reviewed authoring even when source bytes stay fixed.
 *
 * Scenarios:
 *
 * 1. Repeated reads of unchanged source and reviewed owners have equal identity.
 * 2. A target-only edit returns a stale reviewed owner from the injected reader
 *    and changes the publication identity without replacing source bytes.
 * 3. A source edit independently changes identity; source failure retains its
 *    diagnostic instead of producing a success-shaped fingerprint.
 * 4. An omitted reader remains omitted at the timed compile seam, while a
 *    throwing reader prevents compilation and preserves the actual error.
 */
export const test_production_publication_fresh_authoring = (): void => {
  let source = "unchanged source bytes";
  let reviewed = true;
  let compiled = 0;
  let fail = false;
  const seen: Array<boolean | undefined> = [];
  const diagnostic: IAutoMovieDiagnostic = {
    code: "source-owner-mismatch",
    category: "error",
    phase: "source",
    target: "shot",
    path: "src/shot.ts",
    message: "The current target review is stale.",
  };
  const currentAuthoringEvidence = () => ({ sourceOwners: [{ reviewed }] });
  const compile = (
    authoring: ReturnType<typeof currentAuthoringEvidence> | undefined,
    current: typeof currentAuthoringEvidence | undefined,
  ): IAutoMovieBuildProjectOutput => {
    compiled += 1;
    seen.push(authoring?.sourceOwners[0]?.reviewed);
    TestValidator.equals(
      "live reader forwarding is exact",
      current ===
        (authoring === undefined ? undefined : currentAuthoringEvidence),
      true,
    );
    return {
      success: !fail,
      revision: 1,
      builder: {
        version: "unit",
        inputFingerprint: digestAutoMovieBytes(
          Buffer.from(JSON.stringify({ source, authoring })),
        ),
      },
      diagnostics: fail ? [diagnostic] : [],
      materialized: [],
    };
  };
  const read = () =>
    runtime.readProductionPublicationInputFingerprint({
      snapshot: { generated: "same compiled bytes" },
      currentAuthoringEvidence,
      compile,
    });
  const initial = read();
  TestValidator.equals("unchanged publication identity", read(), initial);
  reviewed = false;
  const changedTarget = read();
  TestValidator.equals(
    "fresh target review changes identity",
    changedTarget !== initial,
    true,
  );
  TestValidator.equals("builder sees current reviewed state", seen, [
    true,
    true,
    false,
  ]);
  reviewed = true;
  source = "changed source bytes";
  TestValidator.equals(
    "source edit changes identity separately",
    read() !== initial,
    true,
  );
  fail = true;
  TestValidator.equals(
    "source refusal retains full diagnostic",
    throwsError(read, JSON.stringify([diagnostic])),
    true,
  );
  fail = false;
  runtime.readProductionPublicationInputFingerprint({ snapshot: {}, compile });
  TestValidator.equals(
    "timed builder missing reader retains its fallback input",
    seen.at(-1),
    undefined,
  );
  const before = compiled;
  TestValidator.equals(
    "reader failure propagates",
    throwsError(
      () =>
        runtime.readProductionPublicationInputFingerprint({
          snapshot: {},
          currentAuthoringEvidence: () => {
            throw new Error("target unavailable");
          },
          compile,
        }),
      "target unavailable",
    ),
    true,
  );
  TestValidator.equals("reader failure prevents a compile", compiled, before);
};
