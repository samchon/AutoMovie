import {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMovieDiagnostic,
  IAutoMovieRenderBundleManifest,
  IAutoMovieShotContract,
} from "@automovie/interface";

/**
 * One frame a target's contract declares and the passes it declares with it.
 */
interface IOwedView {
  frame: string;
  time: number;
  pass: AutoMovieGuidePass;
}

/**
 * What a review-stage target owes in pixels, and what it actually has.
 *
 * A citation states what was verified and expires when the cited source moves,
 * which is a strong claim about prose and no claim at all about pixels. Nothing
 * else asks whether the frames a contract declared were ever drawn, so an
 * author who captured nothing can write a fingerprint-valid review of a shot
 * and every gate passes. This asks.
 *
 * It deliberately does not judge the frames. Whether a silhouette reads or a
 * cut lands is settled by looking and recorded in the citation; what is
 * mechanical is whether the evidence that judgement claims to rest on exists at
 * the target's current identity. Separating the two is what lets the judgement
 * stay in prose without letting the prose stand alone.
 */
export const reviewEvidenceDiagnostics = (props: {
  /** Shot contracts the compiled production carries. */
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  /** Compile scope; only `review` and `final` owe pixels. */
  scope: "design" | "source" | "review" | "final";
  /**
   * Current render-target fingerprint for one target, or `null` when the
   * production cannot address that target yet.
   */
  fingerprint: (
    target: IAutoMovieRenderBundleManifest["target"],
  ) => AutoMovieContentDigest | null;
  /**
   * Every frame committed for one target at one fingerprint, in commit order.
   *
   * Reads only bundles filed under that exact fingerprint, so a target whose
   * source, design, or compiler identity moved reports the frames it owes
   * rather than the frames its previous self had.
   */
  captured: (
    target: IAutoMovieRenderBundleManifest["target"],
    fingerprint: AutoMovieContentDigest,
  ) => ReadonlyArray<{ time: number; pass: AutoMovieGuidePass }>;
}): IAutoMovieDiagnostic[] => {
  if (props.scope !== "review" && props.scope !== "final") return [];
  const diagnostics: IAutoMovieDiagnostic[] = [];
  for (const [id, contract] of props.contracts) {
    const target = { kind: "shot", id } as const;
    const fingerprint = props.fingerprint(target);
    if (fingerprint === null) continue;
    const owed: IOwedView[] = contract.reviewFrames.flatMap((frame) =>
      frame.passes.map((pass) => ({ frame: frame.id, time: frame.time, pass })),
    );
    if (owed.length === 0) continue;
    // Compare on the frame index the capture path snaps to rather than on the
    // authored seconds. A contract states a time and the clock resolves it, so
    // an exact float comparison would report a frame that was drawn.
    const held = new Set(
      props
        .captured(target, fingerprint)
        .map((view) => viewKey(view.time, view.pass)),
    );
    const missing = owed.filter(
      (view) => held.has(viewKey(view.time, view.pass)) === false,
    );
    if (missing.length === 0) continue;
    diagnostics.push({
      code: "review-evidence-missing",
      category: "error",
      phase: "review",
      target: `shot:${id}`,
      path: null,
      message: `Shot "${id}" is being reviewed without the evidence its own contract declares. ${describe(
        missing,
      )} No bundle is filed at the shot's current fingerprint ${fingerprint}, so any review written now rests on frames that do not exist or on a previous version of this shot. Capture the declared set, then say what it showed in the evidence citation on the source that realizes this shot.`,
    });
  }
  return diagnostics;
};

/** Frame-and-pass identity, rounded to the millisecond the clock resolves. */
const viewKey = (time: number, pass: AutoMovieGuidePass): string =>
  `${Math.round(time * 1000)}:${pass}`;

/**
 * Name what is owed rather than counting it.
 *
 * A count tells an author how much work is left and nothing about which work,
 * so the list is bounded rather than summarized: the first few by name, and an
 * honest remainder when the contract declares more than a message should hold.
 */
const describe = (missing: readonly IOwedView[]): string => {
  const LIMIT = 6;
  const named = missing
    .slice(0, LIMIT)
    .map((view) => `"${view.frame}" at ${view.time}s (${view.pass})`)
    .join(", ");
  return missing.length <= LIMIT
    ? `Missing ${named}.`
    : `Missing ${named}, and ${missing.length - LIMIT} more.`;
};
