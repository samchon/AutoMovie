import {
  IAutoMovieCompileProject,
  IAutoMovieEraseDesignArtifact,
  IAutoMovieGetGuideDocument,
  IAutoMovieInspectProject,
  IAutoMovieOpenProject,
  IAutoMoviePrepareReview,
  IAutoMoviePreviewFrame,
  IAutoMovieQueryGeometry,
  IAutoMovieRenderBundleManifest,
  IAutoMovieSetAcceptanceScenario,
  IAutoMovieSetFormationDesign,
  IAutoMovieSetModelRecipe,
  IAutoMovieSetProductionDesign,
  IAutoMovieSetShotContract,
  IAutoMovieSetWorldDesign,
  IAutoMovieSubmitReview,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  AutoMovieProductionProject,
  createAutoMovieProductionMcpServer,
  productionRenderBundleRelativePath,
} from "@automovie/mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

/**
 * The public production facade is one closed map of AutoBe-style tool pairs.
 *
 * The runtime tool inventory below rejects an extra or missing method while
 * this structural assignment rejects a method whose named `IProps` and result
 * no longer form the advertised pair. Together they prevent a future inline
 * object parameter or detached `Input`/`Output` signature from silently joining
 * the MCP surface.
 */
interface IProductionToolContract {
  getGuideDocument(
    props: IAutoMovieGetGuideDocument.IProps,
  ): IAutoMovieGetGuideDocument;
  openProject(props: IAutoMovieOpenProject.IProps): IAutoMovieOpenProject;
  inspectProject(
    props: IAutoMovieInspectProject.IProps,
  ): IAutoMovieInspectProject;
  setProductionDesign(
    props: IAutoMovieSetProductionDesign.IProps,
  ): IAutoMovieSetProductionDesign;
  setModelRecipe(
    props: IAutoMovieSetModelRecipe.IProps,
  ): IAutoMovieSetModelRecipe;
  setWorldDesign(
    props: IAutoMovieSetWorldDesign.IProps,
  ): IAutoMovieSetWorldDesign;
  setFormationDesign(
    props: IAutoMovieSetFormationDesign.IProps,
  ): IAutoMovieSetFormationDesign;
  setShotContract(
    props: IAutoMovieSetShotContract.IProps,
  ): IAutoMovieSetShotContract;
  setAcceptanceScenario(
    props: IAutoMovieSetAcceptanceScenario.IProps,
  ): IAutoMovieSetAcceptanceScenario;
  eraseDesignArtifact(
    props: IAutoMovieEraseDesignArtifact.IProps,
  ): IAutoMovieEraseDesignArtifact;
  compileProject(
    props: IAutoMovieCompileProject.IProps,
  ): IAutoMovieCompileProject;
  queryGeometry(props: IAutoMovieQueryGeometry.IProps): IAutoMovieQueryGeometry;
  previewFrame(
    props: IAutoMoviePreviewFrame.IProps,
  ): Promise<IAutoMoviePreviewFrame>;
  prepareReview(props: IAutoMoviePrepareReview.IProps): IAutoMoviePrepareReview;
  submitReview(props: IAutoMovieSubmitReview.IProps): IAutoMovieSubmitReview;
}

/**
 * Minimum semantic signals that keep each production tool from degenerating
 * into a signature paraphrase.
 *
 * The exact prose may improve, but every description must continue to explain
 * its trust boundary, refusal or non-goal. Length alone cannot distinguish
 * useful context from repetition, so this table pins one positive
 * responsibility and one correction boundary per tool.
 */
