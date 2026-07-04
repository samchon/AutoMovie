import { DynamicExecutor } from "@nestia/e2e";
import chalk from "chalk";
import path from "path";
import process from "process";

const parseArg = (type: string): string[] => {
  const prefix = `--${type}`;
  const out: string[] = [];
  const argv = process.argv;
  for (let i = 0; i < argv.length; ++i) {
    const a = argv[i]!;
    if (a === prefix) {
      for (let j = i + 1; j < argv.length && !argv[j]!.startsWith("--"); ++j)
        out.push(argv[j]!);
    } else if (a.startsWith(`${prefix}=`)) out.push(a.slice(prefix.length + 1));
  }
  return out;
};

async function main(): Promise<void> {
  console.log("---------------------------------------------------");
  console.log("automovie Test Program");
  console.log("Start", new Date().toLocaleString("en-US"));
  console.log("---------------------------------------------------");

  const include = parseArg("include");
  const exclude = parseArg("exclude");

  const report = await DynamicExecutor.validate({
    prefix: "test_",
    location: path.join(__dirname, "features"),
    parameters: () => [],
    onComplete: (exec) => {
      const elapsed =
        new Date(exec.completed_at).getTime() -
        new Date(exec.started_at).getTime();
      const mark = exec.error === null ? chalk.green("  ??) : chalk.red("  ??);
      console.log(`${mark} ${exec.name} ${chalk.gray(`(${elapsed} ms)`)}`);
    },
    filter: (name) =>
      (include.length === 0 || include.some((s) => name.includes(s))) &&
      (exclude.length === 0 || exclude.every((s) => !name.includes(s))),
    extension: "ts",
  });

  const failures = report.executions.filter((e) => e.error !== null);
  const passed = report.executions.length - failures.length;
  console.log("---------------------------------------------------");
  console.log(
    `${passed}/${report.executions.length} passed in ${report.time.toLocaleString()} ms`,
  );

  if (failures.length !== 0) {
    console.log(chalk.red(`\n${failures.length} FAILED:`));
    for (const f of failures) {
      console.log(chalk.red(`\n??${f.name}`));
      console.log(f.error);
    }
    process.exit(-1);
  }
  console.log(chalk.green("All tests passed."));
}

process.on("uncaughtException", (e) => console.log("uncaught", e));
process.on("unhandledRejection", (e) => console.log("rejection", e));
main().catch((e) => {
  console.log("critical error", e);
  process.exit(-1);
});
