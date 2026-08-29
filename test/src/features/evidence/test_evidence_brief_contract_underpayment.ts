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
  kind: null;
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

class BriefEvidenceFixtureCleanupError extends AggregateError {}

const ROOT = path.resolve(__dirname, "../../../..");
const TTSC = path.join(ROOT, "node_modules/ttsc/lib/launcher/ttsc.js");
const TTSC_CACHE = path.join(ROOT, "node_modules/.cache/ttsc");
const BRIEF = "docs/briefs/delivery.md";
const ADDRESSABILITY =
  "obligations/delivery/briefs.md#brief-unit-addressability";
const INFORMATION_STRUCTURE =
  "principles/delivery/briefs.md#brief-information-structure";
const CLAIM_NAMES = {
  h2: "briefs H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  h3: "briefs H3 units answer their principle checklists and account for inherited work",
  h4: "briefs H4 units answer their principle checklists and account for inherited work",
} as const;
const CHECKLISTS = [
  "principles/core/common.md#scope-preservation",
  "principles/core/common.md#substantive-completion",
  "principles/core/common.md#machine-default",
  "principles/core/common.md#evidence-content-conformance",
  "principles/core/common.md#declared-basis",
  "principles/core/inherited-units.md#derived-parent-differentiation",
  INFORMATION_STRUCTURE,
  "principles/delivery/briefs.md#no-narrative-smuggling",
  "upstream/delivery/briefs.md#parent-revision-from-brief-work",
] as const;
const OBLIGATIONS = [
  "obligations/core/common.md#purpose-fit",
  "obligations/core/common.md#layer-boundary",
  "obligations/core/common.md#production-language",
  "obligations/core/common.md#proportionate-development",
  "obligations/delivery/briefs.md#single-scope-eligibility",
  ADDRESSABILITY,
  "obligations/delivery/briefs.md#observable-progression",
] as const;

/** Preserve the primary failure if removal of its disposable project fails too. */
const preserveFixtureCleanup = (
  failure: IFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new BriefEvidenceFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Brief evidence fixture cleanup failed after the test failed.",
    );
  }
};

