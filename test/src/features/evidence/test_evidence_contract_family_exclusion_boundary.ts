import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

type Stage = "disabled" | "draft" | "evidence" | "review";

interface IEvidenceReference {
  type: string;
  root?: string;
  files: string[];
  symbol?: string | string[];
  checklist?: boolean;
  noEvidenceExclude?: boolean;
  requireReview?: boolean;
  singleEvidencePerSymbol?: boolean;
  uniqueEvidence?: boolean;
}

interface IEvidenceClaim {
  name?: string;
  type: string;
  root?: string;
  files: string[];
  symbol?: string | string[];
  disabled?: boolean;
  evidenceExcludeCarriers?: string[];
  reference: IEvidenceReference | IEvidenceReference[];
}

interface IEvidenceState {
  location: string;
  kind: "library";
  populationScope: { mode: "complete-production" };
  settings: Stage;
  research: Stage;
  maps: Stage;
  models: Stage;
  spaces: Stage;
  materials: Stage;
  instances: Stage;
  motions: Stage;
  systems: Stage;
  treatments: Stage;
  scripts: Stage;
  screenplays: Stage;
  briefs: Stage;
  modelSources: Stage;
  mapSources: Stage;
  spaceSources: Stage;
  materialSources: Stage;
  instanceSources: Stage;
  motionSources: Stage;
  systemSources: Stage;
  shots: Stage;
  productionSources: Stage;
  filmSources: Stage;
  claims: IEvidenceClaim[];
}

interface IEvidenceModule {
  createAutoMovieEvidenceConfig(state: IEvidenceState): {
    claims: IEvidenceClaim[];
  };
}

interface IFixtureFailure {
  error: unknown;
}

interface ILintResult {
  output: string;
  status: number;
}

class ContractFamilyFixtureCleanupError extends AggregateError {}

const ROOT = path.resolve(__dirname, "../../../..");
const TTSC = path.join(ROOT, "node_modules/ttsc/lib/launcher/ttsc.js");
const TTSC_CACHE = path.join(ROOT, "node_modules/.cache/ttsc");
const MODEL = "docs/models/subject.md";
const CLAIM_NAME =
  "models H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work";

const UPSTREAM =
  "upstream/design/models.md#settings-and-space-revision-from-model-work";
const SETTINGS = "settings/production.md#delivery-scope";
const REFUSED_PRINCIPLE = "principles/design/models.md#representation-contract";
const REFUSED_OBLIGATION = "obligations/design/models.md#reference-scale";

/** Every principle item the seat-shell unit answers for itself. */
const SHELL_PRINCIPLES: readonly (readonly [string, string])[] = [
  [
    "principles/core/common.md#scope-preservation",
    "The delivery scope assigns this population one reviewable chair, and this unit owns its shell construction, floor contact and review silhouette while the surface-partition unit owns the remaining assigned decision.",
  ],
  [
    "principles/core/common.md#substantive-completion",
    "The unit settles the swept-shell form, its 18 mm thickness, its floor-contact origin and its 0.44 m seat plane, so no later layer has to invent the geometry.",
  ],
  [
    "principles/core/common.md#machine-default",
    "The unit names one form, one thickness, one origin and one falsifier, with no balancing qualification, no third list item added for symmetry and no closing restatement.",
  ],
  [
    "principles/core/common.md#evidence-content-conformance",
    "Each acknowledgement below names the construction fact that establishes it, and the upstream answer names the settings defect this construction actually exposed rather than a generic sufficiency.",
  ],
  [
    "principles/core/common.md#declared-basis",
    "The seat plane derives from the standing reference nominated in the delivery scope, the shell thickness is this layer's own choice, and no statement rests on an unstated input.",
  ],
  [
    "principles/core/inherited-units.md#derived-parent-differentiation",
    "Beyond the delivery scope's subject and review condition, this unit adds the bounded construction the scope does not contain: sweep, thickness, origin and contact.",
  ],
  [
    "principles/design/models.md#model-information-structure",
    "The unit identifies the represented part and its central construction decision first, then develops dimensions, contact and review condition in paragraphs with distinct functions.",
  ],
  [
    REFUSED_PRINCIPLE,
    "The unit names the swept-surface strategy, the single rigid part it produces, and the blocking claims that proxy may and may not support.",
  ],
  [
    "principles/design/models.md#spatial-convention",
    "The unit states the floor-contact local origin under the front edge and derives the 0.44 m seat plane from the nominated scale reference rather than from a primitive default.",
  ],
  [
    "principles/design/models.md#reviewable-structure",
    "The unit names the front, side and three-quarter silhouettes the neutral review set must expose and the flat-slab reading that falsifies the shell.",
  ],
];

