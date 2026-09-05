import assert from "node:assert/strict";

import {
  AUTO_MOVIE_DELIVERY_TOC_END,
  AUTO_MOVIE_DELIVERY_TOC_START,
  type IAutoMovieContractBaseline,
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

/** Replace one anchor that must exist, so a stale anchor fails the case. */
const spliced = (text: string, anchor: string, replacement: string): string => {
  assert.equal(text.includes(anchor), true, `arrangement anchor ${anchor}`);
  return text.replace(anchor, replacement);
};

const original = {
  "docs/discovery/a.md": "# A\n\n## Rule {#rule}\n\nOld.\n",
  "docs/discovery/rename.md": "# Rename\n\n## Rule {#rename}\n",
};
const target = {
  "docs/discovery/a.md": "# A\n\n## Rule {#rule}\n\nNew.\n",
  "docs/discovery/added.md": "# Added\n\n## Added {#added}\n",
  "docs/discovery/renamed.md": original["docs/discovery/rename.md"],
};
const originalBaseline = baseline("0.1.0", original);
const targetBaseline = baseline("0.2.0", target);
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
    to: baseline("0.1.0", original),
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
    parseAutoMovieContractBaseline(JSON.stringify(baseline("0.2.0", target))),
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
// Two lexical spellings of one portable target fail at the input stage, on a
// population as on a baseline.
assert.throws(
  () =>
    applyAutoMovieContractMigrationPlan(plan, {
      ...original,
      "docs/discovery/A.md": original["docs/discovery/a.md"],
    }),
  /repeats portable path "docs\/discovery\/a\.md"/u,
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
  language: string;
  observedInputDigest: string;
  planDigest: string;
  protocol: string;
  publicationGeneration: string;
  to: { identity: string; version: string };
  validation: { status: string; targetBaselineIdentity: string };
};
assert.deepEqual(
  {
    actions: receiptRecord.actions,
    from: receiptRecord.from,
    language: receiptRecord.language,
    observedInputDigest: receiptRecord.observedInputDigest,
    protocol: receiptRecord.protocol,
    to: receiptRecord.to,
    validation: receiptRecord.validation,
  },
  {
    actions: outcomes,
    from: { identity: plan.inputs.from, version: "0.1.0" },
    language: "english",
    observedInputDigest: plan.inputs.current,
    protocol: "automovie.contract-migration-receipt.v1",
    to: { identity: plan.inputs.to, version: "0.2.0" },
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
const changedBaseline = baseline("0.3.0", changedTarget);
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
      to: baseline("0.2.0", changedTarget),
    }),
  /baselines do not match the plan/u,
);
assert.throws(
  () =>
    createAutoMovieContractMigrationReceiptArtifacts({
      ...receiptProps,
      from: baseline("0.1.0", {
        ...original,
        "docs/discovery/extra.md": "# X\n",
      }),
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
      plan: { ...plan, fromVersion: "0.0.0" },
    }),
  /compatible conflict-free plan/u,
);
assert.throws(
  () =>
    createAutoMovieContractMigrationReceiptArtifacts({
      ...receiptProps,
      plan: { ...plan, toVersion: "0.0.0" },
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
        version: "0.1.0",
      }),
    }),
  /compatible conflict-free plan/u,
);

// An already migrated project plans no action against its own generation.
assert.deepEqual(
  planAutoMovieContractMigration({
    current: applied,
    from: baseline("0.2.0", target),
    targetSources: target,
    to: baseline("0.2.0", target),
  }).actions,
  [],
);

// Baseline creation: anchors come from visible H2 headings only, paths from
// the portable shared-contract inventory only.
const fencedAnchor =
  "# Contract\n\n```md\n## Example {#not-a-contract-anchor}\n```\n";
assert.deepEqual(
  baseline("0.1.0", { "docs/principles/core/fenced.md": fencedAnchor }).files[0]
    ?.anchors,
  [],
);
assert.deepEqual(baseline("0.1.0", {}).files, []);
for (const valid of [
  "docs/language/principles/common.md",
  "docs/discovery/core/common.md",
  "docs/upstream/story/scripts.md",
  "docs/obligations/café.md",
])
  assert.equal(isAutoMovieContractTargetPath(valid), true, valid);
