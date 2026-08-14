import type {
  AutoMovieVisualChangeStatus,
  IAutoMovieVisualChange,
  IAutoMovieVisualChangeReport,
  IAutoMovieVisualRevisionSnapshot,
  IAutoMovieVisualRevisionView,
} from "@automovie/interface";

const SHA256 = /^sha256:[0-9a-f]{64}$/u;

/**
 * Compare two existing image-digest catalogs without rendering or rehashing.
 *
 * The fold treats `unchanged` as a first-class progress fact, preserves new
 * and gone views, and sorts by stable subject then view identity. It refuses
 * ambiguous snapshots before producing a partial report. The returned shape
 * carries no review verdict or structural subject change.
 *
 * @evidence requirements/review/visual-change-reporting.md#review-visual-change-catalog-identity Compares only two snapshots that declare one catalog and unique stable subject-view keys.
 * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Produces the exhaustive changed, unchanged, new, and gone classification with exact counts.
 * @evidence requirements/review/visual-change-reporting.md#review-visual-change-digest-reuse Validates and compares supplied digests without reading, decoding, rendering, or hashing image bytes.
 * @evidence requirements/review/visual-change-reporting.md#review-visual-change-evidence-boundary Returns progress facts without granting review freshness, completion, quality, or structural meaning.
 * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-revision-snapshot Enforces snapshot identity, digest, uniqueness, and cross-catalog invariants without mutating inputs.
 * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Implements the deterministic union join and four-state count invariant.
 * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-digest-boundary Restricts execution to a pure fold over already-produced digest records.
 * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-evidence-separation Keeps visual byte change separate from review evidence and compiled-subject structure.
 */
export const compareAutoMovieVisualRevisions = (
  before: IAutoMovieVisualRevisionSnapshot,
  after: IAutoMovieVisualRevisionSnapshot,
): IAutoMovieVisualChangeReport => {
  const beforeViews = indexSnapshot("before", before);
  const afterViews = indexSnapshot("after", after);
  if (before.catalog !== after.catalog)
    throw new RangeError(
      `Visual revision catalogs differ: before is "${before.catalog}" and after is "${after.catalog}". Compare revisions of one catalog.`,
    );
  const keys = [...new Set([...beforeViews.keys(), ...afterViews.keys()])].sort(
    (left, right) => compareViews(viewFromKey(left), viewFromKey(right)),
  );
  const counts: Record<AutoMovieVisualChangeStatus, number> = {
    changed: 0,
    unchanged: 0,
    new: 0,
    gone: 0,
  };
  const views = keys.map((key): IAutoMovieVisualChange => {
    const previous = beforeViews.get(key);
    const next = afterViews.get(key);
    const status: AutoMovieVisualChangeStatus =
      previous === undefined
        ? "new"
        : next === undefined
          ? "gone"
          : previous.digest === next.digest
            ? "unchanged"
            : "changed";
    ++counts[status];
    const identity = viewFromKey(key);
    return {
      subject: identity.subject,
      view: identity.view,
      status,
      before: previous?.digest ?? null,
      after: next?.digest ?? null,
    };
  });
  return {
    version: 1,
    catalog: before.catalog,
    fromRevision: before.revision,
    toRevision: after.revision,
    counts,
    views,
  };
};

const indexSnapshot = (
  label: "before" | "after",
  snapshot: IAutoMovieVisualRevisionSnapshot,
): Map<string, IAutoMovieVisualRevisionView> => {
  assertNonBlank(`${label} revision`, snapshot.revision);
  assertNonBlank(`${label} catalog`, snapshot.catalog);
  const output = new Map<string, IAutoMovieVisualRevisionView>();
  for (const entry of snapshot.views) {
    assertNonBlank(`${label} subject`, entry.subject);
    assertNonBlank(`${label} view`, entry.view);
    if (SHA256.test(entry.digest) === false)
      throw new RangeError(
        `${label} visual digest must be "sha256:" followed by 64 lowercase hexadecimal digits, but was "${entry.digest}".`,
      );
    const key = keyOf(entry);
    if (output.has(key))
      throw new RangeError(
        `${label} visual snapshot repeats subject "${entry.subject}" view "${entry.view}".`,
      );
    output.set(key, entry);
  }
  return output;
};

const assertNonBlank = (name: string, value: string): void => {
  if (value.trim().length === 0)
    throw new RangeError(`${name} must be a trimmed non-empty string.`);
  if (value !== value.trim())
    throw new RangeError(
      `${name} must not have leading or trailing whitespace.`,
    );
};

const keyOf = (entry: IAutoMovieVisualRevisionView): string =>
  JSON.stringify({ subject: entry.subject, view: entry.view });

const viewFromKey = (
  key: string,
): Pick<IAutoMovieVisualRevisionView, "subject" | "view"> =>
  JSON.parse(key) as Pick<IAutoMovieVisualRevisionView, "subject" | "view">;

const compareViews = (
  left: Pick<IAutoMovieVisualRevisionView, "subject" | "view">,
  right: Pick<IAutoMovieVisualRevisionView, "subject" | "view">,
): number =>
  compareCodeUnits(left.subject, right.subject) ||
  compareCodeUnits(left.view, right.view);

const compareCodeUnits = (left: string, right: string): number => {
  if (left === right) return 0;
  return left < right ? -1 : 1;
};
