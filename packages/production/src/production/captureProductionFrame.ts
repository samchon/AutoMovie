import {
  AutoMovieCaptureTarget,
  AutoMovieDiagnosticCode,
  IAutoMovieCaptureFrame,
  IAutoMovieDiagnostic,
  IAutoMoviePreviewFrameOutput,
  IAutoMovieRenderBundleManifest,
} from "@automovie/interface";
import path from "node:path";

import type {
  AutoMovieProductionContext,
  IAutoMovieProductionServices,
} from "./AutoMovieProductionContext";
import { canonicalizeAutoMovieJson } from "./contentIdentity";
import { readAutoMovieProductionRegistry } from "./productionRegistry";

/** Verified frame metadata the oracle returns with captured pixels. */
type IAutoMoviePreviewFrame = NonNullable<
  IAutoMoviePreviewFrameOutput["frame"]
>;

/**
 * Capture one registry-owned shot frame or asset turntable view and prove it.
 *
 * Every refusal here is returned as a diagnostic rather than thrown. A
 * `captured:false` answer with its reason is what a reviewing client reads and
 * corrects.
 *
 * The knowledge gate is the one exception. It precedes the call rather than
 * answering it, so an ungated caller gets no outcome to interpret.
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Captures one requested frame or turntable view and proves it, so an author answers the current question without rendering the film and without claiming more than that view.
 */
