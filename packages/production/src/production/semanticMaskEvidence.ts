import {
  autoMovieSemanticMaskVerificationFailure,
  renderAutoMovieSemanticMaskSidecar,
  verifyAutoMovieSemanticMask,
} from "@automovie/engine";
import {
  AutoMovieCaptureObservation,
  IAutoMovieSemanticMaskCoverage,
  IAutoMovieSemanticMaskEvidence,
  IAutoMovieSemanticMaskReceipt,
} from "@automovie/interface";

import { compareCodeUnits, digestAutoMovieBytes } from "./contentIdentity";

/**
 * Runtime agreement between a semantic palette and the scene actually drawn.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-gaps Preserves unresolved declarations and unnamed runtime geometry as explicit partial-deliverable facts.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-authority-gaps Carries the exact runtime gap population that prevents a structural render product from becoming complete.
 */
export type IAutoMovieProductionSemanticMaskCoverage =
  IAutoMovieSemanticMaskCoverage;

/**
 * One shot's palette and runtime coverage captured as an atomic observation.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-provenance Binds the host-observed semantic payload and its runtime completeness to the exact shot it describes.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-provenance-handoff Defines the semantic evidence value a manifest or render receipt must carry without separating palette from coverage.
 */
export type IAutoMovieProductionSemanticMaskEvidence =
  IAutoMovieSemanticMaskEvidence;

/**
 * Resident sidecar facts committed beside one mask image.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-provenance Makes the exact sidecar bytes a content-addressed dependency of the structural image.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-provenance-handoff Carries the relative location, digest, and byte count needed to reopen the semantic dependency.
 */
export type IAutoMovieProductionSemanticMaskReceipt =
  IAutoMovieSemanticMaskReceipt;

/**
 * Current semantic product classification for preview, review, and render.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-gaps Keeps absence, incompatibility, foreign identity, malformed evidence, and observed incompleteness distinct.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-authority-gaps Prevents a mask PNG or beauty success from silently replacing unavailable or incomplete semantic evidence.
 */
export type AutoMovieProductionSemanticMaskStatus =
  | {
      status: "complete";
      evidence: IAutoMovieProductionSemanticMaskEvidence;
    }
  | {
      status: "incomplete";
      evidence: IAutoMovieProductionSemanticMaskEvidence;
      reason: string;
    }
  | {
      status: "not-run" | "unsupported" | "foreign" | "invalid";
      reason: string;
    };

/**
 * Verify one atomic palette and coverage observation for an expected shot.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-provenance Refuses a semantic deliverable whose schema, shot identity, palette digest, or runtime coverage cannot be reopened exactly.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-provenance-handoff Validates the complete semantic handoff before any manifest or receipt can call it current.
 */
export const verifyAutoMovieProductionSemanticMaskEvidence = (props: {
  evidence: IAutoMovieProductionSemanticMaskEvidence;
  expectedShot: string;
}): void => {
  const { evidence, expectedShot } = props;
  exactKeys(evidence, ["version", "shot", "mask", "coverage"], "evidence");
  if (evidence.version !== 1)
    throw new Error(
      `unsupported semantic evidence version ${String(evidence.version)}; expected 1`,
    );
  if (nonBlank(evidence.shot) === false)
    throw new Error("invalid semantic evidence shot; expected a non-blank id");
  if (evidence.shot !== expectedShot)
    throw new Error(
      `foreign semantic evidence for shot "${evidence.shot}"; expected "${expectedShot}"`,
    );
  verifyAutoMovieSemanticMask(evidence.mask);
  verifyCoverage(evidence.coverage);
};

/**
 * Classify an optional host observation without erasing why it is non-current.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-gaps Reports unavailable and incomplete semantic products with their exact retained cause.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-authority-gaps Admits only a current self-verified palette with zero unresolved and unnamed runtime population as complete.
 */
