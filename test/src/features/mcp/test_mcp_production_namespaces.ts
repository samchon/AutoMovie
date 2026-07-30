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
    const legacyGenerated = path.join(
      fixture.root,
      "generated/legacy-generated.bin",
    );
    const sameNamedLegacyChild = path.join(
      fixture.root,
      "generated/fixture-film/legacy-child.bin",
    );
    const legacyRender = path.join(fixture.root, "renders/legacy-render.bin");
    fs.mkdirSync(path.dirname(legacyGenerated), { recursive: true });
    fs.mkdirSync(path.dirname(sameNamedLegacyChild), { recursive: true });
    fs.mkdirSync(path.dirname(legacyRender), { recursive: true });
    fs.writeFileSync(legacyGenerated, "generated");
    fs.writeFileSync(sameNamedLegacyChild, "same-name-child");
    fs.writeFileSync(legacyRender, "render");
    const alpha = AutoMovieProductionProject.open(fixture.root);
    TestValidator.predicate(
      "legacy outputs migrate without byte loss",
      fs.readFileSync(
        path.join(alpha.generatedRoot(), "legacy-generated.bin"),
        "utf8",
      ) === "generated" &&
        fs.readFileSync(
          path.join(alpha.generatedRoot(), "fixture-film/legacy-child.bin"),
          "utf8",
        ) === "same-name-child" &&
        fs.readFileSync(
          path.join(alpha.renderRoot(), "legacy-render.bin"),
          "utf8",
        ) === "render",
    );
    fs.rmSync(path.join(alpha.generatedRoot(), "legacy-generated.bin"));
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
    TestValidator.predicate(
      "both productions compile into independent manifests",
      alphaCompile.success &&
        betaCompile.success &&
        alpha.generatedManifest()?.inputFingerprint ===
          alphaCompile.compiler.inputFingerprint &&
        beta.generatedManifest()?.inputFingerprint ===
          betaCompile.compiler.inputFingerprint &&
        alpha.generatedRoot() !== beta.generatedRoot(),
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
    TestValidator.predicate(
      "a stale handle cannot cross delete and same-id recreation",
      recreated.summary().productionId === "fixture-film" &&
        throws(() => stale.summary(), "deleted or recreated"),
    );
  } finally {
    incarnationFixture.dispose();
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
