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
  mapSources: Stage;
  modelSources: Stage;
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

class SourcePrincipleFixtureCleanupError extends AggregateError {}

const ROOT = path.resolve(__dirname, "../../../..");
const TTSC = path.join(ROOT, "node_modules/ttsc/lib/launcher/ttsc.js");
const SOURCE = "src/production.ts";
const CLAIM_NAME =
  "production source owners answer source-unit principle checklists, serialize settings, and cover production-source obligations";
const CONFORMANCE =
  "principles/source-units.md#source-evidence-content-conformance";
const PRINCIPLES = [
  "principles/source-units.md#source-scope-preservation",
  "principles/source-units.md#source-substantive-completion",
  CONFORMANCE,
] as const;
const OBLIGATIONS = [
  "obligations/production-sources.md#settings-only-serialization",
  "obligations/production-sources.md#delivery-identity",
  "obligations/production-sources.md#shared-visual-grammar",
] as const;
const UPSTREAM =
  "upstream/delivery/production-sources.md#settings-revision-from-production-source-work";
const REASONS = new Map<string, string>([
  [
    PRINCIPLES[0],
    "The export owns only the settings-backed delivery envelope and visual grammar serialized by its fields.",
  ],
  [
    PRINCIPLES[1],
    "The immutable identity, runtime, format, deliverables, and visual grammar form this probe's complete production serialization.",
  ],
  [
    PRINCIPLES[2],
    "Each evidence reason names the exact owner, identity, runtime, format, deliverable, or visual field the export establishes.",
  ],
  [
    OBLIGATIONS[0],
    "settingsOwner traces every emitted delivery and visual value to the fixture's declared settings owner.",
  ],
  [
    OBLIGATIONS[1],
    "The source preserves the declared identity, logline, twelve-second runtime, frame format, delivery mode, and prototype deliverable.",
  ],
  [
    OBLIGATIONS[2],
    "visualGrammar serializes the reviewed palette, silhouette, scale, material language, and blocking fidelity tier together.",
  ],
]);

const reasonOf = (target: string): string => {
  const reason = REASONS.get(target);
  assert.ok(reason, `No focused evidence reason exists for ${target}.`);
  return reason;
};

/** Preserve the primary failure if disposable-project removal fails too. */
const preserveFixtureCleanup = (
  failure: IFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new SourcePrincipleFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Source-principle fixture cleanup failed after the test failed.",
    );
  }
};

