import fs from "node:fs";
import path from "node:path";

import {
  AUTOMOVIE_PROSE_VOICE_POPULATION_CATEGORIES,
  AUTOMOVIE_PROSE_VOICE_RULE,
  autoMovieProseVoicePopulationCategory,
  inspectAutoMovieProseVoice,
  isAutoMovieProseVoicePath,
} from "./proseVoice";

const root = path.resolve(__dirname, "..");

const files = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory()
      ? files(absolute)
      : entry.isFile()
        ? [absolute]
        : [];
  });

const population = [
  path.join(root, "AGENTS.md"),
  path.join(root, "README.md"),
  ...files(path.join(root, ".agents", "skills")),
  ...files(path.join(root, "packages")),
].filter((file) =>
  isAutoMovieProseVoicePath(path.relative(root, file).replaceAll("\\", "/")),
);
const arguments_ = process.argv.slice(2);
const unsupported = arguments_.filter((argument) => argument.startsWith("--"));
if (unsupported.length !== 0) {
  process.stderr.write(
    `prose voice lint does not support options: ${unsupported.join(", ")}\n`,
  );
  process.exitCode = 2;
}
const requested = arguments_
  .filter((argument) => !argument.startsWith("--"))
  .map((file) => path.resolve(root, file));
const candidates = requested.length === 0 ? population : requested;
const violations =
  unsupported.length === 0
    ? candidates.flatMap((file) =>
        inspectAutoMovieProseVoice({
          file: path.relative(root, file),
          rule: AUTOMOVIE_PROSE_VOICE_RULE,
          source: fs.readFileSync(file, "utf8"),
        }),
      )
    : [];

for (const violation of violations)
  process.stderr.write(
    `${violation.file}:${violation.line}:${violation.column} ${violation.kind}: ${JSON.stringify(violation.text)}\n`,
  );
if (unsupported.length === 0) {
  const counts = new Map<string, number>();
  for (const file of candidates) {
    const relative = path.relative(root, file);
    const category =
      autoMovieProseVoicePopulationCategory(relative) ?? "requested";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const populationSummary =
    requested.length === 0
      ? AUTOMOVIE_PROSE_VOICE_POPULATION_CATEGORIES.map(
          (entry) => `${entry}=${counts.get(entry) ?? 0}`,
        )
      : [`requested=${counts.get("requested") ?? candidates.length}`];
  process.stdout.write(
    `${candidates.length} prose voice file(s) checked (${populationSummary.join(", ")}); ${violations.length} violation(s).\n`,
  );
  if (candidates.length === 0) {
    process.stderr.write("Prose voice lint selected no files.\n");
    process.exitCode = 2;
  } else if (violations.length !== 0) process.exitCode = 1;
}
