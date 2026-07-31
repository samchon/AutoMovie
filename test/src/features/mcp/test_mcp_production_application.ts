import {
  AutoMovieProductionFrameCapture,
  IAutoMovieAssetManifest,
  IAutoMovieCaptureFrame,
  IAutoMovieGetGuideDocument,
  IAutoMoviePrepareReview,
  IAutoMovieRepaintShot,
  IAutoMovieSubmitReview,
} from "@automovie/interface";
import {
  AUTOMOVIE_PRODUCTION_GUIDE_NAMES,
  AUTOMOVIE_TOOL_GUIDES,
  AutoMovieApplication,
  AutoMovieProductionProject,
  compileAutoMovieProduction,
  createAutoMovieMcpServer,
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

/** The public MCP boundary is exactly knowledge, evidence, and judgment. */
export const test_mcp_production_application = async (): Promise<void> => {
  const fixture = productionFixture();
  try {
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
    fs.writeFileSync(
      assetManifestPath,
      `${JSON.stringify(assetManifest, null, 2)}\n`,
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
    TestValidator.predicate(
      "the non-MCP compiler API publishes the first production registry",
      compileAutoMovieProduction({
        projectRoot: fixture.root,
        productionId: "fixture-film",
        scope: "source",
      }).success,
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
        productionDesign({ id: "second-film", title: "second-film" }),
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
        gated.includes('getGuideDocument({ name: "PRODUCTION_RENDER" })') &&
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
          'getGuideDocument({ name: "PRODUCTION_RENDER" })',
        ) &&
        partiallyGated.includes(
          'getGuideDocument({ name: "AUTOMOVIE_OVERALL" })',
        ) === false,
    );
    application.getGuideDocument({ name: "PRODUCTION_RENDER" });
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
    TestValidator.predicate(
      "capture resolves only current registry ids and isolates two productions",
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
        capturedProductionIds.includes("second-film"),
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
        "PRODUCTION_REVIEW",
        "PRODUCTION_RENDER",
      ],
    );

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

    const renditionBytes = await productionH264Mp4({
      width: 16,
      height: 16,
      fps: 2,
      frameCount: 2,
    });
    const repainting = new AutoMovieApplication({
      projectRoot: fixture.root,
      productionId: "fixture-film",
      capture,
      repaint: async (_input) => ({
        bytes: renditionBytes,
        mediaType: "video/mp4",
        runtimeIdentity: {
          protocolVersion: "automovie.repaint-runtime.v1",
          provider: "fixture",
          model: "fixture-video",
          version: "1",
          execution: "local",
        },
      }),
    });
    repainting.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
    repainting.getGuideDocument({ name: "PRODUCTION_RENDER" });
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
        repainted.receipt.controls.some((control) => control.pass === "pose") &&
        repainted.receipt.references[0]?.digest === reference.digest &&
        repainted.receipt.adapterIdentity.includes("fixture-video") &&
        repainted.receipt.output.digest.startsWith("sha256:") &&
        fs.existsSync(
          path.join(
            fixture.root,
            "renders",
            "fixture-film",
            repainted.receipt.output.path,
          ),
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