/** Every principle item the surface-partition unit answers for itself. */
const PARTITION_PRINCIPLES: readonly (readonly [string, string])[] = [
  [
    "principles/core/common.md#scope-preservation",
    "The delivery scope assigns this population the chair's reviewable surfaces, and this unit owns the boundary between them; constructing the shell itself belongs to the seat-shell unit.",
  ],
  [
    "principles/core/common.md#substantive-completion",
    "The unit settles which adjoining sides become separate stable surface owners and where their boundary lies, so the materials layer has a partition to bind to.",
  ],
  [
    "principles/core/common.md#machine-default",
    "The unit states the two owners, the reason they change independently and the boundary curve, without a balancing qualification or a summarizing final line.",
  ],
  [
    "principles/core/common.md#evidence-content-conformance",
    "Each acknowledgement below names the partition fact that establishes it, and the upstream negative names the concrete parent decisions examined and found sufficient.",
  ],
  [
    "principles/core/common.md#declared-basis",
    "The partition inherits its shell geometry from the seat-shell unit and owns the division itself, while the construction and appearance of each surface are explicitly left to the materials layer.",
  ],
  [
    "principles/core/inherited-units.md#derived-parent-differentiation",
    "Beyond the seat-shell construction it consumes, this unit adds the surface-ownership decision that construction does not contain.",
  ],
  [
    "principles/design/models.md#model-information-structure",
    "The unit identifies the partitioned surfaces and the central division decision first, then develops the boundary curve and the downstream materials consequence.",
  ],
  [
    REFUSED_PRINCIPLE,
    "The unit gives the seating side and the underside separate stable surface owners because their downstream responses differ, and leaves the construction of each to the materials layer.",
  ],
  [
    "principles/design/models.md#spatial-convention",
    "The unit locates the boundary curve at the shell edge inside the seat-shell local frame and introduces no second coordinate convention.",
  ],
  [
    "principles/design/models.md#reviewable-structure",
    "The unit names the visible boundary between the two surface owners as the partition's review-critical edge.",
  ],
];

/** The whole obligation population, carried by the seat-shell unit alone. */
const SHELL_OBLIGATIONS: readonly (readonly [string, string])[] = [
  [
    "obligations/core/common.md#purpose-fit",
    "This population needs a construction owner and a surface-ownership owner; without the construction role every downstream material and instance decision would be underdetermined.",
  ],
  [
    "obligations/core/common.md#population-variety",
    "The two model units close differently: the shell names the construction the seat is built from, and the surface unit names what the material owner may bind to. One naming a build and the other naming a boundary is the distribution this population chose.",
  ],
  [
    "obligations/core/common.md#layer-boundary",
    "Surface appearance and wear response are routed to the materials layer and the chair's in-world identity stays in settings, so no decision here needs a second specialist family.",
  ],
  [
    "obligations/core/common.md#production-language",
    "The model documents are written in English with metric units throughout, matching the units the delivery scope declares.",
  ],
  [
    "obligations/core/common.md#proportionate-development",
    "One chair at this scale earns two model H2 units, and the construction unit carries the larger share because sweep, contact and review set change together.",
  ],
  [
    "obligations/design/models.md#addressable-model-decisions",
    "Construction and surface ownership have different consumers and different change paths, so each holds its own H2 instead of one umbrella unit.",
  ],
  [
    "obligations/design/models.md#representation-ceiling",
    "Blocking geometry here authorizes silhouette, proportion and contact claims and refuses every claim about upholstery, seam or finish.",
  ],
  [
    REFUSED_OBLIGATION,
    "The 1.70 m standing figure nominated by the delivery scope is the shared reference, and every represented extent is derived or checked against it.",
  ],
  [
    "obligations/design/models.md#articulation-ownership",
    "No pivot, bone or morph is exposed: the shell is deliberately rigid and motion writes no interface into this model.",
  ],
  [
    "obligations/design/models.md#model-review-set",
    "Front, side, three-quarter and underside views against a neutral background are the finite set used to compare model revisions.",
  ],
];

const SHELL_UPSTREAM =
  "Constructing the swept shell exposed a settings contradiction between the declared seat height and the nominated standing reference, and the delivery scope was repaired before this construction was written again.";
const PARTITION_UPSTREAM =
  "Partitioning the shell tested the delivery scope's review condition, the nominated standing reference and the seat-shell contact declaration, and each was sufficient: the partition needs no capability, extent or contact the parents do not already state.";
