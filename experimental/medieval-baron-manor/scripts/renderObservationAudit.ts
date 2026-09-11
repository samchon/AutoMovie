import { renderAutoMovieSemanticMaskSidecar } from "@automovie/engine";
import type {
  AutoMovieCaptureObservation,
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  AutoMovieRenderMetric,
  IAutoMovieRenderObservation,
  IAutoMovieRenderObservationBreach,
  IAutoMovieRenderReport,
  IAutoMovieSemanticMaskEvidence,
} from "@automovie/interface";
import {
  classifyAutoMovieProductionSemanticMaskEvidence,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
} from "@automovie/production";
import { auditAutoMovieRenderObservation } from "@automovie/render";
import path from "node:path";

import {
  captureRenderGcTarget,
  createRenderGcFileSnapshot,
  ensureRenderPhysicalDirectory,
  readCapturedRenderGcFile,
} from "./renderGcSnapshot";

const CONTENT_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

/** Render-job directory holding observation sidecar bundles. */
export const RENDER_OBSERVATION_DIRECTORY = "render-observation";

/** One frame's comparison between preflight bounds and the drawn scene. */
export interface IProductionRenderObservationAudit {
  globalFrame: number;
  pass: AutoMovieGuidePass;
  shot: string;
  status: "checked" | "not-run";
  reason: string | null;
  breaches: IAutoMovieRenderObservationBreach[];
  unchecked: AutoMovieRenderMetric[];
}

/** Stable run-level digest of capture-observation outcomes. */
export interface IProductionRenderObservationSummary {
  checked: number;
  notRun: number;
  notRunReasons: string[];
  unchecked: AutoMovieRenderMetric[];
}

/** Immutable semantic-mask sidecar publication facts. */
export interface IProductionMaskSidecarPublication {
  bytes: number;
  digest: AutoMovieContentDigest;
  path: string;
}

/**
 * Compare one actually drawn shot layer with the report that admitted it.
 *
 * Missing report or capture evidence remains `not-run`. An observed value above
 * a preflight bound is a stale or incomplete inventory and refuses the frame by
 * naming every breached metric.
 */
export const auditProductionRenderCapture = (props: {
  globalFrame: number;
  observation: AutoMovieCaptureObservation<IAutoMovieRenderObservation>;
  pass: AutoMovieGuidePass;
  report: AutoMovieCaptureObservation<IAutoMovieRenderReport>;
  shot: string;
}): IProductionRenderObservationAudit => {
  if (
    props.report.status === "not-run" ||
    props.observation.status === "not-run"
  ) {
    const reasons = [
      ...(props.report.status === "not-run"
        ? [`render report: ${props.report.reason}`]
        : []),
      ...(props.observation.status === "not-run"
        ? [`capture observation: ${props.observation.reason}`]
        : []),
    ];
    return {
      globalFrame: props.globalFrame,
      pass: props.pass,
      shot: props.shot,
      status: "not-run",
      reason: reasons.join("; "),
      breaches: [],
      unchecked: [],
    };
  }
  const audit = auditAutoMovieRenderObservation({
    report: props.report.value,
    observed: props.observation.value,
  });
  if (audit.breaches.length !== 0)
    throw new Error(
      `Render observation exceeded the admitted report for shot "${props.shot}" at frame ${props.globalFrame} (${props.pass}): ${audit.breaches
        .map(
          (breach) =>
            `${breach.metric} observed ${breach.observed} > bound ${breach.bound}`,
        )
        .join(
          ", ",
        )}. Recompile the render inventory and replan before continuing.`,
    );
  if (audit.agrees === false)
    return {
      globalFrame: props.globalFrame,
      pass: props.pass,
      shot: props.shot,
      status: "not-run",
      reason: `render report did not measure observable metrics: ${audit.unchecked.join(
        ", ",
      )}`,
      breaches: [],
      unchecked: audit.unchecked,
    };
  return {
    globalFrame: props.globalFrame,
    pass: props.pass,
    shot: props.shot,
    status: "checked",
    reason: null,
    breaches: [],
    unchecked: audit.unchecked,
  };
};

/** Fold checked and explicitly incomplete outcomes in stable order. */
export const summarizeProductionRenderObservations = (
  audits: readonly IProductionRenderObservationAudit[],
): IProductionRenderObservationSummary => ({
  checked: audits.filter((audit) => audit.status === "checked").length,
  notRun: audits.filter((audit) => audit.status === "not-run").length,
  notRunReasons: [
    ...new Set(
      audits.flatMap((audit) =>
        audit.status === "not-run" && audit.reason !== null
          ? [audit.reason]
          : [],
      ),
    ),
  ].sort(compareCodeUnits),
  unchecked: [...new Set(audits.flatMap((audit) => audit.unchecked))].sort(
    compareCodeUnits,
  ),
});

/** Serialize one available semantic palette for publication beside mask pixels. */
export const renderProductionMaskSidecar = (
  sidecar: AutoMovieCaptureObservation<IAutoMovieSemanticMaskEvidence>,
): AutoMovieCaptureObservation<Uint8Array> =>
  sidecar.status === "not-run"
    ? sidecar
    : {
        status: "available",
        value: Buffer.from(
          renderAutoMovieSemanticMaskSidecar(sidecar.value.mask),
          "utf8",
        ),
      };

/**
 * Publish `<shot>.mask.json` in the content-addressed chunk observation bundle.
 *
 * A retry accepts the resident file only when its bytes are identical. The
 * semantic map therefore accompanies every chunk identity without weakening the
 * chunk receipt's exact PNG/MP4 inventory.
 */
export const publishProductionMaskSidecar = (props: {
  chunk: AutoMovieContentDigest;
  shot: string;
  semanticMask: AutoMovieCaptureObservation<IAutoMovieSemanticMaskEvidence>;
  stateRoot: string;
}): AutoMovieCaptureObservation<IProductionMaskSidecarPublication> => {
  if (CONTENT_DIGEST_PATTERN.test(props.chunk) === false)
    throw new Error(
      "Render observation chunk identity is not a SHA-256 digest.",
    );
  const status = classifyAutoMovieProductionSemanticMaskEvidence({
    observation: props.semanticMask,
    expectedShot: props.shot,
  });
  if (
    status.status !== "complete" &&
    status.status !== "incomplete" &&
    status.status !== "not-run"
  )
    throw new Error(status.reason);
  const rendered = renderProductionMaskSidecar(props.semanticMask);
  if (rendered.status === "not-run") return rendered;
  const directory = ensureRenderPhysicalDirectory(
    props.stateRoot,
    `${RENDER_OBSERVATION_DIRECTORY}/${props.chunk.slice(7)}`,
  );
  const file = path.join(
    directory,
    `${encodeAutoMoviePathSegment(props.shot)}.mask.json`,
  );
  const digest = digestAutoMovieBytes(rendered.value);
  try {
    createRenderGcFileSnapshot(props.stateRoot, file, rendered.value);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = captureRenderGcTarget(props.stateRoot, file);
    if (
      existing.kind !== "file" ||
      existing.bytes !== rendered.value.length ||
      existing.fileDigest !== digest ||
      Buffer.from(
        readCapturedRenderGcFile(existing, rendered.value.length),
      ).equals(Buffer.from(rendered.value)) === false
    )
      throw new Error(
        `Render observation sidecar "${file}" differs from the captured semantic mask. Quarantine the conflicting observation bundle and rerender the chunk.`,
      );
  }
  return {
    status: "available",
    value: {
      bytes: rendered.value.length,
      digest,
      path: file,
    },
  };
};

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
