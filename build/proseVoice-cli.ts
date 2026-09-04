import fs from "node:fs";
import path from "node:path";

import {
  AUTOMOVIE_PROSE_VOICE_RULE,
  inspectAutoMovieProseVoice,
  isAutoMovieProseVoicePath,
  repairAutoMovieProseVoice,
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
const requested = process.argv
  .slice(2)
  .filter((argument) => argument !== "--write")
  .map((file) => path.resolve(root, file));
const candidates = requested.length === 0 ? population : requested;
if (process.argv.slice(2).includes("--write"))
  for (const file of candidates) {
    const source = fs.readFileSync(file, "utf8");
    const repaired = repairAutoMovieProseVoice({
      file: path.relative(root, file),
      rule: AUTOMOVIE_PROSE_VOICE_RULE,
      source,
    });
    if (repaired !== source) fs.writeFileSync(file, repaired, "utf8");
  }
const violations = candidates.flatMap((file) =>
  inspectAutoMovieProseVoice({
    file: path.relative(root, file),
    rule: AUTOMOVIE_PROSE_VOICE_RULE,
    source: fs.readFileSync(file, "utf8"),
  }),
);

for (const violation of violations)
  process.stderr.write(
    `${violation.file}:${violation.line}:${violation.column} ${violation.kind}: ${JSON.stringify(violation.text)}\n`,
  );
if (violations.length !== 0) {
  process.stderr.write(`${violations.length} prose voice violation(s).\n`);
  process.exitCode = 1;
}