export const captureAutoMovieProductionFrame = async (
  context: AutoMovieProductionContext,
  props: IAutoMovieCaptureFrame.IProps,
): Promise<IAutoMovieCaptureFrame> => {
  if (
    props.target.productionId !== undefined &&
    (props.target.productionId.trim().length === 0 ||
      props.target.productionId.trim() !== props.target.productionId)
  )
    return refusal(props.target.productionId, [
      diagnostic(
        "capture-production-invalid",
        props.target.id,
        "captureFrame productionId must be a trimmed non-empty production namespace.",
      ),
    ]);
  let services: IAutoMovieProductionServices;
  try {
    services = context.forProduction(props.target.productionId);
  } catch (error) {
    return refusal(props.target.productionId ?? "", [
      diagnostic(
        "capture-production-unregistered",
        props.target.id,
        error instanceof Error ? error.message : String(error),
      ),
    ]);
  }
  const failure = (
    code: AutoMovieDiagnosticCode,
    message: string,
  ): IAutoMovieCaptureFrame =>
    refusal(services.project.productionId, [
      diagnostic(code, props.target.id, message),
    ]);
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
  const preview = await previewCaptureTarget(services, props);
  if (
    preview.captured === false ||
    preview.renderBundle === null ||
    preview.frame === null
  )
    return refusal(services.project.productionId, preview.diagnostics);
  const frame = preview.frame;
  const manifestPath = path.join(
    services.project.root,
    preview.renderBundle,
    "manifest.json",
  );
  const manifest = services.project.verifiedRenderManifest(manifestPath);
  if (
    manifest === null ||
    reopensThroughReceipt({
      services,
      target: props.target,
      registry,
      manifest,
      manifestPath,
      compileFingerprint: preview.compileFingerprint,
      frame,
    }) === false
  )
    return failure(
      "capture-receipt-invalid",
      "Captured pixels do not reopen through their atomic current render receipt. Discard them, correct the capture host, and retry.",
    );
  return {
    captured: true,
    productionId: services.project.productionId,
    reviewTarget:
      props.target.kind === "shot"
        ? { kind: "shot", id: props.target.id }
        : { kind: "asset", id: props.target.id },
    receipt: {
      version: 2,
      productionId: services.project.productionId,
      target: captureTargetOf(
        services.project.productionId,
        props.target,
        frame,
      ),
      compileFingerprint: registry.inputFingerprint,
      targetFingerprint: manifest.targetFingerprint,
      rendererIdentity: manifest.rendererIdentity,
      bundle: preview.renderBundle,
      outputDigest: frame.digest,
      semanticMask:
        frame.pass === "mask" && manifest.target.kind === "shot"
          ? (manifest.semanticMasks.find(
              (record) =>
                record.frame === frame.index && record.pass === frame.pass,
            ) ?? null)
          : null,
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
};

/**
 * Ask the oracle for the requested view.
 *
 * A shot is sampled at the requested shot-local time.
 *
 * An asset turntable derives its time from the requested angle, so the request
 * carries time zero and states the angle, elevation, and pose instead. Those
 * three are what the receipt has to record.
 */
const previewCaptureTarget = async (
  services: IAutoMovieProductionServices,
  props: IAutoMovieCaptureFrame.IProps,
): Promise<IAutoMoviePreviewFrameOutput> =>
  props.target.kind === "shot"
    ? services.oracle.preview({
        target: { kind: "shot", id: props.target.id },
        time: props.target.time,
        pass: props.target.pass,
        width: props.width,
        height: props.height,
      })
    : services.oracle.preview({
        target: {
          kind: "asset",
          id: props.target.id,
          angleDeg: props.target.angleDeg,
          elevationDeg: props.target.elevationDeg ?? 0,
          pose: props.target.pose ?? "rest",
          part: props.target.part,
        },
        time: 0,
        pass: props.target.pass,
        width: props.width,
        height: props.height,
      });

/**
 * Whether the captured pixels reopen through their own current receipt.
 *
 * The frame is evidence only when one fingerprint runs through all four of the
 * compile that produced it, the registry it was requested against, the manifest
 * that committed it, and the frame record inside that manifest.
 *
 * A read that throws on the way is answered as a mismatch. Either way nothing
 * proves the bytes, and unproven bytes are not accepted.
 */
const reopensThroughReceipt = (props: {
  services: IAutoMovieProductionServices;
  target: IAutoMovieCaptureFrame.IProps["target"];
  registry: ReturnType<typeof readAutoMovieProductionRegistry>;
  manifest: IAutoMovieRenderBundleManifest;
  manifestPath: string;
  compileFingerprint: string;
  frame: IAutoMoviePreviewFrame;
}): boolean => {
  const { services, target, registry, manifest, frame } = props;
  try {
    const status = services.compileStatus();
    const currentRegistry = readAutoMovieProductionRegistry(services.project);
    const relativeFrame = path
      .relative(
        path.dirname(props.manifestPath),
        path.join(services.project.root, frame.path),
      )
      .split(path.sep)
      .join("/");
    const targetMatches =
      target.kind === "shot"
        ? manifest.target.kind === "shot" && manifest.target.id === target.id
        : manifest.target.kind === "asset" &&
          manifest.target.id === target.id &&
          manifest.target.angleDeg === target.angleDeg &&
          manifest.target.elevationDeg === (target.elevationDeg ?? 0) &&
          manifest.target.pose === (target.pose ?? "rest") &&
          manifest.target.part === target.part;
    return (
      props.compileFingerprint === registry.inputFingerprint &&
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
      ) &&
      (frame.pass !== "mask" ||
        manifest.target.kind !== "shot" ||
        manifest.semanticMasks.some(
          (semantic) =>
            semantic.frame === frame.index &&
            semantic.pass === frame.pass &&
            semantic.shot === target.id,
        ))
    );
  } catch {
    return false;
  }
};

/**
 * Name what the receipt says was captured.
 *
 * Time and pass come from the frame, because the oracle snapped the request
 * onto a real production frame.
 *
 * The turntable view comes from the request, because that is the angle,
 * elevation, and pose the caller asked to see.
 */
const captureTargetOf = (
  productionId: string,
  target: IAutoMovieCaptureFrame.IProps["target"],
  frame: IAutoMoviePreviewFrame,
): AutoMovieCaptureTarget =>
  target.kind === "shot"
    ? {
        kind: "shot",
        productionId,
        id: target.id,
        time: frame.time,
        pass: frame.pass,
      }
    : {
        kind: "asset",
        productionId,
        id: target.id,
        angleDeg: target.angleDeg,
        elevationDeg: target.elevationDeg ?? 0,
        pose: target.pose ?? "rest",
        part: target.part,
        pass: frame.pass,
      };

/** One refused capture: no receipt, no frame, and the reason it was refused. */
const refusal = (
  productionId: string,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMovieCaptureFrame => ({
  captured: false,
  productionId,
  reviewTarget: null,
  receipt: null,
  frame: null,
  diagnostics,
});

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
