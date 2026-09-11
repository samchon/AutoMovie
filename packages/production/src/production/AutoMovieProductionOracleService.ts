import {
  measureAutoMovieGeometry,
  renderAutoMovieSemanticMaskSidecar,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  AutoMovieDiagnosticCode,
  AutoMovieProductionFrameCapture,
  IAutoMovieBuildProjectOutput,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieGeneratedManifest,
  IAutoMovieModel,
  IAutoMoviePreviewFrameInput,
  IAutoMoviePreviewFrameOutput,
  IAutoMovieQueryGeometryInput,
  IAutoMovieQueryGeometryOutput,
  IAutoMovieRenderBundleManifest,
  IAutoMovieRenderSpec,
} from "@automovie/interface";
import fs from "node:fs";
import path from "node:path";
import type { PNG } from "pngjs";
import typia from "typia";

import {
  AutoMovieProductionInputRaceError,
  AutoMovieProductionProject,
  productionRenderBundleRelativePath,
} from "./AutoMovieProductionProject";
import { canonicalAutoMovieCaptureRuntimeIdentity } from "./captureRuntimeIdentity";
import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";
import { parseAutoMovieStructuredJson } from "./duplicateAwareJson";
import { readAutoMovieFilmTimeline } from "./filmTimeline";
import { productionRenderTargetFingerprint } from "./renderIdentity";
import { residentPngJs } from "./residentCodecs";
import {
  classifyAutoMovieProductionSemanticMaskEvidence,
  createAutoMovieProductionSemanticMaskReceipt,
} from "./semanticMaskEvidence";

/**
 * Read-only current builder status used to refuse stale oracle answers.
 */
export type AutoMovieBuildStatusProvider = () => IAutoMovieBuildProjectOutput;

/**
 * Compact geometry and actual-frame oracle over current compiled artifacts.
 *
 * Geometry queries read generated shot data and bounded design rather than
 * accepting a caller-supplied film graph. Preview delegates pixels to a
 * project-fixed host adapter, decodes the PNG, binds it to the current compile
 * fingerprint and atomically records a content-addressed render bundle.
 */
export class AutoMovieProductionOracleService {
  /** Bind current project state and optional host evidence adapters. */
  public constructor(
    private readonly project: AutoMovieProductionProject,
    private readonly capture?: AutoMovieProductionFrameCapture,
    private readonly buildStatus?: AutoMovieBuildStatusProvider,
  ) {}

  /**
   * Measure one compact geometry question against the current compile.
   */
  public query(
    input: IAutoMovieQueryGeometryInput,
  ): IAutoMovieQueryGeometryOutput {
    const request = input.request;
    const generated = this.project.generatedManifest();
    const generatedManifestPath = normalizeSlash(
      path.relative(
        this.project.root,
        this.project.trackedStatePath("generated-manifest.json"),
      ),
    );
    if (generated === null)
      return queryFailure(request.query, null, {
        code: "compile-missing",
        category: "error",
        phase: "compile",
        target: request.query,
        path: generatedManifestPath,
        message:
          "No current compile exists. Run the scaffold source compile command before using the geometry API.",
      });
    const freshness = this.freshnessDiagnostic(generated);
    if (freshness !== null)
      return queryFailure(request.query, generated.inputFingerprint, freshness);
    try {
      const graph = this.project.graph();
      const shots = readCompiledShots(this.project, generated.inputFingerprint);
      const result = measureAutoMovieGeometry({
        request,
        design: graph,
        compiled: shots,
        // Read only for the question that needs it, after the compiled shots,
        // which is the order a film-time answer has always read them in.
        timeline:
          request.query === "film-time"
            ? readAutoMovieFilmTimeline(
                this.project,
                generated.inputFingerprint,
              )
            : null,
      });
      return {
        query: request.query,
        compileFingerprint: generated.inputFingerprint,
        result,
        diagnostics: [],
      };
    } catch (error) {
      return queryFailure(request.query, generated.inputFingerprint, {
        code: "geometry-selector-invalid",
        category: "error",
        phase: "compile",
        target: request.query,
        path: null,
        message:
          error instanceof Error
            ? error.message
            : "Geometry query failed. Correct its current selectors.",
      });
    }
  }