const SHELL_SETTINGS =
  "The delivery scope names the single reviewable chair, the metric units and the neutral studio condition this construction is built for.";

/** Preserve the primary failure if removal of its disposable project fails too. */
const preserveFixtureCleanup = (
  failure: IFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ContractFamilyFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Contract-family fixture cleanup failed after the test failed.",
    );
  }
};

/**
 * A real object-library declaration whose only active design branch is models.
 *
 * The declaration is not a disabled shell: settings is reviewed, models is at
 * evidence, and the factory therefore validates the actual file tree, stage
 * order and host population before it returns the claim this probe lints.
 */
const libraryState = (location: string): IEvidenceState => ({
  location,
  kind: "library",
  populationScope: { mode: "complete-production" },
  settings: "review",
  research: "disabled",
  maps: "disabled",
  models: "evidence",
  spaces: "disabled",
  materials: "disabled",
  instances: "disabled",
  motions: "disabled",
  systems: "disabled",
  treatments: "disabled",
  scripts: "disabled",
  screenplays: "disabled",
  briefs: "disabled",
  modelSources: "disabled",
  mapSources: "disabled",
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

const referencesOf = (claim: IEvidenceClaim): IEvidenceReference[] =>
  Array.isArray(claim.reference) ? claim.reference : [claim.reference];

const fileOf = (reference: IEvidenceReference): string => {
  assert.equal(reference.files.length, 1);
  return reference.files[0]!;
};

/** Select exactly one current shared claim; a rename or duplicate is a failure. */
const selectClaim = (
  claims: IEvidenceClaim[],
  name: string,
): IEvidenceClaim => {
  const matches = claims.filter((claim) => claim.name === name);
  assert.equal(
    matches.length,
    1,
    `Expected one current claim named '${name}', received ${matches.length}.`,
  );
  return matches[0]!;
};

/**
 * Pin the flag combinations the active model H2 claim actually carries.
 *
 * The flags are the whole family boundary and the one thing a configuration
 * can invert without any host noticing. Principles and obligations differ only
 * in `checklist`, principles and upstream differ only in `noEvidenceExclude`,
 * and the inherited settings population carries neither, so reading all three
 * in one place is what makes the live probes below interpretable.
 */
const assertModelClaim = (claim: IEvidenceClaim): void => {
  assert.equal(claim.type, "markdown");
  assert.equal(claim.root, "docs");
  assert.deepEqual(claim.files, ["models/**/*.md"]);
  assert.equal(claim.symbol, "h2");
  assert.equal(claim.disabled, false);
  assert.equal(claim.evidenceExcludeCarriers, undefined);

  const references = referencesOf(claim);
  assert.deepEqual(
    references.map(fileOf),
    [
      "principles/core/common.md",
      "principles/core/inherited-units.md",
      "principles/design/models.md",
      "upstream/design/models.md",
      "obligations/core/common.md",
      "obligations/design/models.md",
      "settings/production.md",
    ],
    "the active model branch must select every applicable family exactly once",
  );
  for (const reference of references) {
    const file = fileOf(reference);
    assert.equal(reference.type, "markdown");
    assert.equal(reference.root, "docs");
    assert.equal(reference.symbol, "h2");
    assert.equal(reference.requireReview, false);
    assert.equal(reference.singleEvidencePerSymbol, undefined);
    assert.equal(reference.uniqueEvidence, undefined);
    assert.equal(
      reference.checklist,
      file.startsWith("principles/") || file.startsWith("upstream/")
        ? true
        : undefined,
      `${file} carries the wrong per-host checklist flag`,
    );
    assert.equal(
      reference.noEvidenceExclude,
      file.startsWith("principles/") || file.startsWith("obligations/")
        ? true
        : file.startsWith("upstream/")
          ? undefined
          : false,
      `${file} carries the wrong exclusion flag`,
    );
  }
};

const cite = (target: string, reason: string): string =>
  `@evidence ${target} ${reason}`;

const exclude = (target: string, reason: string): string =>
  `@evidenceExclude ${target} ${reason}`;

/** Make an evidence block whose declarations belong to the preceding heading. */
const evidenceBlock = (lines: readonly string[]): string =>
  ["<!--", ...lines, "-->"].join("\n");

/**
 * A paid two-unit model population that separates the three families at once.
 *
 * `#seat-shell` answers every principle for itself, records the concrete
 * upstream defect it repaired, and carries the whole obligation population.
 * `#surface-partition` answers every principle for itself as well, pays no
 * obligation and cites no settings unit, and records a truthful upstream
 * negative instead. A clean result therefore states three separable facts: the
 * principle checklist is per host, obligation and foundation coverage are
 * properties of the population, and an exclusion is a legitimate answer only
 * where the family permits one.
 */
const cleanModel = (): string =>
  [
    "# Reading-chair model design",
    "",
    "## Seat shell {#seat-shell}",
    "",
    evidenceBlock([
      ...SHELL_PRINCIPLES.map(([target, reason]) => cite(target, reason)),
      cite(UPSTREAM, SHELL_UPSTREAM),
      ...SHELL_OBLIGATIONS.map(([target, reason]) => cite(target, reason)),
      cite(SETTINGS, SHELL_SETTINGS),
    ]),
    "",
    "The seat shell is one swept surface of constant 18 mm thickness whose local origin sits at the floor contact under the front edge, with the seat plane at 0.44 m derived from the nominated standing reference. Its silhouette from the front, side and three-quarter review views is the falsifier: a shell that reads as a flat slab has lost the sweep. Nothing here is articulated, so the shell is a rigid part and motion writes no interface into it.",
    "",
    "## Surface partition {#surface-partition}",
    "",
    evidenceBlock([
      ...PARTITION_PRINCIPLES.map(([target, reason]) => cite(target, reason)),
      exclude(UPSTREAM, PARTITION_UPSTREAM),
    ]),
    "",
    "The upper seating side and the underside are separate surface owners because a review of the seating side judges wear while a review of the underside judges construction, and the two change independently. This unit names the boundary curve where they meet at the shell edge; the materials layer chooses what each side receives.",
    "",
  ].join("\n");

/** Replace one exact fixture declaration and refuse an ambiguous mutation. */
const replaceOnce = (source: string, before: string, after: string): string => {
  const first = source.indexOf(before);
  assert.notEqual(first, -1, `Fixture text did not contain '${before}'.`);
  assert.equal(
    source.indexOf(before, first + before.length),
    -1,
    `Fixture text contained '${before}' more than once.`,
  );
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
};

/** Turn one exact paid citation into an exclusion of the very same target. */
const excuse = (
  source: string,
  target: string,
  paid: string,
  excused: string,
): string => replaceOnce(source, cite(target, paid), exclude(target, excused));

/** Write the only authored host population used by the focused graph. */
const writeModel = (root: string, content: string): void => {
  const location = path.join(root, MODEL);
  fs.mkdirSync(path.dirname(location), { recursive: true });
  fs.writeFileSync(location, content, "utf8");
};

/** Run the real ttsc launcher and preserve all diagnostic channels. */
const lint = (
  root: string,
  phase: "complete" | "excused-principle" | "excused-obligation",
): ILintResult => {
  fs.writeFileSync(
    path.join(root, "index.ts"),
    `export const contractFamilyBoundaryPhase = "${phase}";\n`,
    "utf8",
  );
  const result = spawnSync(
    process.execPath,
    [TTSC, "--cache-dir", TTSC_CACHE, "--noEmit", "--project", "tsconfig.json"],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0" },
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (result.error !== undefined) throw result.error;
  if (result.signal !== null)
    throw new Error(
      `Contract-family lint terminated by ${result.signal}.\n${result.stdout}\n${result.stderr}`,
    );
  if (result.status === null)
    throw new Error(
      `Contract-family lint returned no exit status.\n${result.stdout}\n${result.stderr}`,
    );
  return {
    status: result.status,
    output: `${result.stdout}\n${result.stderr}`
      .replaceAll("\r\n", "\n")
      .replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, ""),
  };
};

const count = (source: string, pattern: RegExp): number =>
  [...source.matchAll(pattern)].length;

const escape = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * Assert that refusing one exclusion produced both halves the contributor
 * documents, and nothing else.
 *
 * `@ttsc/evidence` states both for a reference declaring `noEvidenceExclude`:
 * the exclusion is reported where it is written, and it contributes no
 * coverage, so its target still owes positive evidence. Two diagnostics is
 * therefore the expected count rather than an observed one, and a single
 * diagnostic would mean one of the two halves stopped running.
 *
 * The second diagnostic separates the two families without any extra probe,
 * because the two denominators are different populations. A checklist counts
 * each selected host against the target document's items, so it reports the
 * authored H2 that failed to answer and how many of that document's items it
 * missed. Ordinary coverage counts each target unit against the whole host
 * population, so it reports the contract H2 that nothing cited. `unpaid` is
 * therefore the family under test, spelled out as the fragments only that
 * family's denominator can produce.
 */
const assertRefusedExclusion = (
  result: ILintResult,
  target: string,
  unpaid: readonly string[],
): void => {
  assert.notEqual(result.status, 0, result.output);
  assert.equal(count(result.output, /\[evidence\/graph\]/gu), 2, result.output);
  assert.equal(count(result.output, /error TS\d+:/gu), 2, result.output);
  assert.match(
    result.output,
    new RegExp(
      `Forbidden @evidenceExclude for '${escape(target)}' at ${escape(MODEL)}:`,
      "u",
    ),
    result.output,
  );
  for (const fragment of unpaid)
    assert.match(
      result.output,
      new RegExp(escape(fragment), "u"),
      result.output,
    );
  assert.match(result.output, new RegExp(escape(CLAIM_NAME), "u"));
  assert.match(result.output, /Found 2 errors\./u);
};

/** Resolve the lint host and evidence contributor without using the caller's cwd. */
const linkEvidencePlugins = (root: string): void => {
  const resolve = createRequire(
    path.join(ROOT, "packages/evidence/package.json"),
  );
  for (const name of ["evidence", "lint"] as const) {
    const source = path.dirname(resolve.resolve(`@ttsc/${name}/package.json`));
    const destination = path.join(root, "node_modules", "@ttsc", name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.symlinkSync(
      source,
      destination,
      process.platform === "win32" ? "junction" : "dir",
    );
  }
  const typescript = path.dirname(resolve.resolve("typescript/package.json"));
  const destination = path.join(root, "node_modules", "typescript");
  fs.symlinkSync(
    typescript,
    destination,
    process.platform === "win32" ? "junction" : "dir",
  );
};

/** Copy the generated project's scaffold-local shared contracts. */
const copySharedContracts = (root: string): void => {
  fs.cpSync(
    path.join(ROOT, "packages/template/scaffold/docs"),
    path.join(root, "docs"),
    { recursive: true },
  );
};

/** Materialize the selected real claim object as the temporary lint config. */
const writeLintProject = (root: string, claims: IEvidenceClaim[]): void => {
  fs.writeFileSync(
    path.join(root, "lint.config.ts"),
    [
      'import { evidence } from "@ttsc/evidence";',
      "",
      `const graph = ${JSON.stringify({ claims }, null, 2)};`,
      "",
      "export default {",
      "  plugins: { evidence },",
      '  rules: { "evidence/graph": ["error", graph] },',
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "index.ts"),
    "export const contractFamilyBoundaryPhase = true;\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    '{"private":true,"type":"module","devDependencies":{"@ttsc/lint":"0.28.1"}}\n',
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "esnext",
          module: "esnext",
          moduleResolution: "bundler",
          allowJs: true,
          checkJs: true,
          skipLibCheck: true,
          strict: true,
        },
        include: ["index.ts", "lint.config.ts"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
};

/**
 * The generated graph's shared contract families differ in exactly two flags,
 * and this proves both are running rather than merely configured.
 *
 * A principle is a no-exclusion checklist, an obligation is no-exclusion
 * coverage distributed across one layer's H2 population, and an upstream duty
 * is the one shared family that accepts a concrete truthful negative. Those
 * differences are asserted against the factory's own claims everywhere in this
 * repository and had never been made to fail: no fixture had planted an
 * `@evidenceExclude` against a principle or an obligation and watched it be
 * refused, so `noEvidenceExclude` read green whether or not the contributor
 * honored it. The model branch also carried no live lint proof of any kind.
 *
 * Only the model H2 claim is linted. Its siblings, the model file-parent claim
 * and the layer's `docs/contracts` discovery claim, are proven by
 * `test_evidence_generated_map_space_contract` and by the package factory's own
 * contract-ledger negatives, and leaving them out is what keeps every
 * diagnostic here attributable to one reference.
 *
 * A clean lint of a paid population and a lint that never ran are the same
 * bytes, so the clean run is not evidence on its own. The two refusals below
 * come out of the same fixture, the same linked contributor and the same
 * generated configuration, which is what licenses reading the clean run as a
 * paid population rather than as a silent instrument.
 *
 * Scenarios:
 *
 * 1. A real library declaration with reviewed settings and an evidence-stage
 *    model branch returns the model H2 claim already enabled, selecting the
 *    three shared families and the settings foundation with the exact checklist
 *    and exclusion flags each family owns.
 * 2. Two model H2 units that both answer every principle, leave the whole
 *    obligation population and the settings foundation to one of them, and
 *    record one positive and one truthful-negative upstream answer lint clean,
 *    so coverage is proven to be a property of the population while the
 *    checklist is proven to be a property of each host.
 * 3. Excusing the second unit's representation-contract principle with an
 *    exclusion of that same target is refused where it is written and leaves
 *    the principle unanswered, even though the sibling unit still answers it.
 *    The unanswered count names the model principle document's own item total,
 *    so adding or retiring an item there turns this red; re-pin the count from
 *    the reported diagnostic after rereading the changed item against both
 *    fixture units, never from the item list alone.
 * 4. Excusing the reference-scale obligation the same way is refused as well,
 *    so the obligation family shares the principle's closed exclusion while
 *    differing in its per-host checklist.
 */
export const test_evidence_contract_family_exclusion_boundary = (): void => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-contract-family-boundary-"),
  );
  const resolvedRoot = `${path.resolve(root)}${path.sep}`;
  const safePrefix = `${path.resolve(os.tmpdir())}${path.sep}`;
  if (!resolvedRoot.startsWith(safePrefix))
    throw new Error(
      `Refusing a contract-family fixture outside ${os.tmpdir()}.`,
    );

  let fixtureFailure: IFixtureFailure | undefined;
  try {
    copySharedContracts(root);
    linkEvidencePlugins(root);
    fs.writeFileSync(
      path.join(root, "docs/contracts/index.md"),
      [
        "<!--",
        "@evidenceExclude discovery/core/common.md#shared-local-boundary The chair library's delivery scope, shell construction and surface partition were searched for a rule the shared model and design targets do not already own, and none remained.",
        "-->",
        "",
        "# Work-specific contract audit",
        "",
      ].join("\n"),
      "utf8",
    );
    fs.mkdirSync(path.join(root, "docs/settings"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs/settings/production.md"),
      [
        "# Production settings",
        "",
        "## Delivery scope {#delivery-scope}",
        "",
        "The library delivers one reviewable reading chair in metres under a fixed neutral studio review condition, and nominates a 1.70 m standing figure as the shared scale reference.",
        "",
      ].join("\n"),
      "utf8",
    );

    const complete = cleanModel();
    writeModel(root, complete);

    const resolve = createRequire(
      path.join(ROOT, "packages/evidence/package.json"),
    );
    const module = resolve("./src/index.ts") as IEvidenceModule;
    const claim = selectClaim(
      module.createAutoMovieEvidenceConfig(libraryState(root)).claims,
      CLAIM_NAME,
    );
    assertModelClaim(claim);
    writeLintProject(root, [claim]);

    const paid = lint(root, "complete");
    assert.equal(paid.status, 0, paid.output);
    assert.equal(count(paid.output, /\[evidence\/graph\]/gu), 0, paid.output);

    writeModel(
      root,
      excuse(
        complete,
        REFUSED_PRINCIPLE,
        PARTITION_PRINCIPLES.find(
          ([target]) => target === REFUSED_PRINCIPLE,
        )![1],
        "The surface partition inherits the shell's representation strategy, so it states no representation contract of its own.",
      ),
    );
    assertRefusedExclusion(lint(root, "excused-principle"), REFUSED_PRINCIPLE, [
      "Evidence host Markdown H2 'Surface partition' at docs/models/subject.md",
      `has not acknowledged 1 of 4 checklist item(s): '${REFUSED_PRINCIPLE}'`,
    ]);

    writeModel(
      root,
      excuse(
        complete,
        REFUSED_OBLIGATION,
        SHELL_OBLIGATIONS.find(([target]) => target === REFUSED_OBLIGATION)![1],
        "The seat shell derives its own extents, so this population needs no nominated scale reference.",
      ),
    );
    assertRefusedExclusion(
      lint(root, "excused-obligation"),
      REFUSED_OBLIGATION,
      [
        `Missing acknowledgement for '${REFUSED_OBLIGATION}' (Markdown H2 'Reference scale' at docs/obligations/design/models.md`,
      ],
    );
  } catch (error) {
    fixtureFailure = { error };
    throw error;
  } finally {
    preserveFixtureCleanup(fixtureFailure, () => {
      if (!`${path.resolve(root)}${path.sep}`.startsWith(safePrefix))
        throw new Error(`Refusing to remove a fixture outside ${os.tmpdir()}.`);
      fs.rmSync(root, { force: true, recursive: true });
    });
  }
};
