import assert from "node:assert/strict";

import {
  AUTO_MOVIE_DELIVERY_TOC_END,
  AUTO_MOVIE_DELIVERY_TOC_START,
  applyAutoMovieContractMigrationPlan,
  createAutoMovieContractBaseline,
  isAutoMovieContractTargetPath,
  parseAutoMovieContractBaseline,
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
assert.equal(Object.isFrozen(plan), true);
assert.equal(Object.isFrozen(plan.actions), true);
assert.equal(
  Object.isFrozen(
    parseAutoMovieContractBaseline(JSON.stringify(baseline("2", target))),
  ),
  true,
);
assert.deepEqual(
  planAutoMovieContractMigration({
    current: applied,
    from: baseline("2", target),
    targetSources: target,
    to: baseline("2", target),
  }).actions,
  [],
);

const fencedAnchor =
  "# Contract\n\n```md\n## Example {#not-a-contract-anchor}\n```\n";
assert.deepEqual(
  baseline("1", { "docs/principles/core/fenced.md": fencedAnchor }).files[0]
    ?.anchors,
  [],
);
assert.equal(
  isAutoMovieContractTargetPath("docs/language/principles/common.md"),
  true,
);
for (const invalid of [
  "../outside.md",
  "docs/discovery/../outside.md",
  "docs\\discovery\\outside.md",
  "docs/discovery/CON.md",
  "docs/discovery/name .md\0",
  "docs/contracts/local.md",
])
  assert.equal(isAutoMovieContractTargetPath(invalid), false);
for (const invalidGeneration of ["^1.0.0", "1.0.0 beta"])
  assert.throws(() =>
    baseline(invalidGeneration, {
      "docs/discovery/a.md": original["docs/discovery/a.md"],
    }),
  );
assert.throws(() =>
  baseline("1", {
    "docs/discovery/duplicate.md":
      "# Duplicate\n\n## One {#same}\n\n## Two {#same}\n",
  }),
);
assert.throws(() =>
  parseAutoMovieContractBaseline(
    JSON.stringify({
      ...baseline("1", original),
      files: [
        {
          anchors: [],
          path: "../outside.md",
          sha256:
            "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        },
      ],
    }),
  ),
);
const orderedBaseline = baseline("1", original);
assert.throws(() =>
  parseAutoMovieContractBaseline(
    JSON.stringify({
      ...orderedBaseline,
      files: [...orderedBaseline.files].reverse(),
    }),
  ),
);
assert.throws(() =>
  planAutoMovieContractMigration({
    current: original,
    from: baseline("1", original),
    targetSources: target,
    to: createAutoMovieContractBaseline({
      files: target,
      language: "korean",
      version: "2",
    }),
  }),
);

const recoveredRename = planAutoMovieContractMigration({
  current: {
    "docs/discovery/rename.md": original["docs/discovery/rename.md"],
    "docs/discovery/renamed.md": original["docs/discovery/rename.md"],
  },
  from: baseline("1", {
    "docs/discovery/rename.md": original["docs/discovery/rename.md"],
  }),
  targetSources: {
    "docs/discovery/renamed.md": original["docs/discovery/rename.md"],
  },
  to: baseline("2", {
    "docs/discovery/renamed.md": original["docs/discovery/rename.md"],
  }),
});
assert.deepEqual(
  recoveredRename.actions.map((action) => action.action),
  ["rename"],
);
assert.deepEqual(
  applyAutoMovieContractMigrationPlan(recoveredRename, {
    "docs/discovery/rename.md": original["docs/discovery/rename.md"],
    "docs/discovery/renamed.md": original["docs/discovery/rename.md"],
  }),
  { "docs/discovery/renamed.md": original["docs/discovery/rename.md"] },
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

const index = "# Act One\n";
const units = [
  {
    path: "002-second.md",
    source: "# Second ] movement\\path\n\n## Scene {#second}\n",
  },
  {
    path: "001-first.md",
    source:
      "<!-- # Commented -->\n# First\n\n```md\n# Example\n```\n\n## Scene {#first}\n",
  },
];
const rendered = planAutoMovieDeliveryToc({
  indexPath: "docs/scripts/001-act/index.md",
  indexSource: index,
  units,
});
assert.equal(rendered.changed, true);
assert.equal(rendered.source.startsWith(index), true);
const paddedIndex = "# Padded index  \n";
assert.equal(
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: paddedIndex,
    units,
  }).source.startsWith(paddedIndex),
  true,
);
assert.ok(
  rendered.source.indexOf("001-first") < rendered.source.indexOf("002-second"),
);
assert.ok(rendered.source.includes("Second \\] movement\\\\path"));
assert.equal(
  planAutoMovieDeliveryToc({
    check: true,
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: rendered.source,
    units,
  }).changed,
  false,
);
const staleCheck = planAutoMovieDeliveryToc({
  check: true,
  indexPath: "docs/scripts/001-act/index.md",
  indexSource: index,
  units,
});
assert.equal(staleCheck.diagnostics.length, 1);
assert.equal(staleCheck.source, rendered.source);
assert.throws(() =>
  planAutoMovieDeliveryToc({
    check: true,
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: `${rendered.source}${AUTO_MOVIE_DELIVERY_TOC_END}\n`,
    units,
  }),
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
assert.throws(() =>
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: `${rendered.source}- [Wrong](../outside.md)\n`,
    units,
  }),
);
assert.throws(() =>
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: `${index}\n## Authored prose {#wrong-owner}\n`,
    units,
  }),
);
assert.throws(() =>
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: index,
    units: [{ path: "../outside.md", source: "# Outside\n" }],
  }),
);
assert.throws(() =>
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: `${index}${AUTO_MOVIE_DELIVERY_TOC_END}\n${AUTO_MOVIE_DELIVERY_TOC_START}\n`,
    units,
  }),
);