  /**
   * Capture and verify one actual PNG frame from the current compile.
   */
  public async preview(
    input: IAutoMoviePreviewFrameInput,
  ): Promise<IAutoMoviePreviewFrameOutput> {
    const generated = this.project.generatedManifest();
    if (generated === null)
      throw new Error(
        "Capture requires a current source compile. Run the scaffold compile command before requesting pixels.",
      );
    const freshness = this.freshnessDiagnostic(generated);
    if (freshness !== null)
      return previewFailure(
        generated.inputFingerprint,
        freshness.code,
        freshness.message,
      );
    const graph = this.project.graph();
    const production = graph.production;
    if (production === null)
      throw new Error(
        "Capture requires a production frame format. Create the tracked production design record and run the scaffold compile command.",
      );
    const pass = input.pass ?? "beauty";
    const width = input.width ?? production.frameFormat.width;
    const height = input.height ?? production.frameFormat.height;
    const fps = production.frameFormat.fps;
    if (
      Number.isInteger(width) === false ||
      Number.isInteger(height) === false ||
      width <= 0 ||
      height <= 0 ||
      width > production.frameFormat.width ||
      height > production.frameFormat.height ||
      Number.isFinite(input.time) === false ||
      input.time < 0
    )
      return previewFailure(
        generated.inputFingerprint,
        "preview-input-invalid",
        `Capture time must be non-negative; dimensions must be positive integers no larger than the validated ${production.frameFormat.width}x${production.frameFormat.height} production frame. Correct the capture request.`,
      );
    let duration: number | undefined;
    let requestedTime = input.time;
    const targetPath =
      input.target.kind === "shot"
        ? `shots/${encodeAutoMoviePathSegment(input.target.id)}.json`
        : `models/${encodeAutoMoviePathSegment(input.target.id)}.json`;
    const targetMaterialized = generated.files.some(
      (file) => file.path === targetPath,
    );
    if (input.target.kind === "shot")
      duration = graph.shots.get(input.target.id)?.durationSeconds;
    else {
      if (
        graph.models.has(input.target.id) === false ||
        Number.isFinite(input.target.angleDeg) === false ||
        input.target.angleDeg < 0 ||
        input.target.angleDeg >= 360 ||
        Number.isFinite(input.target.elevationDeg) === false ||
        input.target.elevationDeg < -85 ||
        input.target.elevationDeg > 85
      )
        return previewFailure(
          generated.inputFingerprint,
          "preview-input-invalid",
          "Asset preview requires a current model, angleDeg in [0, 360), and elevationDeg in [-85, 85]. Correct the isolated turntable target.",
        );
      duration = 12;
      requestedTime = input.target.angleDeg / 30;
      if (input.target.pose === "rom-extremes")
        try {
          const validation = typia.validateEquals<IAutoMovieModel>(
            parseAutoMovieStructuredJson({
              record: "compiled-model",
              bytes: this.project.readGeneratedFile(targetPath),
            }),
          );
          if (validation.success === false || validation.data.skeleton === null)
            throw new Error("the compiled model has no humanoid skeleton");
        } catch (error) {
          return previewFailure(
            generated.inputFingerprint,
            "preview-input-invalid",
            `Asset ROM-extremes capture is unavailable because ${
              error instanceof Error ? error.message : String(error)
            }. Use rest pose for props or compile a valid rig.`,
          );
        }
      const part = input.target.part;
      if (part !== undefined) {
        let model: IAutoMovieModel;
        try {
          const validation = typia.validateEquals<IAutoMovieModel>(
            parseAutoMovieStructuredJson({
              record: "compiled-model",
              bytes: this.project.readGeneratedFile(targetPath),
            }),
          );
          if (validation.success === false)
            throw new Error("the compiled model has an invalid schema");
          model = validation.data;
        } catch (error) {
          return previewFailure(
            generated.inputFingerprint,
            "preview-input-invalid",
            `Asset part capture is unavailable because ${
              error instanceof Error ? error.message : String(error)
            }. Compile the model before framing one of its parts.`,
          );
        }
        if (model.origin === "imported")
          return previewFailure(
            generated.inputFingerprint,
            "preview-input-invalid",
            `Compiled model "${input.target.id}" is imported geometry, whose interior nodes this surface does not address. Capture the whole model, or author the piece you need to frame as its own recipe part.`,
          );
        if (model.parts.some((candidate) => candidate.id === part) === false)
          return previewFailure(
            generated.inputFingerprint,
            "preview-input-invalid",
            `Compiled model "${input.target.id}" has no part "${part}". Frame one of its current parts: ${namedParts(model)}.`,
          );
      }
    }
    if (duration === undefined || targetMaterialized === false)
      return previewFailure(
        generated.inputFingerprint,
        "preview-target-missing",
        `Target "${input.target.kind}:${input.target.id}" is absent from current builder-owned output. Correct the target or compile its source before capturing.`,
      );
    if (requestedTime > duration)
      return previewFailure(
        generated.inputFingerprint,
        "preview-input-invalid",
        `Preview time ${requestedTime} exceeds target duration ${duration}. Choose a current in-range frame time.`,
      );
    if (this.capture === undefined)
      return previewFailure(
        generated.inputFingerprint,
        "capture-host-unavailable",
        "This project supplies no project-fixed frame capture. Run the scaffold preview host, or pass a capture adapter.",
      );
    const targetFingerprint = productionRenderTargetFingerprint(
      this.project,
      generated,
      input.target,
    );
    const index = Math.min(
      Math.round(requestedTime * fps),
      Math.floor(duration * fps),
    );
    const time = index / fps;
    const crop =
      input.target.kind === "shot" ? production.frameFormat.crop : undefined;
    let captured: Awaited<ReturnType<AutoMovieProductionFrameCapture>>;
    try {
      captured = await this.capture({
        ...input,
        time,
        width,
        height,
        ...(crop === undefined ? {} : { crop: structuredClone(crop) }),
        projectRoot: this.project.root,
        productionId: this.project.productionId,
        compileFingerprint: generated.inputFingerprint,
      });
    } catch (error) {
      return previewFailure(
        generated.inputFingerprint,
        "capture-failed",
        `${
          error instanceof Error ? error.message : String(error)
        }. Correct the capture host and retry.`,
      );
    }
    const captureInputsCurrent = (): boolean => {
      const current = this.project.generatedManifest();
      return (
        current !== null &&
        current.inputFingerprint === generated.inputFingerprint &&
        this.freshnessDiagnostic(current) === null &&
        productionRenderTargetFingerprint(
          this.project,
          current,
          input.target,
        ) === targetFingerprint
      );
    };
    if (captureInputsCurrent() === false)
      return previewFailure(
        generated.inputFingerprint,
        "capture-input-changed",
        "Production source, design, generated output, or declared renderer inputs changed while the PNG was being captured. Discard this mixed snapshot, compile the current project, and capture the frame again.",
      );
    let png: PNG;
    try {
      if (captured.bytes.length === 0)
        throw new Error("capture returned zero bytes");
      png = residentPngJs().PNG.sync.read(Buffer.from(captured.bytes));
    } catch (error) {
      return previewFailure(
        generated.inputFingerprint,
        "capture-png-invalid",
        `${
          error instanceof Error ? error.message : String(error)
        }. The preview host must return a decodable PNG.`,
      );
    }
    let rendererIdentity: string;
    try {
      rendererIdentity = canonicalAutoMovieCaptureRuntimeIdentity(
        captured.runtimeIdentity,
      );
    } catch (error) {
      return previewFailure(
        generated.inputFingerprint,
        "capture-renderer-identity-invalid",
        `${String(error)} Correct the capture adapter or run npm run capture:install and npm run capture:doctor before these pixels enter a render bundle.`,
      );
    }
    const dialogueRuntimeIdentity = captured.dialogueRuntimeIdentity;
    if (
      dialogueRuntimeIdentity !== null &&
      /^sha256:[0-9a-f]{64}$/u.test(dialogueRuntimeIdentity) === false
    )
      return previewFailure(
        generated.inputFingerprint,
        "capture-dialogue-identity-invalid",
        "The capture host returned an invalid dialogue runtime identity. Rebuild the current dialogue runtime and capture the frame again.",
      );
    if (input.target.kind !== "shot" && dialogueRuntimeIdentity !== null)
      return previewFailure(
        generated.inputFingerprint,
        "capture-dialogue-identity-invalid",
        "A non-shot capture must not claim a dialogue runtime identity. Clear the capture host dialogue state and capture the asset again.",
      );
    const semanticStatus =
      input.target.kind === "shot"
        ? classifyAutoMovieProductionSemanticMaskEvidence({
            observation: captured.semanticMask,
            expectedShot: input.target.id,
          })
        : captured.semanticMask.status === "not-run"
          ? null
          : { status: "foreign" as const };
    if (
      semanticStatus !== null &&
      semanticStatus.status !== "complete" &&
      semanticStatus.status !== "incomplete" &&
      (pass === "mask" || captured.semanticMask.status === "available")
    )
      return previewFailure(
        generated.inputFingerprint,
        "capture-failed",
        `The capture host returned ${semanticStatus.status} semantic evidence${"reason" in semanticStatus ? `: ${semanticStatus.reason}` : "."} Correct the capture host and capture this frame again.`,
      );
    if (
      captured.width !== width ||
      captured.height !== height ||
      png.width !== width ||
      png.height !== height
    )
      return previewFailure(
        generated.inputFingerprint,
        "capture-size-mismatch",
        `Requested ${width}x${height}, adapter reported ${captured.width}x${captured.height}, and PNG decoded as ${png.width}x${png.height}. Fix the preview host viewport.`,
      );
    if (hasVisiblePixelVariance(png) === false)
      return previewFailure(
        generated.inputFingerprint,
        "capture-png-blank",
        "The decoded PNG has no visible pixel variance. Fix the camera, lighting, scene, or preview host before using this frame as review evidence.",
      );
    const renderSpec: IAutoMovieRenderSpec = {
      target: input.target.id,
      frameFormat: {
        width,
        height,
        fps,
        ...(crop === undefined ? {} : { crop: structuredClone(crop) }),
      },
      toneMapping: "none",
      codec: "h264",
      pixelFormat: "yuv420p",
      crf: 17,
    };
    const relativeBundle = productionRenderBundleRelativePath({
      target: input.target,
      dialogueRuntimeIdentity,
      rendererIdentity,
      targetFingerprint,
      renderSpec,
    });
    const suffix = pass === "beauty" ? "" : `.${pass}`;
    const relativeFrame = `preview/frame_${String(index).padStart(6, "0")}${suffix}.png`;
    const bytes = Buffer.from(captured.bytes);
    const digest = digestAutoMovieBytes(bytes);
    const bundleRoot = path.join(
      this.project.renderRoot(),
      ...relativeBundle.split("/"),
    );
    const nextFrame = {
      index,
      time,
      pass,
      path: relativeFrame,
      digest,
      width,
      height,
    };
    const semanticSidecar =
      pass === "mask" &&
      semanticStatus !== null &&
      (semanticStatus.status === "complete" ||
        semanticStatus.status === "incomplete")
        ? {
            path: `preview/frame_${String(index).padStart(6, "0")}.mask.json`,
            bytes: Buffer.from(
              renderAutoMovieSemanticMaskSidecar(semanticStatus.evidence.mask),
              "utf8",
            ),
            evidence: semanticStatus.evidence,
          }
        : null;
    // A shot mask frame always reaches here with complete or incomplete
    // same-shot evidence: every other classification was refused above, so
    // the sidecar is present exactly when the target is a shot.
    const retained = retainedBundleFrames(
      this.project,
      bundleRoot,
      {
        target: input.target,
        compileFingerprint: generated.inputFingerprint,
        dialogueRuntimeIdentity,
        rendererIdentity,
        targetFingerprint,
        renderSpec,
      },
      duration,
    ).filter((frame) => frame.index !== index || frame.pass !== pass);
    const frames = [...retained, nextFrame].sort(
      (left, right) =>
        left.index - right.index || compareCodeUnits(left.pass, right.pass),
    );
    const priorManifest = this.project.verifiedRenderManifest(
      path.join(bundleRoot, "manifest.json"),
    );
    const retainedKeys = new Set(
      retained.map((frame) => `${frame.index}\u0000${frame.pass}`),
    );
    const semanticMasks = [
      ...(priorManifest?.semanticMasks.filter((record) =>
        retainedKeys.has(`${record.frame}\u0000${record.pass}`),
      ) ?? []),
      ...(semanticSidecar === null
        ? []
        : [
            createAutoMovieProductionSemanticMaskReceipt({
              frame: index,
              expectedShot: input.target.id,
              evidence: semanticSidecar.evidence,
              sidecar: semanticSidecar,
            }),
          ]),
      // One bundle carries at most one mask receipt per frame, all for the
      // target shot, so frame order is total.
    ].sort((left, right) => left.frame - right.frame);
    const manifest: IAutoMovieRenderBundleManifest = {
      version: 6,
      target: input.target,
      compileFingerprint: generated.inputFingerprint,
      dialogueRuntimeIdentity,
      rendererIdentity,
      targetFingerprint,
      renderSpec,
      frames,
      semanticMasks,
    };
    try {
      this.project.commitRenderBundle(
        relativeBundle,
        new Map([
          [relativeFrame, bytes],
          ...(semanticSidecar === null
            ? []
            : ([[semanticSidecar.path, semanticSidecar.bytes]] as const)),
        ]),
        manifest,
        captureInputsCurrent,
      );
    } catch (error) {
      if (error instanceof AutoMovieProductionInputRaceError)
        return previewFailure(
          generated.inputFingerprint,
          "capture-input-changed",
          `${error.message} Discard this mixed snapshot, compile the current project, and capture the frame again.`,
        );
      throw error;
    }
    return {
      captured: true,
      compileFingerprint: generated.inputFingerprint,
      renderBundle: normalizeSlash(
        path.relative(this.project.root, bundleRoot),
      ),
      frame: {
        index,
        time,
        pass,
        path: normalizeSlash(
          path.join(
            path.relative(this.project.root, bundleRoot),
            relativeFrame,
          ),
        ),
        mime: "image/png",
        digest,
        width,
        height,
      },
      diagnostics: [],
    };
  }

