import type {
  AutoMovieLibraryReviewEvidence,
  IAutoMovieLibraryReviewObservationReceipt,
  IAutoMovieLibraryReviewPlanFile,
  IAutoMovieLibraryReviewUnitPlan,
} from "@automovie/interface";
import { isDeepStrictEqual } from "node:util";

/**
 * Exact valid UTF-8 bytes and the physical generation that supplied them.
 *
 * @author Samchon
 */
export interface ILibraryReviewPublicationFile {
  identity: string;
  source: string;
  version: string;
}

/**
 * A retained, exclusively created file, never an overwrite destination.
 *
 * @author Samchon
 */
export interface ILibraryReviewPublicationArtifact {
  path: string;
  file: ILibraryReviewPublicationFile;
}

/**
 * Bound-parent effects for one sidecar transaction. Moves are no-replace and
 * preserve a late source competitor, including when they report failure after
 * an effect. Staging syncs and verifies complete bytes before returning.
 *
 * @author Samchon
 */
export interface ILibraryReviewPublicationIO {
  assertBound(): void;
  read(path: string): ILibraryReviewPublicationFile | null;
  stage(path: string, source: string): ILibraryReviewPublicationFile;
  move(source: ILibraryReviewPublicationArtifact, target: string): void;
}

/** Planning may precede compilation, but never adopts a changed authoring basis. */
export const assertLibraryReviewPlanAuthoring = <Authoring>(props: {
  expected: Authoring;
  read: () => Authoring;
}): void => {
  if (!isDeepStrictEqual(props.expected, props.read()))
    throw new Error("Library authoring changed before plan publication.");
};

/** Reopen the newly offered observation after the successful current compile. */
export const admitLibraryReviewReceipt = (props: {
  assertCurrent: () => void;
  expected: AutoMovieLibraryReviewEvidence;
  read: () => AutoMovieLibraryReviewEvidence;
}): void => {
  props.assertCurrent();
  if (!isDeepStrictEqual(props.expected, props.read()))
    throw new Error(
      "Library observation evidence changed before receipt publication.",
    );
};

/** Parse approved bytes only; an absent sidecar is a genuinely empty plan. */
export const parseLibraryReviewPublication = (props: {
  before: ILibraryReviewPublicationFile | null;
  parse: (source: string) => IAutoMovieLibraryReviewPlanFile;
}): IAutoMovieLibraryReviewPlanFile =>
  props.before === null
    ? { version: 1, units: [] }
    : props.parse(props.before.source);

const same = (
  left: ILibraryReviewPublicationFile | null,
  right: ILibraryReviewPublicationFile | null,
): boolean =>
  left === null || right === null
    ? left === right
    : left.identity === right.identity &&
      left.source === right.source &&
      left.version === right.version;

const owns = (
  left: ILibraryReviewPublicationFile | null,
  right: ILibraryReviewPublicationFile | null,
): boolean =>
  left === null || right === null
    ? left === right
    : left.identity === right.identity && left.source === right.source;

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Refuse pending recovery before approving a resident or an absent sidecar. */
export const readLibraryReviewPublication = (props: {
  target: string;
  io: ILibraryReviewPublicationIO;
}): ILibraryReviewPublicationFile | null => {
  props.io.assertBound();
  if (props.io.read(`${props.target}.pending`) !== null)
    throw new Error(
      `Library review publication requires recovery: ${props.target}.pending.`,
    );
  const before = props.io.read(props.target);
  props.io.assertBound();
  if (props.io.read(`${props.target}.pending`) !== null)
    throw new Error(
      `Library review publication started while reading: ${props.target}.pending.`,
    );
  return before === null ? null : Object.freeze({ ...before });
};

/** Replace only the selected H2 plan, retaining every receipt and waiver. */
export const planLibraryReviewUnit = (props: {
  previous: IAutoMovieLibraryReviewPlanFile;
  unit: Pick<
    IAutoMovieLibraryReviewUnitPlan,
    "anchor" | "sources" | "observations"
  >;
}): IAutoMovieLibraryReviewPlanFile => {
  const retained = props.previous.units.find(
    (unit) => unit.anchor === props.unit.anchor,
  );
  return {
    version: 1,
    units: [
      ...props.previous.units.filter(
        (unit) => unit.anchor !== props.unit.anchor,
      ),
      {
        ...props.unit,
        ...(retained?.waivers === undefined
          ? {}
          : { waivers: retained.waivers }),
        receipts: retained?.receipts ?? [],
      },
    ].sort((left, right) => (left.anchor < right.anchor ? -1 : 1)),
  };
};

/**
 * Identical submissions are already recorded. A new observation supersedes
 * only the passed result at its exact identity; non-passed history remains.
 */
