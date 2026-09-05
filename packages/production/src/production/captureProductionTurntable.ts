import {
  AutoMovieDiagnosticCode,
  IAutoMovieAssetTurntableView,
  IAutoMovieCaptureTurntable,
  IAutoMovieDiagnostic,
  IAutoMovieModel,
} from "@automovie/interface";
import typia from "typia";

import type {
  AutoMovieProductionContext,
  IAutoMovieProductionServices,
} from "./AutoMovieProductionContext";
import { autoMovieAssetReviewViews } from "./assetReviewViews";
import { captureAutoMovieProductionFrame } from "./captureProductionFrame";
import { parseAutoMovieStructuredJson } from "./duplicateAwareJson";
import { readAutoMovieProductionRegistry } from "./productionRegistry";

/**
 * Capture the complete view set one asset review is judged from.
 *
 * The views come from the review contract, so this tool covers an asset the way
 * its review will read it. Assembling the same set by hand is where a reviewer
 * skipped the one angle the defect was on and still recorded full coverage.
 *
 * Each view is captured through the ordinary frame capture, so a turntable
 * frame carries exactly the proof a single `captureFrame` carries and nothing
 * weaker. The views are captured one at a time because the host renderer is one
 * instrument and each frame must reopen through a receipt taken against the
 * tree as it stood for that frame.
 */
export const captureAutoMovieProductionTurntable = async (
  context: AutoMovieProductionContext,
  props: IAutoMovieCaptureTurntable.IProps,
): Promise<IAutoMovieCaptureTurntable> => {
  if (
    props.productionId !== undefined &&
    (props.productionId.trim().length === 0 ||
      props.productionId.trim() !== props.productionId)
  )
    return refusal(props.productionId, [
      diagnostic(
        "capture-production-invalid",
        props.asset,
        "captureTurntable productionId must be a trimmed non-empty production namespace.",
      ),
    ]);
  let services: IAutoMovieProductionServices;
  try {
    services = context.forProduction(props.productionId);
  } catch (error) {
    return refusal(props.productionId ?? "", [
      diagnostic(
        "capture-production-unregistered",
        props.asset,
        error instanceof Error ? error.message : String(error),
      ),
    ]);
  }
  const rigged = riggedAsset(services, props.asset);
  if (typeof rigged !== "boolean")
    return refusal(services.project.productionId, [rigged]);
  const views: IAutoMovieAssetTurntableView[] = [];
  const diagnostics: IAutoMovieDiagnostic[] = [];
  for (const view of autoMovieAssetReviewViews({ rigged })) {
    const captured = await captureAutoMovieProductionFrame(context, {
      target: {
        kind: "asset",
        productionId: services.project.productionId,
        id: props.asset,
        angleDeg: view.angleDeg,
        elevationDeg: view.elevationDeg,
        pose: view.pose,
        pass: view.pass,
      },
      width: props.width,
      height: props.height,
    });
    views.push({ ...view, frame: captured.frame?.path ?? null });
    for (const entry of captured.diagnostics)
      diagnostics.push({ ...entry, target: `${props.asset}#${view.id}` });
  }
  return {
    captured: views.every((view) => view.frame !== null),
    productionId: services.project.productionId,
    reviewTarget: { kind: "asset", id: props.asset },
    views,
    diagnostics,
  };
};

/**
 * Whether the registered asset compiles to a rigged model.
 *
 * The answer decides whether the extreme-range pose is part of the required
 * set, so a model that cannot be read is refused rather than covered as if it
 * were a prop. Returns the refusal diagnostic instead of the answer when the
 * registry or the compiled model does not currently support one.
 */
const riggedAsset = (
  services: IAutoMovieProductionServices,
  asset: string,
): boolean | IAutoMovieDiagnostic => {
  let registry: ReturnType<typeof readAutoMovieProductionRegistry>;
  try {
    registry = readAutoMovieProductionRegistry(services.project);
  } catch (error) {
    return diagnostic(
      "capture-registry-unavailable",
      asset,
      error instanceof Error ? error.message : String(error),
    );
  }
  const entry = registry.assets.find((candidate) => candidate.id === asset);
  if (entry === undefined)
    return diagnostic(
      "capture-target-missing",
      asset,
      `Asset "${asset}" is absent from compiler registry ${registry.inputFingerprint}. Correct its registration or compile current source before capturing its turntable.`,
    );
  try {
    const validation = typia.validateEquals<IAutoMovieModel>(
      parseAutoMovieStructuredJson({
        record: "compiled-model",
        bytes: services.project.readGeneratedFile(entry.path),
      }),
    );
    if (validation.success === false)
      throw new Error("the compiled model has an invalid schema");
    return validation.data.skeleton !== null;
  } catch (error) {
    return diagnostic(
      "capture-target-missing",
      asset,
      `Asset "${asset}" has no readable current compiled model: ${
        error instanceof Error ? error.message : String(error)
      }. Compile the source that defines it before capturing its turntable.`,
    );
  }
};

/** One refused turntable: no views, and the reason the request was refused. */
const refusal = (
  productionId: string,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMovieCaptureTurntable => ({
  captured: false,
  productionId,
  reviewTarget: null,
  views: [],
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
