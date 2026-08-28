import type { IAutoMovieEvidenceConfigProps } from "@automovie/evidence";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { productionEvidence } from "../scaffold/productionEvidence";
import { bindProductionBook } from "../scaffold/scripts/book";
import { synchronizeProductionInstructions } from "../scaffold/scripts/sync";
import { renderScaffold } from "../src/renderScaffold";
import { writeAutoMovieProductionInstructions } from "../src/writeAutoMovieProductionInstructions";
import { writeFiles } from "../src/writeFiles";

const roots: string[] = [];
const packageRoot = path.resolve(import.meta.dirname, "..");
const scaffoldRoot = path.join(packageRoot, "scaffold");

/**
 * Generated instruction synchronization and reader editions consume production
 * source without becoming a second authority.
 *
 * Scenarios:
 *
 * 1. Sync replaces stale generated instructions from the installed template,
 *    renders the exact library owner route, and leaves tracked facts unchanged.
 * 2. Repeating sync is byte-identical, while a scaffold source and an installed
 *    template without production skills are refused before mutation.
 * 3. Book binding defaults to screenplays, accepts a non-film map layer and an
 *    explicit output, and leaves every authored document byte unchanged.
 * 4. Unknown, duplicate, valueless, missing-title, and invalid-layer options
 *    fail without creating a reader edition.
 */
void main();