/** The real graph factory receives this state before the focused source exists. */
const disabledState = (location: string): IEvidenceState => ({
  location,
  kind: null,
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

const referencesOf = (claim: IEvidenceClaim): IEvidenceReference[] =>
  Array.isArray(claim.reference) ? claim.reference : [claim.reference];

const fileOf = (reference: IEvidenceReference): string => {
  assert.equal(reference.files.length, 1);
  return reference.files[0]!;
};

/** Select one exact current claim; a rename or duplicate is a test failure. */
const selectClaim = (claims: IEvidenceClaim[]): IEvidenceClaim => {
  const matches = claims.filter((claim) => claim.name === CLAIM_NAME);
  assert.equal(
    matches.length,
    1,
    `Expected one current claim named '${CLAIM_NAME}', received ${matches.length}.`,
  );
  return matches[0]!;
};

/** Pin the exported host and the principle/obligation family distinction. */
const assertProductionSourceClaim = (
  claim: IEvidenceClaim,
): IEvidenceReference[] => {
  assert.equal(claim.name, CLAIM_NAME);
  assert.equal(claim.type, "typescript");
  assert.equal(claim.root, undefined);
  assert.deepEqual(claim.files, [SOURCE]);
  assert.deepEqual(claim.symbol, ["type", "property", "function"]);
  assert.equal(claim.disabled, true);
  assert.equal(claim.evidenceExcludeCarriers, undefined);

  const references = referencesOf(claim);
  assert.deepEqual(
    references.map(fileOf).sort((left, right) => left.localeCompare(right)),
    [
      "obligations/production-sources.md",
      "principles/source-units.md",
      "upstream/delivery/production-sources.md",
    ],
  );
  for (const reference of references) {
    assert.equal(reference.type, "markdown");
    assert.equal(reference.root, "node_modules/@automovie/template/docs");
    assert.equal(reference.symbol, "h2");
    assert.equal(
      reference.noEvidenceExclude,
      fileOf(reference) === "upstream/delivery/production-sources.md"
        ? undefined
        : true,
    );
    assert.equal(reference.requireReview, false);
    assert.equal(reference.singleEvidencePerSymbol, undefined);
    assert.equal(reference.uniqueEvidence, undefined);
    assert.equal(
      reference.checklist,
      [
        "principles/source-units.md",
        "upstream/delivery/production-sources.md",
      ].includes(fileOf(reference))
        ? true
        : undefined,
    );
  }
  return references;
};

/** Write complete production-source type and value owners with exact answers. */
const cleanSource = (): string =>
  [
    "/**",
    ` * @evidence ${PRINCIPLES[0]} The type owns only the immutable delivery envelope serialized by the production value.`,
    ` * @evidence ${PRINCIPLES[1]} Identity, runtime, frame format, delivery mode, deliverables, settings owner, and visual grammar complete this type.`,
    ` * @evidence ${PRINCIPLES[2]} Each type-level reason names the exact field boundary and the source owner that realizes it.`,
    ` * @evidenceExclude ${UPSTREAM} The type exercised the concrete delivery identity, twelve-second runtime, 1920x1080 24 fps format, prototype output, settings owner, and visual grammar without requiring a settings repair.`,
    " */",
    "export interface IProductionEnvelope {",
    "  id: string;",
    "  logline: string;",
    "  runtimeSeconds: number;",
    "  frameFormat: { width: number; height: number; fps: number };",
    "  deliveryMode: string;",
    "  deliverables: readonly string[];",
    "  settingsOwner: string;",
    "  visualGrammar: {",
    "    palette: readonly string[];",
    "    silhouette: string;",
    "    scale: string;",
    "    materialLanguage: string;",
    "    fidelity: string;",
    "  };",
    "}",
    "",
    "/**",
    ...[...PRINCIPLES, ...OBLIGATIONS].map(
      (target) => ` * @evidence ${target} ${reasonOf(target)}`,
    ),
    ` * @evidenceExclude ${UPSTREAM} The value exercised the delivery identity, twelve-second runtime, 1920x1080 24 fps format, prototype output, settings owner, and visual grammar without requiring a settings repair.`,
    " */",
    "export const production: IProductionEnvelope = {",
    '  id: "source-principle-probe",',
    '  logline: "One deterministic source proves its declared delivery.",',
    "  runtimeSeconds: 12,",
    "  frameFormat: { width: 1920, height: 1080, fps: 24 },",
    '  deliveryMode: "prototype",',
    '  deliverables: ["blocking-pass"] as const,',
    '  settingsOwner: "settings/production.md#delivery",',
    "  visualGrammar: {",
    '    palette: ["#20242b", "#d7dde8"] as const,',
    '    silhouette: "single centered subject",',
    '    scale: "meters",',
    '    materialLanguage: "matte blocking surfaces",',
    '    fidelity: "blocking",',
    "  },",
    "} as const;",
    "",
  ].join("\n");

/** Replace one exact fixture declaration and reject an ambiguous mutation. */
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

/** State the upstream values that the focused source serializes. */
const writeSettingsBasis = (root: string): void => {
  const file = path.join(root, "docs/settings/production.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    [
      "# Source-principle probe settings",
      "",
      "## Delivery {#delivery}",
      "",
      "The source-principle-probe is a twelve-second 1920x1080 24 fps blocking-pass prototype. It uses a dark and light neutral palette, one centered silhouette, meter scale, matte blocking surfaces, and blocking fidelity.",
      "",
    ].join("\n"),
    "utf8",
  );
};

/** Install only the shared contract package shape resolved by the graph. */
const copySharedContracts = (root: string): void => {
  const destination = path.join(root, "node_modules", "@automovie", "template");
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(
    path.join(ROOT, "packages/template/docs"),
    path.join(destination, "docs"),
    { recursive: true },
  );
  fs.writeFileSync(
    path.join(destination, "package.json"),
    '{"name":"@automovie/template","version":"0.0.0"}\n',
    "utf8",
  );
};

/** Resolve the native compiler, lint host, and contributor from the workspace. */
const linkEvidenceRuntime = (root: string): void => {
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
  fs.symlinkSync(
    typescript,
    path.join(root, "node_modules", "typescript"),
    process.platform === "win32" ? "junction" : "dir",
  );
};

/** Materialize the selected real claim object as the temporary lint config. */
const writeLintProject = (root: string, claim: IEvidenceClaim): void => {
  fs.writeFileSync(
    path.join(root, "lint.config.ts"),
    [
      'import { evidence } from "@ttsc/evidence";',
      "",
      `const graph = ${JSON.stringify({ claims: [claim] }, null, 2)};`,
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
    path.join(root, "package.json"),
    '{"private":true,"type":"module","devDependencies":{"@ttsc/lint":"0.28.1","typescript":"7.0.2"}}\n',
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
          skipLibCheck: true,
          strict: true,
        },
        include: ["phase.ts", "src/**/*.ts", "lint.config.ts"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
};

/** Run the real ttsc launcher and preserve every diagnostic channel. */
const lint = (
  root: string,
  phase: "complete" | "exported-type-underpayment",
): ILintResult => {
  fs.writeFileSync(
    path.join(root, "phase.ts"),
    `export const sourcePrincipleProbePhase = "${phase}";\n`,
    "utf8",
  );
  const result = spawnSync(
    process.execPath,
    [
      TTSC,
      "--cache-dir",
      path.join(root, ".ttsc-cache"),
      "--noEmit",
      "--project",
      "tsconfig.json",
    ],
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
      `Source-principle lint terminated by ${result.signal}.\n${result.stdout}\n${result.stderr}`,
    );
  if (result.status === null)
    throw new Error(
      `Source-principle lint returned no exit status.\n${result.stdout}\n${result.stderr}`,
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

/** Assert one source checklist diagnostic and no unrelated compiler failure. */
const assertIsolatedDiagnostic = (result: ILintResult): void => {
  assert.notEqual(result.status, 0, result.output);
  assert.equal(count(result.output, /\[evidence\/graph\]/gu), 1, result.output);
  assert.equal(count(result.output, /error TS\d+:/gu), 1, result.output);
  assert.match(result.output, new RegExp(CONFORMANCE.replace(".", "\\."), "u"));
  assert.match(
    result.output,
    new RegExp(CLAIM_NAME.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
  );
  assert.match(result.output, /IProductionEnvelope/u);
  assert.match(result.output, /src\/production\.ts/u);
  assert.match(result.output, /Found 1 error\./u);
};

/**
 * Voice source-unit principle underpayment through the shipped evidence plugin.
 *
 * The complete export pays the exact source principle checklist and production
 * source obligation population. The negative then plants a plainly false
 * delivery-identity reason and removes only that export's answer to the source
 * evidence-content-conformance principle; the same real claim must refuse it
 * with one isolated diagnostic on the selected export.
 *
 * Scenarios:
 *
 * 1. A complete production-source export answers the three per-owner source
 *    principles and three population obligations, so the real contributor
 *    accepts it without a graph diagnostic.
 * 2. The exported type omits only its evidence-content-conformance answer, so
 *    the source-unit checklist rejects that exact type with one diagnostic.
 */
export const test_evidence_source_principle_underpayment = (): void => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-source-principle-underpayment-"),
  );
  const safePrefix = `${path.resolve(os.tmpdir())}${path.sep}`;
  if (!`${path.resolve(root)}${path.sep}`.startsWith(safePrefix))
    throw new Error(
      `Refusing a source-principle fixture outside ${os.tmpdir()}.`,
    );

  let fixtureFailure: IFixtureFailure | undefined;
  try {
    copySharedContracts(root);
    linkEvidenceRuntime(root);
    fs.mkdirSync(path.join(root, "docs/contracts"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs/contracts/index.md"),
      "<!-- @evidenceExclude discovery/common.md#shared-local-boundary This empty disabled graph retains no production-specific contract. -->\n\n# Contract audit\n",
      "utf8",
    );

    const resolve = createRequire(
      path.join(ROOT, "packages/evidence/package.json"),
    );
    const module = resolve("./src/index.ts") as IEvidenceModule;
    const graph = module.createAutoMovieEvidenceConfig(disabledState(root));
    const claim = selectClaim(graph.claims);
    const references = assertProductionSourceClaim(claim);
    claim.disabled = false;
    assert.equal(claim.disabled, false);
    assert.strictEqual(
      referencesOf(claim),
      references,
      `${CLAIM_NAME} rebuilt its reference array while activating.`,
    );
    writeLintProject(root, claim);
    writeSettingsBasis(root);

    const complete = cleanSource();
    const source = path.join(root, SOURCE);
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, complete, "utf8");
    const paid = lint(root, "complete");
    assert.equal(paid.status, 0, paid.output);
    assert.equal(count(paid.output, /\[evidence\/graph\]/gu), 0, paid.output);

    fs.writeFileSync(
      source,
      replaceOnce(
        complete,
        ` * @evidence ${CONFORMANCE} Each type-level reason names the exact field boundary and the source owner that realizes it.\n`,
        "",
      ),
      "utf8",
    );
    assertIsolatedDiagnostic(lint(root, "exported-type-underpayment"));
  } catch (error) {
    fixtureFailure = { error };
    throw error;
  } finally {
    preserveFixtureCleanup(fixtureFailure, () => {
      if (!`${path.resolve(root)}${path.sep}`.startsWith(safePrefix))
        throw new Error(
          `Refusing to remove a source-principle fixture outside ${os.tmpdir()}.`,
        );
      fs.rmSync(root, { force: true, recursive: true });
    });
  }
};
