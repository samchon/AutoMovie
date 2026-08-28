import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

type Stage = "disabled" | "draft" | "evidence" | "review";
type HostSymbol = "file" | "h2" | "h3" | "h4";
type NarrativeLayer = "screenplays" | "scripts";

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
  reference: IEvidenceReference | IEvidenceReference[];
}

interface IEvidenceState {
  location: string;
  kind: "film" | null;
  populationScope:
    | { mode: "complete-production" }
    | { mode: "first-pilot"; partitionGroup: `001-${string}` };
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

interface ILintResult {
  output: string;
  status: number;
}

interface IFixtureFailure {
  error: unknown;
}

class NarrativePartitionFixtureCleanupError extends AggregateError {}

const ROOT = path.resolve(__dirname, "../../../..");
const TTSC = path.join(ROOT, "node_modules/ttsc/lib/launcher/ttsc.js");
const TTSC_CACHE = path.join(ROOT, "node_modules/.cache/ttsc");
const FIXTURE_CACHE = path.join(ROOT, "test/node_modules/.cache");
const GROUP = "001-first-movement";
const TREATMENTS = [
  "treatments/001-signal.md#signal-event",
  "treatments/002-answer.md#answer-event",
] as const;
const UNIT_IDENTITIES = [
  {
    file: "001-arrival.md",
    h1: "Arrival",
    h2: "arrival-sequence",
    h3: "arrival-scene",
    h4: "arrival-beat",
  },
  {
    file: "002-turn.md",
    h1: "Turn",
    h2: "turn-sequence",
    h3: "turn-scene",
    h4: "turn-beat",
  },
] as const;

const claimName = (layer: NarrativeLayer, symbol: HostSymbol): string =>
  symbol === "file"
    ? `${layer} files account for inherited settings, designs, and parent files`
    : symbol === "h2"
      ? `${layer} H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work`
      : `${layer} H${symbol.slice(1)} units answer their principle checklists and account for inherited work`;

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

const selectClaim = (
  claims: IEvidenceClaim[],
  layer: NarrativeLayer,
  symbol: HostSymbol,
): IEvidenceClaim => {
  const name = claimName(layer, symbol);
  const matches = claims.filter((claim) => claim.name === name);
  assert.equal(
    matches.length,
    1,
    `Expected one current claim named '${name}', received ${matches.length}.`,
  );
  return matches[0]!;
};

const layerReference = (
  claim: IEvidenceClaim,
  layer: "scripts" | "treatments",
): IEvidenceReference => {
  const matches = referencesOf(claim).filter(
    (reference) =>
      reference.type === "markdown" &&
      reference.root === "docs" &&
      reference.files.every((file) => file.startsWith(`${layer}/`)),
  );
  assert.equal(
    matches.length,
    1,
    `${claim.name ?? "unnamed claim"} must select one ${layer} relation.`,
  );
  return matches[0]!;
};

const assertRelationShape = (
  claim: IEvidenceClaim,
  layer: NarrativeLayer,
  symbol: HostSymbol,
): void => {
  assert.equal(claim.type, "markdown");
  assert.equal(claim.root, "docs");
  assert.deepEqual(claim.files, [`${layer}/*/???-*.md`]);
  assert.equal(claim.symbol, symbol);
  assert.equal(claim.disabled, true);

  const treatment = layerReference(claim, "treatments");
  assert.deepEqual(treatment.files, ["treatments/???-*.md"]);
  assert.equal(treatment.symbol, "h2");
  assert.equal(treatment.noEvidenceExclude, true);
  assert.equal(treatment.uniqueEvidence, undefined);
  assert.equal(treatment.singleEvidencePerSymbol, undefined);

  if (layer === "scripts") return;
  const script = layerReference(claim, "scripts");
  assert.deepEqual(script.files, ["scripts/*/???-*.md"]);
  assert.equal(script.symbol, symbol);
  assert.equal(script.noEvidenceExclude, true);
  assert.equal(script.uniqueEvidence, true);
  assert.equal(script.singleEvidencePerSymbol, true);
};

const write = (root: string, relative: string, content: string): void => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
};

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
  write(
    root,
    "docs/contracts/index.md",
    "<!-- @evidenceExclude discovery/common.md#shared-local-boundary This focused structural probe retains no production-specific rule. -->\n\n# Contract audit\n",
  );
};

