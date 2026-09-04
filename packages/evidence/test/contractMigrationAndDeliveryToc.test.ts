import assert from "node:assert/strict";

import {
  applyAutoMovieContractMigrationPlan,
  createAutoMovieContractBaseline,
  planAutoMovieContractMigration,
  planAutoMovieDeliveryToc,
} from "../src";

const baseline = (version: string, files: Readonly<Record<string, string>>) =>
  createAutoMovieContractBaseline({
    files,
    language: "english",
    version,
  });

const original = {
  "docs/discovery/a.md": "# A\n\n## Rule {#rule}\n\nOld.\n",
  "docs/discovery/rename.md": "# Rename\n\n## Rule {#rename}\n",
};
const target = {
  "docs/discovery/a.md": "# A\n\n## Rule {#rule}\n\nNew.\n",
  "docs/discovery/added.md": "# Added\n\n## Added {#added}\n",
  "docs/discovery/renamed.md": original["docs/discovery/rename.md"],
};
const plan = planAutoMovieContractMigration({
  current: original,
  from: baseline("1", original),
  targetSources: target,
  to: baseline("2", target),
});
assert.deepEqual(
  plan.actions.map((action) => action.action),
  ["write", "add", "rename"],
);
assert.equal(plan.conflicts.length, 0);
const applied = applyAutoMovieContractMigrationPlan(plan, original);
assert.deepEqual(applied, target);
assert.deepEqual(
  planAutoMovieContractMigration({
    current: applied,
    from: baseline("2", target),
    targetSources: target,
    to: baseline("2", target),
  }).actions,
  [],
);

const removedAnchor = { "docs/discovery/a.md": "# A\n\nNo rule.\n" };
assert.equal(
  planAutoMovieContractMigration({
    current: { "docs/discovery/a.md": original["docs/discovery/a.md"] },
    from: baseline("1", {
      "docs/discovery/a.md": original["docs/discovery/a.md"],
    }),
    targetSources: removedAnchor,
    to: baseline("2", removedAnchor),
  }).conflicts[0]?.kind,
  "removed-anchor",
);
assert.equal(
  planAutoMovieContractMigration({
    current: { "docs/discovery/a.md": "authored" },
    from: baseline("1", {
      "docs/discovery/a.md": original["docs/discovery/a.md"],
    }),
    targetSources: target,
    to: baseline("2", target),
  }).conflicts[0]?.kind,
  "local-modification",
);
assert.throws(() =>
  applyAutoMovieContractMigrationPlan(
    {
      ...plan,
      conflicts: [{ kind: "target-collision", path: "x", reason: "occupied" }],
    },
    original,
  ),
);

const index = "# Act One\n\nAuthored group note.\n";
const units = [
  { path: "002-second.md", source: "# Second\n\n## Scene {#second}\n" },
  { path: "001-first.md", source: "# First\n\n## Scene {#first}\n" },
];
const rendered = planAutoMovieDeliveryToc({
  indexPath: "docs/scripts/001-act/index.md",
  indexSource: index,
  units,
});
assert.equal(rendered.changed, true);
assert.match(rendered.source, /Authored group note/u);
assert.ok(
  rendered.source.indexOf("001-first") < rendered.source.indexOf("002-second"),
);
assert.equal(
  planAutoMovieDeliveryToc({
    check: true,
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: rendered.source,
    units,
  }).changed,
  false,
);
assert.equal(
  planAutoMovieDeliveryToc({
    check: true,
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: index,
    units,
  }).diagnostics.length,
  1,
);
assert.throws(() =>
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: `${index}<!-- automovie:toc:start -->\n`,
    units,
  }),
);
assert.throws(() =>
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: index,
    units: [units[0]!, units[0]!],
  }),
);