const PRODUCTION_TOOL_DESCRIPTION_SIGNALS = {
  getGuideDocument: ["real precondition", "unknown name"],
  openProject: ["durable shared memory", "does not author shots"],
  inspectProject: ["authoritative status projection", "never repairs"],
  setProductionDesign: ["complete object", "downstream fingerprint"],
  setModelRecipe: ["compiler", "never imports arbitrary meshes"],
  setWorldDesign: ["geometry queries", "complete world"],
  setFormationDesign: ["compiler expands", "does not animate troops"],
  setShotContract: ["ordinary code", "independent"],
  setAcceptanceScenario: ["fingerprinted evidence", "does not implement tests"],
  eraseDesignArtifact: ["never cascades silently", "generated files"],
  compileProject: ["no-i/o", "partial generation"],
  queryGeometry: ["stale compilation", "read-only"],
  previewFrame: ["actual png", "full-film rendering"],
  prepareReview: ["fingerprint", "does not perform aesthetic judgment"],
  submitReview: ["false completion", "apply corrections"],
} as const;

/**
 * The canonical 15-tool production coordinator preserves its AutoBe-style
 * `IProps -> result` pairs, guide and resident-state gates, ownership and
 * freshness semantics, actual-frame evidence, and review compliance surface.
 *
 * Scenarios:
 *
 * 1. Project activation requires the overall guide, respects a host-fixed root,
 *    and reports initialization only once.
 * 2. Every named props/result pair and the exact 15-tool inventory remain
 *    structurally closed.
 * 3. Design setters, erasure, compilation, geometry, preview and review calls
 *    preserve their positive, refusal, stale and recovery paths.
 * 4. Inspection reports missing source, invalid design, unowned output, stale
 *    renders and unsafe links without following or repairing them.
 * 5. A live generated controller serves the guide, carries decision-ready
 *    instructions in the first 512 characters, and gives every tool substantial
 *    boundary context below the 1023-character hard cap.
 */