async function main(): Promise<void> {
  try {
    const generated = makeRoot("generated-sync-consumer");
    writeFiles(generated, renderScaffold({ name: "generated-sync-consumer" }));
    const installedTemplate = path.join(
      generated,
      "node_modules",
      "@automovie",
      "template",
    );
    fs.mkdirSync(path.dirname(installedTemplate), { recursive: true });
    write(
      generated,
      "node_modules/@automovie/template/package.json",
      JSON.stringify({
        name: "@automovie/template",
        type: "module",
        exports: {
          ".": "./index.ts",
          "./package.json": "./package.json",
        },
      }),
    );
    write(
      generated,
      "node_modules/@automovie/template/index.ts",
      `export { writeAutoMovieProductionInstructions } from ${JSON.stringify(
        pathToFileURL(
          path.join(
            packageRoot,
            "src",
            "writeAutoMovieProductionInstructions.ts",
          ),
        ).href,
      )};\n`,
    );
    fs.cpSync(
      path.join(packageRoot, "docs"),
      path.join(installedTemplate, "docs"),
      { recursive: true },
    );
    write(generated, "AGENTS.md", "stale generated router\n");
    write(generated, "CLAUDE.md", "stale generated import\n");
    write(generated, ".agents/skills/stale.md", "stale generated skill\n");
    const generatedTrackedBefore = snapshot(generated, [
      "package.json",
      "productionEvidence.ts",
      "docs",
      "src",
    ]);
    const generatedSync = (await import(
      `${pathToFileURL(path.join(generated, "scripts", "sync.ts")).href}?generated-consumer`
    )) as {
      synchronizeProductionInstructions: (props: {
        root: string;
        scaffoldRoot: string;
      }) => string[];
    };
    assert.equal(
      generatedSync.synchronizeProductionInstructions({
        root: generated,
        scaffoldRoot,
      }).length,
      3,
    );
    assert.match(
      fs.readFileSync(path.join(generated, "AGENTS.md"), "utf8"),
      /No production kind is selected/u,
    );
    assert.equal(
      fs.readFileSync(path.join(generated, "CLAUDE.md"), "utf8"),
      "@AGENTS.md\n",
    );
    assert.equal(
      fs.existsSync(path.join(generated, ".agents", "skills", "stale.md")),
      false,
    );
    assert.deepEqual(
      snapshot(generated, [
        "package.json",
        "productionEvidence.ts",
        "docs",
        "src",
      ]),
      generatedTrackedBefore,
    );

    const project = createProduction("instruction-library");
    assert.equal(productionEvidence.location, scaffoldRoot);
    assert.deepEqual(productionEvidence.populationScope, {
      mode: "complete-production",
    });
    assert.throws(
      () => synchronizeProductionInstructions({ root: scaffoldRoot }),
      /cannot synchronize instructions into itself/u,
    );
    const scaffoldSkill = path.join(
      scaffoldRoot,
      ".agents",
      "skills",
      "production",
      "SKILL.md",
    );
    const scaffoldSkillBefore = fs.readFileSync(scaffoldSkill, "utf8");
    const aliasParent = makeRoot("scaffold-alias");
    const scaffoldAlias = path.join(aliasParent, "scaffold");
    fs.symlinkSync(
      scaffoldRoot,
      scaffoldAlias,
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.throws(
      () =>
        writeAutoMovieProductionInstructions({
          root: scaffoldAlias,
          productionEvidence,
          scaffoldRoot,
        }),
      /cannot synchronize instructions into itself/u,
    );
    assert.equal(fs.readFileSync(scaffoldSkill, "utf8"), scaffoldSkillBefore);
    const linkedManaged = makeRoot("linked-managed-instructions");
    fs.mkdirSync(path.join(linkedManaged, ".agents"), { recursive: true });
    const linkedSkills = path.join(linkedManaged, ".agents", "skills");
    fs.symlinkSync(
      path.join(scaffoldRoot, ".agents", "skills"),
      linkedSkills,
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.throws(
      () =>
        writeAutoMovieProductionInstructions({
          root: linkedManaged,
          productionEvidence: disabled(linkedManaged),
          scaffoldRoot,
        }),
      /generated instruction paths may not be links/u,
    );
    assert.equal(fs.readFileSync(scaffoldSkill, "utf8"), scaffoldSkillBefore);
    fs.rmSync(linkedSkills);
    const linkedAgentTarget = path.join(
      linkedManaged,
      "tracked-agent-target.md",
    );
    write(linkedManaged, "tracked-agent-target.md", "tracked bytes\n");
    try {
      fs.symlinkSync(linkedAgentTarget, path.join(linkedManaged, "AGENTS.md"));
      assert.throws(
        () =>
          writeAutoMovieProductionInstructions({
            root: linkedManaged,
            productionEvidence: disabled(linkedManaged),
            scaffoldRoot,
          }),
        /generated instruction paths may not be links/u,
      );
      assert.equal(
        fs.readFileSync(linkedAgentTarget, "utf8"),
        "tracked bytes\n",
      );
    } catch (error) {
      if (
        !(
          error instanceof Error &&
          "code" in error &&
          ["EPERM", "EACCES"].includes(String(error.code))
        )
      )
        throw error;
    }
    assert.throws(
      () => synchronizeProductionInstructions(),
      /belongs to another project root/u,
    );
    write(
      project,
      "package.json",
      JSON.stringify({
        name: "instruction-library",
        description: "A routed object library.",
      }),
    );
    write(
      project,
      "docs/settings/production.md",
      "# Production settings\n\n## Delivery {#delivery}\n\nOne library.\n",
    );
    write(
      project,
      "docs/models/chair.md",
      "# Chair\n\n## Frame {#frame}\n\nOne exact frame.\n",
    );
    write(
      project,
      "docs/contracts/profile.md",
      [
        "<!-- @evidence discovery/core/common.md#shared-local-boundary This production retained one exact chair-profile rule. -->",
        "# Chair profile contract",
        "",
        "This target governs the exact chair profile selected by this production.",
        "",
        "## Profile {#profile}",
        "",
        "The chair keeps its reviewed profile.",
        "",
        "Review question: does the chair preserve its reviewed profile?",
        "",
        "Sources: production decision recorded by this project.",
        "",
      ].join("\n"),
    );
    write(project, "src/models/chair.ts", "export class Chair {}\n");
    write(project, ".agents/skills/stale.md", "stale\n");
    write(project, "AGENTS.md", "stale router\n");
    write(project, "CLAUDE.md", "stale import\n");

    const configuration: IAutoMovieEvidenceConfigProps = {
      ...disabled(project),
      kind: "library",
      settings: "review",
      models: "review",
      modelSources: "review",
      claims: [
        {
          name: "models answer the chair profile contract",
          type: "markdown",
          root: "docs",
          files: ["models/**/*.md"],
          symbol: "h2",
          disabled: false,
          reference: {
            type: "markdown",
            root: "docs",
            files: ["contracts/profile.md"],
            symbol: "h2",
            checklist: true,
            noEvidenceExclude: true,
            requireReview: true,
          },
        },
      ],
    };
    const trackedBefore = snapshot(project, ["docs", "src", "package.json"]);
    const written = writeAutoMovieProductionInstructions({
      root: project,
      productionEvidence: configuration,
      scaffoldRoot,
    });
    assert.deepEqual(written, [
      path.join(project, ".agents", "skills"),
      path.join(project, "AGENTS.md"),
      path.join(project, "CLAUDE.md"),
    ]);
    assert.equal(
      fs.readFileSync(path.join(project, "CLAUDE.md"), "utf8"),
      "@AGENTS.md\n",
    );
    const router = fs.readFileSync(path.join(project, "AGENTS.md"), "utf8");
    assert.match(router, /This is a library/u);
    assert.match(router, /`models` \[Chair\]\(docs\/models\/chair\.md\)/u);
    assert.match(
      router,
      /\[Profile\]\(docs\/contracts\/profile\.md#profile\)/u,
    );
    assert.doesNotMatch(router, /settings -> treatments/u);
    assert.equal(
      fs.existsSync(path.join(project, ".agents", "skills", "stale.md")),
      false,
    );
    assert.equal(
      fs.readFileSync(
        path.join(project, ".agents", "skills", "production", "SKILL.md"),
        "utf8",
      ),
      fs.readFileSync(
        path.join(scaffoldRoot, ".agents", "skills", "production", "SKILL.md"),
        "utf8",
      ),
    );
    assert.match(
      fs.readFileSync(
        path.join(project, ".agents", "skills", "production", "SKILL.md"),
        "utf8",
      ),
      /routes maps, models, spaces, materials, instances, motions, and systems/u,
    );
    assert.deepEqual(
      snapshot(project, ["docs", "src", "package.json"]),
      trackedBefore,
    );

    const generatedBefore = snapshot(project, [
      ".agents",
      "AGENTS.md",
      "CLAUDE.md",
    ]);
    writeAutoMovieProductionInstructions({
      root: project,
      productionEvidence: configuration,
      scaffoldRoot,
    });
    assert.deepEqual(
      snapshot(project, [".agents", "AGENTS.md", "CLAUDE.md"]),
      generatedBefore,
    );

    assert.throws(
      () =>
        writeAutoMovieProductionInstructions({
          root: scaffoldRoot,
          productionEvidence: { ...configuration, location: scaffoldRoot },
          scaffoldRoot,
        }),
      /cannot synchronize instructions into itself/u,
    );
    const incompleteTemplate = makeRoot("missing-production-skill");
    fs.mkdirSync(path.join(incompleteTemplate, ".agents", "skills"), {
      recursive: true,
    });
    assert.throws(
      () =>
        writeAutoMovieProductionInstructions({
          root: project,
          productionEvidence: configuration,
          scaffoldRoot: path.join(incompleteTemplate, "missing"),
        }),
      /installed production skills are missing/u,
    );
    const invalidTemplate = makeRoot("invalid-production-skill");
    write(invalidTemplate, ".agents/skills", "not a directory\n");
    assert.throws(
      () =>
        writeAutoMovieProductionInstructions({
          root: project,
          productionEvidence: configuration,
          scaffoldRoot: invalidTemplate,
        }),
      /installed production skills are missing/u,
    );

    const books = makeRoot("book-command");
    write(
      books,
      "docs/screenplays/001-event/001-beat.md",
      "# First beat\n\n## Action {#action}\n\nIt begins.\n",
    );
    write(
      books,
      "docs/maps/001-site.md",
      "# Site plan\n\n## Extent {#extent}\n\nA bounded site.\n",
    );
    const docsBefore = snapshot(books, ["docs"]);
    const originalCwd = process.cwd();
    process.chdir(books);
    let screenplay: string;
    try {
      screenplay = await bindProductionBook(["--title", "Final Script"]);
    } finally {
      process.chdir(originalCwd);
    }
    assert.equal(
      screenplay,
      path.join(books, "artifacts", "final-script-screenplays.md"),
    );
    assert.equal(
      fs.readFileSync(screenplay, "utf8"),
      "# Final Script\n\n## First beat\n\n### Action\n\nIt begins.\n",
    );
    const customOutput = path.join(books, "reader-editions");
    const map = await bindProductionBook(
      ["--layer", "maps", "--title", "Site Book", "--output", customOutput],
      books,
    );
    assert.equal(map, path.join(customOutput, "site-book-maps.md"));
    assert.match(fs.readFileSync(map, "utf8"), /## Site plan\n\n### Extent/u);
    assert.deepEqual(snapshot(books, ["docs"]), docsBefore);

    const artifactsBefore = snapshot(books, ["artifacts", "reader-editions"]);
    for (const [args, message] of [
      [["--mystery", "x", "--title", "Book"], /Unknown book option/u],
      [["--title", "One", "--title", "Two"], /more than once/u],
      [["--title"], /requires a value/u],
      [["--layer", "maps"], /requires an explicit --title/u],
      [
        ["--layer", "unknown", "--title", "Invalid"],
        /Unknown authored document layer/u,
      ],
    ] as const) {
      await assert.rejects(() => bindProductionBook(args, books), message);
      assert.deepEqual(
        snapshot(books, ["artifacts", "reader-editions"]),
        artifactsBefore,
      );
    }

    process.stdout.write("production instruction commands passed\n");
  } finally {
    for (const root of roots) fs.rmSync(root, { force: true, recursive: true });
  }
}

/** Create a generated-project fixture with the installed shared contracts. */
function createProduction(name: string): string {
  const root = makeRoot(name);
  const linked = path.join(root, "node_modules", "@automovie", "template");
  fs.mkdirSync(path.dirname(linked), { recursive: true });
  fs.cpSync(path.join(packageRoot, "docs"), path.join(linked, "docs"), {
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
    "<!-- @evidenceExclude discovery/core/common.md#shared-local-boundary This command fixture retains no production-specific rule. -->\n\n# Work-specific contract audit\n",
  );
  return root;
}

/** Allocate one disposable root tracked for teardown. */
function makeRoot(name: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  roots.push(root);
  return root;
}

/** Write one project-relative UTF-8 file. */
function write(root: string, relative: string, content: string): void {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

/** Snapshot selected files as deterministic path/content tuples. */
function snapshot(
  root: string,
  selections: readonly string[],
): readonly string[] {
  const files: string[] = [];
  const visit = (target: string): void => {
    if (!fs.existsSync(target)) return;
    const stat = fs.statSync(target);
    if (stat.isFile()) {
      files.push(
        `${path.relative(root, target).replaceAll("\\", "/")}\0${fs.readFileSync(target, "utf8")}`,
      );
      return;
    }
    for (const entry of fs.readdirSync(target).sort())
      visit(path.join(target, entry));
  };
  for (const selection of selections) visit(path.join(root, selection));
  return files.sort();
}

/** The complete disabled declaration from which the fixture selects a library. */
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
