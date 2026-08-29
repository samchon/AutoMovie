import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { preserveBuildScratchCleanup } from "./BuildScratchDirectory";
import {
  type IExperimentalDependencies,
  type IExperimentalModule,
  loadBuildModule,
} from "./loadBuildModule";
import {
  runBuildScenarioChild,
  runWhenBuildScenarioChild,
} from "./runBuildScenarioChild";

interface IRun {
  readonly code: number;
  readonly error: string;
  readonly installs: string[];
  readonly output: string;
  readonly packs: string[];
}

const PIN = "file:./.tarballs/automovie-engine-0.1.0-abcdef012345.tgz";

const runner =
  (module: IExperimentalModule) =>
  (args: readonly string[], install: number | null = 0): IRun => {
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
        return { engine: PIN };
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
 * One sandbox through its whole lifecycle: rendered, packed, installed,
 * refreshed without losing authored work, and re-rendered on demand.
 *
 * `--refresh` and `--force` are the pair that has to stay separated. A sandbox
 * exists to be authored in, and `--force` re-renders every scaffold-managed file
 * over whatever the author wrote: configuration, guides, scripts, viewer files,
 * package wiring. `--refresh` exists so a package fix can reach a sandbox whose
 * production is already under way, which means it must rewrite the manifest's
 * pins and nothing else. Proving that with a file the render itself produced,
 * rather than with a file planted beside it, is what makes the preservation
 * claim about scaffold-managed content rather than about a stranger.
 *
 * Scenarios:
 *
 * 1. `--no-install` renders the scaffold into `experimental/<name>` and calls
 *    neither the pack nor the install, reporting how many files it wrote.
 * 2. Rendered without a pack, the manifest keeps the ranges the scaffold
 *    declared, so a render alone never pins a tarball that was not produced.
 * 3. A second run over the now non-empty directory refuses and names `--force`.
 * 4. `--refresh` packs, repins the manifest onto the pack's specifiers, and
 *    installs, all against the same target directory.
 * 5. The refreshed sandbox keeps the author's edit to a scaffold-managed file.
 * 6. A failing install refuses with a status of one, names the sandbox, and
 *    tells the operator to re-run with `--force`.
 * 7. `--force` re-renders over the non-empty directory and discards the author's
 *    edit, which is the behaviour `--refresh` exists to avoid.
 * 8. `runExperimentalCli` publishes a status only when this module is the
 *    process entry, and `setExperimentalExitCode` is what publishes it.
 */
const assertBuildExperimentalCommandLifecycle = async (): Promise<void> => {
  const module = await loadBuildModule<IExperimentalModule>("experimental.ts");
  const { EXPERIMENTAL_ROOT, runExperimentalCli, setExperimentalExitCode } =
    module;
  const run = runner(module);
  const name = `lifecycle_${process.pid}`;
  const target = path.join(EXPERIMENTAL_ROOT, name);
  let failure: { error: unknown } | undefined;
  // A run killed before its cleanup leaves the directory behind for whichever
  // later process draws the same id, and the first assertion below would then
  // read a refusal instead of a render.
  fs.rmSync(target, { force: true, recursive: true });
  try {
    const rendered = run([name, "--no-install"]);
    const manifest = path.join(target, "package.json");
    const declared = fs.readFileSync(manifest, "utf8");

    const authored = path.join(target, "README.md");
    const original = fs.readFileSync(authored, "utf8");
    fs.writeFileSync(
      authored,
      `${original}\nauthored by the experiment\n`,
      "utf8",
    );

    const repeated = run([name, "--no-install"]);
    const refreshed = run([name, "--refresh"]);
    const repinned = fs.readFileSync(manifest, "utf8");
    const preserved = fs
      .readFileSync(authored, "utf8")
      .includes("authored by the experiment");

    const failedInstall = run([name, "--refresh"], 1);
    const forced = run([name, "--force", "--no-install"]);
    const discarded = fs
      .readFileSync(authored, "utf8")
      .includes("authored by the experiment");

    const published: number[] = [];
    runExperimentalCli(false, [name], (code) => published.push(code));
    runExperimentalCli(true, ["--help"], (code) => published.push(code));
    const previous = process.exitCode;
    setExperimentalExitCode(0);
    const publishedToProcess = process.exitCode === 0;
    process.exitCode = previous;

    TestValidator.equals(
      "a sandbox renders, refreshes without losing authored work, and re-renders on force",
      namedFacts([
        [
          "no-install renders without packing or installing",
          () =>
            rendered.code === 0 &&
            rendered.packs.length === 0 &&
            rendered.installs.length === 0 &&
            rendered.output.includes(`files into experimental/${name}`),
        ],
        [
          "a render without a pack pins nothing",
          () =>
            declared.includes(PIN) === false &&
            declared.includes(`"@automovie/engine"`),
        ],
        [
          "a non-empty sandbox refuses and names force",
          () =>
            repeated.code === 1 &&
            repeated.error.includes(`experimental/${name} is not empty`) &&
            repeated.error.includes("--force"),
        ],
        [
          "refresh packs, repins, and installs the same target",
          () =>
            refreshed.code === 0 &&
            refreshed.packs.join() === target &&
            refreshed.installs.join() === target &&
            repinned.includes(PIN) &&
            refreshed.output.includes(`Refreshed experimental/${name}`),
        ],
        ["refresh preserves the authored edit", () => preserved],
        [
          "a failing install refuses and points at force",
          () =>
            failedInstall.code === 1 &&
            failedInstall.error.includes(
              `npm install failed in experimental/${name}`,
            ) &&
            failedInstall.error.includes("--force"),
        ],
        [
          "force re-renders and discards the authored edit",
          () => forced.code === 0 && discarded === false,
        ],
        [
          "the cli publishes a status only on the entry",
          () => published.join() === "0" && publishedToProcess,
        ],
      ]),
      {
        "no-install renders without packing or installing": true,
        "a render without a pack pins nothing": true,
        "a non-empty sandbox refuses and names force": true,
        "refresh packs, repins, and installs the same target": true,
        "refresh preserves the authored edit": true,
        "a failing install refuses and points at force": true,
        "force re-renders and discards the authored edit": true,
        "the cli publishes a status only on the entry": true,
      },
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveBuildScratchCleanup(failure, target);
  }
};

/** Exercise one sandbox through its whole lifecycle through a runner that can load the build tools. */
export const test_build_experimental_command_lifecycle = (): void => {
  runBuildScenarioChild(
    __filename,
    "test_build_experimental_command_lifecycle",
  );
};

runWhenBuildScenarioChild(
  "test_build_experimental_command_lifecycle",
  assertBuildExperimentalCommandLifecycle,
);