export const test_mcp_production_application = async (): Promise<void> => {
  const fixture = productionFixture();
  try {
    const deferredRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-production-deferred-"),
    );
    try {
      const deferred = new AutoMovieApplication({
        projectRoot: deferredRoot,
      });
      TestValidator.predicate(
        "a fixed root is not initialized before the guide and openProject",
        fs.existsSync(path.join(deferredRoot, ".automovie")) === false &&
          throws(() => deferred.inspectProject({})),
      );
      deferred.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
      const initialized = deferred.openProject({ root: deferredRoot });
      const reused = deferred.openProject({ root: deferredRoot });
      TestValidator.predicate(
        "openProject reports initialization only for the call that performed it",
        fs.existsSync(path.join(deferredRoot, ".automovie/manifest.json")) &&
          initialized.project.initialized &&
          reused.project.initialized === false,
      );
    } finally {
      fs.rmSync(deferredRoot, { force: true, recursive: true });
    }
    const application = new AutoMovieApplication({
      projectRoot: fixture.root,
    });
    const pairedApplication: IProductionToolContract = application;
    TestValidator.predicate(
      "the facade implements every named props and result pair",
      pairedApplication === application,
    );
    TestValidator.predicate(
      "overall guide is a real prerequisite",
      throws(() => application.openProject({ root: fixture.root })),
    );
    const overall = application.getGuideDocument({
      name: "AUTOMOVIE_OVERALL",
    });
    TestValidator.predicate(
      "overall guide explains coding-agent ownership",
      overall.content.includes("coding agent") && overall.version.length > 0,
    );
    const opened = application.openProject({ root: fixture.root });
    const reopenedSameSession = application.openProject({
      root: fixture.root,
    });
    TestValidator.equals(
      "fixed project root",
      opened.project.root,
      fixture.root,
    );
    TestValidator.equals(
      "same-session open reuses the active resident project",
      reopenedSameSession.project.root,
      opened.project.root,
    );
    TestValidator.predicate(
      "fixed host rejects a different root",
      throws(() => application.openProject({ root: `${fixture.root}-other` })),
    );
    const initial = application.inspectProject({});
    TestValidator.predicate(
      "compact inspection sees source and design",
      initial.design.production &&
        initial.source.bound.includes("src/shots/opening.ts") &&
        initial.reviews.entries.length > 0 &&
        initial.nextActions.some(
          (action) =>
            action.owner === "compile" && action.action === "compileProject",
        ),
    );

    for (const name of [
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
    ] as const)
      TestValidator.predicate(
        `guide ${name}`,
        application.getGuideDocument({ name }).content.length > 100,
      );

    TestValidator.predicate(
      "all bounded design setters accept the starter graph",
      application.setProductionDesign(productionDesign()).accepted &&
        application.setModelRecipe(modelRecipe()).accepted &&
        application.setWorldDesign(worldDesign()).accepted &&
        application.setFormationDesign(formationDesign()).accepted &&
        application.setShotContract(shotContract()).accepted &&
        acceptanceScenarios().every(
          (scenario) => application.setAcceptanceScenario(scenario).accepted,
        ),
    );
    TestValidator.predicate(
      "empty erase reason is rejected",
      throws(() =>
        application.eraseDesignArtifact({
          target: { kind: "formation", id: "line" },
          reason: " ",
        }),
      ),
    );
    const erased = application.eraseDesignArtifact({
      target: { kind: "formation", id: "line" },
      reason: "exercise the one-artifact eraser",
    });
    TestValidator.predicate(
      "unreferenced design erases exactly once",
      erased.accepted && erased.fingerprint === null,
    );
    const compiled = application.compileProject({ scope: "source" });
    TestValidator.predicate(
      "application delegates compiler and geometry oracles",
      compiled.success &&
        application.queryGeometry({
          request: { query: "ground", point: { x: 0, z: 0 } },
        }).result?.kind === "ground",
    );
    const changedWorld = worldDesign();
    changedWorld.landmarks = changedWorld.landmarks.map((landmark, index) =>
      index === 0
        ? { ...landmark, meaning: `${landmark.meaning} Changed.` }
        : landmark,
    );
    application.setWorldDesign(changedWorld);
    const staleGeometry = application.queryGeometry({
      request: { query: "ground", point: { x: 0, z: 0 } },
    });
    const staleInspection = application.inspectProject({});
    const refreshed = application.compileProject({ scope: "source" });
    TestValidator.predicate(
      "oracle and inspection refuse stale generated facts",
      staleGeometry.result === null &&
        staleGeometry.diagnostics.some(
          (diagnostic) => diagnostic.code === "generated-stale",
        ) &&
        staleInspection.nextActions.some(
          (action) =>
            action.owner === "compile" &&
            action.action === "compileProject" &&
            action.target === "generated-manifest",
        ) &&
        refreshed.success,
    );
    const renderManifest: IAutoMovieRenderBundleManifest = {
      version: 1,
      target: { kind: "shot", id: "opening" },
      compileFingerprint: refreshed.compiler.inputFingerprint,
      renderSpec: {
        target: "opening",
        frameFormat: { width: 2, height: 2, fps: 24 },
        toneMapping: "none",
        codec: "h264",
        pixelFormat: "yuv420p",
        crf: 17,
      },
      frames: [],
    };
    const renderBundle = productionRenderBundleRelativePath(renderManifest);
    const renderProject = AutoMovieProductionProject.open(fixture.root);
    renderProject.commitRenderBundle(renderBundle, new Map(), renderManifest);
    const currentRender = path.join(
      renderProject.renderRoot(),
      renderBundle,
      "manifest.json",
    );
    const malformedRender = path.join(
      fixture.root,
      "renders/application-malformed/manifest.json",
    );
    fs.mkdirSync(path.dirname(currentRender), { recursive: true });
    fs.mkdirSync(path.dirname(malformedRender), { recursive: true });
    TestValidator.predicate(
      "application test render is canonical",
      fs.existsSync(currentRender),
    );
    fs.writeFileSync(malformedRender, "{bad");
    const renderInspection = application.inspectProject({});
    TestValidator.predicate(
      "inspection parses render identity instead of substring matching",
      renderInspection.renders.some((render) => render.current) &&
        renderInspection.renders.some((render) => render.current === false),
    );
    const newerWorld = worldDesign();
    newerWorld.landmarks[0]!.meaning += " Newer.";
    application.setWorldDesign(newerWorld);
    const staleRenderInspection = application.inspectProject({});
    application.setWorldDesign(changedWorld);
    application.compileProject({ scope: "source" });
    TestValidator.predicate(
      "a bundle matching stale generated output is not reported as current",
      staleRenderInspection.renders.every((render) => render.current === false),
    );
    const sourceFile = path.join(fixture.root, "src/shots/opening.ts");
    const sourceBytes = fs.readFileSync(sourceFile);
    fs.rmSync(sourceFile);
    const missingSourceInspection = application.inspectProject({});
    fs.writeFileSync(sourceFile, sourceBytes);
    const modelFile = path.join(
      fixture.root,
      ".automovie/design/models/sentinel.json",
    );
    const modelBytes = fs.readFileSync(modelFile);
    const invalidModel = JSON.parse(modelBytes.toString("utf8"));
    invalidModel.parameters.height = 99;
    fs.writeFileSync(modelFile, JSON.stringify(invalidModel));
    const invalidDesignInspection = application.inspectProject({});
    fs.writeFileSync(modelFile, modelBytes);
    TestValidator.predicate(
      "inspection turns missing source and invalid design into next actions",
      missingSourceInspection.nextActions.some(
        (action) => action.owner === "source",
      ) &&
        invalidDesignInspection.nextActions.some(
          (action) => action.owner === "design",
        ),
    );
    const unavailable = await application.previewFrame({
      target: { kind: "shot", id: "opening" },
      time: 0,
      width: 2,
      height: 2,
    });
    const prepared = application.prepareReview({
      target: { kind: "source", path: "src/shots/opening.ts" },
    });
    const refused = application.submitReview({
      target: prepared.target,
      preparedFingerprint: prepared.fingerprint,
      observations: "",
      checks: [],
      corrections: [],
      completionBasis: "",
      complete: false,
    });
    TestValidator.predicate(
      "application exposes capture refusal and review validation",
      unavailable.captured === false && refused.accepted === false,
    );
    const unowned = path.join(
      fixture.root,
      "generated",
      "nested",
      "unowned.json",
    );
    fs.mkdirSync(path.dirname(unowned), { recursive: true });
    fs.writeFileSync(unowned, "{}");
    const unownedInspection = application.inspectProject({});
    TestValidator.predicate(
      "inspection reports and routes nested unowned generated files",
      unownedInspection.source.unownedGenerated.includes(
        "nested/unowned.json",
      ) &&
        unownedInspection.nextActions.some(
          (action) =>
            action.action === "remove-unowned-generated" &&
            action.target === "nested/unowned.json",
        ),
    );
    fs.rmSync(unowned);
    const outsideGenerated = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-inspect-generated-"),
    );
    const outsideRender = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-inspect-render-"),
    );
    try {
      fs.writeFileSync(path.join(outsideGenerated, "escape.json"), "{}");
      fs.writeFileSync(
        path.join(outsideRender, "foreign.json"),
        JSON.stringify({
          compileFingerprint: refreshed.compiler.inputFingerprint,
        }),
      );
      const generatedJunction = path.join(
        fixture.root,
        "generated",
        "outside-junction",
      );
      const renderManifestJunction = path.join(
        fixture.root,
        "renders",
        "application-linked",
        "manifest.json",
      );
      fs.symlinkSync(outsideGenerated, generatedJunction, "junction");
      fs.mkdirSync(path.dirname(renderManifestJunction), { recursive: true });
      fs.symlinkSync(outsideRender, renderManifestJunction, "junction");
      const linkedInspection = application.inspectProject({});
      TestValidator.predicate(
        "inspection reports generated junctions without following them",
        linkedInspection.source.unownedGenerated.includes("outside-junction") &&
          linkedInspection.source.unownedGenerated.every(
            (file) => file !== "outside-junction/escape.json",
          ),
      );
      TestValidator.predicate(
        "inspection never treats a render junction as a current manifest",
        linkedInspection.renders.some(
          (render) =>
            render.path === "renders/application-linked/manifest.json" &&
            render.current === false,
        ),
      );
    } finally {
      fs.rmSync(outsideGenerated, { force: true, recursive: true });
      fs.rmSync(outsideRender, { force: true, recursive: true });
    }

    const inactive = new AutoMovieApplication();
    inactive.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
    TestValidator.predicate(
      "resident operations require an active project",
      throws(() => inactive.inspectProject({})),
    );
    TestValidator.predicate(
      "unknown guide names fail loudly at runtime",
      throws(() =>
        inactive.getGuideDocument({
          name: "UNKNOWN" as "AUTOMOVIE_OVERALL",
        }),
      ),
    );

    const server = createAutoMovieProductionMcpServer();
    const client = new Client({
      name: "production-schema-test",
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
      const schemaChars = tools.reduce(
        (sum, tool) =>
          sum +
          JSON.stringify(tool.inputSchema).length +
          JSON.stringify(tool.outputSchema ?? {}).length,
        0,
      );
      TestValidator.equals(
        "production tool inventory",
        tools.map((tool) => tool.name),
        [
          "getGuideDocument",
          "openProject",
          "inspectProject",
          "setProductionDesign",
          "setModelRecipe",
          "setWorldDesign",
          "setFormationDesign",
          "setShotContract",
          "setAcceptanceScenario",
          "eraseDesignArtifact",
          "compileProject",
          "queryGeometry",
          "previewFrame",
          "prepareReview",
          "submitReview",
        ],
      );
      TestValidator.predicate(
        "schema and description ceilings",
        schemaChars <= 150_000 &&
          tools.every(
            (tool) =>
              JSON.stringify(tool.inputSchema).length +
                JSON.stringify(tool.outputSchema ?? {}).length <=
                45_000 &&
              (tool.description?.length ?? 0) >= 450 &&
              (tool.description?.length ?? 0) <= 1_023,
          ),
      );
      const instructions = client.getInstructions();
      const instructionLead = instructions?.slice(0, 512).toLowerCase() ?? "";
      TestValidator.predicate(
        "server instruction lead states ownership, entry point, and no internal LLM",
        instructionLead.includes("production-control mcp") &&
          instructionLead.includes("agent authors") &&
          instructionLead.includes("automovie_overall") &&
          instructionLead.includes("never runs an internal llm"),
      );
      for (const tool of tools) {
        const signals =
          PRODUCTION_TOOL_DESCRIPTION_SIGNALS[
            tool.name as keyof typeof PRODUCTION_TOOL_DESCRIPTION_SIGNALS
          ];
        const description =
          tool.description?.replace(/\s+/g, " ").toLowerCase() ?? "";
        TestValidator.predicate(
          `tool description carries responsibility and correction boundaries: ${tool.name}`,
          signals !== undefined &&
            signals.every((signal) => description.includes(signal)),
        );
        for (const [property, schema] of Object.entries(
          tool.inputSchema.properties ?? {},
        ))
          TestValidator.predicate(
            `top-level input property is documented: ${tool.name}.${property}`,
            typeof (schema as { description?: unknown }).description ===
              "string" &&
              (
                schema as {
                  description: string;
                }
              ).description.trim().length > 0,
          );
      }
      const guide = await client.callTool({
        name: "getGuideDocument",
        arguments: { name: "AUTOMOVIE_OVERALL" },
      });
      TestValidator.predicate(
        "live generated controller serves a guide",
        guide.isError !== true,
      );
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
  } finally {
    fixture.dispose();
  }
};
