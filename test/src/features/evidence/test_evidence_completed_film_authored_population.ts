import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

type Stage = "disabled" | "draft" | "evidence" | "review";

interface EvidenceState {
  location: string;
  kind: "film";
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
  claims: [];
}

interface FixtureFailure {
  error: unknown;
}

class CompletedFilmAuthoredPopulationCleanupError extends AggregateError {}

const AUTHORED_CLAIM_NAMES = [
  "settings H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "models files account for inherited settings, designs, and parent files",
  "models H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "motions files account for inherited settings, designs, and parent files",
  "motions H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "treatments files account for inherited settings, designs, and parent files",
  "treatments H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "scripts files account for inherited settings, designs, and parent files",
  "scripts H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "scripts H3 units answer their principle checklists and account for inherited work",
  "scripts H4 units answer their principle checklists and account for inherited work",
  "screenplays files account for inherited settings, designs, and parent files",
  "screenplays H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "screenplays H3 units answer their principle checklists and account for inherited work",
  "screenplays H4 units answer their principle checklists and account for inherited work",
] as const;

const activeState = (location: string): EvidenceState => ({
  location,
  kind: "film",
  populationScope: { mode: "complete-production" },
  settings: "review",
  research: "disabled",
  maps: "disabled",
  models: "review",
  spaces: "disabled",
  materials: "disabled",
  instances: "disabled",
  motions: "review",
  systems: "disabled",
  treatments: "review",
  scripts: "review",
  screenplays: "review",
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

const files = (directory: string): string[] =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return files(absolute);
      return entry.isFile() && entry.name.endsWith(".md") ? [absolute] : [];
    });

const headingCounts = (
  directory: string,
): { h2: number; h3: number; h4: number } => {
  const counts = { h2: 0, h3: 0, h4: 0 };
  for (const file of files(directory)) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(
      /^(#{2,4})[ \t]+.+\{#[^}]+\}[ \t]*$/gmu,
    )) {
      if (match[1].length === 2) counts.h2 += 1;
      else if (match[1].length === 3) counts.h3 += 1;
      else counts.h4 += 1;
    }
  }
  return counts;
};

const principleInPreamble = (directory: string): string | null => {
  for (const file of files(directory)) {
    const source = fs.readFileSync(file, "utf8");
    const h1 = source.search(/^#(?!#)[ \t]+\S/mu);
    if (
      h1 !== -1 &&
      /@evidence(?:Exclude)?(?:Review)?\s+principles\//u.test(
        source.slice(0, h1),
      )
    )
      return file;
  }
  return null;
};

interface NarrativeUnit {
  anchor: string;
  depth: 2 | 3 | 4;
  evidence: string;
  file: string;
}

const narrativeUnits = (directory: string): NarrativeUnit[] =>
  files(directory).flatMap((file) => {
    const source = fs.readFileSync(file, "utf8");
    return [
      ...source.matchAll(
        /^(#{2,4})[ \t]+.+\{#([^}]+)\}[ \t]*\r?\n\r?\n<!--\r?\n([\s\S]*?)\r?\n-->/gmu,
      ),
    ].map((match) => ({
      anchor: match[2]!,
      depth: match[1]!.length as 2 | 3 | 4,
      evidence: match[3]!,
      file,
    }));
  });

const relativeUnitFiles = (directory: string): string[] =>
  files(directory)
    .filter((file) => path.basename(file) !== "index.md")
    .map((file) => path.relative(directory, file).replaceAll(path.sep, "/"));

const evidenceTargets = (unit: NarrativeUnit, layer: string): string[] =>
  [
    ...unit.evidence.matchAll(
      new RegExp(`^@evidence (${layer}/[^\\s]+)`, "gmu"),
    ),
  ].map((match) => match[1]!);

const legacyPath = (directory: string): string | null => {
  const entries = fs.readdirSync(directory, {
    encoding: "utf8",
    recursive: true,
  });
  for (const file of entries.sort((left, right) => left.localeCompare(right))) {
    const relative = String(file);
    if (!/\.(?:json|md|ts)$/u.test(relative)) continue;
    const absolute = path.join(directory, relative);
    if (!fs.statSync(absolute).isFile()) continue;
    if (
      /\b(?:storylines|scenarios|script)\//u.test(
        fs.readFileSync(absolute, "utf8"),
      )
    )
      return relative;
  }
  return null;
};

