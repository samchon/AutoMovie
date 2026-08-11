import {
  AutoMovieCaptureTarget,
  AutoMovieDiagnosticCode,
  AutoMovieProductionFrameCapture,
  AutoMovieProductionGuideName,
  AutoMovieProductionShotRepaint,
  IAutoMovieCaptureFrame,
  IAutoMovieDiagnostic,
  IAutoMovieGetGuideDocument,
  IAutoMoviePrepareReview,
  IAutoMovieRepaintShot,
  IAutoMovieReviewTarget,
  IAutoMovieSubmitReview,
} from "@automovie/interface";
import path from "node:path";

import { AutoMovieProductionContext } from "./production/AutoMovieProductionContext";
import { AutoMovieProductionGuideService } from "./production/AutoMovieProductionGuideService";
import { AutoMovieProductionRepaintService } from "./production/AutoMovieProductionRepaintService";
import { canonicalizeAutoMovieJson } from "./production/contentIdentity";
import type { AutoMovieModelArchetypeRegistry } from "./production/productionArchetypes";
import { readAutoMovieProductionRegistry } from "./production/productionRegistry";

export {
  findAutoMovieDiagnosticCatalogEntry,
  listAutoMovieDiagnosticCatalog,
} from "./production/diagnosticCatalog";
export type { IAutoMovieDiagnosticCatalogEntry } from "./production/diagnosticCatalog";

/**
 * AutoMovie exposes only knowledge delivery, host-produced visual evidence,
 * optional structure-preserving repaint, and evidence-first review. Coding,
 * design records, compilation, geometry, status, rendering, and migration stay
 * in ordinary repository files and package/CLI APIs. Read the exact guides
 * named by a refusal, then retry the same tool.
 *
 * @author Samchon
 * @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-contract-guidance Limits MCP to guidance, host evidence, optional repaint, and review.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps ordinary source authoring and compilation outside the tool surface.
 * @evidenceExclude requirements/repaint/eligibility-and-prerequisites.md#repaint-delivery-declaration The tool verifies the production-wide delivery mode but does not author the shot source time, output purpose, or sequence policy required by this full declaration.
 * @evidenceExclude requirements/repaint/retries-seeds-and-variation.md#repaint-retry-budget-stop This five-tool surface runs one request and owns no user retry, cost, time, backoff, cancellation, or acceptance budget.
 * @evidenceExclude requirements/repaint/retries-seeds-and-variation.md#repaint-candidate-comparison The tool accepts one request result and does not compare or select among candidates.
 * @evidenceExclude requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance The host adapter returns one attempt outcome; durable histories of timeout, rate-limit, cancellation, or partial-output attempts belong outside this service.
 */
export class AutoMovieApplication {
  private readonly context: AutoMovieProductionContext;
  private readonly guides = new AutoMovieProductionGuideService();
  private readonly repaintService: AutoMovieProductionRepaintService;

  public constructor(props?: {
    /** Host-owned actual PNG capture. */
    capture?: AutoMovieProductionFrameCapture;
    /** Host-owned optional diffusion rendition. */
    repaint?: AutoMovieProductionShotRepaint;
    /** Host seed at or below the immutable project root. */
    projectRoot?: string;
    /** Host-selected default production for review and asset tools. */
    productionId?: string;
    /**
     * Archetype catalogue the served productions register.
     *
     * Omitted leaves the primitive catalogue this package ships with, which is
     * what a project that authors only shipped archetypes wants.
     */
    archetypes?: AutoMovieModelArchetypeRegistry;
  }) {
    this.context = new AutoMovieProductionContext(
      props?.capture,
      props?.projectRoot,
      props?.productionId,
      props?.archetypes,
    );
    this.repaintService = new AutoMovieProductionRepaintService(props?.repaint);
  }

  /**
   * Return one exact package-versioned guide and grant this session credit for
   * reading it. Unknown names fail with the complete valid production-guide
   * list. This call never reads or mutates project files.
   *
   * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Delivers one exact named topic document.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Returns versioned knowledge without project mutation.
   */
  public getGuideDocument(
    props: IAutoMovieGetGuideDocument.IProps,
  ): IAutoMovieGetGuideDocument {
    const output = this.guides.get(props.name);
    this.context.recordGuide(props.name);
    return output;
  }

