import {
  AutoMovieProductionFrameCapture,
  IAutoMovieAssetManifest,
  IAutoMovieCaptureFrame,
  IAutoMovieGetGuideDocument,
  IAutoMoviePrepareReview,
  IAutoMovieRepaintShot,
  IAutoMovieReviewTarget,
  IAutoMovieSubmitReview,
} from "@automovie/interface";
import {
  AUTOMOVIE_PRODUCTION_GUIDE_NAMES,
  AUTOMOVIE_REPAINT_GUIDE,
  AUTOMOVIE_REVIEW_GUIDES,
  AUTOMOVIE_TOOL_GUIDES,
  AutoMovieApplication,
  AutoMovieProductionProject,
  compileAutoMovieProduction,
  createAutoMovieMcpServer,
  digestAutoMovieBytes,
  inspectAutoMovieProduction,
  openAutoMovieProduction,
} from "@automovie/mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

import {
  productionDesign,
  productionFixture,
  shotContract,
  testCaptureRuntimeIdentity,
} from "./productionFixtures";
import { productionH264Mp4 } from "./productionMediaFixtures";

interface IFiveToolContract {
  getGuideDocument(
    props: IAutoMovieGetGuideDocument.IProps,
  ): IAutoMovieGetGuideDocument;
  captureFrame(
    props: IAutoMovieCaptureFrame.IProps,
  ): Promise<IAutoMovieCaptureFrame>;
  repaintShot(
    props: IAutoMovieRepaintShot.IProps,
  ): Promise<IAutoMovieRepaintShot>;
  prepareReview(props: IAutoMoviePrepareReview.IProps): IAutoMoviePrepareReview;
  submitReview(props: IAutoMovieSubmitReview.IProps): IAutoMovieSubmitReview;
}

const rejected = async (
  closure: () => Promise<unknown>,
): Promise<string | null> => {
  try {
    await closure();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const directorySnapshot = (root: string): string[] => {
  const entries: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (entry.isDirectory()) {
        entries.push(`directory:${relative}`);
        visit(absolute);
      } else
        entries.push(
          `file:${relative}:${digestAutoMovieBytes(fs.readFileSync(absolute))}`,
        );
    }
  };
  visit(root);
  return entries;
};