const canonicalNarrativeTopology = (
  fixture: string,
): Record<string, () => boolean> => {
  const treatments = path.join(fixture, "treatments");
  const scripts = path.join(fixture, "scripts");
  const screenplays = path.join(fixture, "screenplays");
  const treatmentUnits = narrativeUnits(treatments);
  const scriptUnits = narrativeUnits(scripts);
  const screenplayUnits = narrativeUnits(screenplays);
  const treatmentTargets = new Set(
    treatmentUnits.map(
      (unit) => `treatments/${path.basename(unit.file)}#${unit.anchor}`,
    ),
  );
  const expectedUnitFiles = ["001-cue/001-cue.md", "002-answer/001-answer.md"];
  const coveredAtEveryDepth = (units: NarrativeUnit[]): boolean =>
    ([2, 3, 4] as const).every((depth) => {
      const covered = new Set(
        units
          .filter((unit) => unit.depth === depth)
          .flatMap((unit) => evidenceTargets(unit, "treatments")),
      );
      return [...treatmentTargets].every((target) => covered.has(target));
    });
  const directTreatmentCoverage = (units: NarrativeUnit[]): boolean =>
    units.every((unit) => evidenceTargets(unit, "treatments").length > 0);
  const exactScreenplayLineage = screenplayUnits.every((unit) => {
    const relative = path
      .relative(screenplays, unit.file)
      .replaceAll(path.sep, "/");
    const expected = `scripts/${relative}#${unit.anchor}`;
    const parents = evidenceTargets(unit, "scripts");
    return parents.length === 1 && parents[0] === expected;
  });
  const splitCounts = new Map<string, number>();
  for (const unit of scriptUnits.filter((candidate) => candidate.depth === 4))
    for (const target of evidenceTargets(unit, "treatments"))
      splitCounts.set(target, (splitCounts.get(target) ?? 0) + 1);

  return {
    "treatments are flat H2-only event files": () =>
      relativeUnitFiles(treatments).every((file) => !file.includes("/")) &&
      treatmentUnits.length === 2 &&
      treatmentUnits.every((unit) => unit.depth === 2),
    "scripts use the grouped delivery partition": () =>
      JSON.stringify(relativeUnitFiles(scripts)) ===
        JSON.stringify(expectedUnitFiles) &&
      fs.existsSync(path.join(scripts, "001-cue/index.md")) &&
      fs.existsSync(path.join(scripts, "002-answer/index.md")),
    "screenplays mirror script files and identities exactly": () =>
      JSON.stringify(relativeUnitFiles(screenplays)) ===
        JSON.stringify(expectedUnitFiles) &&
      scriptUnits.map(({ anchor, depth }) => `${depth}:${anchor}`).join("|") ===
        screenplayUnits
          .map(({ anchor, depth }) => `${depth}:${anchor}`)
          .join("|") &&
      exactScreenplayLineage,
    "scripts cover every treatment directly at every depth": () =>
      directTreatmentCoverage(scriptUnits) && coveredAtEveryDepth(scriptUnits),
    "screenplays cover every treatment directly at every depth": () =>
      directTreatmentCoverage(screenplayUnits) &&
      coveredAtEveryDepth(screenplayUnits),
    "one treatment event spans multiple script units": () =>
      [...splitCounts.values()].some((count) => count > 1),
  };
};

/** Preserve the primary failure if removal of its disposable project fails too. */
const preserveFixtureCleanup = (
  failure: FixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new CompletedFilmAuthoredPopulationCleanupError(
      [failure.error, cleanupFailure],
      "Completed-film authored-population cleanup failed after the test failed.",
    );
  }
};

