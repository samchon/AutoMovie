/**
 * Persisted repaint record kinds that can be inspected independently.
 *
 * @evidence requirements/repaint/identity-and-provenance.md#repaint-provenance-refusal Keeps candidate and active-rendition failure channels distinct.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Names the persisted lineage population inspected by consumers.
 */
export type AutoMovieRepaintRecordKind = "candidate" | "rendition";

/**
 * Stable failure classes exposed without leaking persisted or provider bytes.
 *
 * @evidence requirements/repaint/identity-and-provenance.md#repaint-provenance-refusal Preserves the reason a stored record is unusable.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Provides recovery-safe classifications instead of catch-all absence.
 */
export type AutoMovieRepaintRecordFailureClass =
  | "absent"
  | "schema-invalid"
  | "identity-invalid"
  | "stale"
  | "unsafe-locator"
  | "unavailable"
  | "render-corrupt";

/**
 * Stable stages in the persisted repaint lineage.
 *
 * @evidence requirements/repaint/identity-and-provenance.md#repaint-provenance-refusal Locates the exact failed provenance boundary.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Separates pointer, selection, receipt, currentness, and output inspection.
 */
export type AutoMovieRepaintRecordInspectionStage =
  | "enumeration"
  | "pointer"
  | "selection"
  | "receipt"
  | "currentness"
  | "output";

/**
 * Safe identity of one requested persisted record.
 *
 * @evidence requirements/repaint/identity-and-provenance.md#repaint-provenance-refusal Keeps the affected shot and record addressable without raw contents.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Identifies one inspection target across candidate and rendition readers.
 */
export interface IAutoMovieRepaintRecordTarget {
  /** Record family the target belongs to. */
  kind: AutoMovieRepaintRecordKind;
  /** Shot that owns the record. */
  shot: string;
  /** Stable identity of the record within its family. */
  recordId: string;
}

/**
 * One stable finding produced while inspecting a persisted repaint record.
 *
 * @evidence requirements/repaint/identity-and-provenance.md#repaint-provenance-refusal Exposes exact target, stage, class, and safe recovery.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Carries a refusal without copying record or provider bytes.
 */
export interface IAutoMovieRepaintRecordFinding {
  /** The record the finding is about. */
  target: IAutoMovieRepaintRecordTarget;
  /** Inspection stage that produced the finding. */
  stage: AutoMovieRepaintRecordInspectionStage;
  /** Classified failure, carrying no record or provider bytes. */
  failure: AutoMovieRepaintRecordFailureClass;
  /** Safe recovery sentence a caller may show as is. */
  recovery: string;
}

/**
 * Complete fail-closed inspection result, preserving valid siblings.
 *
 * @evidence requirements/repaint/identity-and-provenance.md#repaint-provenance-refusal Prevents one corrupt record from erasing unrelated valid candidates.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Returns valid records and classified findings in one deterministic observation.
 */
export interface IAutoMovieRepaintRecordInspection<T> {
  /** Every record that inspected clean, with the target it was read as. */
  records: Array<{ target: IAutoMovieRepaintRecordTarget; value: T }>;
  /** Classified refusals for the records that did not. */
  findings: IAutoMovieRepaintRecordFinding[];
}

/**
 * Classified refusal thrown by one physical repaint-record reader.
 *
 * The message is deliberately not part of the persisted finding. Callers
 * receive a built-in recovery sentence, so a filesystem path, provider
 * response, or credential-bearing payload cannot escape through diagnostics.
 *
 * @evidence requirements/repaint/identity-and-provenance.md#repaint-provenance-refusal Preserves why one persisted repaint record was refused without turning the refusal into absence.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Carries the exact lineage stage and safe recovery action across the record-reader boundary.
 */
export class AutoMovieRepaintRecordInspectionError extends Error {
  /** Built-in safe recovery sentence for the classified failure. */
  public readonly recovery: string;

  public constructor(
    /** Inspection stage the reader was in when it refused. */
    public readonly stage: AutoMovieRepaintRecordInspectionStage,
    /** Classified failure the reader refused with. */
    public readonly failure: AutoMovieRepaintRecordFailureClass,
  ) {
    super(`Repaint ${stage} inspection failed as ${failure}.`);
    if (
      INSPECTION_STAGES.has(stage) === false ||
      CLASSIFIED_FAILURES.has(failure) === false
    )
      throw new Error("Repaint inspection refusal is malformed.");
    this.recovery = recoveryFor(failure);
  }
}