const h2Targets = (root: string, reference: IEvidenceReference): string[] => {
  assert.equal(reference.type, "markdown");
  assert.equal(reference.symbol, "h2");
  assert.notEqual(reference.root, undefined);
  return reference.files.flatMap((file) => {
    const source = fs.readFileSync(
      path.resolve(root, reference.root!, file),
      "utf8",
    );
    const anchors = [
      ...source.matchAll(/^##(?!#)[ \t]+.+?\{#([^{}\s]+)\}[ \t]*$/gmu),
    ].map((match) => match[1]!);
    assert.notEqual(anchors.length, 0, `${file} exposes no H2 target.`);
    return anchors.map((anchor) => `${file}#${anchor}`);
  });
};

const scriptTarget = (index: number, symbol: HostSymbol): string => {
  const unit = UNIT_IDENTITIES[index]!;
  const file = `scripts/${GROUP}/${unit.file}`;
  return symbol === "file" ? file : `${file}#${unit[symbol]}`;
};

const relationshipTargets = (
  layer: NarrativeLayer,
  index: number,
  symbol: HostSymbol,
  reference: IEvidenceReference,
): string[] => {
  if (reference.files.every((file) => file.startsWith("treatments/")))
    return index === 0 ? [TREATMENTS[0]] : [...TREATMENTS];
  if (
    layer === "screenplays" &&
    reference.files.every((file) => file.startsWith("scripts/"))
  )
    return [scriptTarget(index, symbol)];
  throw new Error(
    `${claimName(layer, symbol)} has an unexpected project relation ${reference.files.join(", ")}.`,
  );
};

const targetsForHost = (
  root: string,
  claim: IEvidenceClaim,
  layer: NarrativeLayer,
  index: number,
  symbol: HostSymbol,
): string[] =>
  referencesOf(claim).flatMap((reference) =>
    reference.root === "docs" &&
    reference.files.every((file) =>
      ["scripts/", "treatments/"].some((layer) => file.startsWith(layer)),
    )
      ? relationshipTargets(layer, index, symbol, reference)
      : h2Targets(root, reference),
  );

const declaration = (owner: string, target: string): string =>
  `@evidence ${target} ${owner} carries the concrete synthetic fact selected by this structural graph probe.`;

const evidenceBlock = (owner: string, targets: readonly string[]): string =>
  ["<!--", ...targets.map((target) => declaration(owner, target)), "-->"].join(
    "\n",
  );

const narrativeFile = (
  root: string,
  claims: ReadonlyMap<string, IEvidenceClaim>,
  layer: NarrativeLayer,
  index: number,
): string => {
  const unit = UNIT_IDENTITIES[index]!;
  const owner = `${layer} ${unit.h1}`;
  const claim = (symbol: HostSymbol): IEvidenceClaim => {
    const selected = claims.get(claimName(layer, symbol));
    assert.notEqual(selected, undefined);
    return selected!;
  };
  return [
    evidenceBlock(
      `${owner} file`,
      targetsForHost(root, claim("file"), layer, index, "file"),
    ),
    "",
    `# ${unit.h1}`,
    "",
    `## Sequence {#${unit.h2}}`,
    "",
    evidenceBlock(
      `${owner} sequence`,
      targetsForHost(root, claim("h2"), layer, index, "h2"),
    ),
    "",
    "The sequence carries its declared narrative events through one executable delivery movement.",
    "",
    `### Scene {#${unit.h3}}`,
    "",
    evidenceBlock(
      `${owner} scene`,
      targetsForHost(root, claim("h3"), layer, index, "h3"),
    ),
    "",
    "The scene stages the same event attribution inside one continuous audience-facing progression.",
    "",
    `#### Beat {#${unit.h4}}`,
    "",
    evidenceBlock(
      `${owner} beat`,
      targetsForHost(root, claim("h4"), layer, index, "h4"),
    ),
    "",
    "The beat completes the attributed event change in observable form.",
    "",
  ].join("\n");
};

const writePopulation = (
  root: string,
  claims: ReadonlyMap<string, IEvidenceClaim>,
): Readonly<Record<NarrativeLayer, readonly string[]>> => {
  write(
    root,
    "docs/treatments/001-signal.md",
    "# Signal\n\n## Signal changes the question {#signal-event}\n\nA signal creates the question both delivery units carry.\n",
  );
  write(
    root,
    "docs/treatments/002-answer.md",
    "# Answer\n\n## Answer reverses the signal {#answer-event}\n\nAn answer joins the second delivery unit and reverses the first event.\n",
  );

  const output: Record<NarrativeLayer, string[]> = {
    scripts: [],
    screenplays: [],
  };
  for (const layer of ["scripts", "screenplays"] as const) {
    write(
      root,
      `docs/${layer}/${GROUP}/index.md`,
      [
        "# First movement",
        "",
        ...UNIT_IDENTITIES.map((unit) => `- [${unit.h1}](${unit.file})`),
        "",
      ].join("\n"),
    );
    for (const index of [0, 1] as const) {
      const relative = `docs/${layer}/${GROUP}/${UNIT_IDENTITIES[index].file}`;
      const content = narrativeFile(root, claims, layer, index);
      write(root, relative, content);
      output[layer].push(content);
    }
  }
  return output;
};

const writeLintProject = (root: string, claims: IEvidenceClaim[]): void => {
  write(
    root,
    "lint.config.ts",
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
  );
  write(
    root,
    "package.json",
    '{"private":true,"type":"module","devDependencies":{"@ttsc/lint":"0.28.1"}}\n',
  );
  write(
    root,
    "tsconfig.json",
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "esnext",
          module: "esnext",
          moduleResolution: "bundler",
          skipLibCheck: true,
          strict: true,
        },
        include: ["index.ts", "lint.config.ts"],
      },
      null,
      2,
    )}\n`,
  );
};

const lint = (root: string, phase: string): ILintResult => {
  write(
    root,
    "index.ts",
    `export const narrativePartitionCanary = ${JSON.stringify(phase)};\n`,
  );
  const result = spawnSync(
    process.execPath,
    [TTSC, "--cache-dir", TTSC_CACHE, "--noEmit", "-p", "tsconfig.json"],
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
      `Narrative partition lint terminated by ${result.signal}.\n${result.stdout}\n${result.stderr}`,
    );
  if (result.status === null)
    throw new Error(
      `Narrative partition lint returned no status.\n${result.stdout}\n${result.stderr}`,
    );
  return {
    status: result.status,
    output: `${result.stdout}\n${result.stderr}`
      .replaceAll("\r\n", "\n")
      .replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, ""),
  };
};

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

const assertDiagnostic = (
  result: ILintResult,
  claim: string,
  target: string,
  diagnostic: RegExp,
): void => {
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /\[evidence\/graph\]/u);
  assert.match(result.output, diagnostic);
  assert.ok(result.output.includes(claim), result.output);
  assert.ok(result.output.includes(target), result.output);
};

const preserveFixtureCleanup = (
  failure: IFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new NarrativePartitionFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Narrative-partition cleanup failed after the structural probe failed.",
    );
  }
};

const testFirstPilotPopulation = (module: IEvidenceModule): void => {
  const root = fs.mkdtempSync(
    path.join(FIXTURE_CACHE, "automovie-first-pilot-"),
  );
  const safePrefix = `${path.resolve(FIXTURE_CACHE)}${path.sep}`;
  if (!`${path.resolve(root)}${path.sep}`.startsWith(safePrefix))
    throw new Error(`Refusing a first-pilot fixture outside ${FIXTURE_CACHE}.`);

  let fixtureFailure: IFixtureFailure | undefined;
  try {
    copySharedContracts(root);
    write(root, "docs/research/source.md", "## Source {#source}\n");
    const graph = module.createAutoMovieEvidenceConfig({
      ...disabledState(root),
      kind: "film",
      populationScope: {
        mode: "first-pilot",
        partitionGroup: GROUP,
      },
      research: "draft",
    });
    const claims = new Map<string, IEvidenceClaim>();
    for (const layer of ["scripts", "screenplays"] as const)
      for (const symbol of ["file", "h2", "h3", "h4"] as const) {
        const claim = selectClaim(graph.claims, layer, symbol);
        assert.deepEqual(
          claim.files,
          [`${layer}/${GROUP}/???-*.md`],
          `${claim.name ?? "unnamed claim"} widened beyond the declared pilot group`,
        );
        claim.disabled = false;
        claims.set(claimName(layer, symbol), claim);
      }
    writeLintProject(root, [...claims.values()]);
    writePopulation(root, claims);

    const outsideGroup = "002-outside-group";
    const outsideUnit = (treatment?: string): string =>
      [
        "# Outside unit",
        "",
        "## Outside sequence {#outside-sequence}",
        ...(treatment === undefined
          ? []
          : [
              "",
              "<!--",
              declaration("outside script sequence", treatment),
              "-->",
            ]),
        "",
        "### Outside scene {#outside-scene}",
        "",
        "#### Outside beat {#outside-beat}",
        "",
        "This otherwise valid unit remains outside the selected pilot group.",
        "",
      ].join("\n");
    for (const layer of ["scripts", "screenplays"] as const) {
      write(
        root,
        `docs/${layer}/${outsideGroup}/index.md`,
        "# Outside group\n\n- [Outside unit](001-outside.md)\n",
      );
      write(
        root,
        `docs/${layer}/${outsideGroup}/001-outside.md`,
        outsideUnit(),
      );
    }

    const baseline = lint(root, "first-pilot-complete-selected-group");
    assert.equal(baseline.status, 0, baseline.output);
    assert.doesNotMatch(baseline.output, /\[evidence\/graph\]/u);

    const overflow = "treatments/003-overflow.md#overflow-event";
    write(
      root,
      "docs/treatments/003-overflow.md",
      "# Overflow\n\n## Overflow belongs outside the pilot {#overflow-event}\n\nThis event is realized only by an unselected delivery group.\n",
    );
    write(
      root,
      `docs/scripts/${outsideGroup}/001-outside.md`,
      outsideUnit(overflow),
    );
    assertDiagnostic(
      lint(root, "first-pilot-overflow-treatment"),
      claimName("scripts", "h2"),
      overflow,
      /Missing acknowledgement/u,
    );
  } catch (error) {
    fixtureFailure = { error };
    throw error;
  } finally {
    preserveFixtureCleanup(fixtureFailure, () => {
      if (!`${path.resolve(root)}${path.sep}`.startsWith(safePrefix))
        throw new Error(
          `Refusing to remove a first-pilot fixture outside ${FIXTURE_CACHE}.`,
        );
      fs.rmSync(root, { force: true, recursive: true });
    });
  }
};

/**
 * The real generated evidence graph separates narrative-event coverage from
 * the exact delivery partition instead of testing a hand-built approximation.
 *
 * Scenarios:
 *
 * 1. The exact disabled file/H2/H3/H4 script and screenplay claims are pinned,
 *    enabled in place, and accept one treatment split across two delivery
 *    units plus one delivery unit that braids two treatments.
 * 2. Removing the only script-H2 citation to one treatment event fails script
 *    coverage and names that exact treatment target.
 * 3. Giving one screenplay H2 two script parents fails exact same-depth
 *    screenplay-to-script lineage.
 * 4. Removing the only screenplay-H2 citation to one treatment event fails
 *    direct final-layer coverage while exact script lineage remains present.
 * 5. First-pilot claims select one exact group at full strength, ignore a
 *    valid out-of-scope group, and reject a treatment event realized only by
 *    that unselected group.
 */
export const test_evidence_narrative_partition_contract = (): void => {
  fs.mkdirSync(FIXTURE_CACHE, { recursive: true });
  const root = fs.mkdtempSync(
    path.join(FIXTURE_CACHE, "automovie-narrative-partition-"),
  );
  const safePrefix = `${path.resolve(FIXTURE_CACHE)}${path.sep}`;
  if (!`${path.resolve(root)}${path.sep}`.startsWith(safePrefix))
    throw new Error(
      `Refusing a narrative-partition fixture outside ${FIXTURE_CACHE}.`,
    );

  let fixtureFailure: IFixtureFailure | undefined;
  try {
    copySharedContracts(root);
    const resolve = createRequire(
      path.join(ROOT, "packages/evidence/package.json"),
    );
    const module = resolve("./src/index.ts") as IEvidenceModule;
    testFirstPilotPopulation(module);
    const full = module.createAutoMovieEvidenceConfig(disabledState(root));
    const claims = new Map<string, IEvidenceClaim>();
    for (const layer of ["scripts", "screenplays"] as const)
      for (const symbol of ["file", "h2", "h3", "h4"] as const) {
        const claim = selectClaim(full.claims, layer, symbol);
        assertRelationShape(claim, layer, symbol);
        claim.disabled = false;
        claims.set(claimName(layer, symbol), claim);
      }
    writeLintProject(root, [...claims.values()]);
    const baseline = writePopulation(root, claims);

    const complete = lint(root, "complete");
    assert.equal(complete.status, 0, complete.output);
    assert.doesNotMatch(complete.output, /\[evidence\/graph\]/u);

    const scriptPath = `docs/scripts/${GROUP}/${UNIT_IDENTITIES[1].file}`;
    const missingScriptTarget = declaration(
      "scripts Turn sequence",
      TREATMENTS[1],
    );
    write(
      root,
      scriptPath,
      replaceOnce(baseline.scripts[1]!, `${missingScriptTarget}\n`, ""),
    );
    assertDiagnostic(
      lint(root, "missing-script-treatment"),
      claimName("scripts", "h2"),
      TREATMENTS[1],
      /Missing acknowledgement/u,
    );
    write(root, scriptPath, baseline.scripts[1]!);

    const screenplayPath = `docs/screenplays/${GROUP}/${UNIT_IDENTITIES[0].file}`;
    const firstParent = declaration(
      "screenplays Arrival sequence",
      scriptTarget(0, "h2"),
    );
    const secondParent = declaration(
      "screenplays Arrival sequence",
      scriptTarget(1, "h2"),
    );
    write(
      root,
      screenplayPath,
      replaceOnce(
        baseline.screenplays[0]!,
        firstParent,
        `${firstParent}\n${secondParent}`,
      ),
    );
    assertDiagnostic(
      lint(root, "two-script-parents"),
      claimName("screenplays", "h2"),
      scriptTarget(1, "h2"),
      /exactly one/iu,
    );
    write(root, screenplayPath, baseline.screenplays[0]!);

    const finalPath = `docs/screenplays/${GROUP}/${UNIT_IDENTITIES[1].file}`;
    const missingFinalTarget = declaration(
      "screenplays Turn sequence",
      TREATMENTS[1],
    );
    write(
      root,
      finalPath,
      replaceOnce(baseline.screenplays[1]!, `${missingFinalTarget}\n`, ""),
    );
    assertDiagnostic(
      lint(root, "missing-screenplay-treatment"),
      claimName("screenplays", "h2"),
      TREATMENTS[1],
      /Missing acknowledgement/u,
    );
  } catch (error) {
    fixtureFailure = { error };
    throw error;
  } finally {
    preserveFixtureCleanup(fixtureFailure, () => {
      if (!`${path.resolve(root)}${path.sep}`.startsWith(safePrefix))
        throw new Error(
          `Refusing to remove a narrative-partition fixture outside ${FIXTURE_CACHE}.`,
        );
      fs.rmSync(root, { force: true, recursive: true });
    });
  }
};