/**
 * Compile and lint the completed-film fixture's authored Markdown populations
 * with the exact claim objects returned by the current reusable graph.
 *
 * Discovery and source populations are deliberately outside this focused
 * regression: the repository fixture predates the current flat contract ledger
 * and source-directory topology. The explicit 15-name inventory prevents that
 * isolation from becoming a silent hand-built graph or a claim filter that can
 * drop a file-parent, foundation, lineage, principle, or obligation claim.
 *
 * Scenarios:
 *
 * 1. The exact 15 current authored claim objects lint the pinned 49 H2, 4 H3,
 *    and 8 H4 hosts while every file preamble remains free of principle
 *    declarations and review companions.
 * 2. Removing one real `machine-default` principle answer from a settings H2
 *    makes the same graph fail and name the missing principle target.
 */
export const test_evidence_completed_film_authored_population = (): void => {
  const root = path.resolve(__dirname, "../../../..");
  const completedFilm = path.join(root, "test/fixtures/completed-film");
  const fixture = path.join(completedFilm, "docs");
  const cache = path.join(root, "test/node_modules/.cache");
  fs.mkdirSync(cache, { recursive: true });
  const temporary = fs.mkdtempSync(
    path.join(cache, "automovie-completed-film-authored-population-"),
  );
  const safeCache = `${path.resolve(cache)}${path.sep}`;
  if (!`${path.resolve(temporary)}${path.sep}`.startsWith(safeCache))
    throw new Error(
      `Refusing an authored-population test root outside ${cache}.`,
    );

  let fixtureFailure: FixtureFailure | undefined;
  try {
    fs.cpSync(fixture, path.join(temporary, "docs"), { recursive: true });
    fs.mkdirSync(path.join(temporary, "docs/contracts"), { recursive: true });
    fs.writeFileSync(
      path.join(temporary, "docs/contracts/index.md"),
      [
        "<!--",
        "@evidenceExclude discovery/core/common.md#shared-local-boundary This focused authored-population regression does not claim a completed work-specific discovery audit.",
        "-->",
        "",
        "# Focused authored-population test boundary",
        "",
      ].join("\n"),
      "utf8",
    );

    TestValidator.equals(
      "the focused regression names every authored claim",
      namedFacts([["15 names", () => AUTHORED_CLAIM_NAMES.length === 15]]),
      {
        "15 names": true,
      },
    );
    TestValidator.equals(
      "the completed fixture authored host population is pinned",
      headingCounts(fixture),
      { h2: 49, h3: 4, h4: 8 },
    );
    TestValidator.equals(
      "the completed fixture uses the canonical narrative ladder",
      namedFacts(Object.entries(canonicalNarrativeTopology(fixture))),
      {
        "treatments are flat H2-only event files": true,
        "scripts use the grouped delivery partition": true,
        "screenplays mirror script files and identities exactly": true,
        "scripts cover every treatment directly at every depth": true,
        "screenplays cover every treatment directly at every depth": true,
        "one treatment event spans multiple script units": true,
      },
    );
    TestValidator.equals(
      "the completed fixture carries no active legacy narrative path",
      {
        reference: legacyPath(completedFilm),
        scenarioDirectory: fs.existsSync(path.join(fixture, "scenarios")),
        scriptDirectory: fs.existsSync(path.join(fixture, "script")),
        storylineDirectory: fs.existsSync(path.join(fixture, "storylines")),
      },
      {
        reference: null,
        scenarioDirectory: false,
        scriptDirectory: false,
        storylineDirectory: false,
      },
    );
    TestValidator.equals(
      "file preambles carry no principle declaration or review companion",
      principleInPreamble(fixture),
      null,
    );

    const state = JSON.stringify(activeState(temporary), null, 2);
    const names = JSON.stringify(AUTHORED_CLAIM_NAMES, null, 2);
    fs.writeFileSync(
      path.join(temporary, "lint.config.ts"),
      [
        'import { createAutoMovieEvidenceConfig, evidence } from "@automovie/evidence";',
        'import type { ITtscLintConfig } from "@ttsc/lint";',
        "",
        `const names = ${names} as const;`,
        `const full = createAutoMovieEvidenceConfig(${state});`,
        "const claims = names.map((name) => {",
        "  const matches = full.claims.filter((claim) => claim.name === name);",
        "  if (matches.length !== 1)",
        '    throw new Error("Expected one current authored claim named " + name + "; received " + matches.length + ".");',
        "  return matches[0]!;",
        "});",
        "const graph = { claims };",
        "",
        "export default {",
        "  plugins: { evidence },",
        '  rules: { "evidence/graph": ["error", graph] },',
        "} satisfies ITtscLintConfig;",
        "",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(temporary, "index.ts"),
      "export const completedFilmAuthoredPopulationCanary = true;\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(temporary, "package.json"),
      `${JSON.stringify(
        {
          private: true,
          type: "module",
          devDependencies: {
            "@automovie/evidence": "*",
            "@ttsc/lint": "*",
            "@types/node": "*",
            ttsc: "*",
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(temporary, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "esnext",
            module: "esnext",
            moduleResolution: "bundler",
            skipLibCheck: true,
            strict: true,
            types: ["node"],
          },
          include: ["index.ts", "lint.config.ts"],
        },
        null,
        2,
      ),
      "utf8",
    );

    const compile = (): ReturnType<typeof spawnSync> =>
      spawnSync(
        process.execPath,
        [
          path.join(root, "node_modules/ttsc/lib/launcher/ttsc.js"),
          "--noEmit",
          "-p",
          "tsconfig.json",
        ],
        {
          cwd: temporary,
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
        },
      );
    const result = compile();
    if (result.error !== undefined) throw result.error;
    if (result.status !== 0 || result.signal !== null)
      throw new Error(
        [
          `Completed-film authored-population lint exited ${result.status ?? `by ${result.signal}`}.`,
          result.stdout,
          result.stderr,
        ].join("\n"),
      );

    const delivery = path.join(temporary, "docs/settings/000-governing-aim.md");
    const negativeSource = fs
      .readFileSync(delivery, "utf8")
      .replace(
        /^@evidence principles\/core\/common\.md#machine-default .+\n@evidenceReview principles\/core\/common\.md#machine-default .+\n/mu,
        "",
      );
    fs.writeFileSync(delivery, negativeSource, "utf8");
    const negative = compile();
    if (negative.error !== undefined) throw negative.error;
    const negativeOutput = `${negative.stdout}\n${negative.stderr}`
      .replaceAll("\r\n", "\n")
      .replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, "");
    TestValidator.equals(
      "the real graph emits exactly one diagnostic for a missing unit principle",
      namedFacts([
        ["failed", () => negative.status !== 0 || negative.signal !== null],
        [
          "named target",
          () =>
            negativeOutput.includes(
              "principles/core/common.md#machine-default",
            ),
        ],
        [
          "one evidence diagnostic",
          () =>
            [...negativeOutput.matchAll(/\[evidence\/graph\]/gu)].length === 1,
        ],
        [
          "one TypeScript error",
          () => [...negativeOutput.matchAll(/error TS\d+:/gu)].length === 1,
        ],
      ]),
      {
        failed: true,
        "named target": true,
        "one evidence diagnostic": true,
        "one TypeScript error": true,
      },
    );
  } catch (error) {
    fixtureFailure = { error };
    throw error;
  } finally {
    preserveFixtureCleanup(fixtureFailure, () => {
      if (!`${path.resolve(temporary)}${path.sep}`.startsWith(safeCache))
        throw new Error(
          `Refusing to remove an authored-population test root outside ${cache}.`,
        );
      fs.rmSync(temporary, { recursive: true, force: true });
    });
  }
};