  /**
   * Capture one current registry-owned shot frame or asset turntable view
   * through the host adapter. AutoMovie validates current compilation, decoded
   * PNG bytes, raster, runtime identity, target-local fingerprint, and atomic
   * content-addressed receipt. `captured:false` is never review evidence.
   *
   * @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-host-evidence Restricts capture to host-produced current evidence.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Returns verified pixels and identity instead of claiming a view was observed.
   */
  public async captureFrame(
    props: IAutoMovieCaptureFrame.IProps,
  ): Promise<IAutoMovieCaptureFrame> {
    this.requireGuides("captureFrame");
    if (
      props.target.productionId !== undefined &&
      (props.target.productionId.trim().length === 0 ||
        props.target.productionId.trim() !== props.target.productionId)
    )
      return {
        captured: false,
        productionId: props.target.productionId,
        reviewTarget: null,
        receipt: null,
        frame: null,
        diagnostics: [
          diagnostic(
            "capture-production-invalid",
            props.target.id,
            "captureFrame productionId must be a trimmed non-empty production namespace.",
          ),
        ],
      };
    let services: ReturnType<AutoMovieProductionContext["forProduction"]>;
    try {
      services = this.context.forProduction(props.target.productionId);
    } catch (error) {
      return {
        captured: false,
        productionId: props.target.productionId ?? "",
        reviewTarget: null,
        receipt: null,
        frame: null,
        diagnostics: [
          diagnostic(
            "capture-production-unregistered",
            props.target.id,
            error instanceof Error ? error.message : String(error),
          ),
        ],
      };
    }
    const failure = (
      code: AutoMovieDiagnosticCode,
      message: string,
    ): IAutoMovieCaptureFrame => ({
      captured: false,
      productionId: services.project.productionId,
      reviewTarget: null,
      receipt: null,
      frame: null,
      diagnostics: [diagnostic(code, props.target.id, message)],
    });
    let registry: ReturnType<typeof readAutoMovieProductionRegistry>;
    try {
      registry = readAutoMovieProductionRegistry(services.project);
    } catch (error) {
      return failure(
        "capture-registry-unavailable",
        error instanceof Error ? error.message : String(error),
      );
    }
    const registered =
      props.target.kind === "shot"
        ? registry.shots.some((target) => target.id === props.target.id)
        : registry.assets.some((target) => target.id === props.target.id);
    if (registered === false)
      return failure(
        "capture-target-missing",
        `Target "${props.target.kind}:${props.target.id}" is absent from compiler registry ${registry.inputFingerprint}. Correct its registration or compile current source before capture.`,
      );
    const preview =
      props.target.kind === "shot"
        ? await services.oracle.preview({
            target: { kind: "shot", id: props.target.id },
            time: props.target.time,
            pass: props.target.pass,
            width: props.width,
            height: props.height,
          })
        : await services.oracle.preview({
            target: {
              kind: "asset",
              id: props.target.id,
              angleDeg: props.target.angleDeg,
              elevationDeg: props.target.elevationDeg ?? 0,
              pose: props.target.pose ?? "rest",
            },
            time: 0,
            pass: props.target.pass,
            width: props.width,
            height: props.height,
          });
    if (
      preview.captured === false ||
      preview.renderBundle === null ||
      preview.frame === null
    )
      return {
        captured: false,
        productionId: services.project.productionId,
        reviewTarget: null,
        receipt: null,
        frame: null,
        diagnostics: preview.diagnostics,
      };
    const frame = preview.frame;
    const manifestPath = path.join(
      services.project.root,
      preview.renderBundle,
      "manifest.json",
    );
    const manifest = services.project.verifiedRenderManifest(manifestPath);
    let current = false;
    try {
      const status = services.compileStatus();
      const currentRegistry = readAutoMovieProductionRegistry(services.project);
      const relativeFrame = path
        .relative(
          path.dirname(manifestPath),
          path.join(services.project.root, frame.path),
        )
        .split(path.sep)
        .join("/");
      const targetMatches =
        props.target.kind === "shot"
          ? manifest?.target.kind === "shot" &&
            manifest.target.id === props.target.id
          : manifest?.target.kind === "asset" &&
            manifest.target.id === props.target.id &&
            manifest.target.angleDeg === props.target.angleDeg &&
            manifest.target.elevationDeg === (props.target.elevationDeg ?? 0) &&
            manifest.target.pose === (props.target.pose ?? "rest");
      current =
        manifest !== null &&
        preview.compileFingerprint === registry.inputFingerprint &&
        status.success &&
        status.compiler.inputFingerprint === registry.inputFingerprint &&
        canonicalizeAutoMovieJson(currentRegistry) ===
          canonicalizeAutoMovieJson(registry) &&
        manifest.compileFingerprint === registry.inputFingerprint &&
        targetMatches &&
        manifest.frames.some(
          (candidate) =>
            candidate.path === relativeFrame &&
            candidate.index === frame.index &&
            candidate.time === frame.time &&
            candidate.pass === frame.pass &&
            candidate.digest === frame.digest &&
            candidate.width === frame.width &&
            candidate.height === frame.height,
        );
    } catch {
      current = false;
    }
    if (current === false || manifest === null)
      return failure(
        "capture-receipt-invalid",
        "Captured pixels do not reopen through their atomic current render receipt. Discard them, correct the capture host, and retry.",
      );
    const target: AutoMovieCaptureTarget =
      props.target.kind === "shot"
        ? {
            kind: "shot",
            productionId: services.project.productionId,
            id: props.target.id,
            time: frame.time,
            pass: frame.pass,
          }
        : {
            kind: "asset",
            productionId: services.project.productionId,
            id: props.target.id,
            angleDeg: props.target.angleDeg,
            elevationDeg: props.target.elevationDeg ?? 0,
            pose: props.target.pose ?? "rest",
            pass: frame.pass,
          };
    return {
      captured: true,
      productionId: services.project.productionId,
      reviewTarget:
        props.target.kind === "shot"
          ? { kind: "shot", id: props.target.id }
          : { kind: "asset", id: props.target.id },
      receipt: {
        version: 1,
        productionId: services.project.productionId,
        target,
        compileFingerprint: registry.inputFingerprint,
        targetFingerprint: manifest.targetFingerprint,
        rendererIdentity: manifest.rendererIdentity,
        bundle: preview.renderBundle,
        outputDigest: frame.digest,
      },
      frame: {
        index: frame.index,
        time: frame.time,
        pass: frame.pass,
        path: frame.path,
        digest: frame.digest,
        width: frame.width,
        height: frame.height,
      },
      diagnostics: [],
    };
  }

