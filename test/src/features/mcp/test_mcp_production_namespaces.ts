import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  modelRecipe,
  productionDesign,
  productionFixture,
  shotContract,
  writeProductionScreenplay,
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

interface IProductionNamespaceFixtureFailure {
  error: unknown;
}

class ProductionNamespaceFixtureCleanupError extends AggregateError {}

export const preserveProductionNamespaceFixtureCleanup = (
  failure: IProductionNamespaceFixtureFailure | undefined,
  cleanup: () => void,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProductionNamespaceFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Production-namespace fixture teardown failed after the test failed.",
    );
  }
};

interface IProductionNamespaceReplacementCleanup {
  cleanup: () => unknown;
  resource: string;
}

class ProductionNamespaceReplacementCleanupError extends AggregateError {}

/** Attempt every replacement-alias recovery without hiding failure. */
export const preserveProductionNamespaceReplacementCleanup = (
  failure: IProductionNamespaceFixtureFailure | undefined,
  resources: readonly IProductionNamespaceReplacementCleanup[],
): void => {
  const cleanupFailures: Array<{ error: unknown; resource: string }> = [];
  for (const resource of resources)
    try {
      resource.cleanup();
    } catch (error) {
      cleanupFailures.push({ error, resource: resource.resource });
    }
  if (cleanupFailures.length === 1 && failure === undefined)
    throw cleanupFailures[0]!.error;
  if (cleanupFailures.length !== 0)
    throw new ProductionNamespaceReplacementCleanupError(
      [
        ...(failure === undefined ? [] : [failure.error]),
        ...cleanupFailures.map((entry) => entry.error),
      ],
      `Production-namespace replacement cleanup failed${
        failure === undefined ? "" : " after the test failed"
      }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
    );
};

interface INamespaceAuditFixtureFailure {
  error: unknown;
}

interface INamespaceAuditFixtureCleanup {
  cleanup: () => unknown;
  resource: string;
}

class NamespaceAuditFixtureCleanupError extends AggregateError {}

/** Attempt every acquired namespace-audit cleanup without hiding failure. */
export const preserveNamespaceAuditFixtureCleanup = (
  failure: INamespaceAuditFixtureFailure | undefined,
  resources: readonly INamespaceAuditFixtureCleanup[],
): void => {
  const cleanupFailures: Array<{ error: unknown; resource: string }> = [];
  for (const resource of resources)
    try {
      resource.cleanup();
    } catch (error) {
      cleanupFailures.push({ error, resource: resource.resource });
    }
  if (cleanupFailures.length === 1 && failure === undefined)
    throw cleanupFailures[0]!.error;
  if (cleanupFailures.length !== 0)
    throw new NamespaceAuditFixtureCleanupError(
      [
        ...(failure === undefined ? [] : [failure.error]),
        ...cleanupFailures.map((entry) => entry.error),
      ],
      `Namespace-audit fixture cleanup failed${
        failure === undefined ? "" : " after the test failed"
      }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
    );
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
  let unsafeIdsFailure: IProductionNamespaceFixtureFailure | undefined;
  const unsafeIds = productionFixture();
  try {
    for (const productionId of [".", "..", "shared.", "film."])
      TestValidator.predicate(
        `unsafe production id ${productionId}`,
        throws(() =>
          AutoMovieProductionProject.open(unsafeIds.root, productionId),
        ),
      );
  } catch (error) {
    unsafeIdsFailure = { error };
    throw error;
  } finally {
    preserveProductionNamespaceFixtureCleanup(unsafeIdsFailure, () =>
      unsafeIds.dispose(),
    );
  }

  let mismatchedLegacyFailure: IProductionNamespaceFixtureFailure | undefined;
  const mismatchedLegacy = productionFixture();
  try {
    TestValidator.predicate(
      "legacy migration refuses an invented namespace",
      throws(
        () => AutoMovieProductionProject.open(mismatchedLegacy.root, "wrong"),
        'declares id "fixture-film"',
      ),
    );
  } catch (error) {
    mismatchedLegacyFailure = { error };
    throw error;
  } finally {
    preserveProductionNamespaceFixtureCleanup(mismatchedLegacyFailure, () =>
      mismatchedLegacy.dispose(),
    );
  }

  let namespaceFixtureFailure: IProductionNamespaceFixtureFailure | undefined;
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
    const originalLegacyScreenplay = fs.readFileSync(legacyScreenplay);
    fs.writeFileSync(legacyScreenplay, '{"version":1}');
    fs.writeFileSync(legacyGenerated, "generated");
    fs.writeFileSync(sameNamedLegacyChild, "same-name-child");
    fs.writeFileSync(legacyRender, "render");
    const alpha = AutoMovieProductionProject.open(fixture.root);
    const migratedSameNamedLegacyChild = path.join(
      alpha.generatedRoot(),
      "fixture-film/legacy-child.bin",
    );
    const migratedScreenplay = path.join(
      fixture.root,
      ".automovie/design/fixture-film/screenplay/index.json",
    );
    TestValidator.equals(
      "legacy outputs migrate without byte loss",
      namedFacts([
        [
          "readFileSyncAlphaGeneratedRoot",
          () =>
            fs.readFileSync(
              path.join(alpha.generatedRoot(), "legacy-generated.bin"),
              "utf8",
            ) === "generated",
        ],
        [
          "readFileSyncMigratedSameNamedLegacyChildUtf8",
          () =>
            fs.readFileSync(migratedSameNamedLegacyChild, "utf8") ===
            "same-name-child",
        ],
        [
          "readFileSyncAlphaRenderRoot",
          () =>
            fs.readFileSync(
              path.join(alpha.renderRoot(), "legacy-render.bin"),
              "utf8",
            ) === "render",
        ],
        [
          "readFileSyncMigratedScreenplayUtf8",
          () => fs.readFileSync(migratedScreenplay, "utf8") === '{"version":1}',
        ],
      ]),
      {
        readFileSyncAlphaGeneratedRoot: true,
        readFileSyncMigratedSameNamedLegacyChildUtf8: true,
        readFileSyncAlphaRenderRoot: true,
        readFileSyncMigratedScreenplayUtf8: true,
      },
    );
    fs.writeFileSync(migratedScreenplay, originalLegacyScreenplay);
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
    TestValidator.equals(
      "production-owned paths are disjoint",
      namedFacts([
        [
          "alphaGeneratedRootBeta",
          () => alpha.generatedRoot() !== beta.generatedRoot(),
        ],
        ["alphaRenderRootBeta", () => alpha.renderRoot() !== beta.renderRoot()],
        [
          "alphaReviewPathKind",
          () =>
            alpha.reviewPath({
              kind: "design",
              design: { kind: "production" },
            }) !==
            beta.reviewPath({
              kind: "design",
              design: { kind: "production" },
            }),
        ],
        [
          "existsSyncFixtureRoot",
          () =>
            fs.existsSync(
              path.join(
                fixture.root,
                ".automovie",
                "design",
                "fixture-film",
                "production.json",
              ),
            ),
        ],
      ]),
      {
        alphaGeneratedRootBeta: true,
        alphaRenderRootBeta: true,
        alphaReviewPathKind: true,
        existsSyncFixtureRoot: true,
      },
    );
    TestValidator.equals(
      "shared model is visible to both productions",
      namedFacts([
        [
          "alphaDesignKind",
          () => alpha.design({ kind: "model", id: "soloist" }) !== null,
        ],
        [
          "betaDesignKind",
          () => beta.design({ kind: "model", id: "soloist" }) !== null,
        ],
      ]),
      { alphaDesignKind: true, betaDesignKind: true },
    );
    TestValidator.predicate(
      "second production design binds its namespace",
      (() => {
        // Scene numbers are production-scoped, so this namespace's shot cannot
        // join to the alpha production's ledger and needs one of its own.
        writeProductionScreenplay({ root: fixture.root, productionId: "beta" });
        return (
          beta.setProductionDesign(
            productionDesign({ id: "beta", title: "Beta production" }),
          ).accepted && beta.setShotContract(shotContract()).accepted
        );
      })(),
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
    TestValidator.equals(
      "both productions render without byte contamination",
      namedFacts([
        [
          "fsReadFileSyncAlphaRender",
          () => fs.readFileSync(alphaRender, "utf8") === "alpha",
        ],
        [
          "fsReadFileSyncBetaRender",
          () => fs.readFileSync(betaRender, "utf8") === "beta",
        ],
      ]),
      { fsReadFileSyncAlphaRender: true, fsReadFileSyncBetaRender: true },
    );

    const reviewTarget = {
      kind: "design" as const,
      design: { kind: "model" as const, id: "soloist" },
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
    TestValidator.equals(
      "both production review ledgers remain independent",
      namedFacts([
        [
          "alphaReviewReviewTarget",
          () =>
            alpha
              .review(reviewTarget)
              ?.observations.includes("fixture-film") === true,
        ],
        [
          "betaReviewReviewTarget",
          () =>
            beta.review(reviewTarget)?.observations.includes("beta") === true,
        ],
        [
          "alphaReviewPathReviewTarget",
          () =>
            alpha.reviewPath(reviewTarget) !== beta.reviewPath(reviewTarget),
        ],
      ]),
      {
        alphaReviewReviewTarget: true,
        betaReviewReviewTarget: true,
        alphaReviewPathReviewTarget: true,
      },
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
    TestValidator.equals(
      "shared model stales both compile and review identities",
      namedFacts([
        ["alphaBeforeAlphaAfter", () => alphaBefore !== alphaAfter],
        ["betaBeforeBetaAfter", () => betaBefore !== betaAfter],
        [
          "newAutoMovieProductionReviewServiceAlpha",
          () =>
            new AutoMovieProductionReviewService(alpha).prepare({
              target: reviewTarget,
            }).fingerprint !== alpha.review(reviewTarget)?.fingerprint,
        ],
        [
          "newAutoMovieProductionReviewServiceBeta",
          () =>
            new AutoMovieProductionReviewService(beta).prepare({
              target: reviewTarget,
            }).fingerprint !== beta.review(reviewTarget)?.fingerprint,
        ],
      ]),
      {
        alphaBeforeAlphaAfter: true,
        betaBeforeBetaAfter: true,
        newAutoMovieProductionReviewServiceAlpha: true,
        newAutoMovieProductionReviewServiceBeta: true,
      },
    );

    const sharedModel = path.join(
      fixture.root,
      ".automovie",
      "design",
      "shared",
      "models",
      "soloist.json",
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
    TestValidator.equals(
      "production deletion preserves sibling and shared bytes",
      namedFacts([
        ["erasedErased", () => erased.erased],
        ["erasedRemaining", () => erased.remaining.length === 1],
        [
          "erasedRemainingFixture",
          () => erased.remaining[0] === "fixture-film",
        ],
        ["existsSyncSharedModel", () => fs.existsSync(sharedModel)],
        ["existsSyncAlphaDesign", () => fs.existsSync(alphaDesign)],
        ["existsSyncAlphaRender", () => fs.existsSync(alphaRender)],
        [
          "existsSyncBetaGenerated",
          () => fs.existsSync(betaGenerated) === false,
        ],
        ["existsSyncBetaRenders", () => fs.existsSync(betaRenders) === false],
        [
          "throwsBetaSummary",
          () => throws(() => beta.summary(), "was deleted"),
        ],
      ]),
      {
        erasedErased: true,
        erasedRemaining: true,
        erasedRemainingFixture: true,
        existsSyncSharedModel: true,
        existsSyncAlphaDesign: true,
        existsSyncAlphaRender: true,
        existsSyncBetaGenerated: true,
        existsSyncBetaRenders: true,
        throwsBetaSummary: true,
      },
    );
  } catch (error) {
    namespaceFixtureFailure = { error };
    throw error;
  } finally {
    preserveProductionNamespaceFixtureCleanup(namespaceFixtureFailure, () =>
      fixture.dispose(),
    );
  }

  let aliasFixtureFailure: IProductionNamespaceFixtureFailure | undefined;
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
    TestValidator.equals(
      "an internal namespace alias is refused before registration",
      namedFacts([
        [
          "throwsAutoMovieProductionProjectOpen",
          () =>
            throws(
              () => AutoMovieProductionProject.open(aliasFixture.root, "beta"),
              "not a physical directory",
            ),
        ],
        [
          "autoMovieProductionProjectOpenAliasFixture",
          () =>
            AutoMovieProductionProject.open(aliasFixture.root, "fixture-film")
              .productionIds()
              .includes("beta") === false,
        ],
      ]),
      {
        throwsAutoMovieProductionProjectOpen: true,
        autoMovieProductionProjectOpenAliasFixture: true,
      },
    );
  } catch (error) {
    aliasFixtureFailure = { error };
    throw error;
  } finally {
    preserveProductionNamespaceFixtureCleanup(aliasFixtureFailure, () =>
      aliasFixture.dispose(),
    );
  }

  let incarnationFixtureFailure: IProductionNamespaceFixtureFailure | undefined;
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
    TestValidator.equals(
      "every production-scoped read, path and mutation rejects same-id recreation",
      namedFacts([
        [
          "recreatedSummaryProductionId",
          () => recreated.summary().productionId === "fixture-film",
        ],
        [
          "throwsStaleSummary",
          () => throws(() => stale.summary(), "deleted or recreated"),
        ],
        [
          "staleReadsReadThrows",
          () =>
            staleReads.every((read) => throws(read, "deleted or recreated")),
        ],
        [
          "staleMutationsMutateThrows",
          () =>
            staleMutations.every((mutate) =>
              throws(mutate, "deleted or recreated"),
            ),
        ],
      ]),
      {
        recreatedSummaryProductionId: true,
        throwsStaleSummary: true,
        staleReadsReadThrows: true,
        staleMutationsMutateThrows: true,
      },
    );
  } catch (error) {
    incarnationFixtureFailure = { error };
    throw error;
  } finally {
    preserveProductionNamespaceFixtureCleanup(incarnationFixtureFailure, () =>
      incarnationFixture.dispose(),
    );
  }

  let protoFixtureFailure: IProductionNamespaceFixtureFailure | undefined;
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
    TestValidator.equals(
      "prototype-named production receives an own ABA incarnation",
      namedFacts([
        [
          "hasOwnRegistryBeforeIncarnations",
          () => Object.hasOwn(registryBefore.incarnations, "__proto__"),
        ],
        [
          "recreatedSummaryProductionId",
          () => recreated.summary().productionId === "__proto__",
        ],
        [
          "throwsStaleGeneratedRoot",
          () => throws(() => stale.generatedRoot(), "deleted or recreated"),
        ],
      ]),
      {
        hasOwnRegistryBeforeIncarnations: true,
        recreatedSummaryProductionId: true,
        throwsStaleGeneratedRoot: true,
      },
    );
  } catch (error) {
    protoFixtureFailure = { error };
    throw error;
  } finally {
    preserveProductionNamespaceFixtureCleanup(protoFixtureFailure, () =>
      protoFixture.dispose(),
    );
  }

  let replacementFixtureFailure: IProductionNamespaceFixtureFailure | undefined;
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
    let replacementAliasFailure: IProductionNamespaceFixtureFailure | undefined;
    try {
      fs.symlinkSync(
        alphaDesignRoot,
        betaDesignRoot,
        process.platform === "win32" ? "junction" : "dir",
      );
      TestValidator.equals(
        "an opened handle rejects a later internal namespace alias",
        namedFacts([
          [
            "throwsBetaDesign",
            () =>
              throws(
                () => beta.design({ kind: "production" }),
                "changed physical identity",
              ),
          ],
          [
            "alphaSummaryProductionId",
            () => alpha.summary().productionId === "fixture-film",
          ],
        ]),
        { throwsBetaDesign: true, alphaSummaryProductionId: true },
      );
    } catch (error) {
      replacementAliasFailure = { error };
      throw error;
    } finally {
      preserveProductionNamespaceReplacementCleanup(replacementAliasFailure, [
        {
          resource: "replacement alias transient link",
          cleanup: () => {
            if (lstatLink(betaDesignRoot)) fs.unlinkSync(betaDesignRoot);
          },
        },
        {
          resource: "replacement alias resident design root",
          cleanup: () => fs.renameSync(parkedBetaDesignRoot, betaDesignRoot),
        },
      ]);
    }
  } catch (error) {
    replacementFixtureFailure = { error };
    throw error;
  } finally {
    preserveProductionNamespaceFixtureCleanup(replacementFixtureFailure, () =>
      replacementFixture.dispose(),
    );
  }

  const auditFixture = productionFixture();
  let externalAudit: string | undefined;
  let auditFailure: INamespaceAuditFixtureFailure | undefined;
  try {
    externalAudit = fs.mkdtempSync(
      path.join(path.dirname(auditFixture.root), "automovie-external-audit-"),
    );
    const project = AutoMovieProductionProject.open(auditFixture.root);
    const auditRoot = path.join(auditFixture.root, ".automovie/audit");
    fs.symlinkSync(
      externalAudit,
      auditRoot,
      process.platform === "win32" ? "junction" : "dir",
    );
    TestValidator.equals(
      "production erase refuses an aliased global audit directory",
      namedFacts([
        [
          "throwsProjectEraseProduction",
          () =>
            throws(
              () => project.eraseProduction("must not escape"),
              "physical",
            ),
        ],
        [
          "readdirSyncExternalAudit",
          () =>
            externalAudit !== undefined &&
            fs.readdirSync(externalAudit).length === 0,
        ],
        [
          "projectSummaryProductionId",
          () => project.summary().productionId === "fixture-film",
        ],
      ]),
      {
        throwsProjectEraseProduction: true,
        readdirSyncExternalAudit: true,
        projectSummaryProductionId: true,
      },
    );
  } catch (error) {
    auditFailure = { error };
    throw error;
  } finally {
    const completedExternalAudit = externalAudit;
    preserveNamespaceAuditFixtureCleanup(auditFailure, [
      {
        resource: "audit production fixture",
        cleanup: () => auditFixture.dispose(),
      },
      ...(completedExternalAudit === undefined
        ? []
        : [
            {
              resource: "external audit root",
              cleanup: () =>
                fs.rmSync(completedExternalAudit, {
                  force: true,
                  recursive: true,
                }),
            },
          ]),
    ]);
  }
};

const lstatLink = (file: string): boolean => {
  try {
    return fs.lstatSync(file).isSymbolicLink();
  } catch {
    return false;
  }
};
