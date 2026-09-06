import {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieRenderBundleManifest,
  IAutoMovieShotContract,
} from "@automovie/interface";

import { autoMovieAssetReviewViews } from "./assetReviewViews";
import { compareCodeUnits } from "./contentIdentity";
import type { IAutoMovieProductionDesignGraph } from "./validateProductionDesign";

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
  /** Production frame rate, which is the clock a declared time resolves on. */
  fps: number;
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
  ) => ReadonlyArray<{
    time: number;
    pass: AutoMovieGuidePass;
    semanticCoverage?: { unresolved: string[]; unaddressed: number };
  }>;
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
    // Compare on the frame index the capture path snaps to, never on the
    // authored seconds. A contract states a time and the production clock
    // resolves it: capture records the snapped time, so a declared 1.51s and
    // the 1.5s that was actually drawn are the same frame and comparing the
    // seconds would report a frame that exists as missing.
    const snap = (time: number): number =>
      Math.min(
        Math.round(time * props.fps),
        Math.floor(contract.durationSeconds * props.fps),
      );
    const captured = props.captured(target, fingerprint);
    const held = new Set(
      captured
        .filter(
          (view) =>
            view.pass !== "mask" ||
            (view.semanticCoverage !== undefined &&
              view.semanticCoverage.unresolved.length === 0 &&
              view.semanticCoverage.unaddressed === 0),
        )
        .map((view) => viewKey(snap(view.time), view.pass)),
    );
    const missing = owed.filter(
      (view) => held.has(viewKey(snap(view.time), view.pass)) === false,
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
      )}${describeIncompleteSemanticCoverage(captured)} Evidence is read at this shot's current fingerprint ${fingerprint}, so a frame drawn before the shot last moved is still on disk and still does not count. Capture what is named above, then say what it showed in the evidence citation on the source that realizes this shot.`,
    });
  }
  return diagnostics;
};

const describeIncompleteSemanticCoverage = (
  captured: ReadonlyArray<{
    pass: AutoMovieGuidePass;
    semanticCoverage?: { unresolved: string[]; unaddressed: number };
  }>,
): string => {
  const incomplete = captured.filter(
    (view) =>
      view.pass === "mask" &&
      view.semanticCoverage !== undefined &&
      (view.semanticCoverage.unresolved.length !== 0 ||
        view.semanticCoverage.unaddressed !== 0),
  );
  if (incomplete.length === 0) return "";
  const unresolved = [
    ...new Set(incomplete.flatMap((view) => view.semanticCoverage!.unresolved)),
  ].sort(compareCodeUnits);
  const unaddressed = Math.max(
    ...incomplete.map((view) => view.semanticCoverage!.unaddressed),
  );
  return ` Current mask evidence remains incomplete: unresolved ids [${unresolved.join(
    ", ",
  )}] and ${unaddressed} unnamed meshes.`;
};

/**
 * Refuse a reviewed model whose declared turntable views were never drawn.
 *
 * A shot's evidence is frames inside one bundle; an asset's is a separate
 * bundle per view, because the angle, elevation, and pose are part of the
 * target rather than of the frame. The required set is
 * {@link autoMovieAssetReviewViews}, which the capture path and this refusal
 * read from one place so that what an asset owes and what it was captured from
 * cannot drift apart.
 *
 * Only models the production actually consumes are asked for. A recipe nothing
 * stages is an unused design, and demanding a turntable of it would make the
 * gate a tax on the library rather than a check on the film.
 */
export const assetReviewEvidenceDiagnostics = (props: {
  /** Model ids some shot, formation, or compiled shot source consumes. */
  consumed: readonly string[];
  /** Whether one consumed model compiled with a skeleton. */
  rigged: (model: string) => boolean;
  /** Compile scope; only `review` and `final` owe pixels. */
  scope: "design" | "source" | "review" | "final";
  /** Current render-target fingerprint for one exact asset view. */
  fingerprint: (
    target: IAutoMovieRenderBundleManifest["target"],
  ) => AutoMovieContentDigest | null;
  /** Whether any verified bundle stands at that fingerprint. */
  captured: (
    target: IAutoMovieRenderBundleManifest["target"],
    fingerprint: AutoMovieContentDigest,
  ) => ReadonlyArray<{ time: number; pass: AutoMovieGuidePass }>;
}): IAutoMovieDiagnostic[] => {
  if (props.scope !== "review" && props.scope !== "final") return [];
  const diagnostics: IAutoMovieDiagnostic[] = [];
  for (const model of props.consumed) {
    const missing: string[] = [];
    let addressable = false;
    for (const view of autoMovieAssetReviewViews({
      rigged: props.rigged(model),
    })) {
      const target = {
        kind: "asset",
        id: model,
        angleDeg: view.angleDeg,
        elevationDeg: view.elevationDeg,
        pose: view.pose,
      } as const;
      const fingerprint = props.fingerprint(target);
      if (fingerprint === null) continue;
      addressable = true;
      // The pass is a property of the frame rather than of the target, so a
      // bundle standing at this angle proves nothing about which pass was
      // drawn there. An outline view satisfied by a beauty frame is the
      // silhouette check nobody performed.
      if (
        props
          .captured(target, fingerprint)
          .some((held) => held.pass === view.pass) === false
      )
        missing.push(`"${view.id}" (${view.pass})`);
    }
    if (addressable === false || missing.length === 0) continue;
    diagnostics.push({
      code: "review-evidence-missing",
      category: "error",
      phase: "review",
      target: `asset:${model}`,
      path: null,
      message: `Model "${model}" is staged by this production and is being reviewed without the turntable views an asset review is judged from. Missing ${missing.join(
        ", ",
      )}. An object read from one flattering angle is an object whose other side nobody looked at. Capture the declared set, then say what each view showed in the evidence citation on this model's design owner.`,
    });
  }
  return diagnostics;
};

/** Frame-and-pass identity on the production clock. */
const viewKey = (index: number, pass: AutoMovieGuidePass): string =>
  `${index}:${pass}`;

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

/**
 * Every model this production actually stages, closed under level of detail.
 *
 * An asset review is owed by what the film puts on screen, not by what the
 * library happens to hold: a recipe nothing stages is an unused design, and
 * asking it for a turntable would make the gate a tax on the library. Both
 * sides are read because both can introduce a model -- a contract naming an
 * actor or a formation, and a compiled shot source whose build path resolved
 * one the design never named.
 */
export const consumedModelIds = (
  graph: IAutoMovieProductionDesignGraph,
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>,
): string[] => {
  const models = new Set<string>();
  const add = (id: string): void => {
    if (models.has(id)) return;
    const recipe = graph.models.get(id);
    if (recipe === undefined) return;
    models.add(id);
    for (const tier of recipe.lod) add(tier.recipe);
  };
  for (const shot of graph.shots.values())
    for (const participant of shot.participants)
      if (participant.kind === "actor") add(participant.id);
      else {
        const formation = graph.formations.get(participant.id);
        if (formation !== undefined) add(formation.modelRecipe);
      }
  // Each compiled shot's own model list, never the materialized inventory. The
  // inventory holds every recipe the design declares, so reading it would make
  // the gate ask for a turntable of a model nothing stages -- a tax on the
  // library, which is exactly what this rule exists to avoid.
  for (const shot of compiled.values())
    for (const model of shot.models) add(model.id);
  return [...models].sort(compareCodeUnits);
};