for (const invalid of [
  "",
  "../outside.md",
  "docs/discovery/../outside.md",
  "docs/discovery/./a.md",
  "docs/discovery//a.md",
  "/docs/discovery/a.md",
  "docs\\discovery\\outside.md",
  "docs/discovery/CON.md",
  "docs/discovery/COM1.md",
  "docs/discovery/name .md\0",
  "docs/discovery/a./b.md",
  "docs/discovery/a /b.md",
  "docs/discovery/a?.md",
  "docs/discovery/a.txt",
  "docs/obligations/cafe\u0301.md",
  "docs/contracts/local.md",
  "docs/scripts/001-act/index.md",
])
  assert.equal(isAutoMovieContractTargetPath(invalid), false, invalid);
assert.throws(
  () =>
    createAutoMovieContractBaseline({
      files: {},
      language: "klingon" as IAutoMovieContractBaseline["language"],
      version: "0.1.0",
    }),
  /invalid language/u,
);
assert.throws(
  () =>
    baseline("0.1.0", {
      "docs/discovery/A.md": original["docs/discovery/a.md"],
      "docs/discovery/a.md": original["docs/discovery/a.md"],
    }),
  /portable collision/u,
);
assert.throws(
  () =>
    baseline("0.1.0", {
      "docs/discovery/duplicate.md":
        "# Duplicate\n\n## One {#same}\n\n## Two {#same}\n",
    }),
  /invalid anchors/u,
);

// A generation is one exact semantic version; a range, an alias, or a
// locator names more than one inventory or none.
for (const exact of ["0.1.0", "1.2.3-beta.1+build.5", "10.0.0-rc-1", "2.0.0+7"])
  assert.equal(baseline(exact, {}).version, exact);
for (const range of [
  "1",
  "1.2",
  "01.2.3",
  "1.x",
  "1.*",
  "^1.0.0",
  "~1.0.0",
  ">=1.0.0",
  "1.0.0 beta",
  "1.0.0-",
  "1.0.0-01",
  "latest",
  "workspace:*",
  "npm:@automovie/template@1.0.0",
  " 1.0.0",
])
  assert.throws(() => baseline(range, {}), /exact generation/u, range);

// The baseline reader refuses every malformed record before any path in it
// reaches project I/O.
const orderedBaseline = baseline("0.1.0", original);
const rejects = (value: unknown, pattern: RegExp): void =>
  assert.throws(
    () => parseAutoMovieContractBaseline(JSON.stringify(value)),
    pattern,
  );
rejects(null, /must be an object/u);
rejects([], /unsupported field set/u);
rejects({ ...orderedBaseline, extra: 1 }, /unsupported field set/u);
rejects(
  { ...orderedBaseline, protocol: "automovie.contract-baseline.v0" },
  /Unsupported AutoMovie contract baseline protocol/u,
);
rejects({ ...orderedBaseline, language: "klingon" }, /invalid language/u);
rejects({ ...orderedBaseline, version: "^0.1.0" }, /exact generation/u);
rejects({ ...orderedBaseline, files: {} }, /files must be an array/u);
rejects({ ...orderedBaseline, files: [null] }, /file must be an object/u);
rejects(
  { ...orderedBaseline, files: [{ ...orderedBaseline.files[0], extra: 1 }] },
  /unsupported field set/u,
);
rejects(
  {
    ...orderedBaseline,
    files: [{ ...orderedBaseline.files[0], sha256: "sha256:xyz" }],
  },
  /invalid digest for docs\/discovery\/a\.md/u,
);
for (const anchors of [[1], [""], ["a b"], ["{a}"], ["a", "a"]])
  rejects(
    { ...orderedBaseline, files: [{ ...orderedBaseline.files[0], anchors }] },
    /invalid anchors for docs\/discovery\/a\.md/u,
  );
rejects(
  {
    ...orderedBaseline,
    files: [
      {
        anchors: [],
        path: "../outside.md",
        sha256:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      },
    ],
  },
  /Invalid AutoMovie contract baseline path/u,
);
rejects(
  { ...orderedBaseline, files: [...orderedBaseline.files].reverse() },
  /canonical path order/u,
);
rejects(
  {
    ...orderedBaseline,
    files: [
      { ...orderedBaseline.files[0], path: "docs/discovery/A.md" },
      orderedBaseline.files[0],
    ],
  },
  /repeats portable path "docs\/discovery\/a\.md"/u,
);