  /**
   * Derive one optional diffusion rendition from current deterministic shot
   * pixels, structural controls, and manifest-owned references. A missing
   * adapter returns a concrete provisioning script. Accepted output is parsed
   * and atomically committed with source, model, parameters, references, and
   * output digests in one immutable receipt.
   *
   * @evidence requirements/repaint/scope-and-user-choice.md#repaint-provider-independence Leaves provider and candidate selection outside the application.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Commits adopted rendition bytes with their immutable derivation receipt.
   */
  public async repaintShot(
    props: IAutoMovieRepaintShot.IProps,
  ): Promise<IAutoMovieRepaintShot> {
    this.requireGuides("repaintShot");
    if (
      props.productionId.trim().length === 0 ||
      props.productionId.trim() !== props.productionId
    )
      return {
        repainted: false,
        productionId: props.productionId,
        shot: props.shot,
        receipt: null,
        diagnostics: [
          diagnostic(
            "repaint-production-invalid",
            props.shot,
            "repaintShot productionId must be a trimmed non-empty production namespace.",
          ),
        ],
      };
    let services: ReturnType<AutoMovieProductionContext["forProduction"]>;
    try {
      services = this.context.forProduction(props.productionId);
    } catch (error) {
      return {
        repainted: false,
        productionId: props.productionId,
        shot: props.shot,
        receipt: null,
        diagnostics: [
          diagnostic(
            "repaint-production-unregistered",
            props.shot,
            error instanceof Error ? error.message : String(error),
          ),
        ],
      };
    }
    if (services.project.graph().production?.visualDelivery !== "repainted")
      return {
        repainted: false,
        productionId: props.productionId,
        shot: props.shot,
        receipt: null,
        diagnostics: [
          diagnostic(
            "repaint-delivery-disabled",
            props.shot,
            'The current production design declares visualDelivery "deterministic". Change that tracked contract to "repainted", recompile current source, then read DIFFUSION_ENHANCE before requesting a rendition.',
          ),
        ],
      };
    this.requireGuides("repaintShot", AUTOMOVIE_REPAINT_GUIDE);
    return this.repaintService.repaint(services, props);
  }

