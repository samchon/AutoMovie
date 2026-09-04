import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  type IAutoMovieEvidenceConfigProps,
  readAutoMovieProductionEvidence,
} from "../src";
import { createEvidenceProjectFixture } from "./EvidenceProjectFixture";

const roots: string[] = [];

/**
 * The production-evidence reader exposes one exact router/review denominator.
 *
 * Scenarios:
 *
 * 1. A reviewed model library returns its canonical manifest, package identity,
 *    active design branch, exact H1/H2 owners, H2 digests, source lineage, and
 *    flat local contracts in deterministic code-unit order.
 * 2. Comments and fenced examples cannot manufacture owner headings, while a
 *    change inside one H2 changes only that unit's digest.
 * 3. A direct brief exposes its graph-selected shot export and exact H3 owner.
 * 4. A declaration rooted at another project and a manifest without a package
 *    name fail before either can become a router or review denominator.
 */
try {
  const project = createProject();
  write(
    project,
    "package.json",
    JSON.stringify({
      name: "reader-library",
      description: "  An exact model library.  ",
    }),
  );
  write(
    project,
    "docs/settings/production.md",
    "# Production settings\n\n## Delivery {#delivery}\n\nOne model library.\n",
  );
  write(
    project,
    "docs/models/zeta.md",
    "# Zeta model\n\n## Form {#zeta-form}\n\nA late owner.\n",
  );
  const alpha = path.join(project, "docs", "models", "alpha.md");
  write(
    project,
    "docs/models/alpha.md",
    [
      "# Alpha model",
      "",
      "<!--",
      "## Commented impostor {#commented}",
      "-->",
      "",
      "```md",
      "## Fenced impostor {#fenced}",
      "```",
      "",
      "## Shell {#shell}",
      "",
      "The exact shell.",
      "",
      "The shell detail.",
      "",
      "## Joint {#joint}",
      "",
      "The exact joint.",
      "",
    ].join("\n"),
  );
  write(
    project,
    "src/models/z.ts",
    `\ufeff${"/**\n * @evidence models/zeta.md#zeta-form Realizes the reviewed zeta form.\n * @evidenceReview models/zeta.md#zeta-form #9782bb7 Read the form and checked this export.\n */\nclass Z {}\nexport { Z as Zeta };\n".replaceAll("\n", "\r\n")}`,
  );
  write(
    project,
    "src/models/nested/a.ts",
    [
      "/**",
      " * @evidence models/alpha.md#shell Realizes the reviewed shell.",
      " * @evidence models/alpha.md#joint Realizes the reviewed joint.",
      " */",
      "export class A {}",
      "",
    ].join("\n"),
  );
  write(
    project,
    "docs/contracts/visual.md",
    [
      "<!-- @evidence discovery/core/common.md#shared-local-boundary The production audit retained this exact local visual rule. -->",
      "# Local visual contract",
      "",
      "This target governs the exact model profile selected by this production.",
      "",
      "## Profile {#profile}",
      "",
      "Every model keeps its reviewed profile.",
      "",
      "Review question: does the selected model preserve its reviewed profile?",
      "",
      "Sources: production decision recorded by this project.",
      "",
    ].join("\n"),
  );

  const configuration: IAutoMovieEvidenceConfigProps = {
    ...disabled(project),
    kind: "library",
    settings: "review",
    models: "review",
    modelSources: "evidence",
    claims: [
      {
        name: "models answer the local visual contract",
        type: "markdown",
        root: "docs",
        files: ["models/**/*.md"],
        symbol: "h2",
        disabled: false,
        reference: {
          type: "markdown",
          root: "docs",
          files: ["contracts/visual.md"],
          symbol: "h2",
          checklist: true,
          noEvidenceExclude: true,
          requireReview: true,
        },
      },
    ],
  };
  const first = readAutoMovieProductionEvidence({
    root: project,
    productionEvidence: configuration,
  });
  assert.equal(first.root, path.resolve(project));
  assert.equal(first.packageName, "reader-library");
  assert.equal(first.description, "An exact model library.");
  assert.equal(first.configuration, configuration);
  assert.equal(first.manifest.kind, "library");
  assert.deepEqual(
    first.designBranches.map((branch) => ({
      branch: branch.branch,
      designStage: branch.designStage,
      sourceBranch: branch.sourceBinding?.branch,
      sourceStage: branch.sourceBinding?.stage,
      sourcePaths: branch.sourceBinding?.paths,
    })),
    [
      {
        branch: "models",
        designStage: "review",
        sourceBranch: "modelSources",
        sourceStage: "evidence",
        sourcePaths: ["src/models/nested/a.ts", "src/models/z.ts"],
      },
    ],
  );
  assert.equal(
    first.sourceOwners.find((owner) => owner.exportName === "Zeta")
      ?.sourceDigest,
    `sha256:${crypto
      .createHash("sha256")
      .update(
        fs
          .readFileSync(path.join(project, "src/models/z.ts"), "utf8")
          .replace(/^\ufeff/u, "")
          .replace(/\r\n?/gu, "\n"),
      )
      .digest("hex")}`,
  );
  assert.deepEqual(
    first.designOwners.map((owner) => ({
      branch: owner.branch,
      path: owner.path,
      title: owner.title,
      units: owner.units.map((unit) => [unit.anchor, unit.title]),
      sourceFiles: owner.sourceBinding?.files,
      sourceSymbols: owner.sourceBinding?.symbols,
      sourceEnforced: owner.sourceBinding?.enforced,
    })),
    [
      {
        branch: "models",
        path: "docs/models/alpha.md",
        title: "Alpha model",
        units: [
          ["shell", "Shell"],
          ["joint", "Joint"],
        ],
        sourceFiles: ["src/models/**/*.ts"],
        sourceSymbols: ["function", "property", "type"],
        sourceEnforced: true,
      },
      {
        branch: "models",
        path: "docs/models/zeta.md",
        title: "Zeta model",
        units: [["zeta-form", "Form"]],
        sourceFiles: ["src/models/**/*.ts"],
        sourceSymbols: ["function", "property", "type"],
        sourceEnforced: true,
      },
    ],
  );
  assert.deepEqual(
    first.sourceOwners.map((owner) => ({
      branch: owner.branch,
      sourcePath: owner.sourcePath,
      exportName: owner.exportName,
      symbolKind: owner.symbolKind,
      target: `${owner.targetPath}#${owner.targetAnchor}`,
      stage: owner.stage,
      enforced: owner.enforced,
      reviewed: owner.reviewed,
      digested: /^sha256:[a-f0-9]{64}$/u.test(owner.sourceDigest),
    })),
    [
      {
        branch: "modelSources",
        sourcePath: "src/models/nested/a.ts",
        exportName: "A",
        symbolKind: "type",
        target: "docs/models/alpha.md#joint",
        stage: "evidence",
        enforced: true,
        reviewed: false,
        digested: true,
      },
      {
        branch: "modelSources",
        sourcePath: "src/models/nested/a.ts",
        exportName: "A",
        symbolKind: "type",
        target: "docs/models/alpha.md#shell",
        stage: "evidence",
        enforced: true,
        reviewed: false,
        digested: true,
      },
      {
        branch: "modelSources",
        sourcePath: "src/models/z.ts",
        exportName: "Zeta",
        symbolKind: "type",
        target: "docs/models/zeta.md#zeta-form",
        stage: "evidence",
        enforced: true,
        reviewed: false,
        digested: true,
      },
    ],
  );
  assert.deepEqual(
    first.contracts.map((contract) => ({
      path: contract.path,
      title: contract.title,
      items: contract.items.map((item) => [item.anchor, item.title]),
    })),
    [
      {
        path: "docs/contracts/index.md",
        title: "Work-specific contract audit",
        items: [],
      },
      {
        path: "docs/contracts/visual.md",
        title: "Local visual contract",
        items: [["profile", "Profile"]],
      },
    ],
  );
  assert.deepEqual(
    readAutoMovieProductionEvidence({
      root: project,
      productionEvidence: configuration,
    }),
    first,
  );
  const reviewed = readAutoMovieProductionEvidence({
    root: project,
    productionEvidence: { ...configuration, modelSources: "review" },
  });
  assert.equal(
    reviewed.sourceOwners.find((owner) => owner.exportName === "Zeta")
      ?.reviewed,
    true,
  );
  assert.equal(
    reviewed.sourceOwners.find((owner) => owner.exportName === "A")?.reviewed,
    false,
  );

  const brief = createProject();
  write(
    brief,
    "package.json",
    JSON.stringify({ name: "reader-brief", description: "One brief." }),
  );
  write(
    brief,
    "docs/settings/production.md",
    "# Production settings\n\n## Delivery {#delivery}\n\nOne direct brief.\n",
  );
  write(
    brief,
    "docs/briefs/delivery.md",
    "# Delivery\n\n## Sequence {#sequence}\n\n### Opening {#opening}\n\nOne opening shot.\n",
  );
  write(
    brief,
    "src/shots/delivery.ts",
    "/** @evidence briefs/delivery.md#opening Realizes the exact opening. */\nexport const opening = (): void => undefined;\n",
  );
  const briefEvidence = readAutoMovieProductionEvidence({
    root: brief,
    productionEvidence: {
      ...disabled(brief),
      kind: "brief",
      settings: "review",
      briefs: "review",
      shots: "evidence",
    },
  });
  assert.deepEqual(
    briefEvidence.sourceOwners.map((owner) => ({
      branch: owner.branch,
      sourcePath: owner.sourcePath,
      exportName: owner.exportName,
      target: `${owner.targetPath}#${owner.targetAnchor}`,
    })),
    [
      {
        branch: "shots",
        sourcePath: "src/shots/delivery.ts",
        exportName: "opening",
        target: "docs/briefs/delivery.md#opening",
      },
    ],
  );

  const modelSources = path.join(project, "src", "models");
  const inactiveSources = path.join(project, "inactive-models");
  fs.renameSync(modelSources, inactiveSources);
  const withoutSource = readAutoMovieProductionEvidence({
    root: project,
    productionEvidence: { ...configuration, modelSources: "disabled" },
  });
  fs.renameSync(inactiveSources, modelSources);
  assert.equal(withoutSource.designBranches[0]!.sourceBinding, null);
  assert.equal(withoutSource.designOwners[0]!.sourceBinding, null);

  const before = new Map(
    first.designOwners[0]!.units.map((unit) => [unit.anchor, unit.digest]),
  );
  fs.writeFileSync(
    alpha,
    rewrite(
      fs.readFileSync(alpha, "utf8"),
      "The exact joint.",
      "The exact revised joint.",
    ),
  );
  const revised = readAutoMovieProductionEvidence({
    root: project,
    productionEvidence: configuration,
  });
  const after = new Map(
    revised.designOwners[0]!.units.map((unit) => [unit.anchor, unit.digest]),
  );
  assert.equal(after.get("shell"), before.get("shell"));
  assert.notEqual(after.get("joint"), before.get("joint"));

  assert.throws(
    () =>
      readAutoMovieProductionEvidence({
        root: path.join(project, "other"),
        productionEvidence: configuration,
      }),
    /belongs to another project root/u,
  );
  write(project, "package.json", JSON.stringify({ name: "reader-library" }));
  assert.equal(
    readAutoMovieProductionEvidence({
      root: project,
      productionEvidence: configuration,
    }).description,
    "",
  );
  write(project, "package.json", JSON.stringify({ description: 1 }));
  assert.throws(
    () =>
      readAutoMovieProductionEvidence({
        root: project,
        productionEvidence: configuration,
      }),
    /declares no package name/u,
  );

  process.stdout.write("production evidence reader passed\n");
} finally {
  for (const root of roots) fs.rmSync(root, { force: true, recursive: true });
}

/** Create a generated project with a synthetic local contract inventory. */
function createProject(): string {
  return createEvidenceProjectFixture(roots);
}

/** Refuse to silently weaken a mutation-based arrangement. */
function rewrite(
  source: string,
  search: string | RegExp,
  replacement: string,
): string {
  const rewritten = source.replace(search, replacement);
  assert.notEqual(rewritten, source, "the fixture mutation anchor must exist");
  return rewritten;
}

/** Write one project-relative UTF-8 fixture file. */
function write(root: string, relative: string, content: string): void {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

/** The complete disabled declaration every focused reader fixture starts from. */
function disabled(location: string): IAutoMovieEvidenceConfigProps {
  return {
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
  };
}
