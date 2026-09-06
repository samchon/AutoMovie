import { DynamicExecutor } from "@nestia/e2e";
import chalk from "chalk";
import path from "node:path";
import process from "node:process";

/** Read `--include` / `--exclude` substrings from the command line. */
const selectors = (
  argv: readonly string[],
): { include: string[]; exclude: string[] } => {
  const include: string[] = [];
  const exclude: string[] = [];
  let group: string[] | null = null;
  for (const argument of argv) {
    if (argument === "--include") group = include;
    else if (argument === "--exclude") group = exclude;
    else if (group === null)
      throw new Error(`Unexpected argument "${argument}".`);
    else group.push(argument);
  }
  return { include, exclude };
};

async function main(): Promise<void> {
  console.log("---------------------------------------------------");
  console.log("AutoMovie Test Program");
  console.log("Start", new Date().toLocaleString("en-US"));
  console.log("---------------------------------------------------");

  const { include, exclude } = selectors(process.argv.slice(2));
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
    filter: (name) =>
      (include.length === 0 || include.some((s) => name.includes(s))) &&
      (exclude.length === 0 || exclude.every((s) => !name.includes(s))),
    extension: "ts",
  });

  if (report.executions.length === 0)
    throw new Error("The scenario selection matched nothing.");

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

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
