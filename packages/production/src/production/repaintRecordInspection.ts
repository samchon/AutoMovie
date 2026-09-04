/** Persisted repaint record kinds that can be inspected independently. */
export type AutoMovieRepaintRecordKind = "candidate" | "rendition";

/** Stable failure classes exposed without leaking persisted or provider bytes. */
export type AutoMovieRepaintRecordFailureClass =
  | "absent"
  | "schema-invalid"
  | "identity-invalid"
  | "stale"
  | "unsafe-locator"
  | "unavailable"
  | "render-corrupt";

/** Stable stages in the persisted repaint lineage. */
export type AutoMovieRepaintRecordInspectionStage =
  | "enumeration"
  | "pointer"
  | "selection"
  | "receipt"
  | "currentness"
  | "output";

/** Safe identity of one requested persisted record. */
export interface IAutoMovieRepaintRecordTarget {
  kind: AutoMovieRepaintRecordKind;
  shot: string;
  recordId: string;
}

/** One stable finding produced while inspecting a persisted repaint record. */
export interface IAutoMovieRepaintRecordFinding {
  target: IAutoMovieRepaintRecordTarget;
  stage: AutoMovieRepaintRecordInspectionStage;
  failure: AutoMovieRepaintRecordFailureClass;
  recovery: string;
}

/** Complete fail-closed inspection result, preserving valid siblings. */
export interface IAutoMovieRepaintRecordInspection<T> {
  records: Array<{ target: IAutoMovieRepaintRecordTarget; value: T }>;
  findings: IAutoMovieRepaintRecordFinding[];
}

/**
 * Classified refusal thrown by one physical repaint-record reader.
 *
 * The message is deliberately not part of the persisted finding. Callers
 * provide one reviewed recovery sentence, so a filesystem path, provider
 * response, or credential-bearing payload cannot escape through diagnostics.
 *
 * @evidence requirements/repaint/identity-and-provenance.md#repaint-provenance-refusal Preserves why one persisted repaint record was refused without turning the refusal into absence.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Carries the exact lineage stage and safe recovery action across the record-reader boundary.
 */
export class AutoMovieRepaintRecordInspectionError extends Error {
  public constructor(
    public readonly stage: AutoMovieRepaintRecordInspectionStage,
    public readonly failure: Exclude<
      AutoMovieRepaintRecordFailureClass,
      "absent" | "unavailable"
    >,
    public readonly recovery: string,
  ) {
    super(`Repaint ${stage} inspection failed as ${failure}.`);
  }
}

/**
 * Inspect repaint records independently and retain every valid sibling.
 *
 * @evidence requirements/repaint/identity-and-provenance.md#repaint-provenance-refusal Makes missing, malformed, stale, unsafe, unavailable, and corrupt persisted records distinguishable to recovery tooling.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Keeps the record identity and failed lineage stage while excluding raw record contents from the finding.
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
): AutoMovieRepaintRecordInspectionError | null => {
  try {
    return error instanceof AutoMovieRepaintRecordInspectionError
      ? error
      : null;
  } catch {
    return null;
  }
};

const compareTargets = (
  left: IAutoMovieRepaintRecordTarget,
  right: IAutoMovieRepaintRecordTarget,
): number =>
  compareText(left.shot, right.shot) ||
  compareText(left.kind, right.kind) ||
  compareText(left.recordId, right.recordId);

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
