import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

type Stage = "disabled" | "draft" | "evidence" | "review";

interface EvidenceState {
  location: string;
  kind: "film";
  settings: Stage;
  research: Stage;
  models: Stage;
  spaces: Stage;
  materials: Stage;
  instances: Stage;
  motions: Stage;
  systems: Stage;
  storylines: Stage;
  scenarios: Stage;
  script: Stage;
  briefs: Stage;
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

const AUTHORED_CLAIM_NAMES = [
  "settings H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "models files account for inherited settings, designs, and parent files",
  "models H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "motions files account for inherited settings, designs, and parent files",
  "motions H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "storylines files account for inherited settings, designs, and parent files",
  "storylines H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "storylines H3 units answer their principle checklists and account for inherited work",
  "storylines H4 units answer their principle checklists and account for inherited work",
  "scenarios files account for inherited settings, designs, and parent files",
  "scenarios H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "scenarios H3 units answer their principle checklists and account for inherited work",
  "scenarios H4 units answer their principle checklists and account for inherited work",
  "script files account for inherited settings, designs, and parent files",
  "script H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "script H3 units answer their principle checklists and account for inherited work",
  "script H4 units answer their principle checklists and account for inherited work",
] as const;

const activeState = (location: string): EvidenceState => ({
  location,
  kind: "film",
  settings: "review",
  research: "disabled",
  models: "review",
  spaces: "disabled",
  materials: "disabled",
  instances: "disabled",
  motions: "review",
  systems: "disabled",
  storylines: "review",
  scenarios: "review",
  script: "review",
  briefs: "disabled",
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
    for (const match of source.matchAll(/^(#{2,4})[ \t]+.+\{#[^}]+\}[ \t]*$/gmu)) {
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
    if (h1 !== -1 && /@evidence(?:Exclude)?\s+principles\//u.test(source.slice(0, h1)))
      return file;
  }
  return null;
};

/**
 * Compile and lint the completed-film fixture's authored Markdown populations
 * with the exact claim objects returned by the current reusable graph.
 *
 * Discovery and source populations are deliberately outside this focused
 * regression: the repository fixture predates the current flat contract ledger
 * and source-directory topology. The explicit 17-name inventory prevents that
 * isolation from becoming a silent hand-built graph or a claim filter that can
 * drop a file-parent, foundation, lineage, principle, or obligation claim.
 */
export const test_evidence_completed_film_authored_population = (): void => {
  const root = path.resolve(__dirname, "../../../..");
  const fixture = path.join(root, "test/fixtures/completed-film/docs");
  const cache = path.join(root, "test/node_modules/.cache");
  fs.mkdirSync(cache, { recursive: true });
  const temporary = fs.mkdtempSync(
    path.join(cache, "automovie-completed-film-authored-population-"),
  );
  const safeCache = `${path.resolve(cache)}${path.sep}`;
  if (!`${path.resolve(temporary)}${path.sep}`.startsWith(safeCache))
    throw new Error(`Refusing an authored-population test root outside ${cache}.`);

  try {
    fs.cpSync(fixture, path.join(temporary, "docs"), { recursive: true });
    fs.mkdirSync(path.join(temporary, "docs/contracts"), { recursive: true });
    fs.writeFileSync(
      path.join(temporary, "docs/contracts/index.md"),
      [
        "<!--",
        "@evidenceExclude discovery/common.md#shared-local-boundary This focused authored-population regression does not claim a completed work-specific discovery audit.",
        "-->",
        "",
        "# Focused authored-population test boundary",
        "",
      ].join("\n"),
      "utf8",
    );

    TestValidator.equals(
      "the focused regression names every authored claim",
      namedFacts([
        ["17 names", () => AUTHORED_CLAIM_NAMES.length === 17],
      ]),
      {
        "17 names": true,
      },
    );
    TestValidator.equals(
      "the completed fixture authored host population is pinned",
      headingCounts(fixture),
      { h2: 49, h3: 6, h4: 12 },
    );
    TestValidator.equals(
      "file preambles carry no principle checklist",
      principleInPreamble(fixture),
      null,
    );

    const state = JSON.stringify(activeState(temporary), null, 2);
    const names = JSON.stringify(AUTHORED_CLAIM_NAMES, null, 2);
    const evidenceImport = path
      .relative(temporary, path.join(root, "packages/evidence/src"))
      .replaceAll("\\", "/");
    fs.writeFileSync(
      path.join(temporary, "lint.config.ts"),
      [
        `import { createAutoMovieEvidenceConfig, evidence } from "${evidenceImport}";`,
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

    const delivery = path.join(
      temporary,
      "docs/settings/000-governing-aim.md",
    );
    const negativeSource = fs.readFileSync(delivery, "utf8").replace(
      /^@evidence principles\/common\.md#machine-default .+\n@evidenceReview principles\/common\.md#machine-default .+\n/mu,
      "",
    );
    fs.writeFileSync(delivery, negativeSource, "utf8");
    const negative = compile();
    if (negative.error !== undefined) throw negative.error;
    TestValidator.equals(
      "the real graph rejects a missing unit principle",
      namedFacts([
        [
          "failed",
          () => negative.status !== 0 || negative.signal !== null,
        ],
        [
          "named target",
          () =>
            `${negative.stdout}${negative.stderr}`.includes(
              "principles/common.md#machine-default",
            ),
        ],
      ]),
      { failed: true, "named target": true },
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
};
