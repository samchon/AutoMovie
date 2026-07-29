import fs from "node:fs";
import path from "node:path";

const report = path.resolve(
  "node_modules/.cache/automovie-c8-report/coverage-final.json",
);

if (fs.existsSync(report) === false) {
  console.log("No Istanbul coverage-final.json was produced.");
  process.exit(0);
}

const coverage = JSON.parse(fs.readFileSync(report, "utf8"));
const relative = (file) =>
  path.relative(process.cwd(), file).replaceAll("\\", "/");
const location = (span) =>
  span.start.line === span.end.line
    ? `${span.start.line}:${span.start.column}-${span.end.column}`
    : `${span.start.line}:${span.start.column}-${span.end.line}:${span.end.column}`;

for (const [file, data] of Object.entries(coverage).sort(([left], [right]) =>
  left.localeCompare(right),
)) {
  const statements = Object.entries(data.s)
    .filter(([, hits]) => hits === 0)
    .map(([id]) => location(data.statementMap[id]));
  const branches = [];
  for (const [id, hits] of Object.entries(data.b))
    hits.forEach((count, index) => {
      if (count === 0)
        branches.push(
          `${data.branchMap[id].type}@${location(data.branchMap[id].locations[index])}`,
        );
    });
  if (statements.length === 0 && branches.length === 0) continue;
  console.log(`::group::${relative(file)}`);
  if (statements.length !== 0)
    console.log(`uncovered statements: ${statements.join(", ")}`);
  if (branches.length !== 0)
    console.log(`uncovered branches: ${branches.join(", ")}`);
  console.log("::endgroup::");
}