// A duplicate member is refused on the JSON text, in any object scope and
// under any escape spelling, because `JSON.parse` would keep the last one.
const baselineText = JSON.stringify(orderedBaseline);
assert.throws(
  () =>
    parseAutoMovieContractBaseline(
      spliced(baselineText, '"protocol":', '"protocol":"x","protocol":'),
    ),
  /repeats member "protocol" in one object/u,
);
assert.throws(
  () =>
    parseAutoMovieContractBaseline(
      spliced(baselineText, '"anchors":', '"anchors":[],"anchors":'),
    ),
  /repeats member "anchors" in one object/u,
);
assert.throws(
  () =>
    parseAutoMovieContractBaseline(
      spliced(
        baselineText,
        '"path":"docs/discovery/a.md"',
        '"p\\u0061th":"docs/discovery/a.md","path":"docs/discovery/a.md"',
      ),
    ),
  /repeats member "path" in one object/u,
);
// Negative twins: the same name in sibling objects, string values spelled
// like member names, and escaped quotes and backslashes inside a value are
// all one valid record.
const memberNamedAnchors = baseline("0.1.0", {
  "docs/discovery/a.md":
    '# A\n\n## Path {#path}\n\n## Sha {#sha256}\n\n## Quote {#a"b}\n\n## Slash {#a\\b}\n\n## Tail {#a\\}\n',
  "docs/discovery/b.md": original["docs/discovery/a.md"],
});
assert.deepEqual(memberNamedAnchors.files[0]!.anchors, [
  "path",
  "sha256",
  'a"b',
  "a\\b",
  "a\\",
]);
assert.deepEqual(
  parseAutoMovieContractBaseline(JSON.stringify(memberNamedAnchors)),
  memberNamedAnchors,
);

// Planner inputs: both baselines and the target inventory must agree before
// any classification happens.
assert.throws(
  () =>
    planAutoMovieContractMigration({
      current: original,
      from: baseline("0.1.0", original),
      targetSources: target,
      to: createAutoMovieContractBaseline({
        files: target,
        language: "korean",
        version: "0.2.0",
      }),
    }),
  /cannot change production language/u,
);
assert.throws(
  () =>
    planAutoMovieContractMigration({
      current: original,
      from: baseline("0.1.0", original),
      targetSources: target,
      to: baseline("0.1.0", target),
    }),
  /One contract generation cannot identify different baseline inventories/u,
);
for (const targetSources of [
  { ...target, "docs/discovery/extra.md": "# Extra\n" },
  { "docs/discovery/a.md": target["docs/discovery/a.md"] },
])
  assert.throws(
    () =>
      planAutoMovieContractMigration({
        current: original,
        from: originalBaseline,
        targetSources,
        to: targetBaseline,
      }),
    /Target source inventory does not match its baseline/u,
  );
assert.throws(
  () =>
    planAutoMovieContractMigration({
      current: original,
      from: originalBaseline,
      targetSources: { ...target, "docs/discovery/a.md": "# Other\n" },
      to: targetBaseline,
    }),
  /Target source does not match baseline for docs\/discovery\/a\.md/u,
);
assert.throws(
  () =>
    planAutoMovieContractMigration({
      current: original,
      from: originalBaseline,
      targetSources: target,
      to: {
        ...targetBaseline,
        files: targetBaseline.files.map((file) => ({ ...file, anchors: [] })),
      },
    }),
  /Target source does not match baseline for docs\/discovery\/a\.md/u,
);
assert.throws(
  () =>
    planAutoMovieContractMigration({
      current: {
        ...original,
        "docs/discovery/A.md": original["docs/discovery/a.md"],
      },
      from: originalBaseline,
      targetSources: target,
      to: targetBaseline,
    }),
  /repeats portable path/u,
);

// Planner classification: every conflict class from one witness each, with
// the adjacent conflict-free twin.
const migrate = (
  current: Readonly<Record<string, string>>,
  fromFiles: Readonly<Record<string, string>>,
  toFiles: Readonly<Record<string, string>>,
) =>
  planAutoMovieContractMigration({
    current,
    from: baseline("0.1.0", fromFiles),
    targetSources: toFiles,
    to: baseline("0.2.0", toFiles),
  });