  /**
   * Prepare the current four-surface review worksheet. It returns the exact
   * target fingerprint, mandatory axes, and current design/source/frame/outcome
   * evidence. It performs no aesthetic judgment and stores no verdict.
   *
   * @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-host-evidence Prepares current host evidence without deciding the review outcome.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Binds the returned worksheet to current target evidence.
   */
  public prepareReview(
    props: IAutoMoviePrepareReview.IProps,
  ): IAutoMoviePrepareReview {
    this.requireGuides("prepareReview", reviewGuide(props.target));
    return this.context.forProduction().review.prepare(props);
  }

  /**
   * Validate and atomically store one evidence-first review worksheet against
   * its freshly prepared fingerprint. Every criterion and current evidence
   * digest is rechecked. Corrections and completion basis precede the final
   * boolean deliberately; rejected or stale input stores no false completion.
   *
   * @evidence requirements/product/choice-and-external-services.md#product-delegation-not-proxy-decision Stores the delegated reviewer's submitted decision without replacing it.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-agent-input-output Treats the worksheet as author-agent input and returns validation state.
   */
  public submitReview(
    props: IAutoMovieSubmitReview.IProps,
  ): IAutoMovieSubmitReview {
    this.requireGuides("submitReview", reviewGuide(props.target));
    return this.context.forProduction().review.submit(props);
  }

  private requireGuides(
    tool: keyof AutoMovieApplication,
    targetGuide?: AutoMovieProductionGuideName,
  ): void {
    const required = [
      ...AUTOMOVIE_TOOL_GUIDES[tool],
      ...(targetGuide === undefined ? [] : [targetGuide]),
    ];
    const missing = required.filter(
      (guide) => this.context.hasGuide(guide) === false,
    );
    if (missing.length === 0) return;
    throw new Error(
      `${tool} is knowledge-gated: ${required.length - missing.length}/${required.length} required guides have session credit. Recover in order:\n${missing
        .map(
          (guide, index) =>
            `${index + 1}. getGuideDocument({ name: "${guide}" })`,
        )
        .join(
          "\n",
        )}\nThen retry ${tool} unchanged. This is a missing-knowledge precondition, not a payload validation error.`,
    );
  }
}

/**
 * Compile-time-complete guide declaration for the entire reflected surface.
 *
 * @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-contract-guidance Makes each tool's required contract guidance explicit.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Keeps knowledge prerequisites discoverable without another tool.
 */
export const AUTOMOVIE_TOOL_GUIDES = {
  getGuideDocument: [],
  captureFrame: ["AUTOMOVIE_OVERALL", "CAPTURE_FRAME"],
  repaintShot: ["AUTOMOVIE_OVERALL", "REPAINT_SHOT"],
  prepareReview: ["AUTOMOVIE_OVERALL"],
  submitReview: ["AUTOMOVIE_OVERALL"],
} as const satisfies Record<
  keyof AutoMovieApplication,
  readonly AutoMovieProductionGuideName[]
>;

/**
 * Additional guide required only by productions declaring repaint delivery.
 *
 * @evidence requirements/repaint/eligibility-and-prerequisites.md#repaint-current-evidence Applies repaint knowledge before current deterministic pixels can be handed off.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-eligibility-source-lock Gates the external handoff on declared eligibility.
 */
export const AUTOMOVIE_REPAINT_GUIDE =
  "DIFFUSION_ENHANCE" as const satisfies AutoMovieProductionGuideName;

/**
 * Target-specific review contract added to both review tools.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Selects guidance by exact review target kind.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Keeps the target-specific knowledge choice explicit.
 */
export const AUTOMOVIE_REVIEW_GUIDES = {
  asset: "REVIEW_ASSET",
  design: "REVIEW_DEPENDENCY",
  source: "REVIEW_DEPENDENCY",
  shot: "REVIEW_SHOT",
  rendition: "REVIEW_SHOT",
  sequence: "REVIEW_SEQUENCE",
  film: "REVIEW_FILM",
} as const satisfies Record<
  IAutoMovieReviewTarget["kind"],
  AutoMovieProductionGuideName
>;

const reviewGuide = (
  target: IAutoMovieReviewTarget,
): AutoMovieProductionGuideName => AUTOMOVIE_REVIEW_GUIDES[target.kind];

const diagnostic = (
  code: AutoMovieDiagnosticCode,
  target: string,
  message: string,
): IAutoMovieDiagnostic => ({
  code,
  category: "error",
  phase: "render",
  target,
  path: null,
  message,
});
