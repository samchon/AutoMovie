import { DynamicExecutor } from "@nestia/e2e";
import chalk from "chalk";
import path from "node:path";
import process from "node:process";

import { assessScenarioExecution } from "./scenarioExecution";
import { prepareScenarioFilter } from "./scenarioSelection";

async function main(): Promise<void> {
  console.log("---------------------------------------------------");
  console.log("AutoMovie Test Program");
  console.log("Start", new Date().toLocaleString("en-US"));
  console.log("---------------------------------------------------");

  const discovery = {
    prefix: "test_",
    location: path.join(__dirname, "features"),
    parameters: () => [],
    extension: "ts",
  };
  const filter = await prepareScenarioFilter(process.argv.slice(2), (filter) =>
    DynamicExecutor.validate({ ...discovery, filter }),
  );
  const report = await DynamicExecutor.validate({
    ...discovery,
    onComplete: (exec) => {
      const result = assessScenarioExecution(exec);
      const mark = result.passed ? chalk.green("  ✓") : chalk.red("  ✗");
      console.log(
        `${mark} ${exec.name} ${chalk.gray(`(${result.timingLabel})`)}`,
      );
    },
    filter,
  });

  if (report.executions.length === 0)
    throw new Error("The scenario selection matched nothing.");

  const failures = report.executions
    .map(assessScenarioExecution)
    .filter((result) => result.passed === false);
  const passed = report.executions.length - failures.length;
  console.log("---------------------------------------------------");
  console.log(
    `${passed}/${report.executions.length} passed in ${report.time.toLocaleString()} ms`,
  );

  if (failures.length !== 0) {
    console.log(chalk.red(`\n${failures.length} FAILED:`));
    for (const f of failures) {
      console.log(chalk.red(`\n● ${f.execution.name}`));
      console.log({
        assertion: f.execution.error,
        timing: f.timingFailure,
      });
    }
    process.exit(1);
  }
  console.log(chalk.green("All tests passed."));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