export const recordLibraryReviewReceipt = (props: {
  previous: IAutoMovieLibraryReviewPlanFile;
  anchor: string;
  receipt: IAutoMovieLibraryReviewObservationReceipt;
}): IAutoMovieLibraryReviewPlanFile => {
  const unit = props.previous.units.find(
    (entry) => entry.anchor === props.anchor,
  );
  if (unit === undefined)
    throw new Error(
      `Library review owner disappeared from its plan: ${props.anchor}.`,
    );
  if (
    unit.receipts.some((receipt) => isDeepStrictEqual(receipt, props.receipt))
  )
    return props.previous;
  return {
    ...props.previous,
    units: props.previous.units.map((entry) =>
      entry !== unit
        ? entry
        : {
            ...unit,
            receipts: [
              ...unit.receipts.filter(
                (receipt) =>
                  receipt.observation !== props.receipt.observation ||
                  !isDeepStrictEqual(
                    receipt.identity,
                    props.receipt.identity,
                  ) ||
                  receipt.verdict !== "passed",
              ),
              props.receipt,
            ],
          },
    ),
  };
};

/** Keep an unchanged plan's exact bytes, including its original formatting. */
export const libraryReviewPublicationSource = (props: {
  before: ILibraryReviewPublicationFile | null;
  previous: IAutoMovieLibraryReviewPlanFile;
  plan: IAutoMovieLibraryReviewPlanFile;
}): string =>
  props.before !== null && isDeepStrictEqual(props.previous, props.plan)
    ? props.before.source
    : `${JSON.stringify(props.plan, null, 2)}\n`;

/**
 * Publish one approved sidecar without unlinking another writer's generation.
 * The pending marker carries the exact original and candidate for recovery.
 * There is an observable empty slot between preserving the predecessor and
 * activating its successor, not an atomic compare-and-swap of the whole path.
 * Admission runs while the approved sidecar is still resident, including for
 * an unchanged request. Failed recovery retains the marker and every archive.
 */
export const publishLibraryReview = (props: {
  target: string;
  before: ILibraryReviewPublicationFile | null;
  source: string;
  attempt: string;
  admit: (pending: ILibraryReviewPublicationArtifact | null) => void;
  io: ILibraryReviewPublicationIO;
}): "published" | "already-recorded" => {
  const { io, target, before } = props;
  const assertBefore = (): void => {
    io.assertBound();
    if (!same(io.read(target), before))
      throw new Error(`Library review predecessor changed: ${target}.`);
  };
  const initial = readLibraryReviewPublication({ target, io });
  if (!same(initial, before))
    throw new Error(`Library review predecessor changed: ${target}.`);
  props.admit(null);
  assertBefore();
  if (before?.source === props.source) return "already-recorded";

  const prefix = `${target}.${props.attempt}`;
  const archive = `${prefix}.before`;
  const candidatePath = `${prefix}.after`;
  const pendingPath = `${target}.pending`;
  // No cleanup runs on a failed exclusive create: its slot may be partial or
  // may belong to a competitor, and neither confers deletion authority.
  const candidate = {
    path: candidatePath,
    file: io.stage(candidatePath, props.source),
  };
  const pendingSource = `${JSON.stringify({ version: 1, target, before, candidate, archive }, null, 2)}\n`;
  const pending = {
    path: pendingPath,
    file: io.stage(pendingPath, pendingSource),
  };
  try {
    assertBefore();
    props.admit(pending);
    assertBefore();
    if (
      !same(io.read(pendingPath), pending.file) ||
      !same(io.read(candidatePath), candidate.file)
    )
      throw new Error(
        "Library review publication staging changed before admission.",
      );
    if (before !== null) io.move({ path: target, file: before }, archive);
    io.move(candidate, target);
    io.assertBound();
    if (!owns(io.read(target), candidate.file))
      throw new Error(
        "Library review publication lost its candidate generation.",
      );
  } catch (error) {
    const failures: unknown[] = [error];
    try {
      io.assertBound();
      if (!same(io.read(pendingPath), pending.file))
        throw new Error(
          "Library review recovery does not own its pending marker.",
        );
      let current = io.read(target);
      if (owns(current, candidate.file)) {
        io.move({ path: target, file: current! }, candidatePath);
        current = null;
      }
      if (!owns(current, before)) {
        if (current !== null)
          throw new Error(
            "Library review recovery preserves a competing sidecar.",
          );
        const original = io.read(archive);
        if (!owns(original, before))
          throw new Error(
            "Library review recovery cannot identify its predecessor archive.",
          );
        io.move({ path: archive, file: original! }, target);
      }
      io.assertBound();
      if (!owns(io.read(target), before))
        throw new Error(
          "Library review recovery did not restore its predecessor.",
        );
      io.move(pending, `${prefix}.failed`);
    } catch (recoveryError) {
      failures.push(recoveryError);
    }
    throw new AggregateError(
      failures,
      `Library review publication failed (${failures.length === 1 ? "predecessor restored" : "recovery required"}): ${failures.map(message).join("; ")}. Retained artifacts: ${prefix}; pending: ${pendingPath}.`,
    );
  }
  // Finalization failure is not permission to undo a published observation.
  // The exact pending record remains recoverable, or has moved to completed.
  try {
    io.move(pending, `${prefix}.completed`);
  } catch (error) {
    throw new Error(
      `Library review sidecar was published but finalization requires recovery: ${message(error)}. Retained record: ${pendingPath} or ${prefix}.completed.`,
      { cause: error },
    );
  }
  return "published";
};