  private freshnessDiagnostic(
    generated: IAutoMovieGeneratedManifest,
  ): IAutoMovieDiagnostic | null {
    const generatedManifestPath = normalizeSlash(
      path.relative(
        this.project.root,
        this.project.trackedStatePath("generated-manifest.json"),
      ),
    );
    if (this.buildStatus === undefined) return null;
    const status = this.buildStatus();
    if (status.builder.inputFingerprint !== generated.inputFingerprint)
      return {
        code: "generated-stale",
        category: "error",
        phase: "compile",
        target: "generated-manifest",
        path: generatedManifestPath,
        message: `Generated input ${generated.inputFingerprint} differs from current ${status.builder.inputFingerprint}. Run the scaffold compile command before requesting oracle evidence.`,
      };
    const error = status.diagnostics.find(
      (diagnostic) => diagnostic.category === "error",
    );
    if (status.success === false || error !== undefined)
      return {
        code: "compile-current-invalid",
        category: "error",
        phase: "compile",
        target: "generated-manifest",
        path: generatedManifestPath,
        message: `Current source does not pass the read-only builder gate${error === undefined ? "" : `: ${error.message}`}. Correct it and run the scaffold compile command before requesting oracle evidence.`,
      };
    return null;
  }
}

const readCompiledShots = (
  project: AutoMovieProductionProject,
  fingerprint: AutoMovieContentDigest,
): ReadonlyMap<string, IAutoMovieCompiledShotSource> => {
  const manifest = project.generatedManifest();
  if (manifest?.inputFingerprint !== fingerprint)
    throw new Error("Generated manifest changed during geometry query.");
  const output = new Map<string, IAutoMovieCompiledShotSource>();
  for (const entry of manifest.files
    .filter((file) => file.path.startsWith("shots/"))
    .sort((left, right) => compareCodeUnits(left.path, right.path))) {
    const bytes = project.readGeneratedFile(entry.path);
    if (digestAutoMovieBytes(bytes) !== entry.digest)
      throw new Error(
        `Generated shot "${entry.path}" changed after builder freshness validation. Run the scaffold compile command before requesting oracle evidence.`,
      );
    const raw = parseAutoMovieStructuredJson({
      record: "compiled-shot",
      bytes,
    });
    const validation = typia.validateEquals<IAutoMovieCompiledShotSource>(raw);
    if (validation.success === false)
      throw new Error(
        `Generated shot "${entry.path}" is invalid. Run the scaffold compile command after correcting source.`,
      );
    output.set(validation.data.shot.id, validation.data);
  }
  return output;
};

