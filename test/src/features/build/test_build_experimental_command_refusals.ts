import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  type IExperimentalDependencies,
  type IExperimentalModule,
  loadBuildModule,
} from "./loadBuildModule";
import {
  runBuildScenarioChild,
  runWhenBuildScenarioChild,
} from "./runBuildScenarioChild";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

interface IRun {
  readonly code: number;
  readonly error: string;
  readonly installs: string[];
  readonly output: string;
  readonly packs: string[];
}

const runner =
  (module: IExperimentalModule) =>
  (
    args: readonly string[],
    install: number | null = 0,
    pack: (target: string) => Record<string, string> = () => ({}),
  ): IRun => {
    const installs: string[] = [];
    const packs: string[] = [];
    let output = "";
    let error = "";
    const dependencies: IExperimentalDependencies = {
      install: (target) => {
        installs.push(target);
        return install;
      },
      pack: (target) => {
        packs.push(target);
        return pack(target);
      },
    };
    const code = module.runExperimental(
      args,
      dependencies,
      { write: (message) => (output += message) },
      { write: (message) => (error += message) },
    );
    return { code, error, installs, output, packs };
  };

/**
 * The sandbox command refuses a bad request before it spends anything, and
 * reports every failure it cannot prevent.
 *
 * Order is the substance of this scenario, not decoration. Packing the
 * workspace runs each package's build and costs minutes, so a refusal that
 * arrives after the pack has already written into the target has cost the
 * operator that time and left tarballs behind under a directory the command
 * then declines to use. Both refusals here are proved by the injected pack
 * never being called, which is a fact about the order rather than about the
 * message.
 *
 * Scenarios:
 *
 * 1. No arguments prints usage and succeeds, because an invocation with nothing
 *    to do is a request for help rather than an error.
 * 2. `-h` and `--help` do the same from any position.
 * 3. An invocation of options only refuses with a status of one and repeats the
 *    usage, since there is no name to act on.
 * 4. A traversing name is refused before the pack runs. This is the input that
 *    reached the repository root through `--refresh`.
 * 5. A name the scaffold refuses as unportable is refused before the pack runs
 *    too. `con` is a reserved Windows device name, and it passes containment, so
 *    only rendering can reject it: the render therefore has to happen first.
 * 6. `--refresh` against a directory with no manifest refuses before the pack
 *    and says what to do, rather than creating one.
 * 7. A non-`Error` thrown from the pack boundary is still reported as a message
 *    rather than as `[object Object]`.
 * 8. Every refusal writes to the error stream and leaves the output stream
 *    empty, so a caller reading stdout cannot mistake a refusal for a result.
 * 9. The repository's own manifest carries no `file:./.tarballs/` pin. That is
 *    the signature the traversal left behind, and it survives a rename of the
 *    root package in a way an assertion on its name would not.
 */
const assertBuildExperimentalCommandRefusals = async (): Promise<void> => {
  const module = await loadBuildModule<IExperimentalModule>("experimental.ts");
  const { EXPERIMENTAL_ROOT } = module;
  const run = runner(module);
  const empty = run([]);
  const shortHelp = run(["-h"]);
  const longHelp = run(["name", "--help"]);
  const optionsOnly = run(["--force"]);
  const traversal = run(["..", "--refresh"]);
  const unportable = run(["con"]);
  const missingManifest = run([`absent_${process.pid}`, "--refresh"]);
  // Typed `unknown` on purpose. The branch under test is the one that has to
  // survive a boundary throwing something that is not an `Error`, and a
  // literal `throw "..."` is refused by the repository's own lint rule.
  const nonError: unknown = "pack exploded";
  const thrown = run(["thrown_probe"], 0, () => {
    throw nonError;
  });

  TestValidator.equals(
    "the sandbox command refuses before it spends and reports what it cannot prevent",
    namedFacts([
      [
        "no arguments prints usage and succeeds",
        () =>
          empty.code === 0 &&
          empty.output.startsWith("create a working-tree automovie sandbox") &&
          empty.error === "",
      ],
      [
        "help is honoured from any position",
        () =>
          shortHelp.code === 0 &&
          longHelp.code === 0 &&
          longHelp.output === shortHelp.output &&
          longHelp.packs.length === 0,
      ],
      [
        "options without a name refuse",
        () =>
          optionsOnly.code === 1 &&
          optionsOnly.error.startsWith("a name is required") &&
          optionsOnly.error.includes("Usage:") &&
          optionsOnly.output === "",
      ],
      [
        "a traversing name refuses before the pack",
        () =>
          traversal.code === 1 &&
          traversal.packs.length === 0 &&
          traversal.installs.length === 0 &&
          traversal.error.includes(
            "must be one directory segment inside experimental/",
          ),
      ],
      [
        "an unportable name refuses before the pack",
        () =>
          unportable.code === 1 &&
          unportable.packs.length === 0 &&
          unportable.installs.length === 0 &&
          unportable.error.includes("portable directory segment"),
      ],
      [
        "an unportable name leaves no directory behind",
        () => fs.existsSync(path.join(EXPERIMENTAL_ROOT, "con")) === false,
      ],
      [
        "refresh without a manifest refuses",
        () =>
          missingManifest.code === 1 &&
          missingManifest.packs.length === 0 &&
          missingManifest.error.includes("has no package.json to refresh"),
      ],
      [
        "a non-Error failure keeps its text",
        () => thrown.code === 1 && thrown.error === "pack exploded\n",
      ],
      [
        "the repository manifest carries no sandbox pin",
        () =>
          fs
            .readFileSync(path.join(ROOT, "package.json"), "utf8")
            .includes("file:./.tarballs/") === false,
      ],
    ]),
    {
      "no arguments prints usage and succeeds": true,
      "help is honoured from any position": true,
      "options without a name refuse": true,
      "a traversing name refuses before the pack": true,
      "an unportable name refuses before the pack": true,
      "an unportable name leaves no directory behind": true,
      "refresh without a manifest refuses": true,
      "a non-Error failure keeps its text": true,
      "the repository manifest carries no sandbox pin": true,
    },
  );
};

/** Exercise every sandbox request the command refuses through a runner that can load the build tools. */
export const test_build_experimental_command_refusals = (): void => {
  runBuildScenarioChild(__filename, "test_build_experimental_command_refusals");
};

runWhenBuildScenarioChild(
  "test_build_experimental_command_refusals",
  assertBuildExperimentalCommandRefusals,
);
