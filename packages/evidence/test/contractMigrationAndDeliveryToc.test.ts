import assert from "node:assert/strict";

import {
  AUTO_MOVIE_DELIVERY_TOC_END,
  AUTO_MOVIE_DELIVERY_TOC_START,
  applyAutoMovieContractMigrationPlan,
  createAutoMovieContractBaseline,
  createAutoMovieContractMigrationReceiptArtifacts,
  isAutoMovieContractTargetPath,
  observeAutoMovieContractMigrationOutcomes,
  parseAutoMovieContractBaseline,
  planAutoMovieContractMigration,
  planAutoMovieContractMigrationPublication,
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
const originalBaseline = baseline("1", original);
const targetBaseline = baseline("2", target);
const plan = planAutoMovieContractMigration({
  current: original,
  from: originalBaseline,
  targetSources: target,
  to: targetBaseline,
});
assert.deepEqual(
  plan.actions.map((action) => action.action),
  ["write", "add", "rename"],
);
assert.equal(plan.conflicts.length, 0);
assert.match(plan.inputs.current, /^sha256:[0-9a-f]{64}$/u);
assert.equal(
  plan.inputs.from,
  planAutoMovieContractMigration({
    current: original,
    from: originalBaseline,
    targetSources: original,
    to: baseline("1", original),
  }).inputs.to,
);
assert.notEqual(plan.inputs.from, plan.inputs.to);
const applied = applyAutoMovieContractMigrationPlan(plan, original);
assert.deepEqual(applied, target);
assert.equal(Object.isFrozen(plan), true);
assert.equal(Object.isFrozen(plan.actions), true);
assert.equal(Object.isFrozen(plan.inputs), true);
assert.equal(
  Object.isFrozen(
    parseAutoMovieContractBaseline(JSON.stringify(baseline("2", target))),
  ),
  true,
);

// A plan binds the whole judged population: a byte change on a path no
// action touches is a currentness failure for apply and for publication.
const driftedRename = {
  ...original,
  "docs/discovery/rename.md": "# Rename\n\n## Rule {#rename}\n\nDrift.\n",
};
assert.throws(
  () => applyAutoMovieContractMigrationPlan(plan, driftedRename),
  /changed after planning/u,
);
assert.throws(
  () =>
    planAutoMovieContractMigrationPublication({
      current: driftedRename,
      observed: original,
      plan,
    }),
  /changed after planning/u,
);
assert.throws(
  () =>
    planAutoMovieContractMigrationPublication({
      current: original,
      observed: { ...original, "docs/discovery/extra.md": "# Extra\n" },
      plan,
    }),
  /changed after planning/u,
);
const publication = planAutoMovieContractMigrationPublication({
  current: original,
  observed: original,
  plan,
});
assert.deepEqual(Object.keys(publication.creations).sort(), [
  "docs/discovery/added.md",
  "docs/discovery/renamed.md",
]);
assert.deepEqual(Object.keys(publication.replacements), [
  "docs/discovery/a.md",
]);
assert.deepEqual(
  publication.removals.map((removal) => removal.path),
  ["docs/discovery/rename.md"],
);

const published = {
  ...publication.creations,
  ...publication.replacements,
};
const outcomes = observeAutoMovieContractMigrationOutcomes({
  plan,
  published,
});
assert.deepEqual(
  outcomes.map((outcome) => [outcome.action, outcome.path, outcome.status]),
  [
    ["write", "docs/discovery/a.md", "published"],
    ["add", "docs/discovery/added.md", "published"],
    ["rename", "docs/discovery/renamed.md", "published"],
  ],
);
assert.deepEqual(
  outcomes.map((outcome) => [outcome.beforeSha256 === null, outcome.from]),
  [
    [false, null],
    [true, null],
    [false, "docs/discovery/rename.md"],
  ],
);
assert.equal(
  outcomes[2]!.afterSha256,
  targetBaseline.files.find(
    (file) => file.path === "docs/discovery/renamed.md",
  )!.sha256,
);
assert.equal(Object.isFrozen(outcomes), true);
const damaged = observeAutoMovieContractMigrationOutcomes({
  plan,
  published: {
    "docs/discovery/a.md": "competitor bytes",
    "docs/discovery/renamed.md": published["docs/discovery/renamed.md"]!,
  },
});
assert.deepEqual(
  damaged.map((outcome) => outcome.status),
  ["failed", "incomplete", "published"],
);
assert.deepEqual(
  damaged.map((outcome) => outcome.afterSha256),
  outcomes.map((outcome) => outcome.afterSha256),
);

const receiptProps = {
  from: originalBaseline,
  observed: original,
  outcomes,
  plan,
  to: targetBaseline,
};
const receipt = createAutoMovieContractMigrationReceiptArtifacts(receiptProps);
assert.deepEqual(
  createAutoMovieContractMigrationReceiptArtifacts(receiptProps),
  receipt,
);
assert.equal(Object.isFrozen(receipt.receipt), true);
assert.match(
  receipt.predecessor.path,
  /^automovie\/contract-migrations\/[0-9a-f]{64}\/[0-9a-f]{64}\.baseline\.json$/u,
);
assert.match(
  receipt.receipt.path,
  /^automovie\/contract-migrations\/[0-9a-f]{64}\/[0-9a-f]{64}\.receipt\.json$/u,
);
assert.equal(
  receipt.predecessor.path.split("/")[2],
  receipt.receipt.path.split("/")[2],
);
assert.equal(
  receipt.predecessor.path.split("/")[3],
  `${plan.inputs.from.slice("sha256:".length)}.baseline.json`,
);
assert.equal(
  receipt.predecessor.source,
  `${JSON.stringify(originalBaseline, null, 2)}\n`,
);
const receiptRecord = JSON.parse(receipt.receipt.source) as {
  actions: unknown[];
  from: { identity: string; version: string };
  observedInputDigest: string;
  planDigest: string;
  publicationGeneration: string;
  to: { identity: string; version: string };
  validation: { status: string; targetBaselineIdentity: string };
};
assert.deepEqual(
  {
    actions: receiptRecord.actions,
    from: receiptRecord.from,
    observedInputDigest: receiptRecord.observedInputDigest,
    to: receiptRecord.to,
    validation: receiptRecord.validation,
  },
  {
    actions: outcomes,
    from: { identity: plan.inputs.from, version: "1" },
    observedInputDigest: plan.inputs.current,
    to: { identity: plan.inputs.to, version: "2" },
    validation: { status: "completed", targetBaselineIdentity: plan.inputs.to },
  },
);
assert.equal(
  receiptRecord.planDigest,
  `sha256:${receiptRecord.publicationGeneration}`,
);
assert.equal(
  receipt.receipt.path.split("/")[2],
  receiptRecord.publicationGeneration,
);

const changedTarget = {
  ...target,
  "docs/discovery/added.md": "# Added\n\n## Added {#added}\n\nChanged.\n",
};
const changedBaseline = baseline("3", changedTarget);
const changedPlan = planAutoMovieContractMigration({
  current: original,
  from: originalBaseline,
  targetSources: changedTarget,
  to: changedBaseline,
});
const changedReceipt = createAutoMovieContractMigrationReceiptArtifacts({
  from: originalBaseline,
  observed: original,
  outcomes: observeAutoMovieContractMigrationOutcomes({
    plan: changedPlan,
    published: applyAutoMovieContractMigrationPlan(changedPlan, original),
  }),
  plan: changedPlan,
  to: changedBaseline,
});
assert.notEqual(
  changedReceipt.receipt.path.split("/")[2],
  receipt.receipt.path.split("/")[2],
);
assert.notEqual(changedReceipt.receipt.source, receipt.receipt.source);

// The receipt refuses anything short of a completed, matching observation.
assert.throws(
  () =>
    createAutoMovieContractMigrationReceiptArtifacts({
      ...receiptProps,
      outcomes: damaged,
    }),
  /do not match the completed plan/u,
);
assert.throws(
  () =>
    createAutoMovieContractMigrationReceiptArtifacts({
      ...receiptProps,
      outcomes: outcomes.slice(1),
    }),
  /do not match the completed plan/u,
);
assert.throws(
  () =>
    createAutoMovieContractMigrationReceiptArtifacts({
      ...receiptProps,
      outcomes: outcomes.map((outcome, index) =>
        index === 1 ? { ...outcome, afterSha256: "sha256:0" } : outcome,
      ),
    }),
  /do not match the completed plan/u,
);
assert.throws(
  () =>
    createAutoMovieContractMigrationReceiptArtifacts({
      ...receiptProps,
      observed: driftedRename,
    }),
  /changed after planning/u,
);
assert.throws(
  () =>
    createAutoMovieContractMigrationReceiptArtifacts({
      ...receiptProps,
      to: changedBaseline,
    }),
  /compatible conflict-free plan/u,
);
assert.throws(
  () =>
    createAutoMovieContractMigrationReceiptArtifacts({
      ...receiptProps,
      to: baseline("2", changedTarget),
    }),
  /baselines do not match the plan/u,
);
assert.throws(
  () =>
    createAutoMovieContractMigrationReceiptArtifacts({
      ...receiptProps,
      from: baseline("1", { ...original, "docs/discovery/extra.md": "# X\n" }),
    }),
  /baselines do not match the plan/u,
);
assert.throws(
  () =>
    createAutoMovieContractMigrationReceiptArtifacts({
      ...receiptProps,
      plan: {
        ...plan,
        conflicts: [
          { kind: "target-collision", path: "x", reason: "occupied" },
        ],
      },
    }),
  /compatible conflict-free plan/u,
);
assert.throws(
  () =>
    createAutoMovieContractMigrationReceiptArtifacts({
      ...receiptProps,
      plan: { ...plan, protocol: "other" as typeof plan.protocol },
    }),
  /compatible conflict-free plan/u,
);
assert.throws(
  () =>
    createAutoMovieContractMigrationReceiptArtifacts({
      ...receiptProps,
      plan: { ...plan, fromVersion: "0" },
    }),
  /compatible conflict-free plan/u,
);
assert.throws(
  () =>
    createAutoMovieContractMigrationReceiptArtifacts({
      ...receiptProps,
      plan: { ...plan, toVersion: "0" },
    }),
  /compatible conflict-free plan/u,
);
assert.throws(
  () =>
    createAutoMovieContractMigrationReceiptArtifacts({
      ...receiptProps,
      from: createAutoMovieContractBaseline({
        files: original,
        language: "korean",
        version: "1",
      }),
    }),
  /compatible conflict-free plan/u,
);

// An already migrated project plans no action against its own generation.
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
assert.throws(() =>
  planAutoMovieContractMigration({
    current: original,
    from: baseline("1", original),
    targetSources: target,
    to: baseline("1", target),
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
