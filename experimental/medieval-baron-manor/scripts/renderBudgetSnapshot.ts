import type {
  IAutoMovieCaptureRuntimeIdentity,
  IAutoMovieCompiledShotSource,
  IAutoMovieProductionDesign,
  IAutoMovieRenderSpec,
  IAutoMovieRenderTargetAsset,
} from "@automovie/interface";
import {
  AutoMovieProductionProject,
  compareCodeUnits,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
  parseAutoMovieStructuredJson,
} from "@automovie/production";
import {
  type IAutoMovieRenderBudgetAssessment,
  type IAutoMovieRenderBudgetEvidence,
  assessAutoMovieRenderBudget,
  autoMovieRenderBudgetEvidence,
  autoMovieRenderTargetRendererOfGraphics,
  autoMovieRenderTargetSettingsOfShot,
  selectAutoMovieRenderBudget,
} from "@automovie/render";
import path from "node:path";

import {
  type IRenderGcTargetSnapshot,
  createRenderGcFileSnapshot,
  ensureRenderPhysicalDirectory,
} from "./renderGcSnapshot";

/** Maximum bytes of one published render-budget evidence document. */
const RENDER_BUDGET_EVIDENCE_MAX_BYTES = 16 * 1024 * 1024;

/** Directory, under the tier's render-job state, holding the evidence. */
export const RENDER_BUDGET_EVIDENCE_DIRECTORY = "render-budget";

/** Read one compiled shot artifact from current compiler-owned bytes. */
export const readCompiledShotSource = (
  project: AutoMovieProductionProject,
  shot: string,
): IAutoMovieCompiledShotSource =>
  parseAutoMovieStructuredJson({
    record: "compiled-shot",
    bytes: project.readGeneratedFile(
      `shots/${encodeAutoMoviePathSegment(shot)}.json`,
    ),
  }) as IAutoMovieCompiledShotSource;

/**
 * Every byte a drawn frame depends on, as the render target fingerprints them.
 *
 * The declared render/configuration/asset inputs, minus the audio the edit
 * plays: a mix changes no pixel, and fingerprinting it would call every visual
 * report stale the moment a stem is re-cut. A declared optional input that is
 * absent carries no bytes and is left out rather than sealed under an invented
 * digest.
 */
export const productionRenderTargetAssets = (
  project: AutoMovieProductionProject,
  audioAssets: ReadonlySet<string>,
): IAutoMovieRenderTargetAsset[] =>
  project
    .contentInputs()
    .flatMap((input) =>
      input.render && input.bytes !== null && !audioAssets.has(input.path)
        ? [{ path: input.path, digest: digestAutoMovieBytes(input.bytes) }]
        : [],
    )
    .sort((left, right) => compareCodeUnits(left.path, right.path));

/**
 * Measure every shot the edit draws and check it against the tier's budget.
 *
 * The render job is the only place this can happen: the budget is a claim about
 * a renderer drawing specific bytes at a specific raster, and the renderer is
 * only known once the capture host has opened a page and asked WebGL what it
 * is. So the plan's own capture identity is the input, and a plan carrying none
 * produces `not-run` for every shot rather than a verdict attributed to
 * nobody.
 */
export const assessProductionRenderBudget = (props: {
  /** Current production project. */
  project: AutoMovieProductionProject;
  /** Current production design, whose `renderBudgets` are the limits. */
  production: IAutoMovieProductionDesign;
  /** Quality tier this render job targets. */
  tier: string;
  /** Shot ids the edit draws, in any order. */
  shots: readonly string[];
  /** Output raster the tier renders at. */
  frameFormat: { width: number; height: number };
  /** Device pixel ratio the capture host pins. */
  pixelRatio: number;
  /** Delivery tone mapping the capture hands the viewer. */
  delivery: IAutoMovieRenderSpec["toneMapping"];
  /** Graphics identity the plan's capture preflight proved. */
  graphics: IAutoMovieCaptureRuntimeIdentity["graphics"] | null;
  /** Audio assets to exclude from the fingerprinted byte set. */
  audioAssets: ReadonlySet<string>;
}): IAutoMovieRenderBudgetEvidence => {
  const budget = selectAutoMovieRenderBudget(
    props.production.renderBudgets,
    props.tier,
  );
  const renderer = autoMovieRenderTargetRendererOfGraphics(props.graphics);
  const assets = productionRenderTargetAssets(props.project, props.audioAssets);
  const assessments: IAutoMovieRenderBudgetAssessment[] = [
    ...new Set(props.shots),
  ].map((shot) => {
    const compiled = readCompiledShotSource(props.project, shot);
    return assessAutoMovieRenderBudget({
      compiled,
      shot,
      budget,
      renderer,
      settings: autoMovieRenderTargetSettingsOfShot({
        compiled,
        width: props.frameFormat.width,
        height: props.frameFormat.height,
        pixelRatio: props.pixelRatio,
        delivery: props.delivery,
      }),
      assets,
    });
  });
  return autoMovieRenderBudgetEvidence({
    tier: props.tier,
    budgets: props.production.renderBudgets,
    assessments,
  });
};

/**
 * Publish one evidence document beside the render job it belongs to.
 *
 * The file is content-addressed and immutable, exactly as a capture install
 * receipt is: republishing an unchanged verdict lands on the same name, so a
 * second render of the same production neither rewrites evidence nor fails on
 * one that already exists. A different verdict is a different file, and both
 * stay readable.
 */
export const publishRenderBudgetEvidence = (props: {
  /** Tier state root that owns the evidence directory and fences the write. */
  stateRoot: string;
  /** Evidence to publish. */
  evidence: IAutoMovieRenderBudgetEvidence;
}): { path: string; snapshot: IRenderGcTargetSnapshot | null } => {
  const directory = ensureRenderPhysicalDirectory(
    props.stateRoot,
    RENDER_BUDGET_EVIDENCE_DIRECTORY,
  );
  const file = path.join(directory, `${props.evidence.digest.slice(7)}.json`);
  const bytes = Buffer.from(
    `${JSON.stringify(props.evidence, null, 2)}\n`,
    "utf8",
  );
  if (bytes.length > RENDER_BUDGET_EVIDENCE_MAX_BYTES)
    throw new Error(
      "Render budget evidence exceeds its maximum byte length. Reduce the number of shots this tier draws in one job.",
    );
  try {
    return {
      path: file,
      snapshot: createRenderGcFileSnapshot(props.stateRoot, file, bytes),
    };
  } catch (error) {
    // The digest names the bytes, so an existing file at this address already
    // records this verdict; anything else is a real failure.
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    return { path: file, snapshot: null };
  }
};