/**
 * Inspect repaint records independently and retain every valid sibling.
 *
 * @evidence requirements/repaint/identity-and-provenance.md#repaint-provenance-refusal Makes missing, malformed, stale, unsafe, unavailable, and corrupt persisted records distinguishable to recovery tooling.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Keeps the record identity and failed lineage stage while excluding raw record contents from the finding.
 * @evidence requirements/repaint/identity-and-provenance.md#repaint-derivation-chain Walks request, attempt, raw output and selected rendition records as one derivation chain and names the first broken link.
 */
export const inspectAutoMovieRepaintRecords = <T>(props: {
  targets: readonly IAutoMovieRepaintRecordTarget[];
  inspect: (target: IAutoMovieRepaintRecordTarget) => T | null;
}): IAutoMovieRepaintRecordInspection<T> => {
  const targets = props.targets.map(validateTarget).sort(compareTargets);
  const records: IAutoMovieRepaintRecordInspection<T>["records"] = [];
  const findings: IAutoMovieRepaintRecordFinding[] = [];
  for (const target of targets)
    try {
      const value = props.inspect(structuredClone(target));
      if (value === null)
        findings.push({
          target,
          stage: target.kind === "candidate" ? "receipt" : "pointer",
          failure: "absent",
          recovery: `Create or restore the requested ${target.kind} record, then inspect it again.`,
        });
      else records.push({ target, value });
    } catch (error) {
      const classified = safeClassifiedError(error);
      findings.push({
        target,
        stage: classified?.stage ?? "enumeration",
        failure: classified?.failure ?? "unavailable",
        recovery:
          classified?.recovery ??
          "Restore access to the tracked repaint state, then inspect it again.",
      });
    }
  return { records, findings };
};

const validateTarget = (
  target: IAutoMovieRepaintRecordTarget,
): IAutoMovieRepaintRecordTarget => {
  if (
    (target.kind !== "candidate" && target.kind !== "rendition") ||
    typeof target.shot !== "string" ||
    target.shot.trim().length === 0 ||
    target.shot !== target.shot.trim() ||
    typeof target.recordId !== "string" ||
    target.recordId.trim().length === 0 ||
    target.recordId !== target.recordId.trim()
  )
    throw new Error(
      "Repaint inspection targets require exact safe identities.",
    );
  return structuredClone(target);
};

const safeClassifiedError = (
  error: unknown,
): {
  stage: AutoMovieRepaintRecordInspectionStage;
  failure: AutoMovieRepaintRecordFailureClass;
  recovery: string;
} | null => {
  try {
    if (error instanceof AutoMovieRepaintRecordInspectionError === false)
      return null;
    const classified = {
      stage: error.stage,
      failure: error.failure,
      recovery: recoveryFor(error.failure),
    };
    return INSPECTION_STAGES.has(classified.stage) &&
      CLASSIFIED_FAILURES.has(classified.failure) &&
      classified.recovery.length > 0
      ? classified
      : null;
  } catch {
    return null;
  }
};

const INSPECTION_STAGES = new Set<AutoMovieRepaintRecordInspectionStage>([
  "enumeration",
  "pointer",
  "selection",
  "receipt",
  "currentness",
  "output",
]);
const CLASSIFIED_FAILURES = new Set<AutoMovieRepaintRecordFailureClass>([
  "absent",
  "schema-invalid",
  "identity-invalid",
  "stale",
  "unsafe-locator",
  "unavailable",
  "render-corrupt",
]);

const recoveryFor = (failure: AutoMovieRepaintRecordFailureClass): string =>
  ({
    absent: "Create or restore the requested record, then inspect it again.",
    "schema-invalid":
      "Replace the record with one matching the current schema.",
    "identity-invalid": "Restore the record at its canonical identity.",
    stale: "Regenerate the record from current production inputs.",
    "unsafe-locator":
      "Replace linked or escaping state with an owned tracked record.",
    unavailable:
      "Restore access to the tracked repaint state, then inspect it again.",
    "render-corrupt": "Restore or regenerate the exact rendition bytes.",
  })[failure];

const compareTargets = (
  left: IAutoMovieRepaintRecordTarget,
  right: IAutoMovieRepaintRecordTarget,
): number =>
  compareText(left.shot, right.shot) ||
  compareText(left.kind, right.kind) ||
  compareText(left.recordId, right.recordId);

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
