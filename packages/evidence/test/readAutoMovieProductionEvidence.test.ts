import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  type IAutoMovieEvidenceConfigProps,
  readAutoMovieProductionEvidence,
} from "../src";

const roots: string[] = [];
const templateRoot = path.resolve(import.meta.dirname, "..", "..", "template");

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
 * 3. A declaration rooted at another project and a manifest without a package
 *    name fail before either can become a router or review denominator.
 */
try {
  const project = createProject("reader-library");
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
  write(project, "src/models/z.ts", "export class Z {}\n");
  write(project, "src/models/nested/a.ts", "export class A {}\n");
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
    modelSources: "draft",
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
        sourceStage: "draft",
        sourcePaths: ["src/models/nested/a.ts", "src/models/z.ts"],
      },
    ],
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
        sourceEnforced: false,
      },
      {
        branch: "models",
        path: "docs/models/zeta.md",
        title: "Zeta model",
        units: [["zeta-form", "Form"]],
        sourceFiles: ["src/models/**/*.ts"],
        sourceSymbols: ["function", "property", "type"],
        sourceEnforced: false,
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
  const linkedSourceParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "reader-linked-source-"),
  );
  roots.push(linkedSourceParent);
  const linkedSourceTarget = path.join(linkedSourceParent, "models");
  fs.renameSync(path.join(project, "src", "models"), linkedSourceTarget);
  fs.symlinkSync(
    linkedSourceTarget,
    path.join(project, "src", "models"),
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.throws(
    () =>
      readAutoMovieProductionEvidence({
        root: project,
        productionEvidence: configuration,
      }),
    /project evidence populations contain only real files and directories inside the project root/u,
  );
  fs.rmSync(path.join(project, "src", "models"));
  fs.renameSync(linkedSourceTarget, path.join(project, "src", "models"));
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
    fs
      .readFileSync(alpha, "utf8")
      .replace("The exact joint.", "The exact revised joint."),
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

/** Create the package-shaped shared contract dependency used by the graph. */
function createProject(name: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  roots.push(root);
  const linked = path.join(root, "node_modules", "@automovie", "template");
  fs.mkdirSync(path.dirname(linked), { recursive: true });
  fs.cpSync(path.join(templateRoot, "docs"), path.join(linked, "docs"), {
    recursive: true,
  });
  write(
    root,
    "node_modules/@automovie/template/package.json",
    JSON.stringify({ name: "@automovie/template", version: "0.0.0" }),
  );
  write(
    root,
    "docs/contracts/index.md",
    "<!-- @evidenceExclude discovery/core/common.md#shared-local-boundary This reader fixture retains no other production-specific rule. -->\n\n# Work-specific contract audit\n",
  );
  return root;
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
