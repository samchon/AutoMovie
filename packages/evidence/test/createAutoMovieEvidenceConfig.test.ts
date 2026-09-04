import {
  type AutoMoviePopulationScope,
  createAutoMovieContractBindingManifest,
  createAutoMovieEvidenceConfig,
  createAutoMovieProductionPrincipleClaim,
  createAutoMovieRetainedPilotHost,
} from "@automovie/evidence";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createEvidenceProjectFixture } from "./EvidenceProjectFixture";

type Graph = Parameters<typeof createAutoMovieEvidenceConfig>[0];
type Claim = NonNullable<Graph["claims"]>[number];
type ContractManifest = ReturnType<
  typeof createAutoMovieContractBindingManifest
>;

const roots: string[] = [];

/**
 * A disposable project with synthetic contract inputs owned by this test.
 */
const root = (): string => createEvidenceProjectFixture(roots);

/**
 * A shared contract inside the generated project's own documentation root.
 */
const contract = (location: string, relative: string): string =>
  path.join(location, relative);

const write = (location: string, relative: string, content: string): void => {
  const file = path.join(location, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

/** Refuse to silently weaken a mutation-based arrangement. */
const rewrite = (
  source: string,
  search: string | RegExp,
  replacement: string,
): string => {
  const rewritten = source.replace(search, replacement);
  assert.notEqual(rewritten, source, "the fixture mutation anchor must exist");
  return rewritten;
};

/** Write a shared contract into the generated project's local inventory. */
const writeContract = (
  location: string,
  relative: string,
  content: string,
): void => {
  const file = contract(location, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

const target = (title: string, anchor: string): string =>
  `# ${title} contract\n\nThis production-only target states one bounded rule for its selected hosts.\n\n<!--\n### A commented heading is not a target.\n-->\n\n\`\`\`md\n### A fenced heading is not a target.\n\`\`\`\n\n## ${title} {#${anchor}}\n\nSelected hosts preserve the production-owned ${title.toLowerCase()} decision without replacing shared law.\n\nReview question: does the selected host preserve this exact production-owned decision?\n\nSources: production decision recorded by the owning project.\n`;

const localTarget = (title: string, anchor: string): string =>
  `<!-- @evidence discovery/core/common.md#shared-local-boundary The production audit retained this exact local rule. -->\n${target(title, anchor)}`;

const disabled = (location: string): Graph => ({
  location,
  kind: null,
  populationScope: { mode: "complete-production" },
  settings: "disabled",
  research: "disabled",
  maps: "disabled",
  models: "disabled",
  spaces: "disabled",
  materials: "disabled",
  instances: "disabled",
  motions: "disabled",
  systems: "disabled",
  treatments: "disabled",
  scripts: "disabled",
  screenplays: "disabled",
  briefs: "disabled",
  mapSources: "disabled",
  modelSources: "disabled",
  spaceSources: "disabled",
  materialSources: "disabled",
  instanceSources: "disabled",
  motionSources: "disabled",
  systemSources: "disabled",
  shots: "disabled",
  productionSources: "disabled",
  filmSources: "disabled",
  claims: [],
});

/** Create a typed film reset predecessor over already-written retained hosts. */
const filmResetScope = (
  location: string,
  hosts: readonly string[],
): AutoMoviePopulationScope => ({
  mode: "complete-production-reset",
  owner: "test-owner",
  transition: {
    version: 1,
    kind: "film",
    productionLocation: location,
    owner: "test-owner",
    pilotScope: { mode: "first-pilot", partitionGroup: "001-delivery" },
    reviewedBranches: ["treatments", "scripts", "screenplays"],
    retainedHosts: hosts.map((relative) =>
      createAutoMovieRetainedPilotHost({
        path: relative.replaceAll("\\", "/"),
        source: fs.readFileSync(path.join(location, relative), "utf8"),
      }),
    ),
  },
});

/** Create a typed library reset predecessor for the first model pair. */
const libraryResetScope = (
  location: string,
  hosts: readonly string[],
): AutoMoviePopulationScope => ({
  mode: "complete-production-reset",
  owner: "test-owner",
  transition: {
    version: 1,
    kind: "library",
    productionLocation: location,
    owner: "test-owner",
    pilotScope: { mode: "first-pilot" },
    reviewedPairs: [{ design: "models", source: "modelSources" }],
    retainedHosts: hosts.map((relative) =>
      createAutoMovieRetainedPilotHost({
        path: relative.replaceAll("\\", "/"),
        source: fs.readFileSync(path.join(location, relative), "utf8"),
      }),
    ),
  },
});

const throws = (task: () => unknown, fragment: string): boolean => {
  try {
    task();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(fragment);
  }
};

const referencesOf = (claim: Claim | undefined) =>
  claim === undefined
    ? []
    : Array.isArray(claim.reference)
      ? claim.reference
      : [claim.reference];

const referenceTo = (claim: Claim | undefined, file: string) =>
  referencesOf(claim).find(
    (reference) =>
      reference.type === "markdown" && reference.files.includes(file),
  );

const discoveryFilesOf = (claim: Claim | undefined): string[] =>
  referencesOf(claim).flatMap((reference) =>
    reference.type === "markdown" &&
    reference.files[0]?.startsWith("discovery/") === true
      ? reference.files
      : [],
  );

const sharedFilesOf = (
  claim: Claim | undefined,
  family: "obligations" | "principles" | "upstream",
): string[] =>
  referencesOf(claim)
    .flatMap((reference) =>
      reference.type === "markdown" ? reference.files : [],
    )
    .filter((file) => file.startsWith(`${family}/`))
    .sort();

const manifestContractPaths = (
  manifest: ContractManifest,
  branch?: ContractManifest["branches"][number]["name"],
): string[] => [
  ...new Set(
    manifest.bindings
      .filter((binding) => branch === undefined || binding.branch === branch)
      .flatMap((binding) =>
        binding.target.type === "contract" ? [binding.target.path] : [],
      ),
  ),
];

try {
  const scopeRoot = root();
  const missingScope = disabled(scopeRoot) as Partial<Graph>;
  delete missingScope.populationScope;
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(missingScope as Graph),
      "populationScope must be an explicit object",
    ),
    true,
  );
  for (const populationScope of [
    { mode: "unknown" },
    { mode: "complete-production", partitionGroup: "001-first" },
  ])
    assert.equal(
      throws(
        () =>
          createAutoMovieEvidenceConfig({
            ...disabled(scopeRoot),
            populationScope,
          } as Graph),
        populationScope.mode === "unknown"
          ? "Unsupported production population scope"
          : "unsupported fields: partitionGroup",
      ),
      true,
    );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(scopeRoot),
          kind: "film",
          populationScope: { mode: "first-pilot" },
        }),
      "film pilot requires one exact 001-lower-kebab-case",
    ),
    true,
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(scopeRoot),
          kind: "library",
          populationScope: {
            mode: "first-pilot",
            partitionGroup: "001-first",
          },
        }),
      "library pilot cannot invent a partitionGroup",
    ),
    true,
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(scopeRoot),
          kind: "brief",
          populationScope: { mode: "first-pilot" },
        }),
      "first-pilot is available only for a film or library",
    ),
    true,
  );
  assert.deepEqual(
    createAutoMovieContractBindingManifest(disabled(scopeRoot)).populationScope,
    { mode: "complete-production" },
  );
  const missingSharedFamily = root();
  fs.rmSync(path.join(missingSharedFamily, "docs", "discovery"), {
    recursive: true,
  });
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(missingSharedFamily)),
      "Shared contract inventory changed without graph wiring",
    ),
    true,
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(scopeRoot),
          kind: "brief",
          populationScope: { mode: "complete-production-reset" },
        } as unknown as Graph),
      "complete-production-reset is available only after a film or library pilot",
    ),
    true,
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(scopeRoot),
          kind: "library",
          populationScope: { mode: "first-pilot" },
        }),
      "must begin with research or an active settings layer",
    ),
    true,
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(scopeRoot),
          kind: "film",
          populationScope: filmResetScope(scopeRoot, []),
        }),
      "treatments, scripts, and screenplays to reset together to draft",
    ),
    true,
  );

  const repeatedReview = root();
  write(
    repeatedReview,
    "docs/settings/review.md",
    "## Review {#review}\n<!--\n@evidence principles/core/common.md#scope-preservation The unit owns its complete boundary.\n@evidenceReview principles/core/common.md#scope-preservation #abcdef0 Compared the target with the host. Verified relationship: The unit owns its complete boundary.\n-->\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(repeatedReview)),
      "[evidence-review-restatement] principles/core/common.md#scope-preservation (docs/settings/review.md#review)",
    ),
    true,
  );

  const reusedReview = root();
  write(
    reusedReview,
    "src/models/review.ts",
    `/**
 * @evidence principles/core/source-units.md#scope-preservation Owns one model boundary.
 * @evidenceReview principles/core/source-units.md#scope-preservation #abcdef0 Checked principles/core/source-units.md#scope-preservation against this export and found the left profile is the weakest observation.
 * @evidence principles/core/source-units.md#substantive-completion Builds one complete model.
 * @evidenceReview principles/core/source-units.md#substantive-completion #abcdef1 Checked principles/core/source-units.md#substantive-completion against this export and found the left profile is the weakest observation.
 */
export const review = true;
`,
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(reusedReview)),
      "[evidence-review-reused] principles/core/source-units.md#substantive-completion (src/models/review.ts::docblock@1)",
    ),
    true,
  );

  const pilotRoot = root();
  write(pilotRoot, "docs/settings/production.md", "## Scope {#scope}\n");
  const pilotGraph = createAutoMovieEvidenceConfig({
    ...disabled(pilotRoot),
    kind: "film",
    populationScope: {
      mode: "first-pilot",
      partitionGroup: "001-first-delivery",
    },
    settings: "draft",
  });
  assert.deepEqual(
    pilotGraph.claims.find((claim) =>
      claim.name?.startsWith("scripts H2 units"),
    )?.files,
    ["scripts/001-first-delivery/???-*.md"],
  );

  const draftCodeExample = root();
  write(
    draftCodeExample,
    "docs/settings/production.md",
    [
      "## Scope {#scope}",
      "",
      "```md",
      "<!-- @evidence contracts/example.md#rule This is only an example. -->",
      "```",
      "",
    ].join("\n"),
  );
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled(draftCodeExample),
      kind: "library",
      settings: "draft",
    }),
  );

  const indexOnly = root();
  write(indexOnly, "docs/scripts/001-empty/index.md", "# Empty\n");
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(indexOnly)),
      "scripts/001-empty is a delivery group without a numbered unit file",
    ),
    true,
  );

  const missingDeliveryIndex = root();
  write(
    missingDeliveryIndex,
    "docs/scripts/001-unindexed/001-unit.md",
    "# Unit\n\n## Sequence {#sequence}\n### Scene {#scene}\n#### Beat {#beat}\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(missingDeliveryIndex)),
      "scripts/001-unindexed is a resident delivery group without index.md",
    ),
    true,
  );

  const invalidTreatmentName = root();
  write(invalidTreatmentName, "docs/treatments/index.md", "# Index\n");
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(invalidTreatmentName)),
      "Treatments are flat numbered event files",
    ),
    true,
  );

  const invalidDeliveryPlacement = root();
  write(
    invalidDeliveryPlacement,
    "docs/scripts/001-unit.md",
    "# Unit\n\n## Sequence {#sequence}\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(invalidDeliveryPlacement)),
      "scripts use numbered delivery-group directories",
    ),
    true,
  );

  const invalidDeliveryIndex = root();
  write(
    invalidDeliveryIndex,
    "docs/scripts/001-delivery/index.md",
    "# Delivery\n\n## Hidden {#hidden}\n",
  );
  write(
    invalidDeliveryIndex,
    "docs/scripts/001-delivery/001-unit.md",
    "# Unit\n\n## Sequence {#sequence}\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(invalidDeliveryIndex)),
      "is a delivery index and may contain only its H1 title",
    ),
    true,
  );

  const missingDeliveryH1 = root();
  write(missingDeliveryH1, "docs/scripts/001-delivery/index.md", "No title\n");
  write(
    missingDeliveryH1,
    "docs/scripts/001-delivery/001-unit.md",
    "# Unit\n\n## Sequence {#sequence}\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(missingDeliveryH1)),
      "must begin with exactly one H1 narrative title",
    ),
    true,
  );

  const disabledNarrative = root();
  write(disabledNarrative, "docs/scripts/001-stale/index.md", "# Stale\n");
  write(
    disabledNarrative,
    "docs/scripts/001-stale/001-unit.md",
    "# Stale\n\n## Unit {#unit}\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(disabledNarrative)),
      "scripts is disabled but governed hosts remain",
    ),
    true,
  );

  const outOfScopePilot = root();
  write(outOfScopePilot, "docs/settings/production.md", "## Scope {#scope}\n");
  write(
    outOfScopePilot,
    "docs/treatments/001-event.md",
    "# Event\n\n## Event {#event}\n",
  );
  for (const group of ["001-first-delivery", "002-retained-delivery"]) {
    write(outOfScopePilot, `docs/scripts/${group}/index.md`, `# ${group}\n`);
    write(
      outOfScopePilot,
      `docs/scripts/${group}/001-unit.md`,
      `# ${group}\n\n## Sequence {#${group}-sequence}\n\n### Scene {#${group}-scene}\n\n#### Beat {#${group}-beat}\n`,
    );
  }
  const scopedGraph = createAutoMovieEvidenceConfig({
    ...disabled(outOfScopePilot),
    kind: "film",
    populationScope: {
      mode: "first-pilot",
      partitionGroup: "001-first-delivery",
    },
    settings: "review",
    treatments: "review",
    scripts: "draft",
  });
  assert.deepEqual(
    scopedGraph.claims.find((claim) =>
      claim.name?.startsWith("scripts H2 units"),
    )?.files,
    ["scripts/001-first-delivery/???-*.md"],
    "a structurally valid out-of-scope delivery group remains resident but unclaimed during the first pilot",
  );

  const resetRoot = root();
  write(resetRoot, "docs/settings/production.md", "## Scope {#scope}\n");
  write(
    resetRoot,
    "docs/models/subject.md",
    "## Subject {#subject}\n<!-- @evidence principles/core/common.md#scope-preservation Retained pilot review. -->\n",
  );
  write(
    resetRoot,
    "src/models/subject.ts",
    "/** @evidence models/subject.md#subject Retained pilot source. */\nexport class Subject {}\n",
  );
  const resetDeclaration: Graph = {
    ...disabled(resetRoot),
    kind: "library",
    populationScope: libraryResetScope(resetRoot, [
      "docs/models/subject.md",
      "src/models/subject.ts",
    ]),
    settings: "review",
    models: "draft",
    modelSources: "draft",
  };
  assert.doesNotThrow(() => createAutoMovieEvidenceConfig(resetDeclaration));
  write(
    resetRoot,
    "docs/maps/sibling.md",
    "## Sibling {#sibling}\n<!-- @evidence principles/core/common.md#scope-preservation A stale, unpaired design tag. -->\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...resetDeclaration,
          maps: "draft",
        }),
      "docs/maps/sibling.md is draft and must be completed before evidence tags are authored",
    ),
    true,
    "reset preserves evidence tags only for an actual design/source pair that is simultaneously draft",
  );
  const filmReset = root();
  write(filmReset, "docs/settings/production.md", "## Scope {#scope}\n");
  write(
    filmReset,
    "docs/treatments/001-event.md",
    "# Event\n\n## Event {#event}\n<!-- @evidence principles/core/common.md#scope-preservation Retained film-pilot review. -->\n",
  );
  for (const layer of ["scripts", "screenplays"] as const) {
    write(filmReset, `docs/${layer}/001-delivery/index.md`, "# Delivery\n");
    write(
      filmReset,
      `docs/${layer}/001-delivery/001-unit.md`,
      "# Unit\n\n## Sequence {#sequence}\n### Scene {#scene}\n#### Beat {#beat}\n",
    );
  }
  const filmResetPopulation = filmResetScope(filmReset, [
    "docs/treatments/001-event.md",
  ]);
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled(filmReset),
      kind: "film",
      populationScope: filmResetPopulation,
      settings: "review",
      treatments: "draft",
      scripts: "draft",
      screenplays: "draft",
    }),
  );
  write(
    filmReset,
    "docs/maps/stale.md",
    "## Stale {#stale}\n<!-- @evidence principles/core/common.md#scope-preservation A non-reset film branch cannot retain evidence. -->\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(filmReset),
          kind: "film",
          populationScope: filmResetPopulation,
          settings: "review",
          maps: "draft",
          treatments: "draft",
          scripts: "draft",
          screenplays: "draft",
        }),
      "docs/maps/stale.md is draft and must be completed before evidence tags are authored",
    ),
    true,
  );
  fs.rmSync(path.join(resetRoot, "docs", "maps"), { recursive: true });
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...resetDeclaration,
          populationScope: { mode: "complete-production" },
        }),
      "modelSources cannot enter draft before models is in review",
    ),
    true,
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(scopeRoot),
          kind: "library",
          populationScope: libraryResetScope(scopeRoot, []),
        }),
      "requires at least one matching design and source branch in draft",
    ),
    true,
  );

  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled("relative-production"),
          location: 42,
        } as unknown as Graph),
      "location must be an absolute string; received 42",
    ),
    true,
  );

  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled("relative-production"),
          location: "relative-production",
        }),
      "location must be an absolute string",
    ),
    true,
  );

  const missingLocationRoot = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig(
          disabled(path.join(missingLocationRoot, "missing")),
        ),
      "location does not exist",
    ),
    true,
  );

  const fileLocationRoot = root();
  write(fileLocationRoot, "docs/settings/production.md", "## Scope {#scope}\n");
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig(
          disabled(
            path.join(fileLocationRoot, "docs", "settings", "production.md"),
          ),
        ),
      "location is not a directory",
    ),
    true,
  );

  const invalidKind = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(invalidKind),
          kind: "feature",
        } as unknown as Graph),
      "Unsupported production kind",
    ),
    true,
  );

  const invalidStage = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(invalidStage),
          settings: "complete",
        } as unknown as Graph),
      "settings has unsupported evidence stage",
    ),
    true,
  );

  const invalidClaims = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(invalidClaims),
          claims: null,
        } as unknown as Graph),
      "claims must be an array",
    ),
    true,
  );

  const empty = root();
  const graph = createAutoMovieEvidenceConfig(disabled(empty));
  assert.equal(
    new Set(graph.claims.map((claim) => claim.name)).size,
    graph.claims.length,
    "every shared claim has one stable diagnostic identity",
  );
  for (const claim of graph.claims) {
    assert.equal(
      typeof claim.name,
      "string",
      "every shared manifest claim must carry its stable diagnostic name",
    );
    assert.notEqual(
      claim.symbol,
      undefined,
      `${claim.name} must declare the host symbols projected by the manifest`,
    );
    assert.ok(
      claim.files.some((file) => file.startsWith("!") === false),
      `${claim.name} lost its prewired positive host glob`,
    );
    assert.ok(
      referencesOf(claim).length > 0,
      `${claim.name} lost its prewired reference population`,
    );
    for (const reference of referencesOf(claim)) {
      assert.equal(
        reference.type,
        "markdown",
        `${claim.name} uses a non-Markdown shared reference the public manifest cannot project`,
      );
      assert.equal(
        reference.files.length,
        1,
        `${claim.name} must expose each shared contract or population route as one independently classified reference`,
      );
      assert.notEqual(
        reference.symbol,
        undefined,
        `${claim.name} must declare the target symbols projected by the manifest`,
      );
      for (const file of reference.files) {
        if (file.startsWith("principles/")) {
          assert.equal(
            reference.checklist,
            true,
            `${file} must be answered by every selected host for itself`,
          );
          assert.equal(
            reference.noEvidenceExclude,
            true,
            `${file} must not permit a host to excuse a principle`,
          );
          assert.notEqual(
            claim.symbol,
            "file",
            `${file} must bind authored units rather than one whole Markdown file`,
          );
        }
        if (file.startsWith("obligations/")) {
          assert.notEqual(
            reference.checklist,
            true,
            `${file} must be distributed across its selected population`,
          );
          assert.equal(
            reference.noEvidenceExclude,
            true,
            `${file} states a duty the selected layer cannot excuse`,
          );
        }
        if (file.startsWith("upstream/")) {
          assert.equal(
            reference.checklist,
            true,
            `${file} must be answered by every selected inheriting host`,
          );
          assert.equal(
            reference.noEvidenceExclude,
            undefined,
            `${file} must permit a concrete negative when actual parents were sufficient`,
          );
          assert.notEqual(
            claim.symbol,
            "file",
            `${file} must bind inherited units rather than a whole Markdown file`,
          );
        }
      }
    }
  }
  for (const sourceClaim of [
    "shot source owners answer source-unit principle checklists",
    "production source owners answer source-unit principle checklists",
    "film source owners answer source-unit principle checklists",
  ])
    assert.deepEqual(
      graph.claims.find((claim) => claim.name?.startsWith(sourceClaim))?.symbol,
      ["type", "property", "function"],
      `${sourceClaim} must select exported types as well as values; removing type must reopen this canary`,
    );
  write(empty, "docs/settings/production.md", "## Scope {#scope}\n");
  for (const [layer, expected] of Object.entries({
    settings: ["discovery/core/common.md", "discovery/core/settings.md"],
    research: ["discovery/core/common.md"],
    maps: [
      "discovery/core/common.md",
      "discovery/design/designs.md",
      "discovery/design/maps.md",
    ],
    models: [
      "discovery/core/common.md",
      "discovery/design/designs.md",
      "discovery/design/models.md",
    ],
    spaces: [
      "discovery/core/common.md",
      "discovery/design/designs.md",
      "discovery/design/spaces.md",
    ],
    materials: [
      "discovery/core/common.md",
      "discovery/design/designs.md",
      "discovery/design/materials.md",
    ],
    instances: [
      "discovery/core/common.md",
      "discovery/design/designs.md",
      "discovery/design/instances.md",
    ],
    motions: [
      "discovery/core/common.md",
      "discovery/design/designs.md",
      "discovery/design/motions.md",
    ],
    systems: [
      "discovery/core/common.md",
      "discovery/design/designs.md",
      "discovery/design/systems.md",
    ],
    treatments: [
      "discovery/core/common.md",
      "discovery/story/films.md",
      "discovery/story/treatments.md",
    ],
    scripts: [
      "discovery/core/common.md",
      "discovery/story/films.md",
      "discovery/story/scripts.md",
    ],
    screenplays: [
      "discovery/core/common.md",
      "discovery/story/films.md",
      "discovery/story/screenplays.md",
    ],
    briefs: ["discovery/core/common.md", "discovery/delivery/briefs.md"],
  })) {
    const discoveryClaim = graph.claims.find(
      (candidate) =>
        candidate.name ===
        `the ${layer} work-specific contract accounts for its open-world discovery duties`,
    );
    assert.deepEqual(discoveryClaim?.files, ["contracts/*.md"]);
    assert.equal(discoveryClaim?.symbol, "file");
    assert.deepEqual(discoveryClaim?.evidenceExcludeCarriers, [
      "contracts/index.md",
    ]);
    assert.deepEqual(
      discoveryFilesOf(discoveryClaim),
      expected,
      `${layer} work-specific contract discovery targets drifted from their semantic population`,
    );
    for (const file of discoveryFilesOf(discoveryClaim)) {
      const reference = referenceTo(discoveryClaim, file);
      assert.equal(
        reference !== undefined && "checklist" in reference
          ? reference.checklist
          : undefined,
        undefined,
        `${file} must remain ordinary population coverage rather than a per-H2 checklist`,
      );
      assert.equal(
        reference?.noEvidenceExclude,
        undefined,
        `${file} must permit one truthful population-wide no-result exclusion`,
      );
      assert.equal(
        reference?.requireReview,
        false,
        `${file} must not require a fingerprint before the host reaches review`,
      );
    }
    assert.deepEqual(
      discoveryFilesOf(
        graph.claims.find(
          (candidate) =>
            candidate.name ===
            `${layer} H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work`,
        ),
      ),
      [],
      `${layer} authored units must describe the work rather than testify about its contract audit`,
    );
  }
  const draftDiscovery = root();
  write(draftDiscovery, "docs/settings/production.md", "## Scope {#scope}\n");
  const draftDiscoveryClaim = createAutoMovieEvidenceConfig({
    ...disabled(draftDiscovery),
    kind: "library",
    settings: "draft",
  }).claims.find(
    (candidate) =>
      candidate.name ===
      "the settings work-specific contract accounts for its open-world discovery duties",
  );
  assert.equal(
    draftDiscoveryClaim?.disabled,
    false,
    "the separate contract audit starts with authored draft rather than waiting for evidence",
  );
  assert.equal(
    referenceTo(draftDiscoveryClaim, "discovery/core/common.md")?.requireReview,
    false,
  );
  for (const layer of ["treatments", "scripts", "screenplays", "briefs"])
    for (const depth of [3, 4])
      assert.deepEqual(
        discoveryFilesOf(
          graph.claims.find(
            (claim) =>
              claim.name ===
              `${layer} H${depth} units answer their principle checklists and account for inherited work`,
          ),
        ),
        [],
        `${layer} H${depth} must not duplicate H2 population discovery`,
      );
  for (const [layer, contract] of Object.entries({
    settings: "settings",
    research: "research",
    maps: "maps",
    models: "models",
    spaces: "spaces",
    materials: "materials",
    instances: "instances",
    motions: "motions",
    systems: "systems",
    treatments: "treatments",
    scripts: "scripts",
    screenplays: "screenplays",
    briefs: "briefs",
  })) {
    const narrative = ["treatments", "scripts", "screenplays"].includes(layer);
    const domain = ["settings", "research"].includes(layer)
      ? "core"
      : layer === "briefs"
        ? "delivery"
        : narrative
          ? "story"
          : "design";
    const inherited = [
      "maps",
      "models",
      "spaces",
      "materials",
      "instances",
      "motions",
      "systems",
      "briefs",
    ].includes(layer);
    const depths = ["scripts", "screenplays", "briefs"].includes(layer)
      ? [2, 3, 4]
      : [2];
    for (const depth of depths) {
      const claim = graph.claims.find(
        (candidate) =>
          candidate.name ===
          (depth === 2
            ? `${layer} H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work`
            : `${layer} H${depth} units answer their principle checklists and account for inherited work`),
      );
      assert.deepEqual(
        sharedFilesOf(claim, "principles"),
        [
          "principles/core/common.md",
          ...(narrative ? ["principles/story/narratives.md"] : []),
          ...(inherited ? ["principles/core/inherited-units.md"] : []),
          `principles/${domain}/${contract}.md`,
        ].sort(),
        `${layer} H${depth} must answer every applicable principle for itself`,
      );
      assert.deepEqual(
        sharedFilesOf(claim, "upstream"),
        ["settings", "research"].includes(layer)
          ? []
          : [
              `upstream/${
                ["briefs"].includes(layer)
                  ? "delivery"
                  : narrative
                    ? "story"
                    : "design"
              }/${layer}.md`,
            ],
        `${layer} H${depth} must select exactly its domain-partitioned upstream checklist`,
      );
      assert.deepEqual(
        sharedFilesOf(claim, "obligations"),
        depth === 2
          ? [
              "obligations/core/common.md",
              ...(narrative ? ["obligations/story/narratives.md"] : []),
              ...(layer === "research"
                ? []
                : [`obligations/${domain}/${contract}.md`]),
            ].sort()
          : [],
        `${layer} obligations must be covered once-plus across only its primary H2 owner population`,
      );
    }
  }
  const briefH2 = graph.claims.find(
    (claim) =>
      claim.name ===
      "briefs H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  );
  assert.deepEqual(
    sharedFilesOf(briefH2, "obligations"),
    ["obligations/core/common.md", "obligations/delivery/briefs.md"],
    "brief H2 units must cover addressability without inheriting film narrative obligations",
  );
  const briefAddressability = referenceTo(
    briefH2,
    "obligations/delivery/briefs.md",
  );
  assert.equal(
    briefAddressability !== undefined && "checklist" in briefAddressability
      ? briefAddressability.checklist
      : undefined,
    undefined,
  );
  assert.equal(briefAddressability?.noEvidenceExclude, true);
  for (const depth of [3, 4]) {
    const briefUnit = graph.claims.find(
      (claim) =>
        claim.name ===
        `briefs H${depth} units answer their principle checklists and account for inherited work`,
    );
    assert.deepEqual(
      sharedFilesOf(briefUnit, "principles"),
      [
        "principles/core/common.md",
        "principles/core/inherited-units.md",
        "principles/delivery/briefs.md",
      ],
      `brief H${depth} units must answer information structure without inheriting film narrative principles`,
    );
    const briefInformation = referenceTo(
      briefUnit,
      "principles/delivery/briefs.md",
    );
    assert.equal(
      briefInformation !== undefined && "checklist" in briefInformation
        ? briefInformation.checklist
        : undefined,
      true,
    );
    assert.equal(briefInformation?.noEvidenceExclude, true);
  }
  const treatmentH2 = graph.claims.find(
    (claim) =>
      claim.name ===
      "treatments H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  );
  assert.deepEqual(
    sharedFilesOf(treatmentH2, "obligations"),
    [
      "obligations/core/common.md",
      "obligations/story/narratives.md",
      "obligations/story/treatments.md",
    ],
    "the treatment H2 population must cover its complete treatment obligations once across the population",
  );
  for (const depth of [3, 4])
    assert.deepEqual(
      sharedFilesOf(
        graph.claims.find(
          (claim) =>
            claim.name ===
            `treatments H${depth} units answer their principle checklists and account for inherited work`,
        ),
        "obligations",
      ),
      [],
      `treatment H${depth} units must not turn treatment population obligations into per-unit checklists`,
    );
  assert.ok(
    graph.claims.some(
      (claim) =>
        claim.name ===
        "the reserved evidence-lint canary proves the generated graph is running",
    ),
    "the permanent evidence-lint canary was removed",
  );
  for (const layer of [
    "maps",
    "models",
    "spaces",
    "materials",
    "instances",
    "motions",
    "systems",
  ]) {
    assert.ok(
      graph.claims.some(
        (claim) =>
          claim.name ===
            `${layer} H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work` &&
          claim.disabled === true,
      ),
      `disabled shared claims omitted docs/${layer}`,
    );
    assert.ok(
      graph.claims.some(
        (claim) =>
          claim.name ===
            `${layer.slice(0, -1)}Sources owners each answer exactly one ${layer} design file` &&
          claim.disabled === true,
      ),
      `disabled shared claims omitted src/${layer}`,
    );
  }

  const additive = root();
  write(
    additive,
    "docs/contracts/tone.md",
    localTarget("Local tone", "local-tone"),
  );
  const productionOwnedClaim: Claim = {
    name: "production-only tone remains additive",
    type: "markdown",
    root: "docs",
    files: ["settings/**/*.md"],
    symbol: "file",
    disabled: true,
    reference: {
      type: "markdown",
      root: "docs",
      files: ["contracts/tone.md"],
      symbol: "h2",
      checklist: true,
      noEvidenceExclude: true,
    },
  };
  const extended = createAutoMovieEvidenceConfig({
    ...disabled(additive),
    claims: [productionOwnedClaim],
  });
  assert.equal(
    extended.claims.at(-1),
    productionOwnedClaim,
    "production claims must append after, not replace, the shared graph",
  );

  const localBinding = root();
  write(
    localBinding,
    "docs/settings/production.md",
    "# Settings\n\n## Scope {#scope}\n\nOne exact scope.\n",
  );
  write(
    localBinding,
    "docs/contracts/tone.md",
    localTarget("Local tone", "local-tone"),
  );
  const localClaim = createAutoMovieProductionPrincipleClaim({
    name: "settings preserve the local tone",
    document: "contracts/tone.md",
    files: ["settings/**/*.md"],
    layer: "settings",
    stage: "evidence",
    symbol: "h2",
    populationScope: { mode: "complete-production" },
  });
  const localDeclaration: Graph = {
    ...disabled(localBinding),
    kind: "library",
    settings: "evidence",
    claims: [localClaim],
  };
  assert.deepEqual(
    createAutoMovieContractBindingManifest(localDeclaration).localBindings,
    [
      {
        claim: "settings preserve the local tone",
        layer: "settings",
        stage: "evidence",
        enforced: true,
        populationScope: { mode: "complete-production" },
        host: {
          root: "docs",
          files: ["settings/**/*.md"],
          symbols: ["h2"],
        },
        targets: [
          {
            root: "docs",
            files: ["contracts/tone.md"],
            symbols: ["h2"],
          },
        ],
      },
    ],
    "the manifest must retain exact project-local binding identity and stage",
  );
  assert.deepEqual(
    createAutoMovieContractBindingManifest(localDeclaration).localAudits,
    [],
  );
  const pilotScope = {
    mode: "first-pilot",
    partitionGroup: "001-delivery",
  } as const;
  const localAuditClaim = createAutoMovieProductionPrincipleClaim({
    name: "pilot records the inapplicable local tone",
    document: "contracts/tone.md",
    files: ["settings/**/*.md"],
    layer: "settings",
    stage: "draft",
    symbol: "h2",
    populationScope: pilotScope,
    inapplicable: true,
  });
  assert.deepEqual(
    createAutoMovieContractBindingManifest({
      ...disabled(localBinding),
      kind: "film",
      populationScope: pilotScope,
      settings: "draft",
      claims: [localAuditClaim],
    }).localAudits,
    [
      {
        claim: "pilot records the inapplicable local tone",
        layer: "settings",
        stage: "draft",
        enforced: false,
        populationScope: pilotScope,
        host: {
          root: "docs",
          files: ["settings/**/*.md"],
          symbols: ["h2"],
        },
        targets: [
          {
            root: "docs",
            files: ["contracts/tone.md"],
            symbols: ["h2"],
          },
        ],
      },
    ],
    "a pilot-only inapplicable declaration must remain an audit, not a binding",
  );
  for (const malformedBinding of [
    null,
    { ...localClaim.autoMovieBinding, stage: "draft" },
    {
      ...localClaim.autoMovieBinding,
      populationScope: { mode: "first-pilot" },
    },
    { ...localClaim.autoMovieBinding, disposition: "unknown" },
  ])
    assert.equal(
      throws(
        () =>
          createAutoMovieEvidenceConfig({
            ...localDeclaration,
            claims: [
              {
                ...localClaim,
                autoMovieBinding: malformedBinding,
              } as unknown as Claim,
            ],
          }),
        "does not match its declared layer, stage, population scope, or disposition",
      ),
      true,
      "detached project-local binding metadata must fail closed",
    );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...localDeclaration,
          claims: [{ ...localClaim, disabled: true }],
        }),
      "does not match its declared layer, stage, population scope, or disposition",
    ),
    true,
    "a positive local binding cannot be disabled independently of its stage",
  );

  const unselected = root();
  write(unselected, "docs/settings/production.md", "## Scope {#scope}\n");
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(unselected),
          settings: "draft",
        }),
      "Select film, brief, or library",
    ),
    true,
  );

  const hiddenSettingsSubheading = root();
  write(
    hiddenSettingsSubheading,
    "docs/settings/production.md",
    "## Scope {#scope}\n### Hidden decision {#hidden-decision}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(hiddenSettingsSubheading),
          kind: "library",
          settings: "draft",
        }),
      "uses H3 outside the configured H2 authored-unit topology",
    ),
    true,
  );

  const h3BeforeH2 = root();
  write(h3BeforeH2, "docs/settings/production.md", "## Scope {#scope}\n");
  write(
    h3BeforeH2,
    "docs/treatments/001-event.md",
    "# Event\n\n### Scene {#scene}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(h3BeforeH2),
          kind: "film",
          settings: "review",
          treatments: "draft",
        }),
      "uses H3 outside the configured H2 authored-unit topology",
    ),
    true,
  );

  const h4BeforeH3 = root();
  write(h4BeforeH3, "docs/settings/production.md", "## Scope {#scope}\n");
  write(
    h4BeforeH3,
    "docs/treatments/001-event.md",
    "# Event\n\n## Event {#event}\n#### Beat {#beat}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(h4BeforeH3),
          kind: "film",
          settings: "review",
          treatments: "draft",
        }),
      "uses H4 outside the configured H2 authored-unit topology",
    ),
    true,
  );

  const hiddenNarrativeSubheading = root();
  write(
    hiddenNarrativeSubheading,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(
    hiddenNarrativeSubheading,
    "docs/treatments/001-event.md",
    "# Event\n\n## Event {#event}\n",
  );
  write(
    hiddenNarrativeSubheading,
    "docs/scripts/001-delivery/001-unit.md",
    "# Unit\n\n## Sequence {#sequence}\n### Scene {#scene}\n#### Beat {#beat}\n##### Hidden note {#hidden-note}\n",
  );
  write(
    hiddenNarrativeSubheading,
    "docs/scripts/001-delivery/index.md",
    "# Delivery\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(hiddenNarrativeSubheading),
          kind: "film",
          settings: "review",
          treatments: "review",
          scripts: "draft",
        }),
      "uses H5 outside the configured H2/H3/H4 authored-unit topology",
    ),
    true,
  );

  const missingBeat = root();
  write(missingBeat, "docs/settings/production.md", "## Scope {#scope}\n");
  write(
    missingBeat,
    "docs/treatments/001-event.md",
    "# Event\n\n## Event {#event}\n",
  );
  write(
    missingBeat,
    "docs/scripts/001-delivery/001-unit.md",
    "# Unit\n\n## Sequence {#sequence}\n### Scene {#scene}\n",
  );
  write(missingBeat, "docs/scripts/001-delivery/index.md", "# Delivery\n");
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(missingBeat),
          kind: "film",
          settings: "review",
          treatments: "review",
          scripts: "draft",
        }),
      "has no H4 unit",
    ),
    true,
  );

  const repeatedLayerAnchor = root();
  write(repeatedLayerAnchor, "docs/settings/first.md", "## First {#shared}\n");
  write(
    repeatedLayerAnchor,
    "docs/settings/second.md",
    "## Second {#shared}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(repeatedLayerAnchor),
          kind: "library",
          settings: "draft",
        }),
      "settings repeats #shared",
    ),
    true,
  );

  const mismatchedIdentity = root();
  write(
    mismatchedIdentity,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(
    mismatchedIdentity,
    "docs/treatments/001-event.md",
    "# Event\n\n## Event {#event}\n",
  );
  write(
    mismatchedIdentity,
    "docs/scripts/001-delivery/001-unit.md",
    "# Unit\n\n## Sequence {#sequence}\n### Scene {#scene}\n#### Beat {#beat}\n",
  );
  write(
    mismatchedIdentity,
    "docs/scripts/001-delivery/index.md",
    "# Delivery\n",
  );
  write(
    mismatchedIdentity,
    "docs/screenplays/001-delivery/001-unit.md",
    "# Unit\n\n## Sequence {#sequence}\n### Scene {#scene}\n#### Other beat {#other-beat}\n",
  );
  write(
    mismatchedIdentity,
    "docs/screenplays/001-delivery/index.md",
    "# Delivery\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(mismatchedIdentity),
          kind: "film",
          settings: "review",
          treatments: "review",
          scripts: "review",
          screenplays: "draft",
        }),
      "must exactly preserve scripts identity, nesting, and order",
    ),
    true,
  );

  for (const [name, body, diagnostic] of [
    [
      "h3-before-h2",
      "# Unit\n\n### Scene {#scene}\n#### Beat {#beat}\n",
      "has an H3 before an H2",
    ],
    [
      "h4-before-h2",
      "# Unit\n\n#### Beat {#beat}\n",
      "has an H4 before its H2/H3 parents",
    ],
    [
      "h4-before-h3",
      "# Unit\n\n## Sequence {#sequence}\n#### Beat {#beat}\n",
      "has an H4 before its H2/H3 parents",
    ],
  ] as const) {
    const malformedLineage = root();
    write(
      malformedLineage,
      "docs/settings/production.md",
      "## Scope {#scope}\n",
    );
    write(
      malformedLineage,
      "docs/treatments/001-event.md",
      "# Event\n\n## Event {#event}\n",
    );
    write(
      malformedLineage,
      "docs/scripts/001-delivery/index.md",
      "# Delivery\n",
    );
    write(malformedLineage, `docs/scripts/001-delivery/001-${name}.md`, body);
    assert.equal(
      throws(
        () =>
          createAutoMovieEvidenceConfig({
            ...disabled(malformedLineage),
            kind: "film",
            settings: "review",
            treatments: "review",
            scripts: "draft",
          }),
        diagnostic,
      ),
      true,
    );
  }

  const mismatchedTitle = root();
  write(mismatchedTitle, "docs/settings/production.md", "## Scope {#scope}\n");
  write(
    mismatchedTitle,
    "docs/treatments/001-event.md",
    "# Event\n\n## Event {#event}\n",
  );
  for (const layer of ["scripts", "screenplays"] as const) {
    write(
      mismatchedTitle,
      `docs/${layer}/001-delivery/index.md`,
      `# ${layer === "scripts" ? "Delivery" : "Changed delivery"}\n`,
    );
    write(
      mismatchedTitle,
      `docs/${layer}/001-delivery/001-unit.md`,
      `# ${layer === "scripts" ? "Unit" : "Changed unit"}\n\n## Sequence {#sequence}\n### Scene {#scene}\n#### Beat {#beat}\n`,
    );
  }
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(mismatchedTitle),
          kind: "film",
          settings: "review",
          treatments: "review",
          scripts: "review",
          screenplays: "draft",
        }),
      "must exactly preserve the scripts H1 title",
    ),
    true,
  );

  const sourcePopulationManifest = root();
  write(
    sourcePopulationManifest,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(
    sourcePopulationManifest,
    "docs/models/owner.md",
    "## Owner {#owner}\n",
  );
  write(
    sourcePopulationManifest,
    "src/models/owner.ts",
    "export class Owner {}\n",
  );
  assert.ok(
    createAutoMovieContractBindingManifest({
      ...disabled(sourcePopulationManifest),
      kind: "library",
      settings: "review",
      models: "review",
      modelSources: "draft",
    }).bindings.some(
      (binding) =>
        binding.branch === "modelSources" &&
        binding.target.type === "population" &&
        binding.target.root === "docs",
    ),
  );
  write(
    mismatchedTitle,
    "docs/screenplays/001-delivery/001-unit.md",
    "# Unit\n\n## Sequence {#sequence}\n### Scene {#scene}\n#### Beat {#beat}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(mismatchedTitle),
          kind: "film",
          settings: "review",
          treatments: "review",
          scripts: "review",
          screenplays: "draft",
        }),
      "delivery-group H1 title",
    ),
    true,
  );

  const kindWithoutBeginning = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(kindWithoutBeginning),
          kind: "library",
        }),
      "must begin with research or an active settings layer",
    ),
    true,
  );

  assert.equal(
    ["storylines", "scenarios", "script"].some(
      (legacy) => legacy in disabled(kindWithoutBeginning),
    ),
    false,
    "the public declaration must expose only treatments, scripts, and screenplays",
  );

  const treatmentBeforeSettings = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(treatmentBeforeSettings),
          kind: "film",
          settings: "draft",
          treatments: "draft",
        }),
      "treatments cannot enter draft before settings is in review",
    ),
    true,
  );

  const scriptBeforeTreatment = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(scriptBeforeTreatment),
          kind: "film",
          settings: "review",
          treatments: "draft",
          scripts: "draft",
        }),
      "scripts cannot enter draft before treatments is in review",
    ),
    true,
  );

  const screenplayBeforeScript = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(screenplayBeforeScript),
          kind: "film",
          settings: "review",
          treatments: "review",
          scripts: "draft",
          screenplays: "draft",
        }),
      "screenplays cannot enter draft before scripts is in review",
    ),
    true,
  );

  // A design layer promoted over an active but unreviewed foundation reads
  // complete while paying nothing for it, because `designFoundations` withholds
  // a foundation's units until the foundation itself is in review.
  const spacesBeforeMaps = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(spacesBeforeMaps),
          kind: "library",
          settings: "review",
          maps: "evidence",
          spaces: "review",
        }),
      "spaces cannot enter review before maps is in review",
    ),
    true,
  );

  // The same rule must not deadlock the one mutual pair in the foundation
  // table. `motions` and `systems` name each other, so neither can be reviewed
  // first; gating review entry rather than draft entry lets both be written
  // against one another and promoted together in a single declaration.
  const mutualPromotion = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(mutualPromotion),
          kind: "library",
          settings: "review",
          maps: "review",
          models: "review",
          spaces: "review",
          materials: "review",
          instances: "review",
          motions: "review",
          systems: "review",
        }),
      "cannot enter review before",
    ),
    false,
  );

  const filmWithBrief = root();
  write(filmWithBrief, "docs/settings/production.md", "## Scope {#scope}\n");
  write(
    filmWithBrief,
    "docs/briefs/delivery.md",
    "## Delivery {#delivery}\n### Shot {#shot}\n#### Observation {#observation}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(filmWithBrief),
          kind: "film",
          settings: "review",
          briefs: "draft",
        }),
      "film cannot activate the direct-brief layer",
    ),
    true,
  );

  const unreviewedResearch = root();
  write(unreviewedResearch, "docs/research/source.md", "## Source {#source}\n");
  write(
    unreviewedResearch,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(unreviewedResearch),
          kind: "film",
          research: "draft",
          settings: "draft",
        }),
      "settings cannot enter draft before research is in review",
    ),
    true,
  );

  const researchOnly = root();
  write(researchOnly, "docs/research/source.md", "## Source {#source}\n");
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled(researchOnly),
      kind: "library",
      research: "evidence",
    }),
  );

  const interpretedResearch = root();
  write(
    interpretedResearch,
    "docs/research/source.md",
    "## Source {#source}\n",
  );
  write(
    interpretedResearch,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  const researchEvidenceGraph = createAutoMovieEvidenceConfig({
    ...disabled(interpretedResearch),
    kind: "library",
    research: "review",
    settings: "evidence",
  });
  const researchEvidenceClaim = researchEvidenceGraph.claims.find(
    (claim) =>
      claim.name ===
      "reviewed research records support the settings decisions that interpret them",
  );
  assert.deepEqual(researchEvidenceClaim?.files, ["settings/**/*.md"]);
  assert.equal(
    referenceTo(researchEvidenceClaim, "research/**/*.md")?.requireReview,
    false,
    "an evidence-stage settings host must not owe a review fingerprint early",
  );
  const researchReviewClaim = createAutoMovieEvidenceConfig({
    ...disabled(interpretedResearch),
    kind: "library",
    research: "review",
    settings: "review",
  }).claims.find(
    (claim) =>
      claim.name ===
      "reviewed research records support the settings decisions that interpret them",
  );
  assert.equal(
    referenceTo(researchReviewClaim, "research/**/*.md")?.requireReview,
    true,
    "research-consumption reviews begin with the consuming settings stage",
  );

  const sourceResidue = root();
  write(sourceResidue, "docs/settings/production.md", "## Scope {#scope}\n");
  write(sourceResidue, "src/models/residue.ts", "export class Residue {}\n");
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(sourceResidue),
          kind: "library",
          settings: "draft",
        }),
      "modelSources is disabled but governed hosts remain",
    ),
    true,
  );

  const emptySource = root();
  write(emptySource, "docs/settings/production.md", "## Scope {#scope}\n");
  write(emptySource, "docs/models/subject.md", "## Subject {#subject}\n");
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(emptySource),
          kind: "library",
          settings: "review",
          models: "review",
          modelSources: "draft",
        }),
      "modelSources cannot enter draft without a TypeScript host",
    ),
    true,
  );

  const prematureSource = root();
  write(prematureSource, "docs/settings/production.md", "## Scope {#scope}\n");
  write(prematureSource, "docs/models/subject.md", "## Subject {#subject}\n");
  write(
    prematureSource,
    "src/models/subject.ts",
    "/** @evidence models/subject.md premature */\nexport class Subject {}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(prematureSource),
          kind: "library",
          settings: "review",
          models: "review",
          modelSources: "draft",
        }),
      "draft and must be completed before evidence tags",
    ),
    true,
  );

  const emptyActive = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(emptyActive),
          kind: "film",
          settings: "draft",
        }),
      "without a Markdown host",
    ),
    true,
  );

  const residue = root();
  write(residue, "docs/settings/production.md", "## Scope {#scope}\n");
  write(residue, "docs/models/residue.md", "## Shape {#shape}\n");
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(residue),
          kind: "library",
          settings: "draft",
        }),
      "models is disabled but governed hosts remain",
    ),
    true,
  );

  const premature = root();
  write(
    premature,
    "docs/settings/production.md",
    "## Scope {#scope}\n\n<!-- @evidence principles/core/common.md#scope-preservation premature -->\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(premature),
          kind: "brief",
          settings: "draft",
        }),
      "draft and must be completed before evidence tags",
    ),
    true,
  );

  const ownerless = root();
  write(ownerless, "docs/settings/production.md", "## Scope {#scope}\n");
  write(ownerless, "docs/models/subject.md", "## Shape {#shape}\n");
  write(ownerless, "src/models/subject.ts", "const hidden = 1;\n");
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(ownerless),
          kind: "library",
          settings: "review",
          models: "review",
          modelSources: "draft",
        }),
      "no named exported owner",
    ),
    true,
  );

  /**
   * Keep every governed public source declaration evidence-addressable.
   *
   * Scenarios:
   *
   * 1. Direct named type, function, property, and class declarations remain
   *    valid, including private implementation accessors outside the public
   *    evidence population.
   * 2. Enum, namespace, re-export, anonymous default, public accessor,
   *    computed-member, and unsupported export forms are each refused with the
   *    replacement the production author must use.
   */
  const sourceExportProject = (source: string): string => {
    const location = root();
    write(location, "docs/settings/production.md", "## Scope {#scope}\n");
    write(location, "docs/models/subject.md", "## Shape {#shape}\n");
    write(location, "src/models/subject.ts", source);
    return location;
  };
  const sourceExportGraph = (source: string): Graph => ({
    ...disabled(sourceExportProject(source)),
    kind: "library",
    settings: "review",
    models: "review",
    modelSources: "draft",
  });
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig(
      sourceExportGraph(
        [
          'export interface ISubject { readonly id: string; readonly "literal": string; }',
          'export type SubjectId = "subject";',
          "export type SubjectShape = { readonly label: string; };",
          'export const subjectName = "subject";',
          'export const [primarySubject, , tertiarySubject] = ["one", "two", "three"] as const;',
          "export function createSubject(): object { return {}; }",
          "export class Subject {",
          "  public constructor() {}",
          '  public readonly id = "subject";',
          "  public move(): void {}",
          '  private get internalLabel(): string { return "subject"; }',
          '  protected get inheritedLabel(): string { return "subject"; }',
          '  get #internal(): string { return "subject"; }',
          "}",
        ].join("\n"),
      ),
    ),
  );
  for (const [source, fragment] of [
    [
      'export enum SubjectKind { Fixed = "fixed" }\nexport class Subject {}',
      "exports enum SubjectKind",
    ],
    [
      "export namespace SubjectParts { export const id = 1; }\nexport class Subject {}",
      "exports namespace SubjectParts",
    ],
    [
      'export { Subject } from "./subject.js";\nexport class LocalSubject {}',
      "uses a barrel or cross-module re-export",
    ],
    [
      'export * from "./subject.js";\nexport class LocalSubject {}',
      "uses a barrel or namespace export",
    ],
    [
      'export * as SubjectParts from "./subject.js";\nexport class LocalSubject {}',
      "uses a namespace export",
    ],
    [
      "const Subject = class {};\nexport { Subject as default };",
      "uses a default alias or imported re-export",
    ],
    [
      'import { Subject } from "./other.js";\nexport { Subject };\nexport class LocalSubject {}',
      "uses a default alias or imported re-export",
    ],
    ["export default class {}", "exports an anonymous default declaration"],
    [
      "export default function (): void {}",
      "exports an anonymous default declaration",
    ],
    [
      "const Subject = class {};\nexport default Subject;",
      "uses a default export expression or namespace export",
    ],
    [
      'export class Subject { public get label(): string { return "subject"; } }',
      "exports public accessor Subject.label",
    ],
    [
      "export class Subject { public set label(value: string) { void value; } }",
      "exports public accessor Subject.label",
    ],
    [
      'export class Subject { public accessor label = "subject"; }',
      "exports public accessor Subject.label",
    ],
    [
      'export class Subject { public ["label"] = "subject"; }',
      'exports computed public member Subject.["label"]',
    ],
    [
      'export class Subject { public "two words" = "subject"; }',
      'exports unaddressable public literal member Subject."two words"',
    ],
    [
      'export class Subject { public "" = "subject"; }',
      'exports unaddressable public literal member Subject.""',
    ],
    [
      "export import Subject = Models.Subject;",
      "exports unsupported ImportEqualsDeclaration syntax",
    ],
  ] as const) {
    assert.equal(
      throws(
        () => createAutoMovieEvidenceConfig(sourceExportGraph(source)),
        fragment,
      ),
      true,
      `the source export allowlist accepted ${fragment}`,
    );
  }

  const wrongModelOwner = root();
  write(wrongModelOwner, "docs/settings/production.md", "## Scope {#scope}\n");
  write(wrongModelOwner, "docs/models/subject.md", "## Shape {#shape}\n");
  write(
    wrongModelOwner,
    "src/models/subject.ts",
    "export function createSubject(): object { return {}; }\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(wrongModelOwner),
          kind: "library",
          settings: "review",
          models: "review",
          modelSources: "draft",
        }),
      "required kind (class)",
    ),
    true,
  );

  const abstractModelOwner = root();
  write(
    abstractModelOwner,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(abstractModelOwner, "docs/models/subject.md", "## Shape {#shape}\n");
  write(
    abstractModelOwner,
    "src/models/subject.ts",
    "export abstract class Subject {}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(abstractModelOwner),
          kind: "library",
          settings: "review",
          models: "review",
          modelSources: "draft",
        }),
      "required kind (class)",
    ),
    true,
  );

  const declaredModelOwner = root();
  write(
    declaredModelOwner,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(declaredModelOwner, "docs/models/subject.md", "## Shape {#shape}\n");
  write(
    declaredModelOwner,
    "src/models/subject.ts",
    "export declare class Subject {}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(declaredModelOwner),
          kind: "library",
          settings: "review",
          models: "review",
          modelSources: "draft",
        }),
      "required kind (class)",
    ),
    true,
  );

  for (const declaration of [
    "export declare function move(): void;\n",
    "export function move(): void;\n",
    "export declare const move: () => void;\n",
    "export const move: (() => void) | undefined;\n",
  ]) {
    const declaredMotionOwner = root();
    write(
      declaredMotionOwner,
      "docs/settings/production.md",
      "## Scope {#scope}\n",
    );
    write(declaredMotionOwner, "docs/motions/move.md", "## Move {#move}\n");
    write(declaredMotionOwner, "src/motions/move.ts", declaration);
    assert.equal(
      throws(
        () =>
          createAutoMovieEvidenceConfig({
            ...disabled(declaredMotionOwner),
            kind: "library",
            settings: "review",
            motions: "review",
            motionSources: "draft",
          }),
        "required kind (property, function)",
      ),
      true,
    );
  }

  const parsedModelOwner = root();
  write(parsedModelOwner, "docs/settings/production.md", "## Scope {#scope}\n");
  write(parsedModelOwner, "docs/models/subject.md", "## Shape {#shape}\n");
  write(
    parsedModelOwner,
    "src/models/subject.ts",
    [
      "// export class LineCommentDecoy {}",
      "/* export class BlockCommentDecoy {} */",
      'const doubleDecoy = "export class DoubleDecoy {}";',
      "const singleDecoy = 'export class SingleDecoy {}';",
      "const templateDecoy = `export class TemplateDecoy {}`;",
      'const escapedDecoy = "\\\"export class EscapedDecoy {}";',
      "const url = /https?:\\/\\//;",
      "const quotePattern = /['\"]/;",
      "export class 영화Owner {}",
      "void doubleDecoy; void singleDecoy; void templateDecoy; void escapedDecoy; void url; void quotePattern;",
      "",
    ].join("\n"),
  );
  assert.doesNotThrow(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled(parsedModelOwner),
        kind: "library",
        settings: "review",
        models: "review",
        modelSources: "draft",
      }),
    "owner detection must recognize a legal exported Unicode owner without confusing a preceding regular expression",
  );

  for (const declaration of [
    "class Subject {}\nexport { Subject };\n",
    "const move = (): void => {};\nexport { move as publicMove };\n",
    "function move(): void {}\nexport { move as publicMove };\n",
  ]) {
    const localExportOwner = root();
    write(
      localExportOwner,
      "docs/settings/production.md",
      "## Scope {#scope}\n",
    );
    const model = declaration.startsWith("class");
    write(
      localExportOwner,
      model ? "docs/models/subject.md" : "docs/motions/move.md",
      model ? "## Shape {#shape}\n" : "## Move {#move}\n",
    );
    write(
      localExportOwner,
      model ? "src/models/subject.ts" : "src/motions/move.ts",
      declaration,
    );
    assert.doesNotThrow(() =>
      createAutoMovieEvidenceConfig({
        ...disabled(localExportOwner),
        kind: "library",
        settings: "review",
        ...(model
          ? { models: "review" as const, modelSources: "draft" as const }
          : { motions: "review" as const, motionSources: "draft" as const }),
      }),
    );
  }

  const typeOnlyLocalExport = root();
  write(
    typeOnlyLocalExport,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(typeOnlyLocalExport, "docs/models/subject.md", "## Shape {#shape}\n");
  write(
    typeOnlyLocalExport,
    "src/models/subject.ts",
    "class Subject {}\nexport type { Subject };\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(typeOnlyLocalExport),
          kind: "library",
          settings: "review",
          models: "review",
          modelSources: "draft",
        }),
      "required kind (class)",
    ),
    true,
  );

  const uninitializedLocalExport = root();
  write(
    uninitializedLocalExport,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(uninitializedLocalExport, "docs/motions/move.md", "## Move {#move}\n");
  write(
    uninitializedLocalExport,
    "src/motions/move.ts",
    "let move: (() => void) | undefined, hidden = (): void => {};\nexport { move };\nvoid hidden;\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(uninitializedLocalExport),
          kind: "library",
          settings: "review",
          motions: "review",
          motionSources: "draft",
        }),
      "required kind (property, function)",
    ),
    true,
  );

  const mismatch = root();
  write(mismatch, "docs/settings/production.md", "## Scope {#scope}\n");
  write(
    mismatch,
    "docs/treatments/001-opening.md",
    "# Opening event\n\n## Event {#event}\n",
  );
  write(
    mismatch,
    "docs/scripts/001-delivery/001-opening.md",
    "# Opening unit\n\n## Sequence {#sequence}\n### Scene {#scene}\n#### Beat {#beat}\n",
  );
  write(mismatch, "docs/scripts/001-delivery/index.md", "# Delivery\n");
  write(
    mismatch,
    "docs/screenplays/001-delivery/002-renamed.md",
    "# Opening unit\n\n## Sequence {#sequence}\n### Scene {#scene}\n#### Beat {#beat}\n",
  );
  write(mismatch, "docs/screenplays/001-delivery/index.md", "# Delivery\n");
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(mismatch),
          kind: "film",
          settings: "review",
          treatments: "review",
          scripts: "review",
          screenplays: "draft",
        }),
      "filenames must exactly preserve",
    ),
    true,
  );

  const briefWithNarrative = root();
  write(
    briefWithNarrative,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(
    briefWithNarrative,
    "docs/treatments/001-event.md",
    "# Event\n\n## Event {#event}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(briefWithNarrative),
          kind: "brief",
          settings: "review",
          treatments: "draft",
        }),
      "cannot activate treatments",
    ),
    true,
  );

  const libraryWithShot = root();
  write(libraryWithShot, "docs/settings/production.md", "## Scope {#scope}\n");
  write(libraryWithShot, "src/shots/shot.ts", "export const shot = 1;\n");
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(libraryWithShot),
          kind: "library",
          settings: "review",
          shots: "draft",
        }),
      "cannot activate narrative, brief, shot",
    ),
    true,
  );

  const branches = root();
  write(branches, "docs/settings/production.md", "## Scope {#scope}\n");
  for (const name of [
    "maps",
    "models",
    "spaces",
    "materials",
    "instances",
    "motions",
    "systems",
  ])
    write(
      branches,
      `docs/${name}/owner.md`,
      `## ${name} owner {#${name}-owner}\n`,
    );
  write(branches, "src/models/owner.ts", "export class ModelOwner {}\n");
  for (const name of [
    "maps",
    "spaces",
    "materials",
    "instances",
    "motions",
    "systems",
  ])
    write(branches, `src/${name}/owner.ts`, `export const ${name}Owner = 1;\n`);
  write(branches, "src/production.ts", "export const production = 1;\n");
  const branchDeclaration: Graph = {
    ...disabled(branches),
    kind: "library",
    settings: "review",
    maps: "review",
    models: "review",
    spaces: "review",
    materials: "review",
    instances: "review",
    motions: "review",
    systems: "review",
    mapSources: "review",
    modelSources: "review",
    spaceSources: "review",
    materialSources: "review",
    instanceSources: "review",
    motionSources: "review",
    systemSources: "review",
    productionSources: "review",
  };
  const branchGraph = createAutoMovieEvidenceConfig(branchDeclaration);
  const branchManifest =
    createAutoMovieContractBindingManifest(branchDeclaration);
  assert.deepEqual(
    branchManifest.branches.map((branch) => branch.name),
    [
      "settings",
      "maps",
      "models",
      "spaces",
      "materials",
      "instances",
      "motions",
      "systems",
      "mapSources",
      "modelSources",
      "spaceSources",
      "materialSources",
      "instanceSources",
      "motionSources",
      "systemSources",
      "productionSources",
    ],
    "a library manifest must expose only its exact active authored and source branches",
  );
  assert.equal(
    branchManifest.bindings.every(
      (binding) =>
        binding.target.type !== "contract" ||
        binding.target.path.split("/").length === 3,
    ),
    true,
    "public contract routes must include their logical domain instead of freezing the legacy flat package layout",
  );
  assert.deepEqual(
    new Set(branchManifest.bindings.map((binding) => binding.relationship)),
    new Set(["checklist", "distributed-coverage", "foundation", "lineage"]),
    "the manifest must preserve every relationship form the graph assigns",
  );
  assert.deepEqual(
    createAutoMovieContractBindingManifest(branchDeclaration),
    branchManifest,
    "the same declaration and filesystem must produce one deterministic manifest",
  );
  const sourceUnitBindings = branchManifest.bindings.filter(
    (binding) =>
      binding.target.type === "contract" &&
      binding.target.path === "principles/core/source-units.md",
  );
  assert.deepEqual(
    sourceUnitBindings.map((binding) => binding.branch),
    [
      "mapSources",
      "modelSources",
      "spaceSources",
      "materialSources",
      "instanceSources",
      "motionSources",
      "systemSources",
      "productionSources",
    ],
    "every active source branch and no inactive source branch must expose its source-unit checklist",
  );
  assert.equal(
    sourceUnitBindings.every(
      (binding) => binding.relationship === "checklist" && binding.enforced,
    ),
    true,
    "review-stage source-unit checklists must be enforced checklist relationships",
  );

  const settingsOnly = root();
  write(settingsOnly, "docs/settings/production.md", "## Scope {#scope}\n");
  const settingsOnlyManifest = createAutoMovieContractBindingManifest({
    ...disabled(settingsOnly),
    kind: "library",
    settings: "draft",
  });
  assert.equal(
    settingsOnlyManifest.bindings.some(
      (binding) =>
        binding.target.type === "population" &&
        binding.target.root === "docs" &&
        binding.target.files.includes("research/**/*.md"),
    ),
    false,
    "a settings-only manifest must not publish a population route to disabled research",
  );
  assert.equal(
    manifestContractPaths(settingsOnlyManifest).includes(
      "principles/core/settings.md",
    ),
    true,
    "filtering an inactive population target must preserve active settings contract routes",
  );
  assert.equal(
    manifestContractPaths(settingsOnlyManifest).includes(
      "principles/core/source-units.md",
    ),
    false,
    "a manifest with no active source branch must not publish a source-unit checklist",
  );

  const pendingResearchConsumption = root();
  write(
    pendingResearchConsumption,
    "docs/research/source.md",
    "## Source {#source}\n",
  );
  write(
    pendingResearchConsumption,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  const pendingResearchManifest = createAutoMovieContractBindingManifest({
    ...disabled(pendingResearchConsumption),
    kind: "library",
    research: "review",
    settings: "draft",
  });
  const pendingResearchBindings = pendingResearchManifest.bindings.filter(
    (binding) =>
      binding.claim ===
        "reviewed research records support the settings decisions that interpret them" &&
      binding.target.type === "population" &&
      binding.target.root === "docs" &&
      binding.target.files.includes("research/**/*.md"),
  );
  assert.equal(
    pendingResearchBindings.length,
    1,
    "active research must retain its population route before settings reaches evidence",
  );
  assert.equal(
    pendingResearchBindings[0]!.enforced,
    false,
    "an active pre-evidence relationship must remain visible as unenforced",
  );

  const objectLibrary = root();
  write(objectLibrary, "docs/settings/production.md", "## Scope {#scope}\n");
  write(objectLibrary, "docs/models/object.md", "## Object {#object}\n");
  write(objectLibrary, "docs/motions/turn.md", "## Turn {#turn}\n");
  const objectManifest = createAutoMovieContractBindingManifest({
    ...disabled(objectLibrary),
    kind: "library",
    settings: "review",
    models: "draft",
    motions: "draft",
  });
  assert.deepEqual(
    objectManifest.branches.map((branch) => branch.name),
    ["settings", "models", "motions"],
    "an object library must not inherit building, narrative, or delivery branches",
  );
  assert.deepEqual(
    manifestContractPaths(objectManifest).sort(),
    [
      "discovery/core/common.md",
      "discovery/core/settings.md",
      "discovery/design/designs.md",
      "discovery/design/models.md",
      "discovery/design/motions.md",
      "obligations/core/common.md",
      "obligations/core/settings.md",
      "obligations/design/models.md",
      "obligations/design/motions.md",
      "principles/core/common.md",
      "principles/core/inherited-units.md",
      "principles/core/settings.md",
      "principles/design/models.md",
      "principles/design/motions.md",
      "upstream/design/models.md",
      "upstream/design/motions.md",
    ].sort(),
    "an object library must expose its complete core and selected design contract set",
  );
  assert.equal(
    objectManifest.bindings.some(
      (binding) =>
        binding.branch === "models" &&
        binding.stage === "draft" &&
        binding.enforced === false &&
        binding.target.type === "contract" &&
        binding.target.path === "principles/design/models.md",
    ),
    true,
    "draft routing must retain later principle duties without claiming that lint enforces them early",
  );
  assert.equal(
    objectManifest.bindings.some(
      (binding) =>
        binding.branch === "models" &&
        binding.stage === "draft" &&
        binding.enforced === true &&
        binding.target.type === "contract" &&
        binding.target.path === "discovery/design/models.md",
    ),
    true,
    "draft routing must show that discovery coverage is already enforced",
  );

  const buildingLibrary = root();
  write(buildingLibrary, "docs/settings/production.md", "## Scope {#scope}\n");
  for (const layer of ["spaces", "materials", "instances", "systems"])
    write(
      buildingLibrary,
      `docs/${layer}/building.md`,
      `## ${layer} {#${layer}}\n`,
    );
  const buildingManifest = createAutoMovieContractBindingManifest({
    ...disabled(buildingLibrary),
    kind: "library",
    settings: "review",
    spaces: "draft",
    materials: "draft",
    instances: "draft",
    systems: "draft",
  });
  assert.deepEqual(
    buildingManifest.branches.map((branch) => branch.name),
    ["settings", "spaces", "materials", "instances", "systems"],
    "a building library must not inherit object-motion, narrative, or delivery branches",
  );
  assert.deepEqual(
    manifestContractPaths(buildingManifest)
      .filter((contractPath) => contractPath.includes("/design/"))
      .sort(),
    [
      "discovery/design/designs.md",
      "discovery/design/instances.md",
      "discovery/design/materials.md",
      "discovery/design/spaces.md",
      "discovery/design/systems.md",
      "obligations/design/instances.md",
      "obligations/design/materials.md",
      "obligations/design/spaces.md",
      "obligations/design/systems.md",
      "principles/design/instances.md",
      "principles/design/materials.md",
      "principles/design/spaces.md",
      "principles/design/systems.md",
      "upstream/design/instances.md",
      "upstream/design/materials.md",
      "upstream/design/spaces.md",
      "upstream/design/systems.md",
    ].sort(),
    "a building library must expose only its shared and selected design contracts",
  );
  assert.ok(
    branchGraph.claims.some((claim) => claim.name?.includes("systemSources")),
    "the system source branch is not wired",
  );
  const systemObligation = branchGraph.claims.find((claim) =>
    claim.name?.includes("systems H2 units answer their principle checklists"),
  );
  assert.equal(
    referenceTo(systemObligation, "obligations/design/systems.md")
      ?.noEvidenceExclude,
    true,
    "required non-motion layer obligations must refuse exclusions",
  );
  const motionObligation = branchGraph.claims.find((claim) =>
    claim.name?.includes("motions H2 units answer their principle checklists"),
  );
  assert.equal(
    referenceTo(motionObligation, "obligations/design/motions.md")
      ?.noEvidenceExclude,
    true,
    "the population-wide motion-role obligation must refuse exclusions",
  );
  for (const foundation of [
    "maps",
    "models",
    "spaces",
    "materials",
    "instances",
    "systems",
  ])
    assert.ok(
      referenceTo(motionObligation, `${foundation}/owner.md`),
      `motion units omitted the active ${foundation} foundation`,
    );
  for (const [host, foundations] of Object.entries({
    spaces: ["maps"],
    models: ["spaces"],
    materials: ["models", "spaces"],
    instances: ["maps", "models", "spaces", "materials"],
    systems: ["maps", "models", "spaces", "materials", "instances", "motions"],
  })) {
    const hostClaim = branchGraph.claims.find((claim) =>
      claim.name?.includes(
        `${host} H2 units answer their principle checklists`,
      ),
    );
    for (const foundation of foundations)
      assert.ok(
        referenceTo(hostClaim, `${foundation}/owner.md`),
        `${host} units omitted the active ${foundation} foundation`,
      );
  }
  const exactOwner = branchGraph.claims.find((claim) =>
    claim.name?.includes("modelSources owners each answer exactly one"),
  );
  assert.ok(exactOwner, "the exact design-to-source owner claim is missing");
  const exactOwnerJson = JSON.stringify(exactOwner);
  assert.ok(
    exactOwnerJson.includes('"symbol":["type"]') &&
      exactOwnerJson.includes('"singleEvidencePerSymbol":true') &&
      !exactOwnerJson.includes('"uniqueEvidence":true'),
    "each exported model type must own one design file without forbidding peer types from sharing that design",
  );

  const film = root();
  write(film, "docs/settings/production.md", "## Scope {#scope}\n");
  const narrative =
    "# Unit\n\n## Sequence {#sequence}\n### Scene {#scene}\n#### Beat {#beat}\n";
  write(film, "docs/treatments/001-event.md", "# Event\n\n## Event {#event}\n");
  for (const layer of ["scripts", "screenplays"]) {
    write(film, `docs/${layer}/001-delivery/index.md`, "# Delivery\n");
    write(film, `docs/${layer}/001-delivery/001-unit.md`, narrative);
  }
  write(film, "src/shots/sequence.ts", "export const sequenceShot = 1;\n");
  write(film, "src/production.ts", "export const production = 1;\n");
  write(film, "src/film.ts", "export const assembledFilm = 1;\n");
  const filmDeclaration: Graph = {
    ...disabled(film),
    kind: "film",
    settings: "review",
    treatments: "review",
    scripts: "review",
    screenplays: "review",
    shots: "review",
    productionSources: "review",
    filmSources: "review",
  };
  const filmGraph = createAutoMovieEvidenceConfig(filmDeclaration);
  const filmManifest = createAutoMovieContractBindingManifest(filmDeclaration);
  const filmRouting = JSON.stringify({ filmGraph, filmManifest });
  for (const legacyPath of ["storylines/", "scenarios/", '"script/**/*.md"'])
    assert.equal(
      filmRouting.includes(legacyPath),
      false,
      `the canonical film graph must not retain legacy path ${legacyPath}`,
    );
  assert.equal(
    manifestContractPaths(filmManifest).some((contractPath) =>
      contractPath.includes("/design/"),
    ),
    false,
    "a design-free film must not inherit design contracts merely because AutoMovie can author designs",
  );
  assert.equal(
    manifestContractPaths(filmManifest).includes(
      "obligations/story/subjects.md",
    ),
    true,
    "a film route must retain its film-only operative-subject depth",
  );
  assert.equal(
    manifestContractPaths(filmManifest).includes(
      "obligations/delivery/briefs.md",
    ),
    false,
    "a film route must not inherit the mutually exclusive direct-brief contract",
  );
  assert.ok(
    filmGraph.claims.some((claim) =>
      claim.name?.includes(
        "film source owners answer source-unit principle checklists, assemble every screenplay sequence",
      ),
    ),
    "the complete film ladder did not reach film source",
  );
  assert.deepEqual(
    filmGraph.claims.find((claim) =>
      claim.name?.startsWith("shot and acceptance owners each realize"),
    )?.symbol,
    ["property", "function"],
    "exact shot parentage must select only concrete shot owners",
  );
  assert.deepEqual(
    filmGraph.claims.find((claim) =>
      claim.name?.startsWith("shot source owners answer source-unit"),
    )?.symbol,
    ["type", "property", "function"],
    "shot source contracts must still cover exported types and concrete owners",
  );
  for (const layer of ["treatments", "scripts", "screenplays"]) {
    const claim = filmGraph.claims.find(
      (candidate) =>
        candidate.name ===
        `the ${layer} work-specific contract accounts for its open-world discovery duties`,
    );
    for (const file of discoveryFilesOf(claim))
      assert.equal(
        referenceTo(claim, file)?.requireReview,
        true,
        `${layer} review must renew ${file}`,
      );
  }

  const filmSettings = filmGraph.claims.find(
    (claim) =>
      claim.name ===
      "settings H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  );
  const subjectDepth = referenceTo(
    filmSettings,
    "obligations/story/subjects.md",
  );
  assert.notEqual(
    subjectDepth,
    undefined,
    "a film's settings population owes what each operative subject settles",
  );
  assert.equal(
    subjectDepth?.requireReview,
    true,
    "the settings review stage renews the subject depth roles",
  );
  assert.equal(
    subjectDepth?.noEvidenceExclude,
    true,
    "a film settings population must cover every subject obligation without exclusion",
  );
  for (const shape of ["brief", "library"] as const) {
    const shaped = root();
    write(shaped, "docs/settings/production.md", "## Scope {#scope}\n");
    if (shape === "brief") {
      write(shaped, "docs/briefs/001-delivery.md", narrative);
      write(
        shaped,
        "src/shots/delivery.ts",
        "export const deliveryShot = 1;\n",
      );
    }
    const shapedSettings = createAutoMovieEvidenceConfig({
      ...disabled(shaped),
      kind: shape,
      settings: "review",
      ...(shape === "brief" ? { briefs: "review", shots: "review" } : {}),
    }).claims.find(
      (claim) =>
        claim.name ===
        "settings H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
    );
    assert.equal(
      referenceTo(shapedSettings, "obligations/story/subjects.md"),
      undefined,
      `a ${shape} answers one bounded delivery and owes no film cast depth`,
    );
    const designConditions = referenceTo(
      shapedSettings,
      "obligations/core/settings.md",
    );
    assert.notEqual(
      designConditions,
      undefined,
      `a ${shape} still owes the all-shape settings obligations`,
    );
    assert.equal(designConditions?.requireReview, true);
    assert.equal(designConditions?.noEvidenceExclude, true);
  }

  const filmWithoutModelSource = root();
  write(
    filmWithoutModelSource,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(
    filmWithoutModelSource,
    "docs/models/subject.md",
    "## Subject {#subject}\n",
  );
  write(
    filmWithoutModelSource,
    "docs/treatments/001-event.md",
    "# Event\n\n## Event {#event}\n",
  );
  for (const layer of ["scripts", "screenplays"]) {
    write(
      filmWithoutModelSource,
      `docs/${layer}/001-delivery/index.md`,
      "# Delivery\n",
    );
    write(
      filmWithoutModelSource,
      `docs/${layer}/001-delivery/001-unit.md`,
      narrative,
    );
  }
  write(
    filmWithoutModelSource,
    "src/shots/sequence.ts",
    "export const sequenceShot = 1;\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(filmWithoutModelSource),
          kind: "film",
          settings: "review",
          models: "review",
          treatments: "review",
          scripts: "review",
          screenplays: "review",
          shots: "draft",
        }),
      "shots cannot enter draft before modelSources is in review",
    ),
    true,
  );

  const brief = root();
  write(brief, "docs/settings/production.md", "## Scope {#scope}\n");
  write(
    brief,
    "docs/briefs/delivery.md",
    "## Delivery {#delivery}\n### Shot {#shot}\n#### Observation {#observation}\n",
  );
  write(brief, "src/shots/delivery.ts", "export const deliveryShot = 1;\n");
  write(brief, "src/production.ts", "export const production = 1;\n");
  write(brief, "src/film.ts", "export const assembledBrief = 1;\n");
  const briefDeclaration: Graph = {
    ...disabled(brief),
    kind: "brief",
    settings: "review",
    briefs: "review",
    shots: "review",
    productionSources: "review",
    filmSources: "review",
  };
  const briefGraph = createAutoMovieEvidenceConfig(briefDeclaration);
  const briefManifest =
    createAutoMovieContractBindingManifest(briefDeclaration);
  assert.deepEqual(
    manifestContractPaths(briefManifest).sort(),
    [
      "discovery/core/common.md",
      "discovery/core/settings.md",
      "discovery/delivery/briefs.md",
      "obligations/core/common.md",
      "obligations/core/settings.md",
      "obligations/delivery/briefs.md",
      "obligations/delivery/film-sources.md",
      "obligations/delivery/production-sources.md",
      "obligations/delivery/shots.md",
      "principles/core/common.md",
      "principles/core/inherited-units.md",
      "principles/core/settings.md",
      "principles/core/source-units.md",
      "principles/delivery/briefs.md",
      "upstream/delivery/briefs.md",
      "upstream/delivery/film-sources.md",
      "upstream/delivery/production-sources.md",
      "upstream/delivery/shots.md",
    ].sort(),
    "a direct brief must expose the complete core and delivery set without film-story contracts",
  );
  assert.ok(
    JSON.stringify(briefGraph.claims).includes('"files":["briefs/**/*.md"]'),
    "the brief route did not bind shots and delivery to brief units",
  );

  const designedBrief = root();
  write(designedBrief, "docs/settings/production.md", "## Scope {#scope}\n");
  write(designedBrief, "docs/models/subject.md", "## Subject {#subject}\n");
  write(
    designedBrief,
    "docs/briefs/delivery.md",
    "## Delivery {#delivery}\n### Shot {#shot}\n#### Observation {#observation}\n",
  );
  const designedBriefGraph = createAutoMovieEvidenceConfig({
    ...disabled(designedBrief),
    kind: "brief",
    settings: "review",
    models: "review",
    briefs: "evidence",
  });
  const briefDelivery = designedBriefGraph.claims.find((claim) =>
    claim.name?.includes("briefs H2 units answer their principle checklists"),
  );
  assert.ok(
    referenceTo(briefDelivery, "models/subject.md"),
    "brief deliveries must cite the reviewed design branches they use",
  );

  const malformedContract = root();
  fs.writeFileSync(
    contract(malformedContract, "docs/principles/core/common.md"),
    rewrite(
      fs.readFileSync(
        contract(malformedContract, "docs/principles/core/common.md"),
        "utf8",
      ),
      "Review question:",
      "Unrouted question:",
    ),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(malformedContract)),
      "exactly one Review question and one Sources line",
    ),
    true,
  );

  const commentedReviewQuestion = root();
  const commentedCommon = contract(
    commentedReviewQuestion,
    "docs/principles/core/common.md",
  );
  fs.writeFileSync(
    commentedCommon,
    rewrite(
      fs.readFileSync(commentedCommon, "utf8"),
      /^(Review question:.*)$/mu,
      "<!-- $1 -->",
    ),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(commentedReviewQuestion)),
      "exactly one Review question and one Sources line; received 0 and 1",
    ),
    true,
  );

  const fencedSources = root();
  const fencedCommon = contract(
    fencedSources,
    "docs/principles/core/common.md",
  );
  fs.writeFileSync(
    fencedCommon,
    rewrite(
      fs.readFileSync(fencedCommon, "utf8"),
      /^(Sources:.*)$/mu,
      "~~~text\n$1\n~~~",
    ),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(fencedSources)),
      "exactly one Review question and one Sources line; received 1 and 0",
    ),
    true,
  );

  const duplicateContractAnchor = root();
  fs.writeFileSync(
    contract(duplicateContractAnchor, "docs/principles/core/settings.md"),
    rewrite(
      fs.readFileSync(
        contract(duplicateContractAnchor, "docs/principles/core/settings.md"),
        "utf8",
      ),
      "{#information-structure}",
      "{#scope-preservation}",
    ),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(duplicateContractAnchor)),
      "reuses shared H2 anchor",
    ),
    true,
  );

  const duplicateContractTitle = root();
  fs.writeFileSync(
    contract(duplicateContractTitle, "docs/principles/core/settings.md"),
    rewrite(
      fs.readFileSync(
        contract(duplicateContractTitle, "docs/principles/core/settings.md"),
        "utf8",
      ),
      "## Information structure",
      "## Declared scope preservation",
    ),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(duplicateContractTitle)),
      "repeats shared H2 title",
    ),
    true,
  );

  const trailingContractProse = root();
  fs.writeFileSync(
    contract(trailingContractProse, "docs/principles/core/common.md"),
    rewrite(
      fs.readFileSync(
        contract(trailingContractProse, "docs/principles/core/common.md"),
        "utf8",
      ),
      /^(Sources: .+)$/mu,
      "$1\n\nTrailing contract prose.",
    ),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(trailingContractProse)),
      "must end with its Sources line",
    ),
    true,
  );

  const missingContractTitle = root();
  fs.writeFileSync(
    contract(missingContractTitle, "docs/principles/core/common.md"),
    rewrite(
      fs.readFileSync(
        contract(missingContractTitle, "docs/principles/core/common.md"),
        "utf8",
      ),
      "# Common principles",
      "Common principles",
    ),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(missingContractTitle)),
      "must begin with exactly one H1",
    ),
    true,
  );

  const prefacedContractTarget = root();
  fs.writeFileSync(
    contract(prefacedContractTarget, "docs/principles/core/common.md"),
    `Preamble outside the target.\n\n${fs.readFileSync(
      contract(prefacedContractTarget, "docs/principles/core/common.md"),
      "utf8",
    )}`,
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(prefacedContractTarget)),
      "must begin with exactly one H1",
    ),
    true,
  );

  const nestedContractTarget = root();
  fs.writeFileSync(
    contract(nestedContractTarget, "docs/principles/core/common.md"),
    rewrite(
      fs.readFileSync(
        contract(nestedContractTarget, "docs/principles/core/common.md"),
        "utf8",
      ),
      /^(Review question:.*)$/mu,
      "### Hidden subtarget\n\n$1",
    ),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(nestedContractTarget)),
      "evidence targets use only H1 and anchored H2 units",
    ),
    true,
  );

  const unanchoredContractTarget = root();
  fs.writeFileSync(
    contract(unanchoredContractTarget, "docs/principles/core/common.md"),
    rewrite(
      fs.readFileSync(
        contract(unanchoredContractTarget, "docs/principles/core/common.md"),
        "utf8",
      ),
      " {#scope-preservation}",
      "",
    ),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(unanchoredContractTarget)),
      "without an explicit {#anchor}",
    ),
    true,
  );

  const duplicateContractUnitAnchor = root();
  fs.writeFileSync(
    contract(duplicateContractUnitAnchor, "docs/principles/core/common.md"),
    rewrite(
      fs.readFileSync(
        contract(duplicateContractUnitAnchor, "docs/principles/core/common.md"),
        "utf8",
      ),
      "{#substantive-completion}",
      "{#scope-preservation}",
    ),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig(disabled(duplicateContractUnitAnchor)),
      "anchors are unique within one file",
    ),
    true,
  );

  const scopelessContractTarget = root();
  fs.writeFileSync(
    contract(scopelessContractTarget, "docs/principles/core/common.md"),
    rewrite(
      fs.readFileSync(
        contract(scopelessContractTarget, "docs/principles/core/common.md"),
        "utf8",
      ),
      "\n\nSynthetic scope for principles/core/common.md.\n\n",
      "\n\n",
    ),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(scopelessContractTarget)),
      "must state its target scope",
    ),
    true,
  );

  for (const [name, falseScope] of [
    ["comment-only", "<!-- not a scope statement -->"],
    ["backtick-fence-only", "```text\nnot a scope statement\n```"],
    ["tilde-fence-only", "~~~text\nnot a scope statement\n~~~~"],
  ] as const) {
    const falseScopeTarget = root();
    const common = contract(falseScopeTarget, "docs/principles/core/common.md");
    fs.writeFileSync(
      common,
      rewrite(
        fs.readFileSync(common, "utf8"),
        "\n\nSynthetic scope for principles/core/common.md.\n\n",
        `\n\n${falseScope}\n\n`,
      ),
    );
    assert.equal(
      throws(
        () => createAutoMovieEvidenceConfig(disabled(falseScopeTarget)),
        "must state its target scope",
      ),
      true,
      name,
    );
  }

  const targetTag = root();
  fs.appendFileSync(
    contract(targetTag, "docs/principles/core/common.md"),
    "\n<!-- @evidenceExcludeReview principles/core/common.md#scope-preservation #invalid recursive -->\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(targetTag)),
      "shared target and must not carry host-side",
    ),
    true,
  );

  const unlistedTarget = root();
  writeContract(
    unlistedTarget,
    "docs/principles/unwired.md",
    "## Unwired {#unwired}\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(unlistedTarget)),
      "Shared contract inventory changed without graph wiring",
    ),
    true,
  );

  const unlistedDiscoveryTarget = root();
  writeContract(
    unlistedDiscoveryTarget,
    "docs/discovery/unwired.md",
    target("Unwired discovery", "unwired-discovery"),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(unlistedDiscoveryTarget)),
      "Shared contract inventory changed without graph wiring",
    ),
    true,
  );

  const removedDiscoveryTarget = root();
  fs.rmSync(
    contract(removedDiscoveryTarget, "docs/discovery/delivery/briefs.md"),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(removedDiscoveryTarget)),
      "Shared contract inventory changed without graph wiring",
    ),
    true,
  );

  const renamedDiscoveryUnit = root();
  const settingsDiscovery = contract(
    renamedDiscoveryUnit,
    "docs/discovery/core/settings.md",
  );
  fs.writeFileSync(
    settingsDiscovery,
    rewrite(
      fs.readFileSync(settingsDiscovery, "utf8"),
      "{#planned-delivery-backcast}",
      "{#renamed-planned-delivery-backcast}",
    ),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(renamedDiscoveryUnit)),
      "H2 inventory changed without graph wiring",
    ),
    true,
  );

  const taggedDiscoveryTarget = root();
  fs.appendFileSync(
    contract(taggedDiscoveryTarget, "docs/discovery/core/common.md"),
    "\n<!-- @evidenceExclude discovery/core/common.md#shared-local-boundary invalid recursive target -->\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(taggedDiscoveryTarget)),
      "shared target and must not carry host-side",
    ),
    true,
  );

  const addedContractUnit = root();
  fs.appendFileSync(
    contract(addedContractUnit, "docs/principles/core/common.md"),
    "\n## Unexpected shared rule {#unexpected-shared-rule}\n\nThis rule was not added to the reusable graph inventory.\n\nReview question: was the shared graph deliberately rewired for this rule?\n\nSources: production contract inventory.\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(addedContractUnit)),
      "H2 inventory changed without graph wiring",
    ),
    true,
  );

  const retiredConformanceTarget = root();
  const retiredCommon = contract(
    retiredConformanceTarget,
    "docs/principles/core/common.md",
  );
  fs.writeFileSync(
    retiredCommon,
    rewrite(
      fs.readFileSync(retiredCommon, "utf8"),
      "## Declared basis {#declared-basis}",
      [
        "## Evidence-content conformance {#evidence-content-conformance}",
        "",
        "Semantic judgment cannot be restored as a self-certified principle.",
        "",
        "Review question: does this host certify its own evidence truth?",
        "",
        "Sources: synthetic retired-target migration probe.",
        "",
        "## Declared basis {#declared-basis}",
      ].join("\n"),
    ),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(retiredConformanceTarget)),
      "H2 inventory changed without graph wiring",
    ),
    true,
  );

  const removedContractUnit = root();
  const removedCommon = contract(
    removedContractUnit,
    "docs/principles/core/common.md",
  );
  fs.writeFileSync(
    removedCommon,
    rewrite(
      fs.readFileSync(removedCommon, "utf8"),
      /\n## Declared basis \{#declared-basis\}[\s\S]*$/u,
      "\n",
    ),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(removedContractUnit)),
      "H2 inventory changed without graph wiring",
    ),
    true,
  );

  const renamedContractUnit = root();
  const renamedCommon = contract(
    renamedContractUnit,
    "docs/principles/core/common.md",
  );
  fs.writeFileSync(
    renamedCommon,
    rewrite(
      fs.readFileSync(renamedCommon, "utf8"),
      "{#declared-basis}",
      "{#renamed-declared-basis}",
    ),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(renamedContractUnit)),
      "H2 inventory changed without graph wiring",
    ),
    true,
  );

  const unwiredProductionTarget = root();
  write(
    unwiredProductionTarget,
    "docs/contracts/unwired.md",
    localTarget("Unwired", "unwired"),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(unwiredProductionTarget)),
      "production target with no additive claim reference",
    ),
    true,
  );

  const legacyProductionTargetFamily = root();
  write(
    legacyProductionTargetFamily,
    "docs/production-principles/legacy.md",
    target("Legacy local family", "legacy-local-family"),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig(disabled(legacyProductionTargetFamily)),
      "outside the flat docs/contracts inventory",
    ),
    true,
  );

  const workSpecificContract = root();
  write(
    workSpecificContract,
    "docs/contracts/principles-common.md",
    `<!-- @evidence discovery/core/common.md#shared-local-boundary The production audit retained this exact local rule. -->\n${target("Local contract", "local-contract")}`,
  );
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled(workSpecificContract),
      claims: [
        {
          ...productionOwnedClaim,
          reference: {
            type: "markdown",
            root: "docs",
            files: ["contracts/principles-common.md"],
            symbol: "h2",
            checklist: true,
            noEvidenceExclude: true,
          },
        },
      ],
    }),
  );

  const missingActiveContract = root();
  fs.unlinkSync(
    path.join(missingActiveContract, "docs", "contracts", "index.md"),
  );
  write(
    missingActiveContract,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(missingActiveContract),
          kind: "library",
          settings: "draft",
        }),
      "requires a retained docs/contracts rule or a truthful-negative contracts/index.md ledger",
    ),
    true,
  );

  const absentContractDirectory = root();
  fs.rmSync(path.join(absentContractDirectory, "docs", "contracts"), {
    recursive: true,
  });
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig(disabled(absentContractDirectory)),
  );

  const trackerOnlyContracts = root();
  fs.unlinkSync(
    path.join(trackerOnlyContracts, "docs", "contracts", "index.md"),
  );
  write(trackerOnlyContracts, "docs/contracts/.gitkeep", "");
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig(disabled(trackerOnlyContracts)),
  );

  const negativeContractIndex = root();
  write(
    negativeContractIndex,
    "docs/contracts/index.md",
    "<!-- @evidenceExclude discovery/core/common.md#shared-local-boundary The complete audit found no independent local rule. -->\n\n# Work-specific contract\n",
  );
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig(disabled(negativeContractIndex)),
  );

  const nestedContract = root();
  write(
    nestedContract,
    "docs/contracts/principles/core/common.md",
    target("Nested contract", "nested-contract"),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(nestedContract)),
      "nested or non-contract entry is claimed by nothing",
    ),
    true,
  );

  const positiveContractIndex = root();
  write(
    positiveContractIndex,
    "docs/contracts/index.md",
    "<!-- @evidence discovery/core/common.md#shared-local-boundary A positive rule cannot live in the negative ledger. -->\n\n# Work-specific contract\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(positiveContractIndex)),
      "carries truthful discovery negatives and nothing positive",
    ),
    true,
  );

  const targetedContractIndex = root();
  write(
    targetedContractIndex,
    "docs/contracts/index.md",
    "# Work-specific contract\n\n## Hidden rule {#hidden-rule}\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(targetedContractIndex)),
      "negative ledger and no contract target H2",
    ),
    true,
  );

  const emptyContractIndex = root();
  write(
    emptyContractIndex,
    "docs/contracts/index.md",
    "# Work-specific contract\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(emptyContractIndex)),
      "must record at least one truthful discovery negative",
    ),
    true,
  );

  const lateContractIndexEvidence = root();
  write(
    lateContractIndexEvidence,
    "docs/contracts/index.md",
    "# Work-specific contract\n\n<!-- @evidenceExclude discovery/core/common.md#shared-local-boundary This negative appears after H1. -->\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(lateContractIndexEvidence)),
      "may carry discovery host tags only in its comment preamble before H1",
    ),
    true,
  );

  const scatteredContractExclusion = root();
  write(
    scatteredContractExclusion,
    "docs/contracts/principles-common.md",
    `<!-- @evidenceExcludeReview discovery/core/common.md#shared-local-boundary #abcdef0 This reviewed negative is scattered. -->\n${target("Scattered contract", "scattered-contract")}`,
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(scatteredContractExclusion)),
      "cannot scatter a discovery exclusion outside contracts/index.md",
    ),
    true,
  );

  const recursiveContractEvidence = root();
  write(
    recursiveContractEvidence,
    "docs/contracts/principles-common.md",
    `<!-- @evidence discovery/core/common.md#shared-local-boundary The production audit retained this exact local rule. -->\n${rewrite(
      target("Recursive contract", "recursive-contract"),
      "Selected hosts preserve",
      "<!-- @evidence discovery/core/common.md#shared-local-boundary A target unit cannot host its own graph evidence. -->\n\nSelected hosts preserve",
    )}`,
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(recursiveContractEvidence),
          claims: [
            {
              ...productionOwnedClaim,
              reference: {
                type: "markdown",
                root: "docs",
                files: ["contracts/principles-common.md"],
                symbol: "h2",
                checklist: true,
                noEvidenceExclude: true,
              },
            },
          ],
        }),
      "may carry discovery host tags only in its comment preamble before H1",
    ),
    true,
  );

  const nonDiscoveryContractEvidence = root();
  write(
    nonDiscoveryContractEvidence,
    "docs/contracts/principles-common.md",
    `<!-- @evidence principles/core/common.md#purpose-fit This target is not a discovery audit. -->\n${target("Wrong host", "wrong-host")}`,
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig(disabled(nonDiscoveryContractEvidence)),
      "may host only discovery evidence before its H1",
    ),
    true,
  );

  const missingContractEvidence = root();
  write(
    missingContractEvidence,
    "docs/contracts/principles-common.md",
    target("Missing discovery adoption", "missing-discovery-adoption"),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(missingContractEvidence)),
      "must adopt at least one retained discovery rule",
    ),
    true,
  );

  const missingContractHeading = root();
  write(
    missingContractHeading,
    "docs/contracts/principles-common.md",
    "<!-- @evidence discovery/core/common.md#shared-local-boundary A heading is still required. -->\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(missingContractHeading)),
      "must begin with one H1 after a comment-only evidence preamble",
    ),
    true,
  );

  const visibleContractPreamble = root();
  write(
    visibleContractPreamble,
    "docs/contracts/principles-common.md",
    `Visible prose cannot precede the contract.\n\n${localTarget("Visible preamble", "visible-preamble")}`,
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(visibleContractPreamble)),
      "must begin with one H1 after a comment-only evidence preamble",
    ),
    true,
  );

  const fileSelectedProductionTarget = root();
  write(
    fileSelectedProductionTarget,
    "docs/contracts/file-selected.md",
    localTarget("File-selected target", "file-selected-target"),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(fileSelectedProductionTarget),
          claims: [
            {
              ...productionOwnedClaim,
              reference: {
                type: "markdown",
                root: "docs",
                files: ["contracts/file-selected.md"],
                symbol: "file",
              },
            },
          ],
        }),
      "production target with no additive claim reference",
    ),
    true,
    "a file-level reference must not masquerade as wiring for H2 targets",
  );

  const duplicateProductionTargetAnchor = root();
  write(
    duplicateProductionTargetAnchor,
    "docs/contracts/purpose.md",
    localTarget("Production purpose", "purpose-fit"),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(duplicateProductionTargetAnchor),
          claims: [
            {
              ...productionOwnedClaim,
              reference: {
                type: "markdown",
                root: "docs",
                files: ["contracts/purpose.md"],
                symbol: "h2",
                checklist: true,
                noEvidenceExclude: true,
              },
            },
          ],
        }),
      "duplicates target anchor already owned by",
    ),
    true,
  );

  const duplicateProductionTargetTitle = root();
  write(
    duplicateProductionTargetTitle,
    "docs/contracts/purpose.md",
    localTarget("Purpose   FIT", "production-purpose-fit"),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(duplicateProductionTargetTitle),
          claims: [
            {
              ...productionOwnedClaim,
              reference: {
                type: "markdown",
                root: "docs",
                files: ["contracts/purpose.md"],
                symbol: "h2",
                checklist: true,
                noEvidenceExclude: true,
              },
            },
          ],
        }),
      "duplicates target title",
    ),
    true,
  );

  const negatedProductionTarget = root();
  write(
    negatedProductionTarget,
    "docs/contracts/tone.md",
    localTarget("Tone", "tone"),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(negatedProductionTarget),
          claims: [
            {
              ...productionOwnedClaim,
              reference: {
                type: "markdown",
                root: "docs",
                files: ["contracts/t?ne.md", "!contracts/tone.md"],
                symbol: "h2",
                checklist: true,
                noEvidenceExclude: true,
              },
            },
          ],
        }),
      "production target with no additive claim reference",
    ),
    true,
  );

  const malformedProductionTarget = root();
  write(
    malformedProductionTarget,
    "docs/contracts/tone.md",
    rewrite(
      localTarget("Tone", "tone"),
      "Review question:",
      "Unrouted question:",
    ),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(malformedProductionTarget),
          claims: [productionOwnedClaim],
        }),
      "exactly one Review question and one Sources line",
    ),
    true,
  );

  const taggedProductionTarget = root();
  write(
    taggedProductionTarget,
    "docs/contracts/tagged.md",
    `<!-- @evidencePart principles/core/common.md#scope-preservation::fragment recursive -->\n${target("Tagged", "tagged")}`,
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(taggedProductionTarget),
          claims: [
            {
              ...productionOwnedClaim,
              reference: {
                type: "markdown",
                root: "docs",
                files: ["contracts/tagged.md"],
                symbol: "h2",
                checklist: true,
                noEvidenceExclude: true,
              },
            },
          ],
        }),
      "may host only discovery evidence before its H1",
    ),
    true,
  );

  const emptyProductionTargetPattern = root();
  write(
    emptyProductionTargetPattern,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(emptyProductionTargetPattern),
          kind: "brief",
          settings: "draft",
          claims: [
            {
              ...productionOwnedClaim,
              disabled: false,
              reference: {
                type: "markdown",
                root: "docs",
                files: ["contracts/missing.md"],
                symbol: "h2",
                checklist: true,
                noEvidenceExclude: true,
              },
            },
          ],
        }),
      "empty reference population",
    ),
    true,
  );

  const emptyProductionHostPattern = root();
  write(
    emptyProductionHostPattern,
    "docs/contracts/tone.md",
    localTarget("Tone", "tone"),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(emptyProductionHostPattern),
          claims: [
            {
              ...productionOwnedClaim,
              disabled: false,
            },
          ],
        }),
      "selects no host file",
    ),
    true,
  );

  const advancedClaims = root();
  write(
    advancedClaims,
    "docs/settings/production.md",
    "## Scope {#scope}\n\nSupporting detail.\n",
  );
  write(advancedClaims, "docs/contracts/tone.md", localTarget("Tone", "tone"));
  write(advancedClaims, "support.ts", "export const support = true;\n");
  const advancedClaim: Claim = {
    name: "production target validation exercises every supported reference route",
    type: "markdown",
    root: "docs",
    files: ["settings/**/*.md"],
    symbol: "file",
    reference: [
      {
        type: "markdown",
        root: "docs",
        files: [
          "**/*.md",
          "**/**/absent.md",
          "contracts/**",
          "!contracts/other.md",
          "contract?/tone.md",
          "settings/**/*.md",
          "README.md",
        ],
        symbol: ["h1", "h2"],
      },
      {
        type: "markdown",
        root: "docs/contracts",
        files: ["tone.md"],
        symbol: "h2",
      },
      {
        type: "typescript",
        files: ["support.ts"],
        symbol: "property",
      },
      {
        type: "typescript",
        package: "@automovie/interface",
      },
      {
        type: "swagger",
        file: "https://example.invalid/openapi.json",
      },
    ],
  };
  const activeTypeScriptClaim: Claim = {
    name: "local TypeScript claim validation",
    type: "typescript",
    files: ["support.ts"],
    symbol: "property",
    reference: {
      type: "markdown",
      root: "docs",
      files: ["contracts/tone.md"],
      symbol: "h2",
    },
  };
  const activePrismaClaim = {
    name: "non-file-validator claim kinds remain the evidence plugin's owner",
    type: "prisma",
    files: ["schema.prisma"],
    symbol: "model",
    reference: {
      type: "markdown",
      root: "docs",
      files: ["contracts/tone.md"],
      symbol: "h2",
    },
  } as unknown as Claim;
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled(advancedClaims),
      kind: "library",
      settings: "draft",
      claims: [advancedClaim, activeTypeScriptClaim, activePrismaClaim],
    }),
  );

  const projectRootTarget = root();
  write(
    projectRootTarget,
    "docs/contracts/rooted.md",
    localTarget("Project-rooted target", "project-rooted-target"),
  );
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled(projectRootTarget),
      claims: [
        {
          ...productionOwnedClaim,
          reference: {
            type: "markdown",
            root: ".",
            files: ["docs/contracts/rooted.md"],
            symbol: "h2",
            checklist: true,
            noEvidenceExclude: true,
          },
        },
      ],
    }),
  );

  for (const pattern of [
    "./contracts/rooted.md",
    "contracts\\rooted.md",
    "contracts/rooted.md/",
  ])
    assert.doesNotThrow(() =>
      createAutoMovieEvidenceConfig({
        ...disabled(projectRootTarget),
        claims: [
          {
            ...productionOwnedClaim,
            reference: {
              type: "markdown",
              root: "docs",
              files: [pattern],
              symbol: "h2",
              checklist: true,
              noEvidenceExclude: true,
            },
          },
        ],
      }),
    );

  const embeddedDoubleStar = root();
  write(
    embeddedDoubleStar,
    "docs/contracts/toone.md",
    localTarget(
      "Embedded double-star boundary",
      "embedded-double-star-boundary",
    ),
  );
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled(embeddedDoubleStar),
      claims: [
        {
          ...productionOwnedClaim,
          reference: {
            type: "markdown",
            root: "docs",
            files: ["contracts/t**ne.md"],
            symbol: "h2",
            checklist: true,
            noEvidenceExclude: true,
          },
        },
      ],
    }),
  );

  const outsideReference = root();
  const outsideClaim = {
    name: "an external target is not mistaken for a production-local target",
    type: "prisma",
    root: ".",
    files: ["schema.prisma"],
    symbol: "model",
    disabled: true,
    reference: {
      type: "markdown",
      files: ["principle.md"],
      symbol: "h2",
    },
  } as unknown as Claim;
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled(outsideReference),
      claims: [outsideClaim],
    }),
  );

  const emptyReferences = root();
  write(emptyReferences, "docs/settings/production.md", "## Scope {#scope}\n");
  const referenceLess = {
    ...productionOwnedClaim,
    disabled: false,
    reference: [],
  } as Claim;
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(emptyReferences),
          kind: "library",
          settings: "draft",
          claims: [referenceLess],
        }),
      "selects no reference population",
    ),
    true,
  );

  const wrongExtensionReference = root();
  write(
    wrongExtensionReference,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(
    wrongExtensionReference,
    "support.ts",
    "export const support = true;\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(wrongExtensionReference),
          kind: "library",
          settings: "draft",
          claims: [
            {
              ...productionOwnedClaim,
              disabled: false,
              reference: {
                type: "markdown",
                root: "support.ts",
                files: [""],
                symbol: "h2",
              },
            },
          ],
        }),
      "empty reference population",
    ),
    true,
  );

  const missingLocalTypeScriptFiles = root();
  write(
    missingLocalTypeScriptFiles,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  const filelessReference = {
    ...productionOwnedClaim,
    disabled: false,
    reference: {
      type: "typescript",
      symbol: "property",
    },
  } as Claim;
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(missingLocalTypeScriptFiles),
          kind: "library",
          settings: "draft",
          claims: [filelessReference],
        }),
      "empty reference population",
    ),
    true,
  );

  const partiallyEmptyTargets = root();
  write(
    partiallyEmptyTargets,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(
    partiallyEmptyTargets,
    "docs/contracts/tone.md",
    localTarget("Tone", "tone"),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(partiallyEmptyTargets),
          kind: "library",
          settings: "draft",
          claims: [
            {
              ...productionOwnedClaim,
              disabled: false,
              reference: {
                type: "markdown",
                root: "docs",
                files: ["contracts/tone.md", "contracts/missing.md"],
                symbol: "h2",
              },
            },
          ],
        }),
      "contracts/missing.md selects no Markdown target",
    ),
    true,
  );

  // A source directory nobody assigned is the silent half of a listed
  // population: it compiles, ships, and cites nothing. Refusing it is what
  // makes the seven design layers a closed vocabulary rather than a habit.
  const strayLayer = root();
  write(strayLayer, "src/props/chair.ts", "export const chair = 1;");
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(strayLayer)),
      "src/props/chair.ts belongs to no production source layer",
    ),
    true,
  );

  // The scaffold's own examples are the one exception, and they are excluded
  // by name rather than by nothing having looked.
  const examples = root();
  write(examples, "src/examples/props.ts", "export const example = 1;");
  assert.doesNotThrow(() => createAutoMovieEvidenceConfig(disabled(examples)));

  const { claims: omittedClaims, ...withoutClaims } = disabled(root());
  void omittedClaims;
  assert.doesNotThrow(() => createAutoMovieEvidenceConfig(withoutClaims));

  process.stdout.write("production evidence graph canaries passed\n");
} finally {
  for (const directory of roots)
    fs.rmSync(directory, { force: true, recursive: true });
}
