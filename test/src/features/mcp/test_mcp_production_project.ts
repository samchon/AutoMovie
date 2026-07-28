import {
  IAutoMovieGeneratedManifest,
  IAutoMovieRenderBundleManifest,
  IAutoMovieStoredReview,
} from "@automovie/interface";
import {
  AUTOMOVIE_MAX_FORMATION_MEMBERS,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  digestAutoMovieBytes,
  productionRenderBundleRelativePath,
  productionRenderTargetFingerprint,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PNG } from "pngjs";

import {
  acceptanceScenarios,
  formationDesign,
  modelRecipe,
  productionDesign,
  productionFixture,
  shotContract,
  worldDesign,
} from "./productionFixtures";

const throws = (closure: () => unknown): boolean => {
  try {
    closure();
    return false;
  } catch {
    return true;
  }
};

/** The resident production store enforces path, revision and ownership rules. */
export const test_mcp_production_project = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    TestValidator.predicate(
      "manifest and summary preserve tracked identity",
      project.manifest().formatVersion === 2 &&
        project.summary().initialized === false &&
        project.generatedRoot() === path.join(fixture.root, "generated") &&
        project.renderRoot() === path.join(fixture.root, "renders"),
    );
    const manifestCopy = project.manifest();
    manifestCopy.generatedRoot = "caller-mutated";
    TestValidator.equals(
      "manifest callers cannot mutate resident ownership state",
      project.manifest().generatedRoot,
      "generated",
    );
    TestValidator.predicate(
      "project-level erase audit reasons cannot be blank",
      throws(() => project.eraseDesignArtifact({ kind: "world" }, " ")),
    );
    TestValidator.predicate(
      "every design target is readable",
      project.design({ kind: "production" }) !== null &&
        project.design({ kind: "model", id: "sentinel" }) !== null &&
        project.design({ kind: "world" }) !== null &&
        project.design({ kind: "formation", id: "absent" }) === null &&
        project.design({ kind: "shot", id: "opening" }) !== null &&
        project.design({ kind: "acceptance", id: "opening-beauty" }) !== null,
    );
    const stagedShot = shotContract();
    stagedShot.reviewFrames[0]!.id = "replacement-apex";
    const stagedDependencyBreak = project.setShotContract(stagedShot);
    TestValidator.predicate(
      "one-artifact setters accept an orderable dependency migration but expose its new downstream blockers",
      stagedDependencyBreak.accepted &&
        stagedDependencyBreak.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "design-downstream-invalidated" &&
            diagnostic.category === "warning" &&
            diagnostic.target.startsWith("acceptance:"),
        ) &&
        new AutoMovieProductionCompiler(project).lint({ scope: "design" })
          .success === false,
    );
    const unrelatedDuringMigration = project.setWorldDesign(worldDesign());
    TestValidator.predicate(
      "an unrelated setter does not claim a pre-existing migration blocker as its consequence",
      unrelatedDuringMigration.accepted &&
        unrelatedDuringMigration.diagnostics.every(
          (diagnostic) => diagnostic.code !== "design-downstream-invalidated",
        ),
    );
    TestValidator.predicate(
      "restoring the upstream contract clears the staged dependency break",
      project.setShotContract(shotContract()).accepted &&
        new AutoMovieProductionCompiler(project).lint({ scope: "design" })
          .success,
    );
    TestValidator.predicate(
      "source ownership rejects absolute, external and non-TypeScript paths",
      throws(() => project.resolveSourcePath(path.resolve("outside.ts"))) &&
        throws(() => project.resolveSourcePath("../outside.ts")) &&
        throws(() => project.resolveSourcePath("outside/source.ts")) &&
        throws(() => project.resolveSourcePath("src/not-source.json")) &&
        throws(() => project.readSource("src/missing.ts")),
    );
    const outsideSource = path.join(fixture.root, "outside-source");
    const sourceJunction = path.join(fixture.root, "src/junction");
    fs.mkdirSync(outsideSource, { recursive: true });
    fs.writeFileSync(path.join(outsideSource, "escape.ts"), "export {};\n");
    fs.symlinkSync(outsideSource, sourceJunction, "junction");
    TestValidator.predicate(
      "source realpaths cannot escape through a directory junction",
      throws(() => project.readSource("src/junction/escape.ts")),
    );
    fs.rmSync(sourceJunction);
    fs.rmSync(outsideSource, { recursive: true });

    const invalidSchema = project.setModelRecipe(
      {} as ReturnType<typeof modelRecipe>,
    );
    const invalidGraph = project.setModelRecipe({
      ...modelRecipe(),
      parameters: { ...modelRecipe().parameters, height: 99 },
    });
    const invalidReference = project.setFormationDesign({
      ...formationDesign(),
      id: "missing-model-formation",
      modelRecipe: "absent",
    });
    const caseCollision = project.setModelRecipe({
      ...modelRecipe(),
      id: "SENTINEL",
    });
    const nonCanonicalSources = [
      "/src/shots/opening.ts",
      "C:/src/shots/opening.ts",
      "src\\shots\\opening.ts",
      "src/../shots/opening.ts",
      "../outside.ts",
      "C:src/shots/opening.ts",
      "src/shots/",
      "src/shots/opening.js",
    ].map((module, index) =>
      project.setShotContract({
        ...shotContract(),
        id: `non-canonical-source-${index}`,
        source: {
          ...shotContract().source,
          module,
        },
      }),
    );
    const sourceCaseCollision = project.setShotContract({
      ...shotContract(),
      id: "source-case-collision",
      source: {
        ...shotContract().source,
        module: "SRC/shots/opening.ts",
      },
    });
    TestValidator.predicate(
      "setter rejects both schema and graph errors before writing",
      invalidSchema.accepted === false &&
        invalidSchema.diagnostics[0]?.code === "design-schema-invalid" &&
        invalidGraph.accepted === false &&
        invalidGraph.diagnostics.some(
          (item) => item.code === "model-parameter-invalid",
        ) &&
        invalidReference.diagnostics.some(
          (item) => item.code === "design-reference-missing",
        ) &&
        caseCollision.accepted === false &&
        caseCollision.diagnostics[0]?.code === "design-id-collision" &&
        nonCanonicalSources.every((mutation) =>
          mutation.diagnostics.some(
            (item) => item.code === "design-source-path-invalid",
          ),
        ) &&
        sourceCaseCollision.diagnostics.some(
          (item) => item.code === "design-source-path-collision",
        ),
    );
    const boundedFormationCount =
      Math.floor(AUTOMOVIE_MAX_FORMATION_MEMBERS / 2) + 1;
    const boundedFormation = formationDesign({
      kind: "line",
      ranks: 1,
      files: boundedFormationCount,
      spacing: { lateral: 0.8, depth: 0.9 },
    });
    const firstBoundedFormation = project.setFormationDesign({
      ...boundedFormation,
      id: "bounded-a",
      count: boundedFormationCount,
    });
    const aggregateOverflow = project.setFormationDesign({
      ...boundedFormation,
      id: "bounded-b",
      count: boundedFormationCount,
    });
    TestValidator.predicate(
      "formation setters hard-refuse a graph-wide explicit-slot overflow",
      firstBoundedFormation.accepted &&
        aggregateOverflow.accepted === false &&
        aggregateOverflow.diagnostics.some(
          (item) =>
            item.code === "design-range-invalid" &&
            item.target === "formations",
        ) &&
        project.eraseDesignArtifact({
          kind: "formation",
          id: "bounded-a",
        }).accepted,
    );
    TestValidator.predicate(
      "missing design erase is explicit",
      project.eraseDesignArtifact({
        kind: "formation",
        id: "absent",
      }).diagnostics[0]?.code === "design-missing",
    );
    TestValidator.predicate(
      "shot acceptance references block erasure",
      project
        .eraseDesignArtifact({
          kind: "shot",
          id: "opening",
        })
        .diagnostics.some((item) => item.code === "design-reference-active"),
    );
    const filmAcceptance = {
      id: "film-opening-beauty",
      target: { kind: "film" as const, id: "fixture-film" },
      criterion: {
        kind: "frame" as const,
        shot: "opening",
        frame: "signal-apex",
        pass: "beauty" as const,
        expectation: "The film retains the opening signal frame.",
      },
      required: true,
    };
    const filmEventAcceptance = {
      id: "film-opening-event",
      target: { kind: "film" as const, id: "fixture-film" },
      criterion: {
        kind: "event" as const,
        shot: "opening",
        event: "signal-raised",
        expectation: "The opening signal event remains in the film.",
      },
      required: true,
    };
    TestValidator.predicate(
      "film-scoped criteria are real shot and production references",
      project.setAcceptanceScenario(filmAcceptance).accepted &&
        project.setAcceptanceScenario(filmEventAcceptance).accepted &&
        project
          .eraseDesignArtifact({ kind: "shot", id: "opening" })
          .diagnostics.some((diagnostic) =>
            diagnostic.message.includes("acceptance:film-opening-beauty"),
          ) &&
        project
          .eraseDesignArtifact({ kind: "production" })
          .diagnostics.some((diagnostic) =>
            diagnostic.message.includes("acceptance:film-opening-beauty"),
          ),
    );
    TestValidator.predicate(
      "temporary film acceptances erase without a cascade",
      project.eraseDesignArtifact({
        kind: "acceptance",
        id: filmAcceptance.id,
      }).accepted &&
        project.eraseDesignArtifact({
          kind: "acceptance",
          id: filmEventAcceptance.id,
        }).accepted,
    );
    TestValidator.predicate(
      "shot frame clocks retain the singleton production design",
      project
        .eraseDesignArtifact({ kind: "production" })
        .diagnostics.some((diagnostic) =>
          diagnostic.message.includes("shot:opening"),
        ),
    );
    const landmarkShot = shotContract();
    landmarkShot.opening[0]!.predicates.push({
      kind: "position",
      subject: { kind: "landmark", id: "signal-ground" },
      axis: "x",
      operator: "==",
      value: 0,
      tolerance: 0,
    });
    project.setShotContract(landmarkShot);
    TestValidator.predicate(
      "shot predicates retain the world that owns their landmark selectors",
      project
        .eraseDesignArtifact({ kind: "world" })
        .diagnostics.some((diagnostic) =>
          diagnostic.message.includes("shot:opening"),
        ),
    );
    landmarkShot.opening[0]!.predicates = [
      {
        kind: "position",
        subject: { kind: "point", position: { x: 0, y: 0, z: 0 } },
        axis: "x",
        operator: "==",
        value: 0,
        tolerance: 0,
      },
      {
        kind: "distance",
        from: { kind: "point", position: { x: 0, y: 0, z: 0 } },
        to: { kind: "landmark", id: "signal-ground" },
        operator: "==",
        value: 0,
        tolerance: 0,
      },
    ];
    project.setShotContract(landmarkShot);
    const landmarkAsDistanceDestination = project.eraseDesignArtifact({
      kind: "world",
    });
    landmarkShot.opening[0]!.predicates = [
      {
        kind: "distance",
        from: { kind: "landmark", id: "signal-ground" },
        to: { kind: "point", position: { x: 0, y: 0, z: 0 } },
        operator: "==",
        value: 0,
        tolerance: 0,
      },
    ];
    project.setShotContract(landmarkShot);
    TestValidator.predicate(
      "both distance operands preserve their referenced landmark world",
      landmarkAsDistanceDestination.accepted === false &&
        project.eraseDesignArtifact({ kind: "world" }).accepted === false,
    );
    project.setShotContract(shotContract());
    const standaloneModel = {
      ...modelRecipe(),
      id: "standalone",
      lod: [
        {
          tier: "hero" as const,
          maxDistance: null,
          recipe: "standalone",
        },
      ],
    };
    TestValidator.predicate(
      "a model's self LOD does not make the model impossible to erase",
      project.setModelRecipe(standaloneModel).accepted &&
        project.eraseDesignArtifact({
          kind: "model",
          id: standaloneModel.id,
        }).accepted,
    );
    project.setFormationDesign(formationDesign());
    const dependentModel = {
      ...modelRecipe(),
      id: "sentinel-variant",
      lod: [
        { tier: "hero" as const, maxDistance: 10, recipe: "sentinel" },
        {
          tier: "far" as const,
          maxDistance: null,
          recipe: "sentinel-variant",
        },
      ],
    };
    const dependentModelMutation = project.setModelRecipe(dependentModel);
    const transitiveDependentModel = {
      ...modelRecipe(),
      id: "sentinel-variant-far",
      lod: [
        {
          tier: "hero" as const,
          maxDistance: 10,
          recipe: "sentinel-variant",
        },
        {
          tier: "far" as const,
          maxDistance: null,
          recipe: "sentinel-variant-far",
        },
      ],
    };
    const transitiveDependentMutation = project.setModelRecipe(
      transitiveDependentModel,
    );
    const dependencyCycleFixture = productionFixture();
    let cyclicDependencyTraversal = false;
    try {
      const modelRoot = path.join(
        dependencyCycleFixture.root,
        ".automovie/design/models",
      );
      fs.writeFileSync(
        path.join(modelRoot, "cycle-a.json"),
        JSON.stringify({
          ...modelRecipe(),
          id: "cycle-a",
          lod: [
            {
              tier: "hero",
              maxDistance: null,
              recipe: "cycle-b",
            },
          ],
        }),
      );
      fs.writeFileSync(
        path.join(modelRoot, "cycle-b.json"),
        JSON.stringify({
          ...modelRecipe(),
          id: "cycle-b",
          lod: [
            {
              tier: "hero",
              maxDistance: null,
              recipe: "cycle-a",
            },
          ],
        }),
      );
      fs.writeFileSync(
        path.join(modelRoot, "missing-lod.json"),
        JSON.stringify({
          ...modelRecipe(),
          id: "missing-lod",
          lod: [
            {
              tier: "hero",
              maxDistance: null,
              recipe: "absent",
            },
          ],
        }),
      );
      AutoMovieProductionProject.open(
        dependencyCycleFixture.root,
      ).eraseDesignArtifact({
        kind: "model",
        id: "sentinel",
      });
      cyclicDependencyTraversal = true;
    } finally {
      dependencyCycleFixture.dispose();
    }
    const refusedModelErase = project.eraseDesignArtifact({
      kind: "model",
      id: "sentinel",
    });
    TestValidator.predicate(
      "model consequences and erasure include dependent LOD models and formations",
      cyclicDependencyTraversal &&
        dependentModelMutation.accepted &&
        transitiveDependentMutation.accepted &&
        refusedModelErase.consequences.staleReviews.some(
          (target) =>
            target.kind === "design" &&
            target.design.kind === "model" &&
            target.design.id === "sentinel-variant",
        ) &&
        refusedModelErase.consequences.staleReviews.some(
          (target) =>
            target.kind === "design" &&
            target.design.kind === "model" &&
            target.design.id === "sentinel-variant-far",
        ) &&
        refusedModelErase.diagnostics.some(
          (item) =>
            item.message.includes("model:sentinel-variant") ||
            item.message.includes("formation:line"),
        ),
    );
    project.setShotContract({
      ...shotContract(),
      participants: [{ kind: "formation", id: "line" }],
    });
    TestValidator.predicate(
      "formation references block erasure",
      project
        .eraseDesignArtifact({
          kind: "formation",
          id: "line",
        })
        .diagnostics.some((item) => item.code === "design-reference-active"),
    );
    const secondShotMutation = project.setShotContract({
      ...shotContract(),
      id: "second",
      beat: "second",
    });
    const acceptanceMutation = project.setAcceptanceScenario(
      acceptanceScenarios()[0]!,
    );
    TestValidator.predicate(
      "mutation consequences follow target-local shot and review dependencies",
      secondShotMutation.accepted &&
        secondShotMutation.consequences.staleRenders.includes("shot:second") &&
        secondShotMutation.consequences.staleRenders.includes(
          "shot:opening",
        ) === false &&
        acceptanceMutation.accepted &&
        acceptanceMutation.consequences.staleRenders.length === 0 &&
        acceptanceMutation.consequences.staleReviews.some(
          (target) => target.kind === "shot" && target.id === "opening",
        ) &&
        acceptanceMutation.consequences.staleReviews.some(
          (target) => target.kind === "shot" && target.id === "second",
        ) === false,
    );
    const modelMutation = project.setModelRecipe(modelRecipe());
    const worldMutation = project.setWorldDesign(worldDesign());
    const productionMutation = project.setProductionDesign(productionDesign());
    TestValidator.predicate(
      "mutation consequences identify dependent shot and film",
      modelMutation.consequences.staleRenders.includes("shot:opening") &&
        modelMutation.consequences.staleRenders.includes("shot:second") &&
        worldMutation.consequences.staleReviews.some(
          (target) => target.kind === "film",
        ) &&
        productionMutation.consequences.staleRenders.length > 0 &&
        project.eraseDesignArtifact({
          kind: "shot",
          id: "second",
        }).accepted,
    );
    project.setShotContract(shotContract());
    TestValidator.predicate(
      "unreferenced formation erases",
      project.eraseDesignArtifact({
        kind: "formation",
        id: "line",
      }).accepted,
    );

    const first = AutoMovieProductionProject.open(fixture.root);
    const stale = AutoMovieProductionProject.open(fixture.root);
    first.setWorldDesign(worldDesign());
    TestValidator.predicate(
      "optimistic revision rejects stale resident writers",
      throws(() => stale.setProductionDesign(productionDesign())),
    );

    const compiler = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    );
    const compiled = compiler.compile({ scope: "source" });
    TestValidator.predicate("project compiler fixture", compiled.success);
    const linkedGenerated = productionFixture();
    const outsideGenerated = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-generated-outside-"),
    );
    try {
      const linkedProject = AutoMovieProductionProject.open(
        linkedGenerated.root,
      );
      const linkedCompiler = new AutoMovieProductionCompiler(linkedProject);
      TestValidator.predicate(
        "linked generated fixture compiles",
        linkedCompiler.compile({ scope: "source" }).success,
      );
      const shotsRoot = path.join(linkedProject.generatedRoot(), "shots");
      fs.copyFileSync(
        path.join(shotsRoot, "opening.json"),
        path.join(outsideGenerated, "opening.json"),
      );
      fs.rmSync(shotsRoot, { force: true, recursive: true });
      fs.symlinkSync(outsideGenerated, shotsRoot, "junction");
      const unsafeGenerated = linkedCompiler.lint({ scope: "source" });
      TestValidator.predicate(
        "generated reads and compiler ownership refuse a nested junction",
        throws(() => linkedProject.readGeneratedFile("shots/opening.json")) &&
          throws(() => linkedProject.readGeneratedFile("shots")) &&
          throws(() => linkedProject.readGeneratedFile("contracts")) &&
          unsafeGenerated.diagnostics.some(
            (item) => item.code === "generated-path-outside",
          ),
      );
    } finally {
      linkedGenerated.dispose();
      fs.rmSync(outsideGenerated, { force: true, recursive: true });
    }
    const linkedState = productionFixture();
    const outsideState = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-state-outside-"),
    );
    try {
      const stateProject = AutoMovieProductionProject.open(linkedState.root);
      const modelRoot = path.join(linkedState.root, ".automovie/design/models");
      fs.copyFileSync(
        path.join(modelRoot, "sentinel.json"),
        path.join(outsideState, "sentinel.json"),
      );
      fs.rmSync(modelRoot, { force: true, recursive: true });
      fs.symlinkSync(outsideState, modelRoot, "junction");
      TestValidator.predicate(
        "tracked design reads refuse a nested state junction",
        throws(() => stateProject.graph()),
      );
    } finally {
      linkedState.dispose();
      fs.rmSync(outsideState, { force: true, recursive: true });
    }
    const linkedStateFile = productionFixture();
    const outsideStateFile = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-state-file-outside-"),
    );
    try {
      const stateProject = AutoMovieProductionProject.open(
        linkedStateFile.root,
      );
      fs.symlinkSync(
        outsideStateFile,
        path.join(linkedStateFile.root, ".automovie/design/models/unsafe.json"),
        "junction",
      );
      TestValidator.predicate(
        "tracked keyed design refuses a symbolic JSON entry",
        throws(() => stateProject.graph()),
      );
    } finally {
      linkedStateFile.dispose();
      fs.rmSync(outsideStateFile, { force: true, recursive: true });
    }
    const ownerProject = AutoMovieProductionProject.open(fixture.root);
    TestValidator.predicate(
      "missing keyed design reads are explicit",
      ownerProject.design({ kind: "shot", id: "absent" }) === null &&
        ownerProject.design({ kind: "acceptance", id: "absent" }) === null,
    );
    const oldManifest = ownerProject.generatedManifest()!;
    const retained = oldManifest.files.filter((entry) =>
      entry.path.startsWith("contracts/"),
    );
    const retainedBytes = new Map(
      retained.map((entry) => [
        entry.path,
        fs.readFileSync(path.join(ownerProject.generatedRoot(), entry.path)),
      ]),
    );
    const smaller: IAutoMovieGeneratedManifest = {
      ...oldManifest,
      files: retained,
    };
    ownerProject.commitGenerated(retainedBytes, smaller);
    TestValidator.predicate(
      "generated commit deletes formerly declared stale files",
      fs.existsSync(
        path.join(ownerProject.generatedRoot(), "shots/opening.json"),
      ) === false,
    );
    TestValidator.predicate(
      "generated and render writes cannot escape owned roots",
      throws(() =>
        ownerProject.commitGenerated(
          new Map([["../escape", Buffer.from("x")]]),
          oldManifest,
        ),
      ) &&
        throws(() =>
          ownerProject.commitRenderBundle("../escape", new Map(), {
            version: 2,
            target: { kind: "shot", id: "opening" },
            compileFingerprint: oldManifest.inputFingerprint,
            rendererIdentity: "test:png-v1",
            targetFingerprint: productionRenderTargetFingerprint(
              ownerProject,
              oldManifest,
              { kind: "shot", id: "opening" },
            ),
            renderSpec: {
              target: "opening",
              frameFormat: { width: 1, height: 1, fps: 1 },
              toneMapping: "none",
              codec: "h264",
              pixelFormat: "yuv420p",
              crf: 17,
            },
            frames: [],
          }),
        ),
    );

    const renderImage = new PNG({ width: 1, height: 1 });
    renderImage.data.fill(200);
    const renderImageBytes = PNG.sync.write(renderImage);
    const renderManifest: IAutoMovieRenderBundleManifest = {
      version: 2,
      target: { kind: "shot", id: "opening" },
      compileFingerprint: oldManifest.inputFingerprint,
      rendererIdentity: "test:png-v1",
      targetFingerprint: productionRenderTargetFingerprint(
        ownerProject,
        oldManifest,
        { kind: "shot", id: "opening" },
      ),
      renderSpec: {
        target: "opening",
        frameFormat: { width: 1, height: 1, fps: 1 },
        toneMapping: "none",
        codec: "h264",
        pixelFormat: "yuv420p",
        crf: 17,
      },
      frames: [
        {
          index: 0,
          time: 0,
          pass: "beauty",
          path: "frame.png",
          digest: digestAutoMovieBytes(renderImageBytes),
          width: 1,
          height: 1,
        },
      ],
    };
    const renderBundle = productionRenderBundleRelativePath(renderManifest);
    const blankRendererRefused = throws(() =>
      ownerProject.commitRenderBundle(renderBundle, new Map(), {
        ...renderManifest,
        rendererIdentity: " ",
      }),
    );
    const revision = ownerProject.commitRenderBundle(
      renderBundle,
      new Map([
        ["frame.bin", Buffer.from("frame")],
        ["frame.png", renderImageBytes],
      ]),
      renderManifest,
    );
    TestValidator.predicate(
      "render bundle commits bytes and manifest atomically",
      blankRendererRefused &&
        revision > 0 &&
        fs.existsSync(
          path.join(ownerProject.renderRoot(), renderBundle, "manifest.json"),
        ),
    );
    let inputGuardReads = 0;
    const guardedRevision = ownerProject.revision();
    const guardedCommitRefused = throws(() =>
      ownerProject.commitRenderBundle(
        renderBundle,
        new Map([
          ["frame.bin", Buffer.from("guarded-change")],
          ["frame.png", renderImageBytes],
        ]),
        renderManifest,
        () => inputGuardReads++ === 0,
      ),
    );
    TestValidator.predicate(
      "guarded render commit rolls back when inputs change during apply",
      guardedCommitRefused &&
        inputGuardReads === 2 &&
        ownerProject.revision() === guardedRevision &&
        fs
          .readFileSync(
            path.join(ownerProject.renderRoot(), renderBundle, "frame.bin"),
          )
          .equals(Buffer.from("frame")),
    );
    const renderFramePath = path.join(
      ownerProject.renderRoot(),
      renderBundle,
      "frame.bin",
    );
    const renderManifestPath = path.join(
      ownerProject.renderRoot(),
      renderBundle,
      "manifest.json",
    );
    TestValidator.predicate(
      "render manifest is bound to its MCP-owned receipt",
      ownerProject.verifiedRenderManifest(renderManifestPath) !== null,
    );
    const renderImagePath = path.join(
      ownerProject.renderRoot(),
      renderBundle,
      "frame.png",
    );
    fs.writeFileSync(renderImagePath, Buffer.from("tampered"));
    const tamperedRenderFrame =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    fs.writeFileSync(renderImagePath, renderImageBytes);
    fs.rmSync(renderImagePath);
    const missingRenderFrame =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    fs.writeFileSync(renderImagePath, renderImageBytes);
    TestValidator.predicate(
      "manifest ownership includes every declared frame's current PNG bytes",
      tamperedRenderFrame === null && missingRenderFrame === null,
    );
    const renderReceiptDirectory = path.join(
      fixture.root,
      ".automovie/render-receipts",
    );
    const renderReceiptPath = path.join(
      renderReceiptDirectory,
      fs.readdirSync(renderReceiptDirectory)[0]!,
    );
    const renderManifestBytes = fs.readFileSync(renderManifestPath);
    const renderReceiptBytes = fs.readFileSync(renderReceiptPath);
    const writeOwnedRenderManifest = (
      manifest: IAutoMovieRenderBundleManifest,
    ): void => {
      const serialized = Buffer.from(`${JSON.stringify(manifest)}\n`);
      fs.writeFileSync(renderManifestPath, serialized);
      fs.writeFileSync(
        renderReceiptPath,
        `${JSON.stringify({
          version: 1,
          bundle: renderBundle,
          manifestDigest: digestAutoMovieBytes(serialized),
        })}\n`,
      );
    };
    writeOwnedRenderManifest({
      ...renderManifest,
      rendererIdentity: " ",
    });
    const blankOwnedRenderer =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    writeOwnedRenderManifest({
      ...renderManifest,
      frames: [renderManifest.frames[0]!, renderManifest.frames[0]!],
    });
    const duplicateRenderFrame =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    writeOwnedRenderManifest({
      ...renderManifest,
      frames: [{ ...renderManifest.frames[0]!, width: 2 }],
    });
    const mismatchedRenderWidth =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    writeOwnedRenderManifest({
      ...renderManifest,
      frames: [{ ...renderManifest.frames[0]!, height: 2 }],
    });
    const mismatchedRenderHeight =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    fs.writeFileSync(renderManifestPath, renderManifestBytes);
    fs.writeFileSync(renderReceiptPath, renderReceiptBytes);
    TestValidator.predicate(
      "render verification rejects duplicate frame ownership and false raster metadata",
      blankOwnedRenderer === null &&
        duplicateRenderFrame === null &&
        mismatchedRenderWidth === null &&
        mismatchedRenderHeight === null,
    );
    const nonCanonicalManifest = path.join(
      ownerProject.renderRoot(),
      "non-canonical",
      "manifest.json",
    );
    fs.mkdirSync(path.dirname(nonCanonicalManifest), { recursive: true });
    fs.writeFileSync(nonCanonicalManifest, renderManifestBytes);
    TestValidator.predicate(
      "render verification refuses absent, non-file, external and non-canonical manifests",
      ownerProject.verifiedRenderManifest(
        path.join(ownerProject.renderRoot(), "absent.json"),
      ) === null &&
        ownerProject.verifiedRenderManifest(ownerProject.renderRoot()) ===
          null &&
        ownerProject.verifiedRenderManifest(
          path.join(fixture.root, "package.json"),
        ) === null &&
        ownerProject.verifiedRenderManifest(nonCanonicalManifest) === null,
    );
    fs.writeFileSync(renderManifestPath, "{}");
    const invalidRenderManifest =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    fs.writeFileSync(renderManifestPath, "{bad");
    const malformedRenderManifest =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    fs.writeFileSync(renderManifestPath, renderManifestBytes);
    fs.rmSync(renderReceiptPath);
    const missingRenderReceipt =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    for (const receipt of [
      { version: 0, bundle: renderBundle, manifestDigest: "sha256:bad" },
      {
        version: 1,
        bundle: "wrong-bundle",
        manifestDigest: digestAutoMovieBytes(renderManifestBytes),
      },
      { version: 1, bundle: renderBundle, manifestDigest: "sha256:bad" },
    ]) {
      fs.writeFileSync(renderReceiptPath, JSON.stringify(receipt));
      TestValidator.equals(
        "render verification rejects a mismatched receipt field",
        ownerProject.verifiedRenderManifest(renderManifestPath),
        null,
      );
    }
    fs.writeFileSync(renderReceiptPath, "{bad");
    const malformedRenderReceipt =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    fs.writeFileSync(renderReceiptPath, renderReceiptBytes);
    TestValidator.predicate(
      "render verification validates manifest schema, JSON and receipt ownership",
      invalidRenderManifest === null &&
        malformedRenderManifest === null &&
        missingRenderReceipt === null &&
        malformedRenderReceipt === null &&
        ownerProject.verifiedRenderManifest(renderManifestPath) !== null,
    );
    TestValidator.predicate(
      "render reads reject absent paths and directories",
      throws(() => ownerProject.readRenderFile("absent.bin")) &&
        throws(() => ownerProject.readRenderFile(renderBundle)),
    );
    const outsideRenderRead = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-render-read-"),
    );
    const renderReadJunction = path.join(
      ownerProject.renderRoot(),
      "read-junction",
    );
    fs.writeFileSync(path.join(outsideRenderRead, "escape.bin"), "escape");
    fs.symlinkSync(outsideRenderRead, renderReadJunction, "junction");
    TestValidator.predicate(
      "render reads reject nested junction escapes",
      throws(() => ownerProject.readRenderFile("read-junction/escape.bin")),
    );
    fs.rmSync(renderReadJunction);
    fs.rmSync(outsideRenderRead, { force: true, recursive: true });
    const deliverableFiles = ownerProject.commitProductionDeliverableFiles(
      "feature*CON",
      new Map([
        ["z.bin", Buffer.from("z")],
        ["nested/a.bin", Buffer.from("a")],
      ]),
    );
    TestValidator.predicate(
      "deliverable commits are nonempty, sorted and renderer-owned",
      deliverableFiles.paths[0]?.endsWith("nested/a.bin") === true &&
        deliverableFiles.paths[1]?.endsWith("z.bin") === true &&
        deliverableFiles.paths.every((file) =>
          fs.existsSync(path.join(ownerProject.renderRoot(), file)),
        ) &&
        throws(() =>
          ownerProject.commitProductionDeliverableFiles("empty", new Map()),
        ) &&
        throws(() =>
          ownerProject.commitProductionDeliverableFiles(
            "unsafe",
            new Map([["../escape.bin", Buffer.from("x")]]),
          ),
        ) &&
        throws(() =>
          ownerProject.commitProductionDeliverableFiles(
            "duplicate",
            new Map([
              ["nested/../same.bin", Buffer.from("first")],
              ["same.bin", Buffer.from("second")],
            ]),
          ),
        ) &&
        throws(() =>
          ownerProject.commitProductionDeliverableFiles(
            "case-collision",
            new Map([
              ["Frame.bin", Buffer.from("first")],
              ["frame.bin", Buffer.from("second")],
            ]),
          ),
        ),
    );
    TestValidator.predicate(
      "aggregate render commit validates its public schema",
      throws(() => ownerProject.commitProductionRenderManifest({} as never)),
    );
    const frameBeforeFailure = fs.readFileSync(renderFramePath);
    const manifestBeforeFailure = fs.readFileSync(renderManifestPath);
    const revisionBeforeFailure = ownerProject.revision();
    const renameSync = fs.renameSync;
    fs.renameSync = ((oldPath, newPath) => {
      if (String(newPath) === renderManifestPath)
        throw new Error("injected manifest rename failure");
      return renameSync(oldPath, newPath);
    }) as typeof fs.renameSync;
    try {
      TestValidator.predicate(
        "multi-file commit rolls back updated and newly created files",
        throws(() =>
          ownerProject.commitRenderBundle(
            renderBundle,
            new Map([
              ["frame.bin", Buffer.from("changed")],
              ["new.bin", Buffer.from("new")],
            ]),
            renderManifest,
          ),
        ) &&
          fs.readFileSync(renderFramePath).equals(frameBeforeFailure) &&
          fs.readFileSync(renderManifestPath).equals(manifestBeforeFailure) &&
          fs.existsSync(
            path.join(ownerProject.renderRoot(), renderBundle, "new.bin"),
          ) === false &&
          ownerProject.revision() === revisionBeforeFailure,
      );
    } finally {
      fs.renameSync = renameSync;
    }
    let renameFailures = 0;
    fs.renameSync = ((oldPath, newPath) => {
      const target = String(newPath);
      if (
        (renameFailures === 0 && target === renderManifestPath) ||
        (renameFailures === 1 && target === renderFramePath)
      ) {
        ++renameFailures;
        throw new Error(`injected rename failure ${renameFailures}`);
      }
      return renameSync(oldPath, newPath);
    }) as typeof fs.renameSync;
    try {
      let aggregate = false;
      try {
        ownerProject.commitRenderBundle(
          renderBundle,
          new Map([["frame.bin", Buffer.from("changed-again")]]),
          renderManifest,
        );
      } catch (error) {
        aggregate = error instanceof AggregateError;
      }
      TestValidator.predicate(
        "rollback failure is surfaced as an aggregate instead of hidden",
        aggregate && ownerProject.revision() === revisionBeforeFailure,
      );
    } finally {
      fs.renameSync = renameSync;
      fs.writeFileSync(renderFramePath, frameBeforeFailure);
      fs.writeFileSync(renderManifestPath, manifestBeforeFailure);
    }
    fs.rmSync(renderFramePath);
    const outsideRenderTarget = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-render-target-"),
    );
    fs.symlinkSync(outsideRenderTarget, renderFramePath, "junction");
    TestValidator.predicate(
      "commit target cannot be replaced through a symlink or junction",
      throws(() =>
        ownerProject.commitRenderBundle(
          renderBundle,
          new Map([["frame.bin", Buffer.from("unsafe")]]),
          renderManifest,
        ),
      ),
    );
    fs.rmSync(renderFramePath, { force: true, recursive: true });
    fs.rmSync(outsideRenderTarget, { force: true, recursive: true });
    const lstatSync = fs.lstatSync;
    Object.defineProperty(fs, "lstatSync", {
      configurable: true,
      value: ((filePath: fs.PathLike, options?: unknown) => {
        if (String(filePath).endsWith("denied.json")) {
          const error = new Error(
            "injected lstat denial",
          ) as NodeJS.ErrnoException;
          error.code = "EACCES";
          throw error;
        }
        return lstatSync(filePath, options as never);
      }) as typeof fs.lstatSync,
    });
    try {
      TestValidator.predicate(
        "non-missing lstat errors are not hidden as absent files",
        throws(() => ownerProject.readTrackedStateFile("denied.json")),
      );
    } finally {
      Object.defineProperty(fs, "lstatSync", {
        configurable: true,
        value: lstatSync,
      });
    }
    TestValidator.predicate(
      "all review target paths are owned and encoded",
      [
        { kind: "design" as const, design: { kind: "production" as const } },
        { kind: "design" as const, design: { kind: "world" as const } },
        {
          kind: "design" as const,
          design: { kind: "formation" as const, id: "line/name" },
        },
        { kind: "source" as const, path: "src/shots/opening.ts" },
        { kind: "shot" as const, id: "opening" },
        { kind: "film" as const, id: "fixture-film" },
      ].every((target) =>
        ownerProject
          .reviewPath(target)
          .startsWith(path.join(fixture.root, ".automovie/reviews")),
      ),
    );
    TestValidator.predicate(
      "blank encoded review identity is rejected",
      throws(() =>
        ownerProject.reviewPath({
          kind: "shot",
          id: " ",
        }),
      ),
    );
    const stored: IAutoMovieStoredReview = {
      version: 1,
      target: { kind: "source", path: "src/shots/opening.ts" },
      fingerprint: oldManifest.inputFingerprint,
      observations: "stored",
      checks: [],
      corrections: [],
      completionBasis: "stored",
      complete: false,
    };
    ownerProject.commitReview(stored);
    TestValidator.equals(
      "stored review round-trip",
      ownerProject.review(stored.target),
      stored,
    );
    TestValidator.equals(
      "missing review returns null",
      ownerProject.review({ kind: "shot", id: "absent" }),
      null,
    );
    TestValidator.predicate(
      "digest helper remains usable for owned bytes",
      digestAutoMovieBytes(Buffer.from("frame")).startsWith("sha256:"),
    );

    const modelDirectory = path.join(fixture.root, ".automovie/design/models");
    const encodedDuplicate = path.join(modelDirectory, "%73entinel.json");
    fs.writeFileSync(encodedDuplicate, JSON.stringify(modelRecipe()));
    TestValidator.predicate(
      "distinct filenames cannot decode to one design id",
      throws(() => ownerProject.graph()),
    );
    fs.rmSync(encodedDuplicate);
    const kelvin = { ...modelRecipe(), id: "K" };
    const lowerK = { ...modelRecipe(), id: "k" };
    fs.writeFileSync(
      path.join(modelDirectory, `${encodeURIComponent(kelvin.id)}.json`),
      JSON.stringify(kelvin),
    );
    fs.writeFileSync(
      path.join(modelDirectory, `${encodeURIComponent(lowerK.id)}.json`),
      JSON.stringify(lowerK),
    );
    TestValidator.predicate(
      "case-folding collisions are rejected even with distinct filenames",
      throws(() => ownerProject.graph()),
    );
    fs.rmSync(
      path.join(modelDirectory, `${encodeURIComponent(kelvin.id)}.json`),
    );
    fs.rmSync(
      path.join(modelDirectory, `${encodeURIComponent(lowerK.id)}.json`),
    );
    const vanished = path.join(modelDirectory, "vanished.json");
    fs.writeFileSync(
      vanished,
      JSON.stringify({ ...modelRecipe(), id: "vanished" }),
    );
    const residentReadFileSync = fs.readFileSync;
    fs.readFileSync = ((file: fs.PathOrFileDescriptor, ...args: unknown[]) => {
      if (path.resolve(String(file)) === path.resolve(vanished))
        fs.rmSync(vanished, { force: true });
      return (residentReadFileSync as (...parameters: unknown[]) => unknown)(
        file,
        ...args,
      );
    }) as typeof fs.readFileSync;
    try {
      TestValidator.predicate(
        "a design disappearing during inventory is a loud race",
        throws(() => ownerProject.graph()),
      );
    } finally {
      fs.readFileSync = residentReadFileSync;
    }
    const invalidTyped = path.join(modelDirectory, "invalid.json");
    fs.writeFileSync(invalidTyped, "null");
    TestValidator.predicate(
      "present JSON null is invalid typed design rather than absence",
      throws(() => ownerProject.graph()),
    );
    fs.rmSync(invalidTyped);
  } finally {
    fixture.dispose();
  }

  const contentFixture = productionFixture();
  try {
    const manifestPath = path.join(
      contentFixture.root,
      ".automovie/manifest.json",
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        ...manifest,
        contentRoots: ["viewer", "src"],
        contentFiles: ["automovie.config.ts", "missing-content.file"],
      }),
    );
    const contentProject = AutoMovieProductionProject.open(contentFixture.root);
    const inputs = contentProject.contentInputs();
    TestValidator.predicate(
      "declared content roots and files enter deterministic compilation identity",
      inputs.some(
        (input) => input.path === "viewer/src/main.ts" && input.bytes !== null,
      ) &&
        inputs.some(
          (input) =>
            input.path === "automovie.config.ts" && input.bytes !== null,
        ) &&
        inputs.some(
          (input) =>
            input.path === "missing-content.file" && input.bytes === null,
        ) &&
        inputs.some(
          (input) =>
            input.path === "src/shots/opening.ts" &&
            input.source &&
            input.render,
        ),
    );
    const outsideContent = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-content-junction-"),
    );
    const nestedContentJunction = path.join(
      contentFixture.root,
      "viewer",
      "linked",
    );
    fs.writeFileSync(path.join(outsideContent, "escape.ts"), "export {};\n");
    fs.symlinkSync(outsideContent, nestedContentJunction, "junction");
    TestValidator.predicate(
      "declared content inventory refuses nested junctions",
      throws(() => contentProject.contentInputs()),
    );
    fs.rmSync(nestedContentJunction);
    fs.rmSync(outsideContent, { force: true, recursive: true });
    const racedOutside = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-content-race-"),
    );
    const racedOutsideFile = path.join(racedOutside, "outside.ts");
    fs.writeFileSync(racedOutsideFile, "export {};\n");
    const viewerRoot = path.join(contentFixture.root, "viewer");
    const viewerFile = path.join(viewerRoot, "src/main.ts");
    const residentRealpathSync = fs.realpathSync;
    const withRacedRealpath = (
      select: (absolute: string, occurrence: number) => string | null,
    ): boolean => {
      const occurrences = new Map<string, number>();
      Reflect.set(
        fs,
        "realpathSync",
        (candidate: fs.PathLike, ...args: unknown[]) => {
          const absolute = path.resolve(String(candidate));
          const occurrence = (occurrences.get(absolute) ?? 0) + 1;
          occurrences.set(absolute, occurrence);
          const replacement = select(absolute, occurrence);
          return replacement === null
            ? (
                residentRealpathSync as (
                  file: fs.PathLike,
                  ...options: unknown[]
                ) => unknown
              )(candidate, ...args)
            : replacement;
        },
      );
      try {
        return throws(() => contentProject.contentInputs());
      } finally {
        Reflect.set(fs, "realpathSync", residentRealpathSync);
      }
    };
    try {
      TestValidator.predicate(
        "a content root cannot race its physical-root realpath outside the project",
        withRacedRealpath((absolute, occurrence) =>
          absolute === path.resolve(viewerRoot) && occurrence === 1
            ? racedOutside
            : null,
        ),
      );
      TestValidator.predicate(
        "a traversed content directory cannot race from its verified physical root",
        withRacedRealpath((absolute, occurrence) =>
          absolute === path.resolve(viewerRoot) && occurrence === 2
            ? racedOutside
            : null,
        ),
      );
      TestValidator.predicate(
        "a content file cannot race its lstat into an external realpath",
        withRacedRealpath((absolute) =>
          absolute === path.resolve(viewerFile) ? racedOutsideFile : null,
        ),
      );
      fs.rmSync(viewerRoot, { recursive: true });
      fs.writeFileSync(viewerRoot, "not a directory");
      TestValidator.predicate(
        "a declared content root replaced after project open is refused",
        throws(() => contentProject.contentInputs()),
      );
    } finally {
      fs.rmSync(racedOutside, { force: true, recursive: true });
    }
  } finally {
    contentFixture.dispose();
  }

  const nestedContentFileFixture = productionFixture();
  const outsideContentFile = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-content-file-junction-"),
  );
  try {
    fs.writeFileSync(
      path.join(outsideContentFile, "escape.ts"),
      "export {};\n",
    );
    fs.symlinkSync(
      outsideContentFile,
      path.join(nestedContentFileFixture.root, "linked-content-file"),
      "junction",
    );
    const manifestPath = path.join(
      nestedContentFileFixture.root,
      ".automovie/manifest.json",
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        ...manifest,
        contentFiles: ["linked-content-file/escape.ts"],
      }),
    );
    const contentProject = AutoMovieProductionProject.open(
      nestedContentFileFixture.root,
    );
    TestValidator.predicate(
      "declared content files cannot escape through an intermediate junction",
      throws(() => contentProject.contentInputs()),
    );
  } finally {
    nestedContentFileFixture.dispose();
    fs.rmSync(outsideContentFile, { force: true, recursive: true });
  }

  const parentJunctionFixture = productionFixture();
  const outsideContentRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-content-root-junction-"),
  );
  try {
    fs.mkdirSync(path.join(outsideContentRoot, "viewer"));
    fs.writeFileSync(
      path.join(outsideContentRoot, "viewer", "escape.ts"),
      "export {};\n",
    );
    fs.symlinkSync(
      outsideContentRoot,
      path.join(parentJunctionFixture.root, "linked-content-root"),
      "junction",
    );
    const manifestPath = path.join(
      parentJunctionFixture.root,
      ".automovie/manifest.json",
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        ...manifest,
        contentRoots: ["linked-content-root/viewer"],
      }),
    );
    TestValidator.predicate(
      "a declared content root cannot escape through a parent junction",
      throws(() => AutoMovieProductionProject.open(parentJunctionFixture.root)),
    );
  } finally {
    parentJunctionFixture.dispose();
    fs.rmSync(outsideContentRoot, { force: true, recursive: true });
  }

  for (const [name, contentRoots, contentFiles, prepare] of [
    [
      "missing-root",
      ["missing-content"],
      [],
      (_root: string): void => undefined,
    ],
    [
      "file-root",
      ["automovie.config.ts"],
      [],
      (_root: string): void => undefined,
    ],
    ["directory-file", [], ["viewer"], (_root: string): void => undefined],
    [
      "junction-file",
      [],
      ["linked-content"],
      (root: string): void => {
        fs.symlinkSync(
          path.join(root, "viewer"),
          path.join(root, "linked-content"),
          "junction",
        );
      },
    ],
  ] as const) {
    const invalidContent = productionFixture();
    try {
      prepare(invalidContent.root);
      const manifestPath = path.join(
        invalidContent.root,
        ".automovie/manifest.json",
      );
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      fs.writeFileSync(
        manifestPath,
        JSON.stringify({ ...manifest, contentRoots, contentFiles }),
      );
      TestValidator.predicate(
        `declared content rejects ${name}`,
        throws(() =>
          AutoMovieProductionProject.open(invalidContent.root).contentInputs(),
        ),
      );
    } finally {
      invalidContent.dispose();
    }
  }

  const replacedOwner = productionFixture();
  try {
    const ownerProject = AutoMovieProductionProject.open(replacedOwner.root);
    fs.rmSync(ownerProject.renderRoot(), { recursive: true });
    fs.symlinkSync(
      path.join(replacedOwner.root, "viewer"),
      path.join(replacedOwner.root, "renders"),
      "junction",
    );
    TestValidator.predicate(
      "an owned root replaced by an internal junction cannot receive writes",
      throws(() =>
        ownerProject.commitProductionDeliverableFiles(
          "unsafe-owner",
          new Map([["frame.bin", Buffer.from("x")]]),
        ),
      ),
    );
  } finally {
    replacedOwner.dispose();
  }

  const invalidRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-production-root-"),
  );
  try {
    const fileRoot = path.join(invalidRoot, "file");
    fs.writeFileSync(fileRoot, "x");
    TestValidator.predicate(
      "project root must be a directory",
      throws(() => AutoMovieProductionProject.open(fileRoot)),
    );
    TestValidator.predicate(
      "project root must not be a filesystem root",
      throws(() =>
        AutoMovieProductionProject.open(path.parse(invalidRoot).root),
      ),
    );
    const fresh = path.join(invalidRoot, "fresh");
    const initialized = AutoMovieProductionProject.open(fresh);
    TestValidator.predicate(
      "fresh project initializes format and directories",
      initialized.summary().initialized &&
        initialized.revision() === 0 &&
        initialized.inventory().production === false &&
        initialized.contentInputs().length === 0,
    );
    TestValidator.predicate(
      "every absent design discriminator returns one missing mutation",
      [
        { kind: "production" as const },
        { kind: "model" as const, id: "absent" },
        { kind: "world" as const },
        { kind: "formation" as const, id: "absent" },
        { kind: "shot" as const, id: "absent" },
        { kind: "acceptance" as const, id: "absent" },
      ].every(
        (target) =>
          initialized.eraseDesignArtifact(target).diagnostics[0]?.code ===
          "design-missing",
      ),
    );

    for (const value of [
      "{bad",
      "null",
      '{"formatVersion":1}',
      '{"formatVersion":2,"projectId":"","sourceRoots":[],"generatedRoot":"g","renderRoot":"r"}',
    ]) {
      const root = path.join(invalidRoot, `manifest-${Math.random()}`);
      fs.mkdirSync(path.join(root, ".automovie"), { recursive: true });
      fs.writeFileSync(path.join(root, ".automovie/manifest.json"), value);
      TestValidator.predicate(
        "invalid manifest is rejected",
        throws(() => AutoMovieProductionProject.open(root)),
      );
    }
    const invalidOwnedRoot = path.join(invalidRoot, "absolute-owned");
    fs.mkdirSync(path.join(invalidOwnedRoot, ".automovie"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(invalidOwnedRoot, ".automovie/manifest.json"),
      JSON.stringify({
        formatVersion: 2,
        projectId: "x",
        sourceRoots: ["src"],
        generatedRoot: path.resolve(invalidRoot, "outside"),
        renderRoot: "renders",
      }),
    );
    TestValidator.predicate(
      "manifest-owned roots must be relative",
      throws(() => AutoMovieProductionProject.open(invalidOwnedRoot)),
    );
    for (const [name, ownership] of [
      [
        "blank-generated",
        { sourceRoots: ["src"], generatedRoot: "", renderRoot: "renders" },
      ],
      [
        "absolute-source",
        {
          sourceRoots: ["/src"],
          generatedRoot: "generated",
          renderRoot: "renders",
        },
      ],
      [
        "drive-source",
        {
          sourceRoots: ["C:/src"],
          generatedRoot: "generated",
          renderRoot: "renders",
        },
      ],
      [
        "drive-relative-source",
        {
          sourceRoots: ["C:src"],
          generatedRoot: "generated",
          renderRoot: "renders",
        },
      ],
      [
        "parent-source",
        {
          sourceRoots: ["../src"],
          generatedRoot: "generated",
          renderRoot: "renders",
        },
      ],
      [
        "backslash-source",
        {
          sourceRoots: ["src\\shots"],
          generatedRoot: "generated",
          renderRoot: "renders",
        },
      ],
      [
        "dot-source",
        {
          sourceRoots: ["src/../src"],
          generatedRoot: "generated",
          renderRoot: "renders",
        },
      ],
      [
        "case-source",
        {
          sourceRoots: ["src", "SRC"],
          generatedRoot: "generated",
          renderRoot: "renders",
        },
      ],
      [
        "cross-case-content",
        {
          sourceRoots: ["src"],
          generatedRoot: "generated",
          renderRoot: "renders",
          contentRoots: ["SRC"],
        },
      ],
      [
        "duplicate-content-file",
        {
          sourceRoots: ["src"],
          generatedRoot: "generated",
          renderRoot: "renders",
          contentFiles: ["config.ts", "config.ts"],
        },
      ],
      [
        "trailing-content-file",
        {
          sourceRoots: ["src"],
          generatedRoot: "generated",
          renderRoot: "renders",
          contentFiles: ["viewer/"],
        },
      ],
      [
        "project-root",
        { sourceRoots: ["src"], generatedRoot: ".", renderRoot: "renders" },
      ],
      [
        "reserved-state",
        {
          sourceRoots: ["src"],
          generatedRoot: ".automovie/generated",
          renderRoot: "renders",
        },
      ],
      [
        "source-generated-overlap",
        {
          sourceRoots: ["src"],
          generatedRoot: "src/generated",
          renderRoot: "renders",
        },
      ],
      [
        "source-source-overlap",
        {
          sourceRoots: ["src", "src/shots"],
          generatedRoot: "generated",
          renderRoot: "renders",
        },
      ],
      [
        "generated-render-overlap",
        {
          sourceRoots: ["src"],
          generatedRoot: "output",
          renderRoot: "output/renders",
        },
      ],
      [
        "content-root-project",
        {
          sourceRoots: ["src"],
          generatedRoot: "generated",
          renderRoot: "renders",
          contentRoots: ["."],
        },
      ],
      [
        "content-root-state",
        {
          sourceRoots: ["src"],
          generatedRoot: "generated",
          renderRoot: "renders",
          contentRoots: [".automovie/design"],
        },
      ],
      [
        "content-file-generated",
        {
          sourceRoots: ["src"],
          generatedRoot: "generated",
          renderRoot: "renders",
          contentFiles: ["generated/output.json"],
        },
      ],
    ] as const) {
      const root = path.join(invalidRoot, `ownership-${name}`);
      fs.mkdirSync(path.join(root, ".automovie"), { recursive: true });
      fs.writeFileSync(
        path.join(root, ".automovie/manifest.json"),
        JSON.stringify({
          formatVersion: 2,
          projectId: name,
          ...ownership,
        }),
      );
      TestValidator.predicate(
        `manifest ownership layout rejects ${name}`,
        throws(() => AutoMovieProductionProject.open(root)),
      );
    }

    const junctionOutside = path.join(invalidRoot, "junction-outside");
    fs.mkdirSync(junctionOutside);
    const junctionRoot = path.join(invalidRoot, "junction-owned-root");
    fs.mkdirSync(path.join(junctionRoot, ".automovie"), { recursive: true });
    fs.writeFileSync(
      path.join(junctionRoot, ".automovie/manifest.json"),
      JSON.stringify({
        formatVersion: 2,
        projectId: "junction-owned-root",
        sourceRoots: ["src"],
        generatedRoot: "generated",
        renderRoot: "renders",
      }),
    );
    fs.symlinkSync(
      junctionOutside,
      path.join(junctionRoot, "generated"),
      "junction",
    );
    TestValidator.predicate(
      "compiler-owned root cannot escape through a junction",
      throws(() => AutoMovieProductionProject.open(junctionRoot)),
    );
    const internalAlias = productionFixture();
    try {
      fs.rmSync(path.join(internalAlias.root, "generated"), {
        force: true,
        recursive: true,
      });
      fs.symlinkSync(
        path.join(internalAlias.root, "viewer"),
        path.join(internalAlias.root, "generated"),
        "junction",
      );
      TestValidator.predicate(
        "owned roots cannot alias another project directory through a junction",
        throws(() => AutoMovieProductionProject.open(internalAlias.root)),
      );
    } finally {
      internalAlias.dispose();
    }

    const stateOutside = path.join(invalidRoot, "state-outside");
    const stateJunctionRoot = path.join(invalidRoot, "state-junction-root");
    fs.mkdirSync(stateOutside);
    fs.mkdirSync(stateJunctionRoot);
    fs.symlinkSync(
      stateOutside,
      path.join(stateJunctionRoot, ".automovie"),
      "junction",
    );
    TestValidator.predicate(
      "reserved state cannot escape through a junction",
      throws(() => AutoMovieProductionProject.open(stateJunctionRoot)) &&
        fs.readdirSync(stateOutside).length === 0,
    );

    const invalidIncarnationRoot = path.join(
      invalidRoot,
      "invalid-incarnation",
    );
    AutoMovieProductionProject.open(invalidIncarnationRoot);
    const incarnationPath = path.join(
      invalidIncarnationRoot,
      ".automovie/incarnation.json",
    );
    for (const value of [
      { version: 2, id: "7b2e2389-a246-4df2-94fb-f48e9bb90d51" },
      { version: 1, id: 42 },
      { version: 1, id: "not-a-uuid" },
    ]) {
      fs.writeFileSync(incarnationPath, JSON.stringify(value));
      TestValidator.predicate(
        "invalid production incarnation is rejected",
        throws(
          () => AutoMovieProductionProject.open(invalidIncarnationRoot),
          "Invalid production state incarnation",
        ),
      );
    }

    const malformedDesign = productionFixture();
    try {
      fs.writeFileSync(
        path.join(malformedDesign.root, ".automovie/design/models/%ZZ.json"),
        JSON.stringify(modelRecipe()),
      );
      TestValidator.predicate(
        "malformed encoded design filename is rejected",
        throws(() =>
          AutoMovieProductionProject.open(malformedDesign.root).graph(),
        ),
      );
      fs.rmSync(
        path.join(malformedDesign.root, ".automovie/design/models/%ZZ.json"),
      );
      fs.writeFileSync(
        path.join(malformedDesign.root, ".automovie/design/world.json"),
        "{bad",
      );
      TestValidator.predicate(
        "invalid design JSON is rejected",
        throws(() =>
          AutoMovieProductionProject.open(malformedDesign.root).graph(),
        ),
      );
    } finally {
      malformedDesign.dispose();
    }

    const invalidRevision = productionFixture();
    try {
      fs.writeFileSync(
        path.join(invalidRevision.root, ".automovie/revision.json"),
        '{"revision":-1}',
      );
      TestValidator.predicate(
        "revision must be a non-negative safe integer",
        throws(() => AutoMovieProductionProject.open(invalidRevision.root)),
      );
    } finally {
      invalidRevision.dispose();
    }
  } finally {
    fs.rmSync(invalidRoot, { force: true, recursive: true });
  }
};