/**
 * The frames this bundle already holds, kept without opening one of them.
 *
 * Appending a frame used to read, digest, and decode every frame already in the
 * bundle, and then write all of them back. That made one capture cost the whole
 * bundle and a capture loop cost its square: 1.7 seconds per frame at 139
 * frames, 14 seconds at 163, which is what made a 432-capture scenario take
 * hours and stop being a canary anybody would run (`#1957`).
 *
 * Two of those three were duplicate work. `verifiedRenderManifest` already
 * reads every frame in the bundle, digests it against the manifest, and probes
 * its raster, so decoding each one a second time proved nothing the read had not
 * just proved, and pixel variance cannot change while the digest holds. The
 * rewrite proved even less: the bytes were being written back exactly as they
 * were read, which is what made an append cost the bundle twice over.
 *
 * So the retained bytes are neither decoded again nor rewritten. The caller
 * commits the one new frame beside the manifest, and the frames already on disk
 * stay where the captures that made them put them.
 *
 * What remains here is the part that is about this append rather than about the
 * bytes: the manifest must describe this exact target and render spec, a frame's
 * index and time must agree with the production clock, and its file must still
 * be inside this bundle and still exist. A frame whose file is gone is dropped,
 * so the manifest never names one that is not there.
 */
const retainedBundleFrames = (
  project: AutoMovieProductionProject,
  bundleRoot: string,
  expected: Pick<
    IAutoMovieRenderBundleManifest,
    | "target"
    | "compileFingerprint"
    | "dialogueRuntimeIdentity"
    | "rendererIdentity"
    | "targetFingerprint"
    | "renderSpec"
  >,
  duration: number,
): IAutoMovieRenderBundleManifest["frames"] => {
  const manifest = project.verifiedRenderManifest(
    path.join(bundleRoot, "manifest.json"),
  );
  if (
    manifest === null ||
    Buffer.from(
      canonicalAutoMovieJsonBytes({
        target: manifest.target,
        dialogueRuntimeIdentity: manifest.dialogueRuntimeIdentity,
        rendererIdentity: manifest.rendererIdentity,
        targetFingerprint: manifest.targetFingerprint,
        renderSpec: manifest.renderSpec,
      }),
    ).equals(
      Buffer.from(
        canonicalAutoMovieJsonBytes({
          target: expected.target,
          dialogueRuntimeIdentity: expected.dialogueRuntimeIdentity,
          rendererIdentity: expected.rendererIdentity,
          targetFingerprint: expected.targetFingerprint,
          renderSpec: expected.renderSpec,
        }),
      ),
    ) === false
  )
    return [];
  const retained: IAutoMovieRenderBundleManifest["frames"] = [];
  const bundlePrefix = `${path.resolve(bundleRoot)}${path.sep}`;
  for (const frame of manifest.frames)
    try {
      if (
        Number.isSafeInteger(frame.index) === false ||
        frame.index < 0 ||
        frame.time !== frame.index / manifest.renderSpec.frameFormat.fps ||
        frame.time > duration
      )
        continue;
      const absolute = path.resolve(bundleRoot, frame.path);
      if (absolute.startsWith(bundlePrefix) === false) continue;
      if (fs.statSync(absolute).isFile() === false) continue;
      retained.push(frame);
    } catch {
      continue;
    }
  return retained;
};