const summary = (
  migration: ReturnType<typeof migrate>,
): { actions: string[]; conflicts: string[] } => ({
  actions: migration.actions.map((action) => `${action.action} ${action.path}`),
  conflicts: migration.conflicts.map(
    (conflict) => `${conflict.kind} ${conflict.path}`,
  ),
});
const shared = "# Shared\n\n## Rule {#shared}\n";
assert.deepEqual(
  summary(
    migrate(
      { "docs/discovery/x.md": shared },
      { "docs/discovery/x.md": shared },
      { "docs/discovery/y.md": shared, "docs/discovery/z.md": shared },
    ),
  ),
  { actions: [], conflicts: ["rename-ambiguity docs/discovery/x.md"] },
);
assert.deepEqual(
  summary(
    migrate(
      { "docs/discovery/w.md": shared, "docs/discovery/x.md": shared },
      { "docs/discovery/w.md": shared, "docs/discovery/x.md": shared },
      { "docs/discovery/y.md": shared },
    ),
  ),
  {
    actions: [],
    conflicts: [
      "rename-ambiguity docs/discovery/w.md",
      "rename-ambiguity docs/discovery/x.md",
    ],
  },
);
const renameFrom = { "docs/discovery/x.md": shared };
const renameTo = { "docs/discovery/y.md": shared };
assert.deepEqual(summary(migrate(renameFrom, renameFrom, renameTo)), {
  actions: ["rename docs/discovery/y.md"],
  conflicts: [],
});
assert.deepEqual(summary(migrate({}, renameFrom, renameTo)), {
  actions: [],
  conflicts: ["missing-source docs/discovery/x.md"],
});
assert.deepEqual(
  summary(
    migrate({ "docs/discovery/y.md": "# Other\n" }, renameFrom, renameTo),
  ),
  { actions: [], conflicts: ["missing-source docs/discovery/x.md"] },
);
assert.deepEqual(
  summary(
    migrate({ "docs/discovery/x.md": "# Edited\n" }, renameFrom, renameTo),
  ),
  { actions: [], conflicts: ["local-modification docs/discovery/x.md"] },
);
assert.deepEqual(
  summary(
    migrate(
      { "docs/discovery/x.md": shared, "docs/discovery/y.md": "# Other\n" },
      renameFrom,
      renameTo,
    ),
  ),
  { actions: [], conflicts: ["target-collision docs/discovery/y.md"] },
);
const added = { "docs/discovery/n.md": shared };
assert.deepEqual(summary(migrate({}, {}, added)), {
  actions: ["add docs/discovery/n.md"],
  conflicts: [],
});
assert.deepEqual(summary(migrate(added, {}, added)), {
  actions: [],
  conflicts: [],
});
assert.deepEqual(
  summary(migrate({ "docs/discovery/n.md": "# Other\n" }, {}, added)),
  { actions: [], conflicts: ["target-collision docs/discovery/n.md"] },
);
const retired = { "docs/discovery/r.md": shared };
assert.deepEqual(summary(migrate({}, retired, {})), {
  actions: [],
  conflicts: [],
});
assert.deepEqual(
  summary(migrate({ "docs/discovery/r.md": "# Edited\n" }, retired, {})),
  { actions: [], conflicts: ["local-modification docs/discovery/r.md"] },
);
assert.deepEqual(summary(migrate(retired, retired, {})), {
  actions: [],
  conflicts: ["removed-contract docs/discovery/r.md"],
});
const revised = {
  "docs/discovery/r.md": "# Shared\n\n## Rule {#shared}\n\nMore.\n",
};
assert.deepEqual(summary(migrate({}, retired, revised)), {
  actions: [],
  conflicts: ["missing-source docs/discovery/r.md"],
});
assert.deepEqual(summary(migrate(retired, retired, revised)), {
  actions: ["write docs/discovery/r.md"],
  conflicts: [],
});
assert.deepEqual(summary(migrate(revised, retired, revised)), {
  actions: [],
  conflicts: [],
});

