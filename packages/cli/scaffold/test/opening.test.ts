import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import assert from "node:assert/strict";

const firstProject = AutoMovieProductionProject.open(process.cwd());
const first = new AutoMovieProductionCompiler(firstProject).compile({
  scope: "source",
});
assert.equal(first.success, true, JSON.stringify(first.diagnostics, null, 2));

const reopenedProject = AutoMovieProductionProject.open(process.cwd());
const reopened = new AutoMovieProductionCompiler(reopenedProject).compile({
  scope: "source",
});
assert.equal(
  reopened.compiler.inputFingerprint,
  first.compiler.inputFingerprint,
  "Reopening the project must preserve compiler identity.",
);
assert.ok(
  reopened.materialized.every((file) => file.status === "unchanged"),
  "A second unchanged compile must materialize no changed files.",
);
process.stdout.write("opening compile/reopen identity: ok\n");