/**
 * Name the parts a caller may frame, bounded so the refusal stays readable.
 *
 * A building compiles to hundreds of parts, and a refusal that pastes all of
 * them is one nobody reads. The first twenty plus a count is enough to correct
 * a misspelling and to see that the inventory is larger than the message.
 */
const namedParts = (model: IAutoMovieModel): string => {
  const ids = model.parts.map((part) => part.id).sort(compareCodeUnits);
  return ids.length <= 20
    ? ids.join(", ")
    : `${ids.slice(0, 20).join(", ")}, and ${ids.length - 20} more`;
};

const previewFailure = (
  compileFingerprint: AutoMovieContentDigest,
  code: AutoMovieDiagnosticCode,
  message: string,
): IAutoMoviePreviewFrameOutput => ({
  captured: false,
  compileFingerprint,
  renderBundle: null,
  frame: null,
  diagnostics: [
    {
      code,
      category: "error",
      phase: "render",
      target: "preview",
      path: null,
      message,
    },
  ],
});

const queryFailure = (
  query: IAutoMovieQueryGeometryOutput["query"],
  compileFingerprint: AutoMovieContentDigest | null,
  diagnostic: IAutoMovieDiagnostic,
): IAutoMovieQueryGeometryOutput => ({
  query,
  compileFingerprint,
  result: null,
  diagnostics: [diagnostic],
});

const normalizeSlash = (value: string): string =>
  value.split(path.sep).join("/");

const hasVisiblePixelVariance = (png: PNG): boolean => {
  if (png.data.length < 8) return false;
  const alpha = png.data[3]!;
  const first = [
    png.data[0]! * alpha,
    png.data[1]! * alpha,
    png.data[2]! * alpha,
    alpha,
  ];
  for (let offset = 4; offset < png.data.length; offset += 4) {
    const currentAlpha = png.data[offset + 3]!;
    if (
      png.data[offset]! * currentAlpha !== first[0] ||
      png.data[offset + 1]! * currentAlpha !== first[1] ||
      png.data[offset + 2]! * currentAlpha !== first[2] ||
      currentAlpha !== first[3]
    )
      return true;
  }
  return false;
};