/** The declaration supplied to the real graph factory before any brief exists. */
const disabledState = (location: string): IEvidenceState => ({
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
 * Pin the real brief claim topology before enabling it for the focused probe.
 *
 * Principles remain no-exclusion checklists on every H2/H3/H4 host, while
 * obligations remain no-exclusion population coverage on H2 alone. The exact
 * file inventory also proves that the empty root retains its common and brief
 * upstream accounting without fabricating settings, design, or narrative
 * hosts.
 */
const assertBriefClaim = (
  claim: IEvidenceClaim,
  symbol: "h2" | "h3" | "h4",
): IEvidenceReference[] => {
  assert.equal(claim.name, CLAIM_NAMES[symbol]);
  assert.equal(claim.type, "markdown");
  assert.equal(claim.root, "docs");
  assert.deepEqual(claim.files, ["briefs/**/*.md"]);
  assert.equal(claim.symbol, symbol);
  assert.equal(claim.disabled, true);
  assert.equal(claim.evidenceExcludeCarriers, undefined);

  const references = referencesOf(claim);
  assert.deepEqual(
    references.map(fileOf).sort((left, right) => left.localeCompare(right)),
    symbol === "h2"
      ? [
          "obligations/core/common.md",
          "obligations/delivery/briefs.md",
          "principles/core/common.md",
          "principles/core/inherited-units.md",
          "principles/delivery/briefs.md",
          "upstream/delivery/briefs.md",
        ]
      : [
          "principles/core/common.md",
          "principles/core/inherited-units.md",
          "principles/delivery/briefs.md",
          "upstream/delivery/briefs.md",
        ],
  );
  for (const reference of references) {
    assert.equal(reference.type, "markdown");
    assert.equal(reference.root, "docs");
    assert.equal(reference.symbol, "h2");
    assert.equal(
      reference.noEvidenceExclude,
      fileOf(reference).startsWith("upstream/") ? undefined : true,
    );
    assert.equal(reference.requireReview, false);
    assert.equal(reference.singleEvidencePerSymbol, undefined);
    assert.equal(reference.uniqueEvidence, undefined);
    assert.equal(
      reference.checklist,
      fileOf(reference).startsWith("obligations/") ? undefined : true,
    );
  }
  return references;
};

/** Make an evidence block whose declarations belong to the preceding heading. */
const evidenceBlock = (
  owner: "Delivery" | "Shot" | "Observation",
  targets: readonly string[],
): string =>
  [
    "<!--",
    ...targets.map(
      (target) =>
        `@evidence ${target} ${owner} states the concrete bounded decision this contract requires.`,
    ),
    "-->",
  ].join("\n");

/** A fully paid one-delivery, one-shot, one-observation brief population. */
const cleanBrief = (): string =>
  [
    "# Rotation study",
    "",
    "## Delivery {#delivery}",
    "",
    evidenceBlock("Delivery", [...CHECKLISTS, ...OBLIGATIONS]),
    "",
    "Delivery owns one five-second clockwise rotation under the fixed front-camera review condition. The result is a complete visible turn, and any reversal or incomplete turn falsifies it; Shot and Observation allocate that result.",
    "",
    "### Shot {#shot}",
    "",
    evidenceBlock("Shot", CHECKLISTS),
    "",
    "Shot owns the locked frontal composition for the complete rotation. The subject remains centered at constant scale, and Observation states the acceptance predicate.",
    "",
    "#### Observation {#observation}",
    "",
    evidenceBlock("Observation", CHECKLISTS),
    "",
    "From the locked frontal camera, observe one uninterrupted clockwise turn ending at the initial silhouette; a reversed direction, cut, or different terminal silhouette falsifies this observation.",
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

const declaration = (
  owner: "Delivery" | "Shot" | "Observation",
  target: string,
): string =>
  `@evidence ${target} ${owner} states the concrete bounded decision this contract requires.\n`;

/** Write the only Markdown host population used by the focused graph. */
const writeBrief = (root: string, content: string): void => {
  const location = path.join(root, BRIEF);
  fs.mkdirSync(path.dirname(location), { recursive: true });
  fs.writeFileSync(location, content, "utf8");
};

/** Run the real ttsc launcher and preserve all diagnostic channels. */
const lint = (
  root: string,
  phase: "complete" | "hidden-shot" | "bundled-observation",
): ILintResult => {
  fs.writeFileSync(
    path.join(root, "index.ts"),
    `export const briefContractUnderpaymentCanary = "${phase}";\n`,
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
      `Brief evidence lint terminated by ${result.signal}.\n${result.stdout}\n${result.stderr}`,
    );
  if (result.status === null)
    throw new Error(
      `Brief evidence lint returned no exit status.\n${result.stdout}\n${result.stderr}`,
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

/** Assert one evidence diagnostic and no unrelated compiler failure. */
const assertIsolatedDiagnostic = (
  result: ILintResult,
  target: string,
  claimName: string,
  host?: string,
): void => {
  assert.notEqual(result.status, 0, result.output);
  assert.equal(count(result.output, /\[evidence\/graph\]/gu), 1, result.output);
  assert.equal(count(result.output, /error TS\d+:/gu), 1, result.output);
  assert.match(result.output, new RegExp(target.replace(".", "\\."), "u"));
  assert.match(
    result.output,
    new RegExp(claimName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
  );
  if (host !== undefined) assert.match(result.output, new RegExp(host, "u"));
  assert.match(result.output, /Found 1 error\./u);
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
    {
      recursive: true,
    },
  );
};

/** Materialize the selected real claim objects as the temporary lint config. */
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
    "export const briefContractUnderpaymentCanary = true;\n",
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
 * The current reusable brief claims voice their semantic underpayment through
 * the shipped evidence plugin rather than through a hand-built approximation.
 *
 * Scenarios:
 *
 * 1. The exact disabled H2 delivery, H3 shot, and H4 observation claims are
 *    selected by name, structurally pinned, enabled in place, and fully paid.
 * 2. An H3 that hides an independently composed second shot accompanies one
 *    removed H2 addressability acknowledgement and emits only that obligation.
 * 3. An H4 that bundles distinct viewing conditions and falsifiers accompanies
 *    one removed H4 information-structure answer and emits only that checklist
 *    diagnostic on the Observation host.
 */
export const test_evidence_brief_contract_underpayment = (): void => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-brief-contract-underpayment-"),
  );
  const resolvedRoot = `${path.resolve(root)}${path.sep}`;
  const safePrefix = `${path.resolve(os.tmpdir())}${path.sep}`;
  if (!resolvedRoot.startsWith(safePrefix))
    throw new Error(
      `Refusing a brief evidence fixture outside ${os.tmpdir()}.`,
    );

  let fixtureFailure: IFixtureFailure | undefined;
  try {
    copySharedContracts(root);
    linkEvidencePlugins(root);
    fs.mkdirSync(path.join(root, "docs/contracts"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs/contracts/index.md"),
      "<!-- @evidenceExclude discovery/core/common.md#shared-local-boundary This empty disabled graph retains no production-specific contract. -->\n\n# Contract audit\n",
      "utf8",
    );

    const resolve = createRequire(
      path.join(ROOT, "packages/evidence/package.json"),
    );
    const module = resolve("./src/index.ts") as IEvidenceModule;
    const full = module.createAutoMovieEvidenceConfig(disabledState(root));
    const claims = (["h2", "h3", "h4"] as const).map((symbol) => {
      const claim = selectClaim(full.claims, CLAIM_NAMES[symbol]);
      const references = assertBriefClaim(claim, symbol);
      claim.disabled = false;
      assert.equal(claim.disabled, false);
      assert.strictEqual(
        referencesOf(claim),
        references,
        `${CLAIM_NAMES[symbol]} rebuilt its reference array while activating.`,
      );
      return claim;
    });
    writeLintProject(root, claims);

    const complete = cleanBrief();
    writeBrief(root, complete);
    const paid = lint(root, "complete");
    assert.equal(paid.status, 0, paid.output);
    assert.equal(count(paid.output, /\[evidence\/graph\]/gu), 0, paid.output);

    const hiddenShot = replaceOnce(
      complete,
      "Shot owns the locked frontal composition for the complete rotation. The subject remains centered at constant scale, and Observation states the acceptance predicate.",
      "Shot owns the locked frontal composition for the complete rotation. It also cuts to an independently composed overhead shot under a second viewing condition with its own acceptance boundary, but gives that second shot no H3 address. Observation states only the frontal acceptance predicate.",
    );
    writeBrief(
      root,
      replaceOnce(hiddenShot, declaration("Delivery", ADDRESSABILITY), ""),
    );
    assertIsolatedDiagnostic(
      lint(root, "hidden-shot"),
      ADDRESSABILITY,
      CLAIM_NAMES.h2,
    );

    const bundledObservation = replaceOnce(
      complete,
      "From the locked frontal camera, observe one uninterrupted clockwise turn ending at the initial silhouette; a reversed direction, cut, or different terminal silhouette falsifies this observation.",
      "From the locked frontal camera at full light, observe one uninterrupted clockwise turn; reversal falsifies that result. From an overhead camera after the light falls to half intensity, observe a centered circular path; leaving the center marker falsifies this separate result.",
    );
    writeBrief(
      root,
      replaceOnce(
        bundledObservation,
        declaration("Observation", INFORMATION_STRUCTURE),
        "",
      ),
    );
    assertIsolatedDiagnostic(
      lint(root, "bundled-observation"),
      INFORMATION_STRUCTURE,
      CLAIM_NAMES.h4,
      "Markdown H4 'Observation' at docs/briefs/delivery\\.md",
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
