import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  modelRecipe,
  productionDesign,
  productionFixture,
  shotContract,
} from "./productionFixtures";

const throws = (closure: () => unknown, signal?: string): boolean => {
  try {
    closure();
    return false;
  } catch (error) {
    return (
      signal === undefined ||
      (error instanceof Error && error.message.includes(signal))
    );
  }
};

/**
 * Proves that one physical project can host independent production namespaces.
 *
 * Scenarios:
 *
 * 1. Opening a legacy one-production scaffold migrates its records and outputs
 *    into the production id selected from production design.
 * 2. A second production gets disjoint design, review, generated, render, revision
 *    and lock addresses while both read project-shared model design.
 * 3. Updating one shared model changes both productions' compile fingerprints.
 * 4. Deleting the second production removes only its namespace and leaves the
 *    first production and shared assets byte-present.
 */
export const test_mcp_production_namespaces = (): void => {
  const unsafeIds = productionFixture();
  try {
    for (const productionId of [".", "..", "shared.", "film."])
      TestValidator.predicate(
        `unsafe production id ${productionId}`,
        throws(() =>
          AutoMovieProductionProject.open(unsafeIds.root, productionId),
        ),
      );
  } finally {
    unsafeIds.dispose();
  }

  const mismatchedLegacy = productionFixture();
  try {
    TestValidator.predicate(
      "legacy migration refuses an invented namespace",
      throws(
        () => AutoMovieProductionProject.open(mismatchedLegacy.root, "wrong"),
        'declares id "fixture-film"',
      ),
    );
  } finally {
    mismatchedLegacy.dispose();
  }

  const fixture = productionFixture();
  try {
    const legacyScreenplay = path.join(
      fixture.root,
      ".automovie/design/screenplay/index.json",
    );
    const legacyGenerated = path.join(
      fixture.root,
      "generated/legacy-generated.bin",
    );
    const sameNamedLegacyChild = path.join(
      fixture.root,
      "generated/fixture-film/legacy-child.bin",
    );
    const legacyRender = path.join(fixture.root, "renders/legacy-render.bin");
    fs.mkdirSync(path.dirname(legacyScreenplay), { recursive: true });
    fs.mkdirSync(path.dirname(legacyGenerated), { recursive: true });
    fs.mkdirSync(path.dirname(sameNamedLegacyChild), { recursive: true });
    fs.mkdirSync(path.dirname(legacyRender), { recursive: true });
    fs.writeFileSync(legacyScreenplay, '{"version":1}');
    fs.writeFileSync(legacyGenerated, "generated");
    fs.writeFileSync(sameNamedLegacyChild, "same-name-child");
    fs.writeFileSync(legacyRender, "render");
    const alpha = AutoMovieProductionProject.open(fixture.root);
    const migratedSameNamedLegacyChild = path.join(
      alpha.generatedRoot(),
      "fixture-film/legacy-child.bin",
    );
    TestValidator.predicate(
      "legacy outputs migrate without byte loss",
      fs.readFileSync(
        path.join(alpha.generatedRoot(), "legacy-generated.bin"),
        "utf8",
      ) === "generated" &&
        fs.readFileSync(migratedSameNamedLegacyChild, "utf8") ===
          "same-name-child" &&
        fs.readFileSync(
          path.join(alpha.renderRoot(), "legacy-render.bin"),
          "utf8",
        ) === "render" &&
        fs.readFileSync(
          path.join(
            fixture.root,
            ".automovie/design/fixture-film/screenplay/index.json",
          ),
          "utf8",
        ) === '{"version":1}',
    );
    fs.rmSync(path.join(alpha.generatedRoot(), "legacy-generated.bin"));
    fs.rmSync(migratedSameNamedLegacyChild);
    fs.rmSync(path.join(alpha.renderRoot(), "legacy-render.bin"));
    const beta = AutoMovieProductionProject.open(fixture.root, "beta");
    TestValidator.equals(
      "registered production inventory",
      beta.productionIds(),
      ["beta", "fixture-film"],
    );
    TestValidator.predicate(
      "multiple productions require an explicit selection",
      throws(
        () => AutoMovieProductionProject.open(fixture.root),
        "contains 2 productions",
      ),
    );
    TestValidator.predicate(
      "production-owned paths are disjoint",
      alpha.generatedRoot() !== beta.generatedRoot() &&
        alpha.renderRoot() !== beta.renderRoot() &&
        alpha.reviewPath({ kind: "design", design: { kind: "production" } }) !==
          beta.reviewPath({
            kind: "design",
            design: { kind: "production" },
          }) &&
        fs.existsSync(
          path.join(
            fixture.root,
            ".automovie",
            "design",
            "fixture-film",
            "production.json",
          ),
        ),
    );
    TestValidator.predicate(
      "shared model is visible to both productions",
      alpha.design({ kind: "model", id: "sentinel" }) !== null &&
        beta.design({ kind: "model", id: "sentinel" }) !== null,
    );
    TestValidator.predicate(
      "second production design binds its namespace",
      beta.setProductionDesign(
        productionDesign({ id: "beta", title: "Beta production" }),
      ).accepted && beta.setShotContract(shotContract()).accepted,
    );
    const alphaCompiler = new AutoMovieProductionCompiler(alpha);
    const betaCompiler = new AutoMovieProductionCompiler(beta);
    const alphaCompile = alphaCompiler.compile({ scope: "source" });
    const betaCompile = betaCompiler.compile({ scope: "source" });
    const alphaManifest = alpha.generatedManifest();
    const betaManifest = beta.generatedManifest();
    const namespaceCompileContracts = {
      "fixture-film compiles": alphaCompile.success,
      "beta compiles": betaCompile.success,
      "fixture-film manifest matches its compiler fingerprint":
        alphaManifest?.inputFingerprint ===
        alphaCompile.compiler.inputFingerprint,
      "beta manifest matches its compiler fingerprint":
        betaManifest?.inputFingerprint ===
        betaCompile.compiler.inputFingerprint,
      "production generated roots are disjoint":
        alpha.generatedRoot() !== beta.generatedRoot(),
    } satisfies Record<string, boolean>;
    const failedNamespaceCompileContracts = Object.entries(
      namespaceCompileContracts,
    )
      .filter(([, accepted]) => accepted === false)
      .map(([contract]) => `- ${contract}`);
    if (failedNamespaceCompileContracts.length !== 0)
      throw new Error(
        [
          "Namespace compile contract failures:",
          ...failedNamespaceCompileContracts,
          "Production compile outputs:",
          JSON.stringify(
            {
              "fixture-film": alphaCompile,
              beta: betaCompile,
            },
            null,
            2,
          ),
        ].join("\n"),
      );
    TestValidator.predicate(
      "both productions compile into independent manifests",
      failedNamespaceCompileContracts.length === 0,
    );

    alpha.commitProductionDeliverableFiles(
      "namespace-proof",
      new Map([["frame.bin", Buffer.from("alpha")]]),
    );
    beta.commitProductionDeliverableFiles(
      "namespace-proof",
      new Map([["frame.bin", Buffer.from("beta")]]),
    );
    const alphaRender = path.join(
      alpha.renderRoot(),
      "deliverables/namespace-proof/frame.bin",
    );
    const betaRender = path.join(
      beta.renderRoot(),
      "deliverables/namespace-proof/frame.bin",
    );
    TestValidator.predicate(
      "both productions render without byte contamination",
      fs.readFileSync(alphaRender, "utf8") === "alpha" &&
        fs.readFileSync(betaRender, "utf8") === "beta",
    );

    const reviewTarget = {
      kind: "design" as const,
      design: { kind: "model" as const, id: "sentinel" },
    };
    for (const project of [alpha, beta]) {
      const prepared = new AutoMovieProductionReviewService(project).prepare({
        target: reviewTarget,
      });
      project.commitReview({
        version: 1,
        target: reviewTarget,
        fingerprint: prepared.fingerprint,
        observations: `Reviewed production ${project.productionId}.`,
        checks: [],
        corrections: [
          {
            owner: "design",
            target: project.productionId,
            problem:
              "Namespace-isolation fixture records an incomplete review.",
            expected:
              "A later review may complete production-specific criteria.",
          },
        ],
        completionBasis:
          "Production namespace storage is independently addressed.",
        complete: false,
      });
    }
    TestValidator.predicate(
      "both production review ledgers remain independent",
      alpha.review(reviewTarget)?.observations.includes("fixture-film") ===
        true &&
        beta.review(reviewTarget)?.observations.includes("beta") === true &&
        alpha.reviewPath(reviewTarget) !== beta.reviewPath(reviewTarget),
    );

    const alphaBefore = alphaCompiler.lint({
      scope: "source",
    }).compiler.inputFingerprint;
    const betaBefore = betaCompiler.lint({
      scope: "source",
    }).compiler.inputFingerprint;
    const changed = modelRecipe();
    changed.palette.body = "#c08040";
    TestValidator.predicate(
      "shared model mutation is accepted",
      alpha.setModelRecipe(changed).accepted,
    );
    const alphaAfter = alphaCompiler.lint({
      scope: "source",
    }).compiler.inputFingerprint;
    const betaAfter = betaCompiler.lint({
      scope: "source",
    }).compiler.inputFingerprint;
    TestValidator.predicate(
      "shared model stales both compile and review identities",
      alphaBefore !== alphaAfter &&
        betaBefore !== betaAfter &&
        new AutoMovieProductionReviewService(alpha).prepare({
          target: reviewTarget,
        }).fingerprint !== alpha.review(reviewTarget)?.fingerprint &&
        new AutoMovieProductionReviewService(beta).prepare({
          target: reviewTarget,
        }).fingerprint !== beta.review(reviewTarget)?.fingerprint,
    );

    const sharedModel = path.join(
      fixture.root,
      ".automovie",
      "design",
      "shared",
      "models",
      "sentinel.json",
    );
    const alphaDesign = path.join(
      fixture.root,
      ".automovie",
      "design",
      "fixture-film",
      "production.json",
    );
    const betaGenerated = beta.generatedRoot();
    const betaRenders = beta.renderRoot();
    const erased = beta.eraseProduction("remove the beta acceptance fixture");
    TestValidator.predicate(
      "production deletion preserves sibling and shared bytes",
      erased.erased &&
        erased.remaining.length === 1 &&
        erased.remaining[0] === "fixture-film" &&
        fs.existsSync(sharedModel) &&
        fs.existsSync(alphaDesign) &&
        fs.existsSync(alphaRender) &&
        fs.existsSync(betaGenerated) === false &&
        fs.existsSync(betaRenders) === false &&
        throws(() => beta.summary(), "was deleted"),
    );
  } finally {
    fixture.dispose();
  }

  const aliasFixture = productionFixture();
  try {
    AutoMovieProductionProject.open(aliasFixture.root);
    const alphaDesignRoot = path.join(
      aliasFixture.root,
      ".automovie/design/fixture-film",
    );
    const betaDesignRoot = path.join(
      aliasFixture.root,
      ".automovie/design/beta",
    );
    fs.symlinkSync(
      alphaDesignRoot,
      betaDesignRoot,
      process.platform === "win32" ? "junction" : "dir",
    );
    TestValidator.predicate(
      "an internal namespace alias is refused before registration",
      throws(
        () => AutoMovieProductionProject.open(aliasFixture.root, "beta"),
        "not a physical directory",
      ) &&
        AutoMovieProductionProject.open(aliasFixture.root, "fixture-film")
          .productionIds()
          .includes("beta") === false,
    );
  } finally {
    aliasFixture.dispose();
  }

  const incarnationFixture = productionFixture();
  try {
    const erasing = AutoMovieProductionProject.open(incarnationFixture.root);
    const stale = AutoMovieProductionProject.open(
      incarnationFixture.root,
      "fixture-film",
    );
    erasing.eraseProduction("exercise production incarnation fencing");
    const recreated = AutoMovieProductionProject.open(
      incarnationFixture.root,
      "fixture-film",
    );
    const staleReads = [
      () => stale.readTrackedStateFile("revision.json"),
      () => stale.trackedStatePath("revision.json"),
      () => stale.generatedRoot(),
      () => stale.readGeneratedFile("missing.bin"),
      () => stale.renderRoot(),
      () => stale.readRenderFile("missing.bin"),
      () =>
        stale.reviewPath({
          kind: "design",
          design: { kind: "production" },
        }),
    ];
    const staleMutations = [
      () =>
        stale.setProductionDesign({
          ...productionDesign(),
          id: "wrong-production",
        }),
      () => stale.setWorldDesign({} as never),
      () =>
        stale.eraseDesignArtifact({
          kind: "model",
          id: "absent",
        }),
    ];
    TestValidator.predicate(
      "every production-scoped read, path and mutation rejects same-id recreation",
      recreated.summary().productionId === "fixture-film" &&
        throws(() => stale.summary(), "deleted or recreated") &&
        staleReads.every((read) => throws(read, "deleted or recreated")) &&
        staleMutations.every((mutate) =>
          throws(mutate, "deleted or recreated"),
        ),
    );
  } finally {
    incarnationFixture.dispose();
  }

  const protoFixture = productionFixture();
  try {
    AutoMovieProductionProject.open(protoFixture.root);
    const erasing = AutoMovieProductionProject.open(
      protoFixture.root,
      "__proto__",
    );
    const stale = AutoMovieProductionProject.open(
      protoFixture.root,
      "__proto__",
    );
    const registryBefore = JSON.parse(
      fs.readFileSync(
        path.join(protoFixture.root, ".automovie/productions.json"),
        "utf8",
      ),
    ) as { incarnations: Record<string, string> };
    erasing.eraseProduction("exercise prototype-key incarnation fencing");
    const recreated = AutoMovieProductionProject.open(
      protoFixture.root,
      "__proto__",
    );
    TestValidator.predicate(
      "prototype-named production receives an own ABA incarnation",
      Object.hasOwn(registryBefore.incarnations, "__proto__") &&
        recreated.summary().productionId === "__proto__" &&
        throws(() => stale.generatedRoot(), "deleted or recreated"),
    );
  } finally {
    protoFixture.dispose();
  }

  const replacementFixture = productionFixture();
  try {
    const alpha = AutoMovieProductionProject.open(replacementFixture.root);
    const beta = AutoMovieProductionProject.open(
      replacementFixture.root,
      "beta",
    );
    const alphaDesignRoot = path.join(
      replacementFixture.root,
      ".automovie/design/fixture-film",
    );
    const betaDesignRoot = path.join(
      replacementFixture.root,
      ".automovie/design/beta",
    );
    const parkedBetaDesignRoot = `${betaDesignRoot}.parked`;
    fs.renameSync(betaDesignRoot, parkedBetaDesignRoot);
    try {
      fs.symlinkSync(
        alphaDesignRoot,
        betaDesignRoot,
        process.platform === "win32" ? "junction" : "dir",
      );
      TestValidator.predicate(
        "an opened handle rejects a later internal namespace alias",
        throws(
          () => beta.design({ kind: "production" }),
          "changed physical identity",
        ) && alpha.summary().productionId === "fixture-film",
      );
    } finally {
      if (lstatLink(betaDesignRoot)) fs.unlinkSync(betaDesignRoot);
      fs.renameSync(parkedBetaDesignRoot, betaDesignRoot);
    }
  } finally {
    replacementFixture.dispose();
  }

  const auditFixture = productionFixture();
  const externalAudit = fs.mkdtempSync(
    path.join(path.dirname(auditFixture.root), "automovie-external-audit-"),
  );
  try {
    const project = AutoMovieProductionProject.open(auditFixture.root);
    const auditRoot = path.join(auditFixture.root, ".automovie/audit");
    fs.symlinkSync(
      externalAudit,
      auditRoot,
      process.platform === "win32" ? "junction" : "dir",
    );
    TestValidator.predicate(
      "production erase refuses an aliased global audit directory",
      throws(() => project.eraseProduction("must not escape"), "physical") &&
        fs.readdirSync(externalAudit).length === 0 &&
        project.summary().productionId === "fixture-film",
    );
  } finally {
    auditFixture.dispose();
    fs.rmSync(externalAudit, { force: true, recursive: true });
  }
};

const lstatLink = (file: string): boolean => {
  try {
    return fs.lstatSync(file).isSymbolicLink();
  } catch {
    return false;
  }
};
