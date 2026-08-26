import {
  AutoMovieDiagnosticCode,
  AutoMovieViolationKind,
  IAutoMovieConstraintViolation,
  IAutoMovieDiagnostic,
  IAutoMovieValidation,
} from "@automovie/interface";

/**
 * Which diagnostic identity one engine violation kind is reported under.
 *
 * The requirements forbid merging distinct causes into one generic identity, and
 * a single code for every content violation did exactly that: a service run
 * occupying another run's volume, a wet room whose membrane leaves a surface
 * uncovered, and a mistyped field all arrived as `source-scene-content-invalid`,
 * so the catalog handed all three the same invariant, the same correction, and
 * the same guide.
 *
 * The map is total over the kind union rather than a lookup with a fallback. A
 * tier added to `AutoMovieViolationKind` then fails to compile here, which makes
 * its identity a decision somebody makes rather than a default it inherits.
 *
 * Four kinds have producers on this path today. `type` and `range` keep one
 * identity because they share one correction, editing the field the occurrence
 * names. `physics` and `coverage` do not: a run that has to move and a region
 * that has to be covered are different work from a value that has to be fixed.
 */
const CODE_OF_KIND: Readonly<
  Record<AutoMovieViolationKind, AutoMovieDiagnosticCode>
> = {
  type: "source-scene-content-invalid",
  range: "source-scene-content-invalid",
  rom: "source-scene-content-invalid",
  temporal: "source-scene-content-invalid",
  topology: "source-scene-content-invalid",
  physics: "source-scene-physics-invalid",
  coverage: "source-scene-coverage-incomplete",
};

/**
 * The identity one engine violation is reported under, read from its own kind.
 *
 * Exported because the mapping is a product decision worth checking directly:
 * every kind must resolve to a code the shipped catalog explains, and the two
 * split identities must stay split.
 */
export const autoMovieSourceContentDiagnosticCode = (
  kind: AutoMovieViolationKind,
): AutoMovieDiagnosticCode => CODE_OF_KIND[kind];

/**
 * One classified finding a source phase is about to publish.
 *
 * The message is composed by whoever found it, because only that caller knows
 * the record's address inside the program and the correction its own fold owns.
 * What travels with it here is the classification the engine already made and
 * the compiler used to drop.
 */
export interface IAutoMovieSourceContentFinding {
  /** Tier the engine judged this by, which decides the diagnostic identity. */
  kind: AutoMovieViolationKind;

  /** Effect on the result: an error invalidates the scope, a warning does not. */
  severity: "error" | "warning";

  /** The record's address, what was required, and this fold's own correction. */
  message: string;
}

/** Carry one engine violation as a finding, with the message its finder wrote. */
export const autoMovieSourceContentFinding = (
  violation: IAutoMovieConstraintViolation,
  message: string,
): IAutoMovieSourceContentFinding => ({
  kind: violation.kind,
  severity: violation.severity,
  message,
});

/**
 * Turn one classified finding into the diagnostic a source phase reports.
 *
 * Severity crosses this boundary unchanged, which it did not before. A validation
 * that produced only warnings was dropped whole, so an authored penetration
 * nothing runs through was never mentioned, and a warning riding beside an error
 * was published as an error, so advice a film may legitimately accept blocked the
 * compile. Those are opposite failures of one missing field, and the requirements
 * settle both: severity follows the effect on the result, and a warning states a
 * risk to review rather than a refusal.
 */
export const autoMovieSourceContentDiagnostic = (props: {
  finding: IAutoMovieSourceContentFinding;
  target: string;
  path: string;
}): IAutoMovieDiagnostic => ({
  code: autoMovieSourceContentDiagnosticCode(props.finding.kind),
  category: props.finding.severity,
  phase: "source",
  target: props.target,
  path: props.path,
  message: props.finding.message,
});

/**
 * Every violation one validation carries, whether or not it failed.
 *
 * A validation that succeeds still carries `warnings`, and reading only the
 * failure branch is how the warning tier disappeared from this phase. Both
 * branches are read here so no caller has to remember there are two.
 */
export const autoMovieValidationFindings = (
  validation: IAutoMovieValidation,
): readonly IAutoMovieConstraintViolation[] =>
  validation.success ? (validation.warnings ?? []) : validation.violations;
