import { DynamicExecutor } from "@nestia/e2e";
import chalk from "chalk";
import path from "node:path";
import process from "node:process";

import { createFatalTestEventHandler } from "./integrity/fatalTestEvent";
import { scenarioSelectionDiagnostics } from "./integrity/scenarioSelection";
import { parseScenarioSelectorArguments } from "./integrity/scenarioSelectorArguments";

async function main(): Promise<void> {
  console.log("---------------------------------------------------");
  console.log("AutoMovie Test Program");
  console.log("Start", new Date().toLocaleString("en-US"));
  console.log("---------------------------------------------------");

  const { include, exclude } = parseScenarioSelectorArguments(
    process.argv.slice(2),
  );

  // Every name the discovery offered, so a term that matched nothing can be
  // told from one that matched something the other half then removed.
  const discovered: string[] = [];
  const report = await DynamicExecutor.validate({
    prefix: "test_",
    location: path.join(__dirname, "features"),
    parameters: () => [],
    onComplete: (exec) => {
      const elapsed =
        new Date(exec.completed_at).getTime() -
        new Date(exec.started_at).getTime();
      const mark = exec.error === null ? chalk.green("  ✓") : chalk.red("  ✗");
      console.log(`${mark} ${exec.name} ${chalk.gray(`(${elapsed} ms)`)}`);
    },
    filter: (name) => {
      discovered.push(name);
      return (
        (include.length === 0 || include.some((s) => name.includes(s))) &&
        (exclude.length === 0 || exclude.every((s) => !name.includes(s)))
      );
    },
    extension: "ts",
  });

  // A filter that selected nothing is refused before the verdict is printed.
  // `--include test_this_does_not_exist` used to print "All tests passed" and
  // exit 0, and four of this repository's own commands pass exactly one term.
  const selection = scenarioSelectionDiagnostics({
    discovered,
    exclude,
    include,
    selected: report.executions.length,
  });
  if (selection.length !== 0) {
    console.log(chalk.red("\nSCENARIO SELECTION:"));
    for (const diagnostic of selection)
      console.log(chalk.red(`  ${diagnostic}`));
    process.exit(1);
  }

  const failures = report.executions.filter((e) => e.error !== null);
  const passed = report.executions.length - failures.length;
  console.log("---------------------------------------------------");
  console.log(
    `${passed}/${report.executions.length} passed in ${report.time.toLocaleString()} ms`,
  );

  if (failures.length !== 0) {
    console.log(chalk.red(`\n${failures.length} FAILED:`));
    for (const f of failures) {
      console.log(chalk.red(`\n● ${f.name}`));
      console.log(f.error);
    }
    process.exit(1);
  }
  console.log(chalk.green("All tests passed."));
}

const fatal = createFatalTestEventHandler({
  report: ({ kind, diagnostic }) => console.log(kind, diagnostic),
  writeStatus: (status) => {
    process.exitCode = status;
  },
});

process.on("uncaughtException", (error) => fatal("uncaught exception", error));
process.on("unhandledRejection", (error) =>
  fatal("unhandled rejection", error),
);
main().catch((error: unknown) => fatal("critical error", error));
