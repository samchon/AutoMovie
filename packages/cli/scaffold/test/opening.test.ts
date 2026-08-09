import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import assert from "node:assert/strict";

import { Army } from "../src/formations/army";
import { ArmyMember } from "../src/units/armyHero";

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

// A subject refuses a measurement its specification does not state, and says
// which document it contradicts. Checked here rather than in a constructor: a
// subclass sets its own fields after the base constructor has run, so only the
// method that emits the record sees what the subject finally is.
assert.throws(
  () =>
    new (class extends Army {
      public override readonly count = 1;
    })().design(),
  /docs\/characters\/army\.md/,
  "An army whose count leaves a declared rank empty must be refused.",
);
assert.throws(
  () =>
    new (class extends ArmyMember {
      public override readonly height = 1.9;
    })().design(),
  /docs\/characters\/army\.md/,
  "A member taller than the specification states must be refused.",
);
process.stdout.write(
  "subject constraints refuse what the spec does not state: ok\n",
);