export const classifyAutoMovieProductionSemanticMaskEvidence = (props: {
  observation: AutoMovieCaptureObservation<IAutoMovieProductionSemanticMaskEvidence>;
  expectedShot: string;
}): AutoMovieProductionSemanticMaskStatus => {
  if (props.observation.status === "not-run")
    return nonBlank(props.observation.reason)
      ? { status: "not-run", reason: props.observation.reason }
      : {
          status: "invalid",
          reason: "semantic evidence not-run reason must be non-blank",
        };
  const evidence = props.observation.value;
  if (evidence.version !== 1)
    return {
      status: "unsupported",
      reason: `unsupported semantic evidence version ${String(evidence.version)}; expected 1`,
    };
  if (nonBlank(evidence.shot) && evidence.shot !== props.expectedShot)
    return {
      status: "foreign",
      reason: `foreign semantic evidence for shot "${evidence.shot}"; expected "${props.expectedShot}"`,
    };
  try {
    verifyAutoMovieProductionSemanticMaskEvidence({
      evidence,
      expectedShot: props.expectedShot,
    });
  } catch (error) {
    return {
      status:
        autoMovieSemanticMaskVerificationFailure(error) === "unsupported"
          ? "unsupported"
          : "invalid",
      reason: (error as Error).message,
    };
  }
  if (
    evidence.coverage.unresolved.length !== 0 ||
    evidence.coverage.unaddressed !== 0
  )
    return {
      status: "incomplete",
      evidence,
      reason: `semantic mask for shot "${evidence.shot}" has ${evidence.coverage.unresolved.length} unresolved ids and ${evidence.coverage.unaddressed} unaddressed meshes`,
    };
  return { status: "complete", evidence };
};

/**
 * Seal canonical sidecar bytes and runtime coverage into one receipt record.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-provenance Makes each mask frame name the exact semantic sidecar and coverage that give its pixels meaning.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-provenance-handoff Produces the canonical record shared by preview and chunk completion receipts.
 */
export const createAutoMovieProductionSemanticMaskReceipt = (props: {
  frame: number;
  evidence: IAutoMovieProductionSemanticMaskEvidence;
  sidecar: { path: string; bytes: Uint8Array };
}): IAutoMovieProductionSemanticMaskReceipt => {
  verifyFrame(props.frame);
  verifyAutoMovieProductionSemanticMaskEvidence({
    evidence: props.evidence,
    expectedShot: props.evidence.shot,
  });
  verifySidecarPath(props.sidecar.path);
  const expected = Buffer.from(
    renderAutoMovieSemanticMaskSidecar(props.evidence.mask),
    "utf8",
  );
  if (Buffer.from(props.sidecar.bytes).equals(expected) === false)
    throw new Error(
      `semantic sidecar bytes for shot "${props.evidence.shot}" do not match its canonical palette`,
    );
  return {
    version: 1,
    frame: props.frame,
    pass: "mask",
    shot: props.evidence.shot,
    sidecar: {
      path: props.sidecar.path,
      digest: digestAutoMovieBytes(props.sidecar.bytes),
      bytes: props.sidecar.bytes.byteLength,
    },
    semanticDigest: props.evidence.mask.digest,
    coverage: {
      unresolved: [...props.evidence.coverage.unresolved],
      unaddressed: props.evidence.coverage.unaddressed,
    },
  };
};

/**
 * Reopen one receipt against its exact shot, frame, palette, coverage, and bytes.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-freshness Prevents a historical, moved, tampered, or partial semantic dependency from standing in for current mask evidence.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-provenance-handoff Revalidates the resident sidecar and semantic record before a preview or render chunk is reusable.
 */
