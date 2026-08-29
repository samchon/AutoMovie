import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  buildScratchDirectory,
  preserveBuildScratchCleanup,
} from "./BuildScratchDirectory";
import { type IExperimentalModule, loadBuildModule } from "./loadBuildModule";
import {
  runBuildScenarioChild,
  runWhenBuildScenarioChild,
} from "./runBuildScenarioChild";

/**
 * The sandbox install boundary runs the real `npm install` and reports its
 * status honestly.
 *
 * The installer is `npm` rather than `pnpm` on purpose. `pnpm pack` rewrites each
 * packed package's own `workspace:^` ranges into plain semver, and npm satisfies
 * those transitive ranges from the directly installed siblings while pnpm does
 * not; pnpm's `overrides` do not reach a range from inside a packed tarball
 * either, so the same registry 404 surfaces one package later. That choice only
 * holds if the boundary actually executes, which is what this exercises: a
 * status nobody has ever seen come back non-zero is a status the caller's
 * failure branch was written blind against.
 *
 * The two projects here are self-contained, so neither reaches the network. The
 * point is the boundary's contract with the caller, not npm's resolver.
 *
 * Scenarios:
 *
 * 1. A minimal project installs and returns zero, which is the value the caller
 *    compares against.
 * 2. A project whose manifest npm cannot parse returns a non-zero status rather
 *    than zero or null, so the caller's refusal branch is reachable.
 * 3. The install runs in the directory it was given, proving `cwd` carries the
 *    target rather than the process's own working directory: the installed
 *    lockfile appears under that directory and nowhere else.
 */
const assertBuildExperimentalInstallBoundary = async (): Promise<void> => {
  const { experimentalDependencies } =
    await loadBuildModule<IExperimentalModule>("experimental.ts");
  const scratch = buildScratchDirectory("install-boundary");
  let failure: { error: unknown } | undefined;
  try {
    const good = path.join(scratch, "good");
    const bad = path.join(scratch, "bad");
    fs.mkdirSync(good, { recursive: true });
    fs.mkdirSync(bad, { recursive: true });
    fs.writeFileSync(
      path.join(good, "package.json"),
      `${JSON.stringify(
        { name: "automovie-install-probe", private: true, version: "1.0.0" },
        null,
        2,
      )}\n`,
      "utf8",
    );
    fs.writeFileSync(path.join(bad, "package.json"), "{ not json", "utf8");

    const accepted = experimentalDependencies.install(good);
    const refused = experimentalDependencies.install(bad);

    TestValidator.equals(
      "the install boundary executes npm and reports its status",
      namedFacts([
        ["a minimal project installs", () => accepted === 0],
        [
          "an unparsable manifest fails",
          () => refused !== 0 && refused !== null,
        ],
        [
          "the install ran in the directory it was given",
          () =>
            fs.existsSync(path.join(good, "package-lock.json")) &&
            fs.existsSync(path.join(scratch, "package-lock.json")) === false,
        ],
      ]),
      {
        "a minimal project installs": true,
        "an unparsable manifest fails": true,
        "the install ran in the directory it was given": true,
      },
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveBuildScratchCleanup(failure, scratch);
  }
};

/** Exercise the real npm install boundary through a runner that can load the build tools. */
export const test_build_experimental_install_boundary = (): void => {
  runBuildScenarioChild(__filename, "test_build_experimental_install_boundary");
};

runWhenBuildScenarioChild(
  "test_build_experimental_install_boundary",
  assertBuildExperimentalInstallBoundary,
);