/** The public MCP boundary is exactly knowledge, evidence, and judgment. */
export const test_mcp_production_application = async (): Promise<void> => {
  const fixture = productionFixture();
  try {
    const productionPath = path.join(
      fixture.root,
      ".automovie/design/production.json",
    );
    const production = JSON.parse(
      fs.readFileSync(productionPath, "utf8"),
    ) as ReturnType<typeof productionDesign>;
    production.frameFormat.fps = 2;
    production.visualDelivery = "repainted";
    production.deliverables = production.deliverables.map((deliverable) => ({
      ...deliverable,
      required: deliverable.kind === "feature",
    }));
    fs.writeFileSync(
      productionPath,
      `${JSON.stringify(production, null, 2)}\n`,
    );
    const assetManifestPath = path.join(fixture.root, ".automovie/assets.json");
    const assetManifest = JSON.parse(
      fs.readFileSync(assetManifestPath, "utf8"),
    ) as IAutoMovieAssetManifest;
    const reference = assetManifest.assets[0]!;
    reference.uses.push({
      production: "fixture-film",
      consumer: { kind: "rendition-reference", id: "opening" },
      reason: "Fixed style reference for the opening shot rendition.",
    });
    const restrictedReference = structuredClone(reference);
    restrictedReference.path = "public/audio/non-rendition-reference-stem.json";
    restrictedReference.uses = [
      {
        production: "fixture-film",
        consumer: { kind: "audio-cue", id: "restricted-guide" },
        reason: "Audio-only guide stem that repaint must never disclose.",
      },
      {
        production: "second-film",
        consumer: { kind: "audio-cue", id: "restricted-guide" },
        reason: "Second production reuses the same audio-only guide stem.",
      },
    ];
    assetManifest.assets.push(restrictedReference);
    assetManifest.assets.sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    );
    fs.copyFileSync(
      path.join(fixture.root, reference.path),
      path.join(fixture.root, restrictedReference.path),
    );
    fs.writeFileSync(
      assetManifestPath,
      `${JSON.stringify(assetManifest, null, 2)}\n`,
    );
    const filmPath = path.join(fixture.root, "src/film.ts");
    fs.writeFileSync(
      filmPath,
      fs.readFileSync(filmPath, "utf8").replace(
        "audio: [],",
        `audio: [{
          id: "restricted-guide",
          asset: "public/audio/non-rendition-reference-stem.json",
          sourceDuration: { seconds: 11.5 },
          sourceOffset: { frame: 0 },
          start: { frame: 0 },
          duration: { seconds: 6 },
          gain: 0,
          fadeIn: { frame: 0 },
          fadeOut: { frame: 0 },
          bus: "ambience",
        }],`,
      ),
    );

    const capturedProductionIds: string[] = [];
    const capture = async (
      input: Parameters<AutoMovieProductionFrameCapture>[0],
    ) => {
      capturedProductionIds.push(input.productionId);
      const image = new PNG({
        width: input.width ?? 16,
        height: input.height ?? 16,
      });
      image.data.fill(180);
      image.data[0] = input.productionId === "fixture-film" ? 20 : 40;
      return {
        bytes: PNG.sync.write(image),
        runtimeIdentity: testCaptureRuntimeIdentity(),
        width: image.width,
        height: image.height,
      };
    };
    const first = openAutoMovieProduction({
      projectRoot: fixture.root,
      productionId: "fixture-film",
      capture,
    });
    const firstCompile = compileAutoMovieProduction({
      projectRoot: fixture.root,
      productionId: "fixture-film",
      scope: "source",
    });
    if (firstCompile.success === false)
      throw new Error(
        `The non-MCP compiler API failed its first registered production:\n${JSON.stringify(firstCompile.diagnostics, null, 2)}`,
      );
    const firstRegistry = AutoMovieProductionProject.registeredProductionIds(
      fixture.root,
    );
    TestValidator.predicate(
      "the non-MCP compiler API compiles the first registered production",
      firstRegistry.length === 1 && firstRegistry[0] === "fixture-film",
    );
    TestValidator.predicate(
      "the non-MCP inspection API reports current compiled ownership",
      inspectAutoMovieProduction(first).source.missing.length === 0 &&
        inspectAutoMovieProduction(first).source.unownedGenerated.length === 0,
    );
    const secondProject = AutoMovieProductionProject.open(
      fixture.root,
      "second-film",
    );
    TestValidator.predicate(
      "a second production binds the same source registry independently",
      secondProject.setProductionDesign(
        productionDesign({
          id: "second-film",
          title: "second-film",
          visualDelivery: "deterministic",
        }),
      ).accepted &&
        secondProject.setShotContract(shotContract()).accepted &&
        openAutoMovieProduction({
          projectRoot: fixture.root,
          productionId: "second-film",
          capture,
        }).compiler.compile({ scope: "source" }).success,
    );

    const application = new AutoMovieApplication({
      projectRoot: path.join(fixture.root, "src"),
      productionId: "fixture-film",
      capture,
    });
    const paired: IFiveToolContract = application;
    TestValidator.predicate(
      "the application implements the five named props/result pairs",
      paired === application &&
        Object.keys(AUTOMOVIE_TOOL_GUIDES).join(",") ===
          "getGuideDocument,captureFrame,repaintShot,prepareReview,submitReview",
    );
    const gated = await rejected(() =>
      application.captureFrame({
        target: {
          kind: "shot",
          productionId: "fixture-film",
          id: "opening",
          time: 0,
        },
      }),
    );
    TestValidator.predicate(
      "missing knowledge is a plain recovery script with partial credit",
      gated?.includes("0/2 required guides") === true &&
        gated.includes('getGuideDocument({ name: "AUTOMOVIE_OVERALL" })') &&
        gated.includes('getGuideDocument({ name: "CAPTURE_FRAME" })') &&
        gated.includes("not a payload validation error"),
    );
    application.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
    const partiallyGated = await rejected(() =>
      application.captureFrame({
        target: {
          kind: "shot",
          productionId: "fixture-film",
          id: "opening",
          time: 0,
        },
      }),
    );
    TestValidator.predicate(
      "guide credit survives and the recovery script lists only missing reads",
      partiallyGated?.includes("1/2 required guides") === true &&
        partiallyGated.includes(
          'getGuideDocument({ name: "CAPTURE_FRAME" })',
        ) &&
        partiallyGated.includes(
          'getGuideDocument({ name: "AUTOMOVIE_OVERALL" })',
        ) === false,
    );
    application.getGuideDocument({ name: "CAPTURE_FRAME" });
    const reviewGated = await rejected(async () =>
      application.prepareReview({
        target: { kind: "asset", id: "sentinel" },
      }),
    );
    TestValidator.predicate(
      "review knowledge is selected from the exact target surface",
      reviewGated?.includes("1/2 required guides") === true &&
        reviewGated.includes('getGuideDocument({ name: "REVIEW_ASSET" })') &&
        AUTOMOVIE_REVIEW_GUIDES.asset === "REVIEW_ASSET" &&
        AUTOMOVIE_REVIEW_GUIDES.shot === "REVIEW_SHOT" &&
        AUTOMOVIE_REVIEW_GUIDES.rendition === "REVIEW_SHOT" &&
        AUTOMOVIE_REVIEW_GUIDES.sequence === "REVIEW_SEQUENCE" &&
        AUTOMOVIE_REVIEW_GUIDES.film === "REVIEW_FILM" &&
        AUTOMOVIE_REVIEW_GUIDES.design === "REVIEW_DEPENDENCY" &&
        AUTOMOVIE_REVIEW_GUIDES.source === "REVIEW_DEPENDENCY",
    );
    const reviewTargets: IAutoMovieReviewTarget[] = [
      { kind: "asset", id: "sentinel" },
      { kind: "design", design: { kind: "production" } },
      { kind: "source", path: "src/shots/opening.ts" },
      { kind: "shot", id: "opening" },
      { kind: "rendition", id: "opening" },
      { kind: "sequence", id: "SEQ-SIGNAL" },
      { kind: "film", id: "fixture-film" },
    ];
    for (const target of reviewTargets) {
      const gatedReview = new AutoMovieApplication({
        projectRoot: fixture.root,
        productionId: "fixture-film",
        capture,
      });
      gatedReview.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
      const expectedGuide = AUTOMOVIE_REVIEW_GUIDES[target.kind];
      const prepareGate = await rejected(async () =>
        gatedReview.prepareReview({ target }),
      );
      const submitGate = await rejected(async () =>
        gatedReview.submitReview({
          target,
          preparedFingerprint: `sha256:${"0".repeat(64)}`,
          observations: "Gate execution probe.",
          checks: [],
          corrections: [
            {
              owner: "source",
              target: "gate-probe",
              problem: "The probe is intentionally incomplete.",
              expected: "The target-specific guide is credited.",
            },
          ],
          completionBasis: "Gate execution probe.",
          complete: false,
        }),
      );
      TestValidator.predicate(
        `${target.kind} prepare and submit both require the exact review guide`,
        prepareGate?.includes(
          `getGuideDocument({ name: "${expectedGuide}" })`,
        ) === true &&
          submitGate?.includes(
            `getGuideDocument({ name: "${expectedGuide}" })`,
          ) === true,
      );
      gatedReview.getGuideDocument({ name: expectedGuide });
      TestValidator.predicate(
        `${target.kind} prepare and submit execute after exact guide credit`,
        (await rejected(async () => gatedReview.prepareReview({ target }))) ===
          null &&
          (await rejected(async () =>
            gatedReview.submitReview({
              target,
              preparedFingerprint: `sha256:${"0".repeat(64)}`,
              observations: "Gate execution probe.",
              checks: [],
              corrections: [
                {
                  owner: "source",
                  target: "gate-probe",
                  problem: "The probe is intentionally incomplete.",
                  expected: "The target-specific guide is credited.",
                },
              ],
              completionBasis: "Gate execution probe.",
              complete: false,
            }),
          )) === null,
      );
    }
    application.getGuideDocument({ name: "REPAINT_SHOT" });
    const deterministicRepaint = await application.repaintShot({
      productionId: "second-film",
      shot: "opening",
      references: [{ role: "style", path: reference.path }],
      parameters: { prompt: "Preserve the signal.", seed: 17, strength: 0.8 },
    });
    TestValidator.predicate(
      "deterministic delivery refuses repaint without requiring diffusion knowledge",
      deterministicRepaint.repainted === false &&
        deterministicRepaint.diagnostics[0]?.code ===
          "repaint-delivery-disabled" &&
        AUTOMOVIE_REPAINT_GUIDE === "DIFFUSION_ENHANCE",
    );
    const stateRoot = path.join(fixture.root, ".automovie");
    const stateRegistryPath = path.join(stateRoot, "productions.json");
    const registryBeforeUnknown = fs.readFileSync(stateRegistryPath);
    const revisionBeforeUnknown = first.project.revision();
    const treeBeforeUnknown = directorySnapshot(stateRoot);
    const unknownProductionCapture = await application.captureFrame({
      target: {
        kind: "shot",
        productionId: "typo-film",
        id: "opening",
        time: 0,
      },
    });
    const unknownProductionRepaint = await application.repaintShot({
      productionId: "typo-film",
      shot: "opening",
      references: [{ role: "style", path: reference.path }],
      parameters: { prompt: "Preserve the signal.", seed: 17, strength: 0.8 },
    });
    TestValidator.predicate(
      "unknown production ids are read-only refusals",
      unknownProductionCapture.diagnostics[0]?.code ===
        "capture-production-unregistered" &&
        unknownProductionRepaint.diagnostics[0]?.code ===
          "repaint-production-unregistered" &&
        fs.readFileSync(stateRegistryPath).equals(registryBeforeUnknown) &&
        first.project.revision() === revisionBeforeUnknown &&
        JSON.stringify(directorySnapshot(stateRoot)) ===
          JSON.stringify(treeBeforeUnknown),
    );
    const unknownGuide = await rejected(async () =>
      application.getGuideDocument({
        name: "RETIRED_GUIDE" as IAutoMovieGetGuideDocument.IProps["name"],
      }),
    );
    TestValidator.predicate(
      "unknown guide recovery names the complete production allowlist",
      AUTOMOVIE_PRODUCTION_GUIDE_NAMES.every(
        (name) => unknownGuide?.includes(name) === true,
      ),
    );
    const invalidCaptureProduction = await application.captureFrame({
      target: {
        kind: "shot",
        productionId: " ",
        id: "opening",
        time: 0,
      },
    });
    const invalidRepaintProduction = await application.repaintShot({
      productionId: " ",
      shot: "opening",
      references: [{ role: "style", path: reference.path }],
      parameters: { prompt: "Preserve the signal.", seed: 17, strength: 0.8 },
    });
    TestValidator.predicate(
      "explicit blank production ids never fall through to the host default",
      invalidCaptureProduction.diagnostics[0]?.code ===
        "capture-production-invalid" &&
        invalidRepaintProduction.diagnostics[0]?.code ===
          "repaint-production-invalid",
    );
    const registryPath = path.join(
      first.project.generatedRoot(),
      "manifests/compile.json",
    );
    const originalRegistry = fs.readFileSync(registryPath);
    const alteredRegistry = JSON.parse(originalRegistry.toString("utf8")) as {
      film: string | null;
    };
    alteredRegistry.film = "altered-without-ownership";
    fs.writeFileSync(
      registryPath,
      `${JSON.stringify(alteredRegistry, null, 2)}\n`,
    );
    const staleRegistry = await application.captureFrame({
      target: {
        kind: "shot",
        productionId: "fixture-film",
        id: "opening",
        time: 0,
      },
    });
    fs.writeFileSync(registryPath, originalRegistry);
    TestValidator.predicate(
      "capture refuses registry bytes that differ from compiler ownership",
      staleRegistry.captured === false &&
        staleRegistry.diagnostics[0]?.code === "capture-registry-unavailable",
    );
    const missing = await application.captureFrame({
      target: {
        kind: "shot",
        productionId: "fixture-film",
        id: "caller-invented",
        time: 0,
      },
    });
    const firstBeauty = await application.captureFrame({
      target: {
        kind: "shot",
        productionId: "fixture-film",
        id: "opening",
        time: 0,
        pass: "beauty",
      },
    });
    const firstPose = await application.captureFrame({
      target: {
        kind: "shot",
        productionId: "fixture-film",
        id: "opening",
        time: 0,
        pass: "pose",
      },
    });
    const assetTurntable = await application.captureFrame({
      target: {
        kind: "asset",
        id: "sentinel",
        angleDeg: 90,
        elevationDeg: 0,
        pose: "rest",
        pass: "beauty",
      },
    });
    const secondBeauty = await application.captureFrame({
      target: {
        kind: "shot",
        productionId: "second-film",
        id: "opening",
        time: 0,
        pass: "beauty",
      },
    });
    const capturesAreCurrentAndIsolated =
      missing.captured === false &&
      missing.diagnostics[0]?.code === "capture-target-missing" &&
      firstBeauty.captured &&
      firstPose.captured &&
      assetTurntable.captured &&
      secondBeauty.captured &&
      firstBeauty.receipt?.productionId === "fixture-film" &&
      assetTurntable.receipt?.productionId === "fixture-film" &&
      assetTurntable.receipt?.target.kind === "asset" &&
      assetTurntable.receipt.target.id === "sentinel" &&
      assetTurntable.receipt.target.angleDeg === 90 &&
      assetTurntable.receipt.outputDigest === assetTurntable.frame?.digest &&
      secondBeauty.receipt?.productionId === "second-film" &&
      firstBeauty.receipt?.bundle !== secondBeauty.receipt?.bundle &&
      capturedProductionIds.includes("fixture-film") &&
      capturedProductionIds.includes("second-film");
    if (capturesAreCurrentAndIsolated === false)
      throw new Error(
        `Capture isolation matrix failed:\n${JSON.stringify(
          {
            missing,
            firstBeauty,
            firstPose,
            assetTurntable,
            secondBeauty,
            capturedProductionIds,
          },
          null,
          2,
        )}`,
      );
    TestValidator.predicate(
      "capture resolves only current registry ids and isolates two productions",
      capturesAreCurrentAndIsolated,
    );
    TestValidator.equals(
      "only the production guide allowlist is served",
      AUTOMOVIE_PRODUCTION_GUIDE_NAMES,
      [
        "AUTOMOVIE_OVERALL",
        "PRODUCTION_DESIGN",
        "MODEL_RECIPE",
        "WORLD_DESIGN",
        "FORMATION_DESIGN",
        "SHOT_CONTRACT",
        "ACCEPTANCE",
        "SOURCE_OWNERSHIP",
        "COMPILATION",
        "GEOMETRY",
        "CAPTURE_FRAME",
        "REPAINT_SHOT",
        "REVIEW_ASSET",
        "REVIEW_SHOT",
        "REVIEW_SEQUENCE",
        "REVIEW_FILM",
        "REVIEW_DEPENDENCY",
        "SCREENPLAY_WRITING",
        "CINEMATOGRAPHY",
        "EDITING",
        "OBJECT_RIGGING",
        "WORLD_BUILDING",
        "MOTION",
        "BATTLE_SIM",
        "SOUND_DESIGN",
        "ASSET_SOURCING",
        "DIFFUSION_ENHANCE",
        "TYPESCRIPT",
        "DEBUGGING",
      ],
    );

    const diffusionGated = await rejected(() =>
      application.repaintShot({
        productionId: "fixture-film",
        shot: "opening",
        references: [{ role: "style", path: reference.path }],
        parameters: {
          prompt: "Preserve the signal.",
          seed: 17,
          strength: 0.8,
        },
      }),
    );
    TestValidator.predicate(
      "repainted delivery dynamically requires diffusion guidance",
      diffusionGated?.includes("2/3 required guides") === true &&
        diffusionGated.includes(
          'getGuideDocument({ name: "DIFFUSION_ENHANCE" })',
        ),
    );
    application.getGuideDocument({ name: "DIFFUSION_ENHANCE" });
    const unavailable = await application.repaintShot({
      productionId: "fixture-film",
      shot: "opening",
      references: [{ role: "style", path: reference.path }],
      parameters: { prompt: "Preserve the signal.", seed: 17, strength: 0.8 },
    });
    TestValidator.predicate(
      "a missing repaint adapter returns provisioning guidance",
      unavailable.repainted === false &&
        unavailable.diagnostics[0]?.code === "repaint-host-unavailable" &&
        unavailable.diagnostics[0].message.includes(
          "AutoMovieProductionShotRepaint",
        ),
    );

    const frameGrid: IAutoMovieCaptureFrame[] = [firstBeauty, firstPose];
    for (let index = 1; index < 12; ++index)
      for (const pass of ["beauty", "pose"] as const)
        frameGrid.push(
          await application.captureFrame({
            target: {
              kind: "shot",
              productionId: "fixture-film",
              id: "opening",
              time: index / 2,
              pass,
            },
          }),
        );
    TestValidator.predicate(
      "repaint source evidence covers every beauty and structural frame",
      frameGrid.length === 24 && frameGrid.every((capture) => capture.captured),
    );

    const shortRenditionBytes = await productionH264Mp4({
      width: 16,
      height: 16,
      fps: 2,
      frameCount: 2,
    });
    const renditionBytes = await productionH264Mp4({
      width: 16,
      height: 16,
      fps: 2,
      frameCount: 12,
    });
    let repaintAdapterCalls = 0;
    const repainting = new AutoMovieApplication({
      projectRoot: fixture.root,
      productionId: "fixture-film",
      capture,
      repaint: async (input) => {
        ++repaintAdapterCalls;
        return {
          bytes:
            input.parameters.prompt === "Return a short clip."
              ? shortRenditionBytes
              : renditionBytes,
          mediaType: "video/mp4",
          runtimeIdentity: {
            protocolVersion: "automovie.repaint-runtime.v1",
            provider: "fixture",
            model: "fixture-video",
            version: "1",
            execution: "local",
          },
        };
      },
    });
    repainting.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
    repainting.getGuideDocument({ name: "REPAINT_SHOT" });
    repainting.getGuideDocument({ name: "DIFFUSION_ENHANCE" });
    repainting.getGuideDocument({ name: "REVIEW_SHOT" });
    const sourcePrepared = repainting.prepareReview({
      target: { kind: "shot", id: "opening" },
    });
    const frameEvidence = (frame: (typeof sourcePrepared.frames)[number]) => ({
      kind: "frame" as const,
      target: frame.target,
      reviewFrame: frame.reviewFrame,
      bundle: frame.bundle,
      frame: frame.frame,
      time: frame.time,
      pass: frame.pass,
      digest: frame.digest,
    });
    const sourceAcceptance = [
      ...first.project.graph().acceptance.values(),
    ].filter(
      (scenario) =>
        scenario.required &&
        scenario.target.kind === "shot" &&
        scenario.target.id === "opening",
    );
    const sourceReview = repainting.submitReview({
      target: sourcePrepared.target,
      preparedFingerprint: sourcePrepared.fingerprint,
      observations:
        "The current deterministic source frames satisfy the shot contract.",
      checks: sourcePrepared.requiredCriteria.map((criterion, index) => ({
        criterion,
        verdict: "pass",
        observation: `${criterion} passes on current deterministic evidence.`,
        evidence:
          criterion === "acceptance-scenarios"
            ? sourceAcceptance.flatMap((scenario) => {
                const matching = sourcePrepared.frames.find(
                  (frame) =>
                    scenario.criterion.kind === "frame" &&
                    frame.reviewFrame === scenario.criterion.frame &&
                    frame.pass === scenario.criterion.pass,
                );
                return [
                  ...(matching === undefined ? [] : [frameEvidence(matching)]),
                  {
                    kind: "acceptance" as const,
                    scenario: scenario.id,
                    exactValue: scenario,
                  },
                ];
              })
            : [
                frameEvidence(
                  sourcePrepared.frames[index % sourcePrepared.frames.length]!,
                ),
              ],
        ...(criterion === "acceptance-scenarios"
          ? {
              acceptanceScenarios: sourceAcceptance.map(
                (scenario) => scenario.id,
              ),
            }
          : {}),
      })),
      corrections: [],
      completionBasis: sourcePrepared.requiredCriteria.join(", "),
      complete: true,
    });
    if (sourceReview.accepted === false || sourceReview.state !== "complete")
      throw new Error(
        `Deterministic repaint-source review failed:\n${JSON.stringify(
          {
            prepared: {
              criteria: sourcePrepared.requiredCriteria,
              frames: sourcePrepared.frames.map((frame) => ({
                reviewFrame: frame.reviewFrame,
                time: frame.time,
                pass: frame.pass,
                digest: frame.digest,
              })),
              diagnostics: sourcePrepared.diagnostics,
            },
            submitted: sourceReview,
          },
          null,
          2,
        )}`,
      );
    TestValidator.predicate(
      "repaint requires and records a current completed deterministic source review",
      sourceReview.accepted && sourceReview.state === "complete",
    );
    const restricted = await repainting.repaintShot({
      productionId: "fixture-film",
      shot: "opening",
      references: [{ role: "style", path: restrictedReference.path }],
      parameters: {
        prompt: "Do not send this asset.",
        seed: 17,
        strength: 0.8,
      },
    });
    TestValidator.predicate(
      "non-rendition asset bytes are refused before adapter disclosure",
      restricted.repainted === false &&
        restricted.diagnostics[0]?.code === "repaint-reference-invalid" &&
        repaintAdapterCalls === 0,
    );
    const shortRendition = await repainting.repaintShot({
      productionId: "fixture-film",
      shot: "opening",
      references: [{ role: "style", path: reference.path }],
      parameters: { prompt: "Return a short clip.", seed: 17, strength: 0.8 },
    });
    TestValidator.predicate(
      "repaint output must match exact shot raster, clock and frame count",
      shortRendition.repainted === false &&
        shortRendition.diagnostics[0]?.code === "repaint-output-invalid" &&
        repaintAdapterCalls === 1,
    );
    const repainted = await repainting.repaintShot({
      productionId: "fixture-film",
      shot: "opening",
      references: [{ role: "style", path: reference.path }],
      parameters: { prompt: "Preserve the signal.", seed: 17, strength: 0.8 },
    });
    TestValidator.predicate(
      "attached repaint commits the complete provenance chain",
      repainted.repainted &&
        repainted.receipt?.sourceRenderFingerprint.startsWith("sha256:") ===
          true &&
        repainted.receipt.sourceReviewFingerprint ===
          sourceReview.fingerprint &&
        repainted.receipt.attemptId.length === 36 &&
        repainted.receipt.controls.some((control) => control.pass === "pose") &&
        repainted.receipt.references[0]?.digest === reference.digest &&
        repainted.receipt.adapterIdentity.includes("fixture-video") &&
        repainted.receipt.output.digest.startsWith("sha256:") &&
        repaintAdapterCalls === 2 &&
        fs.existsSync(
          path.join(
            fixture.root,
            "renders",
            "fixture-film",
            repainted.receipt.output.path,
          ),
        ),
    );
    repainting.getGuideDocument({ name: "REVIEW_SHOT" });
    const renditionReview = repainting.prepareReview({
      target: { kind: "rendition", id: "opening" },
    });
    const acceptedReceipt = repainted.receipt;
    TestValidator.predicate(
      "repainted delivery enters separate receipt-bound review evidence",
      acceptedReceipt !== null &&
        renditionReview.renditions.some(
          (rendition) =>
            rendition.shot === "opening" &&
            rendition.path === acceptedReceipt.output.path &&
            rendition.digest === acceptedReceipt.output.digest &&
            rendition.receiptDigest.startsWith("sha256:") &&
            rendition.sourceRenderFingerprint ===
              acceptedReceipt.sourceRenderFingerprint &&
            rendition.sourceReviewFingerprint ===
              acceptedReceipt.sourceReviewFingerprint,
        ) &&
        renditionReview.diagnostics.some(
          (diagnostic) => diagnostic.code === "review-rendition-missing",
        ) === false,
    );
    const rerolled = await repainting.repaintShot({
      productionId: "fixture-film",
      shot: "opening",
      references: [{ role: "style", path: reference.path }],
      parameters: {
        prompt: "Preserve the signal.",
        seed: 17,
        strength: 0.8,
      },
    });
    const rerolledReview = repainting.prepareReview({
      target: { kind: "rendition", id: "opening" },
    });
    const repaintFilmReview = repainting.prepareReview({
      target: { kind: "film", id: "fixture-film" },
    });
    TestValidator.predicate(
      "even an identical-byte reroll selects a new attempt and stales prior review identity",
      rerolled.repainted &&
        rerolled.receipt?.attemptId !== acceptedReceipt?.attemptId &&
        rerolled.receipt?.output.path !== acceptedReceipt?.output.path &&
        rerolledReview.fingerprint !== renditionReview.fingerprint &&
        rerolledReview.renditions.length === 1 &&
        rerolledReview.renditions[0]?.path === rerolled.receipt?.output.path,
    );
    TestValidator.predicate(
      "film review preflights the selected repaint cut before approval",
      repaintFilmReview.renditions.length === 1 &&
        repaintFilmReview.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "review-rendition-delivery-invalid",
        ) === false,
    );
    const activeRenditionPath = first.project.trackedStatePath(
      "renditions/active/opening.json",
    );
    const activeRenditionBytes = fs.readFileSync(activeRenditionPath);
    const activeRendition = JSON.parse(
      activeRenditionBytes.toString("utf8"),
    ) as {
      version: 1;
      shot: string;
      receipt: string;
      output: string;
    };
    const invalidRenditionReviews: IAutoMoviePrepareReview[] = [];
    for (const active of [
      "{",
      "{}\n",
      `${JSON.stringify(
        { ...activeRendition, receipt: "renditions/missing.json" },
        null,
        2,
      )}\n`,
      `${JSON.stringify(
        { ...activeRendition, output: "renditions/wrong.mp4" },
        null,
        2,
      )}\n`,
    ]) {
      fs.writeFileSync(activeRenditionPath, active);
      invalidRenditionReviews.push(
        repainting.prepareReview({
          target: { kind: "rendition", id: "opening" },
        }),
      );
    }
    fs.writeFileSync(activeRenditionPath, activeRenditionBytes);
    const selectedReceiptPath = first.project.trackedStatePath(
      activeRendition.receipt,
    );
    const selectedReceiptBytes = fs.readFileSync(selectedReceiptPath);
    fs.writeFileSync(selectedReceiptPath, "{}\n");
    invalidRenditionReviews.push(
      repainting.prepareReview({
        target: { kind: "rendition", id: "opening" },
      }),
    );
    const wrongShotReceipt = JSON.parse(
      selectedReceiptBytes.toString("utf8"),
    ) as NonNullable<IAutoMovieRepaintShot["receipt"]>;
    wrongShotReceipt.shot = "answer";
    fs.writeFileSync(
      selectedReceiptPath,
      `${JSON.stringify(wrongShotReceipt, null, 2)}\n`,
    );
    invalidRenditionReviews.push(
      repainting.prepareReview({
        target: { kind: "rendition", id: "opening" },
      }),
    );
    fs.writeFileSync(selectedReceiptPath, selectedReceiptBytes);
    const selectedOutputPath = path.join(
      first.project.renderRoot(),
      rerolled.receipt!.output.path,
    );
    const selectedOutputBytes = fs.readFileSync(selectedOutputPath);
    fs.writeFileSync(
      selectedOutputPath,
      Buffer.concat([selectedOutputBytes, Buffer.from([0])]),
    );
    const changedOutputReview = repainting.prepareReview({
      target: { kind: "rendition", id: "opening" },
    });
    invalidRenditionReviews.push(changedOutputReview);
    fs.writeFileSync(selectedOutputPath, selectedOutputBytes);
    TestValidator.predicate(
      "forged active pointers and changed rendition bytes never become review evidence",
      invalidRenditionReviews.every(
        (prepared) =>
          prepared.renditions.length === 0 &&
          prepared.diagnostics.some(
            (diagnostic) => diagnostic.code === "review-rendition-missing",
          ),
      ),
    );
    const currentRenditionEvidence = {
      kind: "rendition" as const,
      ...rerolledReview.renditions[0]!,
    };
    const renditionWorksheet: IAutoMovieSubmitReview.IProps = {
      target: { kind: "rendition", id: "opening" },
      preparedFingerprint: rerolledReview.fingerprint,
      observations: "The current selected rendition needs another pass.",
      checks: rerolledReview.requiredCriteria.map((criterion, index) => ({
        criterion,
        verdict: "revise",
        observation: `Rendition criterion ${index} remains under review.`,
        evidence: [currentRenditionEvidence],
        ...(criterion === "acceptance-scenarios"
          ? { acceptanceScenarios: [] }
          : {}),
      })),
      corrections: [
        {
          owner: "render",
          target: rerolledReview.renditions[0]!.path,
          problem: "The visual approval probe remains intentionally open.",
          expected: "Submit a complete evidence-backed appearance review.",
        },
      ],
      completionBasis: "The rendition evidence is current but not approved.",
      complete: false,
    };
    const acceptedRenditionReview = repainting.submitReview(renditionWorksheet);
    const forgedRenditionWorksheet = structuredClone(renditionWorksheet);
    const forgedRenditionEvidence = forgedRenditionWorksheet.checks[0]!
      .evidence[0] as Extract<
      (typeof forgedRenditionWorksheet.checks)[number]["evidence"][number],
      { kind: "rendition" }
    >;
    forgedRenditionEvidence.digest = digestAutoMovieBytes(
      Buffer.from("forged-rendition"),
    );
    const forgedRenditionReview = repainting.submitReview(
      forgedRenditionWorksheet,
    );
    const uncitedCompletion = structuredClone(renditionWorksheet);
    uncitedCompletion.complete = true;
    uncitedCompletion.corrections = [];
    for (const check of uncitedCompletion.checks) {
      check.verdict = "pass";
      check.evidence = check.evidence.filter(
        (evidence) => evidence.kind !== "rendition",
      );
    }
    const uncitedRenditionReview = repainting.submitReview(uncitedCompletion);
    TestValidator.predicate(
      "submitReview accepts exact rendition evidence and refuses forged or uncited identities",
      acceptedRenditionReview.accepted &&
        forgedRenditionReview.diagnostics.some(
          (diagnostic) => diagnostic.code === "review-evidence-stale",
        ) &&
        uncitedRenditionReview.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "review-rendition-coverage-incomplete",
        ),
    );
    const forgedReceipt = structuredClone(repainted.receipt!);
    forgedReceipt.sourceRenderFingerprint = forgedReceipt.output.digest;
    let forgedReceiptRejected = false;
    try {
      first.project.commitRepaintRendition(forgedReceipt, renditionBytes);
    } catch {
      forgedReceiptRejected = true;
    }
    TestValidator.predicate(
      "the project commit gate independently rejects forged source provenance",
      forgedReceiptRejected,
    );

    const server = createAutoMovieMcpServer({
      projectRoot: fixture.root,
      productionId: "fixture-film",
      capture,
    });
    const client = new Client({
      name: "five-tool-schema-test",
      version: "0.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    try {
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);
      const { tools } = await client.listTools();
      TestValidator.equals(
        "the reflected MCP inventory is exactly five tools",
        tools.map((tool) => tool.name),
        [
          "getGuideDocument",
          "captureFrame",
          "repaintShot",
          "prepareReview",
          "submitReview",
        ],
      );
      TestValidator.predicate(
        "every tool description fits MCP client limits",
        tools.every(
          (tool) =>
            (tool.description?.length ?? 0) > 100 &&
            (tool.description?.length ?? 0) <= 1_023,
        ),
      );
      const submitReview = tools.find((tool) => tool.name === "submitReview")!;
      TestValidator.equals(
        "submitReview remains verdict-last after reflection",
        Object.keys(
          (
            submitReview.inputSchema as {
              properties: Record<string, unknown>;
            }
          ).properties,
        ),
        [
          "target",
          "preparedFingerprint",
          "observations",
          "checks",
          "corrections",
          "completionBasis",
          "complete",
        ],
      );
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
  } finally {
    fixture.dispose();
  }
};