export const verifyAutoMovieProductionSemanticMaskReceipt = (props: {
  receipt: IAutoMovieProductionSemanticMaskReceipt;
  expectedFrame: number;
  expectedShot: string;
  evidence: IAutoMovieProductionSemanticMaskEvidence;
  resident: { path: string; bytes: Uint8Array };
}): void => {
  exactKeys(
    props.receipt,
    [
      "version",
      "frame",
      "pass",
      "shot",
      "sidecar",
      "semanticDigest",
      "coverage",
    ],
    "receipt",
  );
  exactKeys(props.receipt.sidecar, ["path", "digest", "bytes"], "sidecar");
  verifyCoverage(props.receipt.coverage);
  verifySidecarPath(props.receipt.sidecar.path);
  if (props.receipt.version !== 1)
    throw new Error(
      `unsupported semantic receipt version ${String(props.receipt.version)}; expected 1`,
    );
  verifyFrame(props.expectedFrame);
  if (
    props.receipt.frame !== props.expectedFrame ||
    props.receipt.pass !== "mask"
  )
    throw new Error(
      `stale semantic receipt frame ${String(props.receipt.frame)}/${String(props.receipt.pass)}; expected mask frame ${props.expectedFrame}`,
    );
  verifyAutoMovieProductionSemanticMaskEvidence({
    evidence: props.evidence,
    expectedShot: props.expectedShot,
  });
  if (props.receipt.shot !== props.expectedShot)
    throw new Error(
      `foreign semantic receipt for shot "${props.receipt.shot}"; expected "${props.expectedShot}"`,
    );
  verifySidecarPath(props.resident.path);
  if (props.receipt.sidecar.path !== props.resident.path)
    throw new Error(
      `foreign semantic sidecar path "${props.resident.path}"; expected "${props.receipt.sidecar.path}"`,
    );
  const recreated = createAutoMovieProductionSemanticMaskReceipt({
    frame: props.expectedFrame,
    evidence: props.evidence,
    sidecar: props.resident,
  });
  if (
    props.receipt.sidecar.digest !== recreated.sidecar.digest ||
    props.receipt.sidecar.bytes !== recreated.sidecar.bytes
  )
    throw new Error(
      `tampered semantic sidecar for shot "${props.expectedShot}" does not match its receipt`,
    );
  if (
    props.receipt.semanticDigest !== recreated.semanticDigest ||
    sameCoverage(props.receipt.coverage, recreated.coverage) === false
  )
    throw new Error(
      `stale semantic payload for shot "${props.expectedShot}" does not match its receipt`,
    );
};

/** Refuse non-exact records before reading any field as evidence. */
const exactKeys = (
  value: object,
  expected: readonly string[],
  name: string,
): void => {
  const actual = Object.keys(value).sort(compareCodeUnits);
  const canonical = [...expected].sort(compareCodeUnits);
  if (
    actual.length !== canonical.length ||
    actual.some((key, index) => key !== canonical[index])
  )
    throw new Error(
      `invalid semantic ${name} keys; expected ${canonical.join(", ")}`,
    );
};

/** Validate the complete runtime coverage value without normalizing it. */
const verifyCoverage = (
  coverage: IAutoMovieProductionSemanticMaskCoverage,
): void => {
  exactKeys(coverage, ["unresolved", "unaddressed"], "coverage");
  if (
    Number.isSafeInteger(coverage.unaddressed) === false ||
    coverage.unaddressed < 0
  )
    throw new Error(
      "invalid semantic coverage unaddressed count; expected a non-negative safe integer",
    );
  if (
    coverage.unresolved.some(
      (id, index) =>
        nonBlank(id) === false ||
        (index !== 0 && coverage.unresolved[index - 1]! >= id),
    )
  )
    throw new Error(
      "invalid semantic coverage unresolved ids; expected non-blank sorted unique ids",
    );
};

/** Validate one portable frame identity. */
const verifyFrame = (frame: number): void => {
  if (Number.isSafeInteger(frame) === false || frame < 0)
    throw new Error(
      `invalid semantic receipt frame ${String(frame)}; expected a non-negative safe integer`,
    );
};

/** Keep receipt paths portable, relative, and inside their owning directory. */
const verifySidecarPath = (path: string): void => {
  const segments = path.split("/");
  if (
    nonBlank(path) === false ||
    path.includes("\\") ||
    path.startsWith("/") ||
    /^[A-Za-z]:/.test(path) ||
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  )
    throw new Error(
      `invalid semantic sidecar path "${path}"; expected a portable relative path inside the receipt directory`,
    );
};

/** Compare coverage as exact ordered evidence. */
const sameCoverage = (
  left: IAutoMovieProductionSemanticMaskCoverage,
  right: IAutoMovieProductionSemanticMaskCoverage,
): boolean =>
  left.unaddressed === right.unaddressed &&
  left.unresolved.length === right.unresolved.length &&
  left.unresolved.every((id, index) => id === right.unresolved[index]);

/** A user-authored id or reason must carry at least one non-whitespace glyph. */
const nonBlank = (value: string): boolean => value.trim().length !== 0;
