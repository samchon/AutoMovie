import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { namedFacts, throwsError } from "../internal/predicates";
import {
  type IPackWorkspaceDependencies,
  type ITgzModule,
  loadBuildModule,
} from "./loadBuildModule";
import {
  runBuildScenarioChild,
  runWhenBuildScenarioChild,
} from "./runBuildScenarioChild";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const TARGET = path.join(ROOT, "node_modules", ".cache", "refusal-target");

interface IPackAnswer {
  readonly status: number | null;
  readonly stdout: string;
}

const dependencies = (
  answer: IPackAnswer,
  exists = true,
): IPackWorkspaceDependencies => ({
  remove: () => undefined,
  makeDirectory: () => undefined,
  pack: () => answer,
  exists: () => exists,
  read: () => Buffer.from("abc"),
  rename: () => undefined,
  write: () => undefined,
});

const tarball = (name: string): string =>
  `Tarball Details\n${path.join(TARGET, ".tarballs", name)}\n`;

/**
 * `packWorkspace` refuses every way a pack can fail to produce exactly one
 * usable tarball.
 *
 * Each refusal exists because the silent alternative is worse than a crash. A
 * non-zero pack that is not read leaves the previous run's tarball in place and
 * pins a sandbox to stale bytes; an ambiguous report means a prefix match has
 * claimed a sibling's tarball; and a reported path that is not on disk means the
 * digest would be taken over bytes that are not the ones being installed.
 *
 * Scenarios:
 *
 * 1. A non-zero pack status refuses, naming the package that failed. The first
 *    package in the closed set is `@automovie/interface`, so that is the name
 *    the message must carry.
 * 2. A null status, which is what a pack that never started reports, refuses on
 *    the same branch rather than being read as success.
 * 3. Output naming no tarball refuses and states the count it saw.
 * 4. Output naming two tarballs refuses on the same count check, because a
 *    second `.tgz` line means the caller cannot tell which file is the package.
 * 5. A reported tarball that is absent from disk refuses instead of hashing a
 *    missing file.
 * 6. The positive twin: exactly one reported and present tarball at status zero
 *    does not throw, so none of the refusals above is over-matching.
 */
const assertBuildTgzPackRefusals = async (): Promise<void> => {
  const { packWorkspace } = await loadBuildModule<ITgzModule>("tgz.ts");
  const one = tarball("automovie-interface-0.1.0.tgz");
  TestValidator.equals(
    "packWorkspace refuses every unusable pack result",
    namedFacts([
      [
        "non-zero status refuses",
        () =>
          throwsError(
            () =>
              packWorkspace(TARGET, dependencies({ status: 1, stdout: one })),
            "pnpm pack failed for @automovie/interface",
          ),
      ],
      [
        "null status refuses",
        () =>
          throwsError(
            () =>
              packWorkspace(
                TARGET,
                dependencies({ status: null, stdout: one }),
              ),
            "pnpm pack failed for @automovie/interface",
          ),
      ],
      [
        "no reported tarball refuses",
        () =>
          throwsError(
            () =>
              packWorkspace(
                TARGET,
                dependencies({ status: 0, stdout: "Tarball Details\n" }),
              ),
            "pnpm pack named 0 tarballs for @automovie/interface; expected one.",
          ),
      ],
      [
        "two reported tarballs refuse",
        () =>
          throwsError(
            () =>
              packWorkspace(
                TARGET,
                dependencies({
                  status: 0,
                  stdout: `${one}${tarball("automovie-engine-0.1.0.tgz")}`,
                }),
              ),
            "pnpm pack named 2 tarballs for @automovie/interface; expected one.",
          ),
      ],
      [
        "absent tarball refuses",
        () =>
          throwsError(
            () =>
              packWorkspace(
                TARGET,
                dependencies({ status: 0, stdout: one }, false),
              ),
            "pnpm pack reported a missing tarball for @automovie/interface",
          ),
      ],
      [
        "one present tarball is accepted",
        () =>
          throwsError(() =>
            packWorkspace(TARGET, dependencies({ status: 0, stdout: one })),
          ) === false,
      ],
    ]),
    {
      "non-zero status refuses": true,
      "null status refuses": true,
      "no reported tarball refuses": true,
      "two reported tarballs refuse": true,
      "absent tarball refuses": true,
      "one present tarball is accepted": true,
    },
  );
};

/** Exercise every unusable pack result through a runner that can load the build tools. */
export const test_build_tgz_pack_refusals = (): void => {
  runBuildScenarioChild(__filename, "test_build_tgz_pack_refusals");
};

runWhenBuildScenarioChild(
  "test_build_tgz_pack_refusals",
  assertBuildTgzPackRefusals,
);
