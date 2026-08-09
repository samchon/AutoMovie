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

import { namedFacts } from "../internal/predicates";
import {
  productionCompileSucceeded,
  productionDesign,
  productionFixture,
  shotContract,
  testCaptureRuntimeIdentity,
  writeProductionScreenplay,
} from "./productionFixtures";
import { productionH264Mp4 } from "./productionMediaFixtures";

interface IProductionApplicationFailure {
  error: unknown;
}

interface IProductionApplicationConnectionCleanup {
  cleanup: () => Promise<unknown>;
  resource: string;
}

class ProductionApplicationCleanupError extends AggregateError {}

/** Close application resources without replacing an earlier failure. */
export const preserveProductionApplicationCleanup = async (
  failure: IProductionApplicationFailure | undefined,
  connections: readonly IProductionApplicationConnectionCleanup[],
  fixtureCleanup: () => unknown,
): Promise<void> => {
  const results = await Promise.allSettled(
    connections.map((resource) => Promise.resolve().then(resource.cleanup)),
  );
  const cleanupFailures: Array<{ error: unknown; resource: string }> =
    results.flatMap((result, index) =>
      result.status === "fulfilled"
        ? []
        : [{ error: result.reason, resource: connections[index]!.resource }],
    );
  try {
    fixtureCleanup();
  } catch (error) {
    cleanupFailures.push({ error, resource: "production fixture" });
  }
  if (cleanupFailures.length === 0) return;
  if (failure === undefined && cleanupFailures.length === 1)
    throw cleanupFailures[0]!.error;
  throw new ProductionApplicationCleanupError(
    [
      ...(failure === undefined ? [] : [failure.error]),
      ...cleanupFailures.map((entry) => entry.error),
    ],
    `Production-application cleanup failed${
      failure === undefined ? "" : " after the test failed"
    }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
  );
};

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
  const connectionCleanups: IProductionApplicationConnectionCleanup[] = [];
  let productionApplicationFailure: IProductionApplicationFailure | undefined;
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
    TestValidator.equals(
      "the non-MCP compiler API compiles the first registered production",
      namedFacts([
        ["oneRegistered", () => firstRegistry.length === 1],
        ["fixtureFilm", () => firstRegistry[0] === "fixture-film"],
      ]),
      { oneRegistered: true, fixtureFilm: true },
    );
    TestValidator.equals(
      "the non-MCP inspection API reports current compiled ownership",
      namedFacts([
        [
          "noMissing",
          () => inspectAutoMovieProduction(first).source.missing.length === 0,
        ],
        [
          "noUnowned",
          () =>
            inspectAutoMovieProduction(first).source.unownedGenerated.length ===
            0,
        ],
      ]),
      { noMissing: true, noUnowned: true },
    );
    const secondProject = AutoMovieProductionProject.open(
      fixture.root,
      "second-film",
    );
    // Scene numbers are production-scoped, so this production's shots cannot
    // join to the first one's ledger and need one of their own.
    writeProductionScreenplay({
      root: fixture.root,
      productionId: "second-film",
    });
    TestValidator.equals(
      "a second production binds the same source registry independently",
      namedFacts([
        [
          "designAccepted",
          () =>
            secondProject.setProductionDesign(
              productionDesign({
                id: "second-film",
                title: "second-film",
                visualDelivery: "deterministic",
              }),
            ).accepted,
        ],
        [
          "contractAccepted",
          () => secondProject.setShotContract(shotContract()).accepted,
        ],
        [
          "sourceCompiled",
          () =>
            productionCompileSucceeded(
              "second production application fixture",
              openAutoMovieProduction({
                projectRoot: fixture.root,
                productionId: "second-film",
                capture,
              }).compiler.compile({ scope: "source" }),
            ),
        ],
      ]),
      { designAccepted: true, contractAccepted: true, sourceCompiled: true },
    );

    const application = new AutoMovieApplication({
      projectRoot: path.join(fixture.root, "src"),
      productionId: "fixture-film",
      capture,
    });
    const paired: IFiveToolContract = application;
    TestValidator.equals(
      "the application implements the five named props/result pairs",
      namedFacts([
        ["contractInstance", () => paired === application],
        [
          "guideNames",
          () =>
            Object.keys(AUTOMOVIE_TOOL_GUIDES).join(",") ===
            "getGuideDocument,captureFrame,repaintShot,prepareReview,submitReview",
        ],
      ]),
      { contractInstance: true, guideNames: true },
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
    TestValidator.equals(
      "missing knowledge is a plain recovery script with partial credit",
      namedFacts([
        [
          "gatedIncludesRequired",
          () => gated?.includes("0/2 required guides") === true,
        ],
        [
          "gatedIncludesGetGuideDocument",
          () =>
            gated !== null &&
            gated.includes('getGuideDocument({ name: "AUTOMOVIE_OVERALL" })'),
        ],
        [
          "gatedIncludesGetGuideDocument2",
          () =>
            gated !== null &&
            gated.includes('getGuideDocument({ name: "CAPTURE_FRAME" })'),
        ],
        [
          "gatedIncludesNot",
          () =>
            gated !== null && gated.includes("not a payload validation error"),
        ],
      ]),
      {
        gatedIncludesRequired: true,
        gatedIncludesGetGuideDocument: true,
        gatedIncludesGetGuideDocument2: true,
        gatedIncludesNot: true,
      },
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
    // Each fact is its own closure, so a narrowing an earlier conjunct made
    // (here: the recovery script is not `null`) does not reach the later facts.
    // Repeat only the guard the compiler needs, as a comparison that cannot
    // move the answer; `namedFacts` stops at the first false fact, so the
    // guarding itself still comes from the ordering.
    TestValidator.equals(
      "guide credit survives and the recovery script lists only missing reads",
      namedFacts([
        [
          "creditRemembered",
          () => partiallyGated?.includes("1/2 required guides") === true,
        ],
        [
          "listsCaptureFrame",
          () =>
            partiallyGated?.includes(
              'getGuideDocument({ name: "CAPTURE_FRAME" })',
            ) === true,
        ],
        [
          "omitsOverall",
          () =>
            partiallyGated?.includes(
              'getGuideDocument({ name: "AUTOMOVIE_OVERALL" })',
            ) === false,
        ],
      ]),
      { creditRemembered: true, listsCaptureFrame: true, omitsOverall: true },
    );
    application.getGuideDocument({ name: "CAPTURE_FRAME" });
    const reviewGated = await rejected(async () =>
      application.prepareReview({
        target: { kind: "asset", id: "soloist" },
      }),
    );
    TestValidator.equals(
      "review knowledge is selected from the exact target surface",
      namedFacts([
        [
          "reviewGatedIncludesRequired",
          () => reviewGated?.includes("1/2 required guides") === true,
        ],
        [
          "reviewGatedIncludesGetGuideDocument",
          () =>
            reviewGated !== null &&
            reviewGated.includes('getGuideDocument({ name: "REVIEW_ASSET" })'),
        ],
        [
          "AUTOMOVIEREVIEWGUIDESAssetREVIEWASSET",
          () => AUTOMOVIE_REVIEW_GUIDES.asset === "REVIEW_ASSET",
        ],
        [
          "AUTOMOVIEREVIEWGUIDESShotREVIEWSHOT",
          () => AUTOMOVIE_REVIEW_GUIDES.shot === "REVIEW_SHOT",
        ],
        [
          "AUTOMOVIEREVIEWGUIDESRenditionREVIEWSHOT",
          () => AUTOMOVIE_REVIEW_GUIDES.rendition === "REVIEW_SHOT",
        ],
        [
          "AUTOMOVIEREVIEWGUIDESSequenceREVIEWSEQUENCE",
          () => AUTOMOVIE_REVIEW_GUIDES.sequence === "REVIEW_SEQUENCE",
        ],
        [
          "AUTOMOVIEREVIEWGUIDESFilmREVIEWFILM",
          () => AUTOMOVIE_REVIEW_GUIDES.film === "REVIEW_FILM",
        ],
        [
          "AUTOMOVIEREVIEWGUIDESDesignREVIEWDEPENDENCY",
          () => AUTOMOVIE_REVIEW_GUIDES.design === "REVIEW_DEPENDENCY",
        ],
        [
          "AUTOMOVIEREVIEWGUIDESSourceREVIEWDEPENDENCY",
          () => AUTOMOVIE_REVIEW_GUIDES.source === "REVIEW_DEPENDENCY",
        ],
      ]),
      {
        reviewGatedIncludesRequired: true,
        reviewGatedIncludesGetGuideDocument: true,
        AUTOMOVIEREVIEWGUIDESAssetREVIEWASSET: true,
        AUTOMOVIEREVIEWGUIDESShotREVIEWSHOT: true,
        AUTOMOVIEREVIEWGUIDESRenditionREVIEWSHOT: true,
        AUTOMOVIEREVIEWGUIDESSequenceREVIEWSEQUENCE: true,
        AUTOMOVIEREVIEWGUIDESFilmREVIEWFILM: true,
        AUTOMOVIEREVIEWGUIDESDesignREVIEWDEPENDENCY: true,
        AUTOMOVIEREVIEWGUIDESSourceREVIEWDEPENDENCY: true,
      },
    );
    const reviewTargets: IAutoMovieReviewTarget[] = [
      { kind: "asset", id: "soloist" },
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
      TestValidator.equals(
        `${target.kind} prepare and submit both require the exact review guide`,
        namedFacts([
          [
            "prepareGated",
            () =>
              prepareGate?.includes(
                `getGuideDocument({ name: "${expectedGuide}" })`,
              ) === true,
          ],
          [
            "submitGated",
            () =>
              submitGate?.includes(
                `getGuideDocument({ name: "${expectedGuide}" })`,
              ) === true,
          ],
        ]),
        { prepareGated: true, submitGated: true },
      );
      gatedReview.getGuideDocument({ name: expectedGuide });
      // A fact closure is synchronous, so both awaits are hoisted; the submit
      // stays behind the prepare exactly as the conjunction left it, and its
      // placeholder is never read because `namedFacts` stops at the false one.
      const prepareExecuted = await rejected(async () =>
        gatedReview.prepareReview({ target }),
      );
      const submitExecuted =
        prepareExecuted === null
          ? await rejected(async () =>
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
            )
          : "prepare was refused, so submit was never attempted";
      TestValidator.equals(
        `${target.kind} prepare and submit execute after exact guide credit`,
        namedFacts([
          ["prepareExecuted", () => prepareExecuted === null],
          ["submitExecuted", () => submitExecuted === null],
        ]),
        { prepareExecuted: true, submitExecuted: true },
      );
    }
    application.getGuideDocument({ name: "REPAINT_SHOT" });
    const deterministicRepaint = await application.repaintShot({
      productionId: "second-film",
      shot: "opening",
      references: [{ role: "style", path: reference.path }],
      parameters: { prompt: "Preserve the signal.", seed: 17, strength: 0.8 },
    });
    TestValidator.equals(
      "deterministic delivery refuses repaint without requiring diffusion knowledge",
      namedFacts([
        ["refused", () => deterministicRepaint.repainted === false],
        [
          "deliveryDisabled",
          () =>
            deterministicRepaint.diagnostics[0]?.code ===
            "repaint-delivery-disabled",
        ],
        [
          "repaintGuideName",
          () => AUTOMOVIE_REPAINT_GUIDE === "DIFFUSION_ENHANCE",
        ],
      ]),
      { refused: true, deliveryDisabled: true, repaintGuideName: true },
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
    TestValidator.equals(
      "unknown production ids are read-only refusals",
      namedFacts([
        [
          "unknownProductionCaptureDiagnosticsCode",
          () =>
            unknownProductionCapture.diagnostics[0]?.code ===
            "capture-production-unregistered",
        ],
        [
          "unknownProductionRepaintDiagnosticsCode",
          () =>
            unknownProductionRepaint.diagnostics[0]?.code ===
            "repaint-production-unregistered",
        ],
        [
          "readFileSyncStateRegistryPathEquals",
          () =>
            fs.readFileSync(stateRegistryPath).equals(registryBeforeUnknown),
        ],
        [
          "firstProjectRevision",
          () => first.project.revision() === revisionBeforeUnknown,
        ],
        [
          "stringifyDirectorySnapshotStateRoot",
          () =>
            JSON.stringify(directorySnapshot(stateRoot)) ===
            JSON.stringify(treeBeforeUnknown),
        ],
      ]),
      {
        unknownProductionCaptureDiagnosticsCode: true,
        unknownProductionRepaintDiagnosticsCode: true,
        readFileSyncStateRegistryPathEquals: true,
        firstProjectRevision: true,
        stringifyDirectorySnapshotStateRoot: true,
      },
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
    TestValidator.equals(
      "explicit blank production ids never fall through to the host default",
      namedFacts([
        [
          "captureInvalid",
          () =>
            invalidCaptureProduction.diagnostics[0]?.code ===
            "capture-production-invalid",
        ],
        [
          "repaintInvalid",
          () =>
            invalidRepaintProduction.diagnostics[0]?.code ===
            "repaint-production-invalid",
        ],
      ]),
      { captureInvalid: true, repaintInvalid: true },
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
    TestValidator.equals(
      "capture refuses registry bytes that differ from compiler ownership",
      namedFacts([
        ["refused", () => staleRegistry.captured === false],
        [
          "registryUnavailable",
          () =>
            staleRegistry.diagnostics[0]?.code ===
            "capture-registry-unavailable",
        ],
      ]),
      { refused: true, registryUnavailable: true },
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
    const signalMask = await application.captureFrame({
      target: {
        kind: "shot",
        productionId: "fixture-film",
        id: "opening",
        time: 2,
        pass: "mask",
      },
    });
    const assetTurntable = await application.captureFrame({
      target: {
        kind: "asset",
        id: "soloist",
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
      assetTurntable.receipt.target.id === "soloist" &&
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
        "SOUND_DESIGN",
        "ASSET_SOURCING",
        "DIFFUSION_ENHANCE",
        "EVIDENCE_GRAPH",
        "SOURCE_COMPOSITION",
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
    TestValidator.equals(
      "repainted delivery dynamically requires diffusion guidance",
      namedFacts([
        [
          "twoOfThree",
          () => diffusionGated?.includes("2/3 required guides") === true,
        ],
        [
          "listsDiffusionEnhance",
          () =>
            diffusionGated?.includes(
              'getGuideDocument({ name: "DIFFUSION_ENHANCE" })',
            ) === true,
        ],
      ]),
      { twoOfThree: true, listsDiffusionEnhance: true },
    );
    application.getGuideDocument({ name: "DIFFUSION_ENHANCE" });
    const unavailable = await application.repaintShot({
      productionId: "fixture-film",
      shot: "opening",
      references: [{ role: "style", path: reference.path }],
      parameters: { prompt: "Preserve the signal.", seed: 17, strength: 0.8 },
    });
    TestValidator.equals(
      "a missing repaint adapter returns provisioning guidance",
      namedFacts([
        ["refused", () => unavailable.repainted === false],
        [
          "hostUnavailable",
          () => unavailable.diagnostics[0]?.code === "repaint-host-unavailable",
        ],
        [
          "namesHostType",
          () =>
            unavailable.diagnostics[0]?.message.includes(
              "AutoMovieProductionShotRepaint",
            ) === true,
        ],
      ]),
      { refused: true, hostUnavailable: true, namesHostType: true },
    );

    const frameGrid: IAutoMovieCaptureFrame[] = [
      firstBeauty,
      firstPose,
      signalMask,
    ];
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
    TestValidator.equals(
      "repaint source evidence covers every beauty, pose and required mask frame",
      namedFacts([
        ["gridComplete", () => frameGrid.length === 25],
        ["allCaptured", () => frameGrid.every((capture) => capture.captured)],
      ]),
      { gridComplete: true, allCaptured: true },
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
    TestValidator.equals(
      "repaint source preparation owns every declared review pass",
      namedFacts([
        ["threeFrames", () => sourcePrepared.frames.length === 3],
        [
          "everyPass",
          () =>
            ["beauty", "mask", "pose"].every((pass) =>
              sourcePrepared.frames.some((frame) => frame.pass === pass),
            ),
        ],
        [
          "noErrors",
          () =>
            sourcePrepared.diagnostics.every(
              (diagnostic) => diagnostic.category !== "error",
            ),
        ],
      ]),
      { threeFrames: true, everyPass: true, noErrors: true },
    );
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
    TestValidator.equals(
      "repaint requires and records a current completed deterministic source review",
      namedFacts([
        ["accepted", () => sourceReview.accepted],
        ["complete", () => sourceReview.state === "complete"],
      ]),
      { accepted: true, complete: true },
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
    TestValidator.equals(
      "non-rendition asset bytes are refused before adapter disclosure",
      namedFacts([
        ["refused", () => restricted.repainted === false],
        [
          "referenceInvalid",
          () => restricted.diagnostics[0]?.code === "repaint-reference-invalid",
        ],
        ["adapterUntouched", () => repaintAdapterCalls === 0],
      ]),
      { refused: true, referenceInvalid: true, adapterUntouched: true },
    );
    const shortRendition = await repainting.repaintShot({
      productionId: "fixture-film",
      shot: "opening",
      references: [{ role: "style", path: reference.path }],
      parameters: { prompt: "Return a short clip.", seed: 17, strength: 0.8 },
    });
    TestValidator.equals(
      "repaint output must match exact shot raster, clock and frame count",
      namedFacts([
        ["refused", () => shortRendition.repainted === false],
        [
          "outputInvalid",
          () =>
            shortRendition.diagnostics[0]?.code === "repaint-output-invalid",
        ],
        ["adapterCalledOnce", () => repaintAdapterCalls === 1],
      ]),
      { refused: true, outputInvalid: true, adapterCalledOnce: true },
    );
    const repainted = await repainting.repaintShot({
      productionId: "fixture-film",
      shot: "opening",
      references: [{ role: "style", path: reference.path }],
      parameters: { prompt: "Preserve the signal.", seed: 17, strength: 0.8 },
    });
    TestValidator.equals(
      "attached repaint commits the complete provenance chain",
      namedFacts([
        ["repaintedAttached", () => repainted.repainted],
        [
          "renderFingerprint",
          () =>
            repainted.receipt?.sourceRenderFingerprint.startsWith("sha256:") ===
            true,
        ],
        [
          "reviewFingerprint",
          () =>
            repainted.receipt?.sourceReviewFingerprint ===
            sourceReview.fingerprint,
        ],
        ["attemptIdUuid", () => repainted.receipt?.attemptId.length === 36],
        [
          "poseControl",
          () =>
            repainted.receipt?.controls.some(
              (control) => control.pass === "pose",
            ) === true,
        ],
        [
          "referenceDigest",
          () => repainted.receipt?.references[0]?.digest === reference.digest,
        ],
        [
          "adapterIdentity",
          () =>
            repainted.receipt?.adapterIdentity.includes("fixture-video") ===
            true,
        ],
        [
          "outputDigest",
          () => repainted.receipt?.output.digest.startsWith("sha256:") === true,
        ],
        ["adapterCalledTwice", () => repaintAdapterCalls === 2],
        [
          "renditionWritten",
          () =>
            repainted.receipt !== null &&
            fs.existsSync(
              path.join(
                fixture.root,
                "renders",
                "fixture-film",
                repainted.receipt.output.path,
              ),
            ),
        ],
      ]),
      {
        repaintedAttached: true,
        renderFingerprint: true,
        reviewFingerprint: true,
        attemptIdUuid: true,
        poseControl: true,
        referenceDigest: true,
        adapterIdentity: true,
        outputDigest: true,
        adapterCalledTwice: true,
        renditionWritten: true,
      },
    );
    repainting.getGuideDocument({ name: "REVIEW_SHOT" });
    const renditionReview = repainting.prepareReview({
      target: { kind: "rendition", id: "opening" },
    });
    const acceptedReceipt = repainted.receipt;
    TestValidator.equals(
      "repainted delivery enters separate receipt-bound review evidence",
      namedFacts([
        ["receiptAccepted", () => acceptedReceipt !== null],
        [
          "renditionBound",
          () =>
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
            ),
        ],
        [
          "noMissingDiagnostic",
          () =>
            renditionReview.diagnostics.some(
              (diagnostic) => diagnostic.code === "review-rendition-missing",
            ) === false,
        ],
      ]),
      {
        receiptAccepted: true,
        renditionBound: true,
        noMissingDiagnostic: true,
      },
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
    repainting.getGuideDocument({ name: "REVIEW_FILM" });
    const repaintFilmReview = repainting.prepareReview({
      target: { kind: "film", id: "fixture-film" },
    });
    TestValidator.equals(
      "even an identical-byte reroll selects a new attempt and stales prior review identity",
      namedFacts([
        ["rerolledAttached", () => rerolled.repainted],
        [
          "newAttemptId",
          () => rerolled.receipt?.attemptId !== acceptedReceipt?.attemptId,
        ],
        [
          "newOutputPath",
          () => rerolled.receipt?.output.path !== acceptedReceipt?.output.path,
        ],
        [
          "staleReviewIdentity",
          () => rerolledReview.fingerprint !== renditionReview.fingerprint,
        ],
        ["oneRendition", () => rerolledReview.renditions.length === 1],
        [
          "selectsReroll",
          () =>
            rerolledReview.renditions[0]?.path ===
            rerolled.receipt?.output.path,
        ],
      ]),
      {
        rerolledAttached: true,
        newAttemptId: true,
        newOutputPath: true,
        staleReviewIdentity: true,
        oneRendition: true,
        selectsReroll: true,
      },
    );
    TestValidator.equals(
      "film review preflights the selected repaint cut before approval",
      namedFacts([
        ["oneCut", () => repaintFilmReview.renditions.length === 1],
        [
          "deliveryValid",
          () =>
            repaintFilmReview.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "review-rendition-delivery-invalid",
            ) === false,
        ],
      ]),
      { oneCut: true, deliveryValid: true },
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
    TestValidator.equals(
      "submitReview accepts exact rendition evidence and refuses forged or uncited identities",
      namedFacts([
        ["exactAccepted", () => acceptedRenditionReview.accepted],
        [
          "forgedStale",
          () =>
            forgedRenditionReview.diagnostics.some(
              (diagnostic) => diagnostic.code === "review-evidence-stale",
            ),
        ],
        [
          "uncitedIncomplete",
          () =>
            uncitedRenditionReview.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "review-rendition-coverage-incomplete",
            ),
        ],
      ]),
      { exactAccepted: true, forgedStale: true, uncitedIncomplete: true },
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
    connectionCleanups.push({
      resource: "MCP server",
      cleanup: () => server.close(),
    });
    const client = new Client({
      name: "five-tool-schema-test",
      version: "0.0.0",
    });
    connectionCleanups.unshift({
      resource: "MCP client",
      cleanup: () => client.close(),
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
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
  } catch (error) {
    productionApplicationFailure = { error };
    throw error;
  } finally {
    await preserveProductionApplicationCleanup(
      productionApplicationFailure,
      connectionCleanups,
      () => fixture.dispose(),
    );
  }
};