const recoveredRename = planAutoMovieContractMigration({
  current: {
    "docs/discovery/rename.md": original["docs/discovery/rename.md"],
    "docs/discovery/renamed.md": original["docs/discovery/rename.md"],
  },
  from: baseline("0.1.0", {
    "docs/discovery/rename.md": original["docs/discovery/rename.md"],
  }),
  targetSources: {
    "docs/discovery/renamed.md": original["docs/discovery/rename.md"],
  },
  to: baseline("0.2.0", {
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
    from: baseline("0.1.0", {
      "docs/discovery/a.md": original["docs/discovery/a.md"],
    }),
    targetSources: removedAnchor,
    to: baseline("0.2.0", removedAnchor),
  }).conflicts[0]?.kind,
  "removed-anchor",
);
assert.equal(
  planAutoMovieContractMigration({
    current: { "docs/discovery/a.md": "authored" },
    from: baseline("0.1.0", {
      "docs/discovery/a.md": original["docs/discovery/a.md"],
    }),
    targetSources: target,
    to: baseline("0.2.0", target),
  }).conflicts[0]?.kind,
  "local-modification",
);
assert.throws(
  () =>
    applyAutoMovieContractMigrationPlan(
      {
        ...plan,
        conflicts: [
          { kind: "target-collision", path: "x", reason: "occupied" },
        ],
      },
      original,
    ),
  /with conflicts cannot be applied/u,
);

// Delivery index: the canonical bytes are the authored H1 line, one blank
// line, and the managed block in unit filename order, in every mode.
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
const canonical = [
  "# Act One",
  "",
  AUTO_MOVIE_DELIVERY_TOC_START,
  "- [First](./001-first.md)",
  "- [Second \\] movement\\\\path](./002-second.md)",
  AUTO_MOVIE_DELIVERY_TOC_END,
  "",
].join("\n");
const rendered = planAutoMovieDeliveryToc({
  indexPath: "docs/scripts/001-act/index.md",
  indexSource: index,
  units,
});
assert.deepEqual(
  { changed: rendered.changed, diagnostics: rendered.diagnostics },
  { changed: true, diagnostics: [] },
);
assert.equal(rendered.source, canonical);
assert.equal(
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: "# Act One\r\n",
    units,
  }).source,
  canonical,
);
assert.equal(
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: index,
    units: [
      units[0]!,
      units[1]!,
      { path: "003-third.md", source: "# Third\n\n## Scene {#third}\n" },
    ],
  }).source,
  canonical.replace(
    `${AUTO_MOVIE_DELIVERY_TOC_END}\n`,
    `- [Third](./003-third.md)\n${AUTO_MOVIE_DELIVERY_TOC_END}\n`,
  ),
);
const paddedIndex = "# Padded index  \n";
assert.equal(
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: paddedIndex,
    units,
  }).source.startsWith(paddedIndex),
  true,
);
assert.deepEqual(
  planAutoMovieDeliveryToc({
    check: true,
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: rendered.source,
    units,
  }),
  { changed: false, diagnostics: [], source: canonical },
);
const staleCheck = planAutoMovieDeliveryToc({
  check: true,
  indexPath: "docs/scripts/001-act/index.md",
  indexSource: index,
  units,
});
assert.deepEqual(staleCheck, {
  changed: true,
  diagnostics: [
    "docs/scripts/001-act/index.md has a missing, stale, or misordered delivery TOC.",
  ],
  source: canonical,
});
assert.equal(
  planAutoMovieDeliveryToc({
    check: true,
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: canonical.replace("./001-first.md", "./001-wrong.md"),
    units,
  }).diagnostics.length,
  1,
);
const tocRejects = (indexSource: string, pattern: RegExp): void =>
  assert.throws(
    () =>
      planAutoMovieDeliveryToc({
        check: true,
        indexPath: "docs/scripts/001-act/index.md",
        indexSource,
        units,
      }),
    pattern,
  );
tocRejects(
  `${rendered.source}${AUTO_MOVIE_DELIVERY_TOC_END}\n`,
  /duplicate managed TOC delimiters/u,
);
tocRejects(
  `${index}${AUTO_MOVIE_DELIVERY_TOC_START}\n`,
  /malformed managed TOC block/u,
);
tocRejects(
  `${index}${AUTO_MOVIE_DELIVERY_TOC_END}\n${AUTO_MOVIE_DELIVERY_TOC_START}\n`,
  /malformed managed TOC block/u,
);
tocRejects(
  `${rendered.source}- [Wrong](../outside.md)\n`,
  /only its H1 title and generated unit links/u,
);
tocRejects(
  `${index}\n## Authored prose {#wrong-owner}\n`,
  /only its H1 title and generated unit links/u,
);
tocRejects("Just prose\n", /must contain exactly one H1 title/u);
tocRejects("# One\n\n# Two\n", /must contain exactly one H1 title/u);
tocRejects(
  "## Lead {#lead}\n\n# Title\n",
  /must contain exactly one H1 title/u,
);
const unitRejects = (
  units: readonly { path: string; source: string }[],
  pattern: RegExp,
): void =>
  assert.throws(
    () =>
      planAutoMovieDeliveryToc({
        indexPath: "docs/scripts/001-act/index.md",
        indexSource: index,
        units,
      }),
    pattern,
  );
unitRejects([units[0]!, units[0]!], /repeats 002-second\.md/u);
unitRejects(
  [{ path: "../outside.md", source: "# Outside\n" }],
  /invalid unit path/u,
);
unitRejects(
  [{ path: "001-First.md", source: "# Outside\n" }],
  /invalid unit path/u,
);
unitRejects(
  [{ path: "003-none.md", source: "## Only {#only}\n" }],
  /003-none\.md must contain exactly one H1 title/u,
);
unitRejects(
  [{ path: "003-two.md", source: "# One\n\n# Two\n" }],
  /must contain exactly one H1 title/u,
);
unitRejects(
  [{ path: "003-lead.md", source: "## Lead {#lead}\n\n# Title\n" }],
  /must contain exactly one H1 title/u,
);

process.stdout.write("contract migration and delivery toc passed\n");
