import type { IAutoMovieDialogueVisemeTimeline } from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionTtsReceipt,
} from "@automovie/interface";
import { createHash } from "node:crypto";

/** Final-byte mouth data installed in the capture host before any frame opens. */
export interface IAutoMovieProductionDialogueRuntime {
  /** Runtime schema. */
  version: 1;
  /** Compiler input shared by the film and sound plans. */
  inputFingerprint: AutoMovieContentDigest;
  /** Film frame clock used by every mouth range. */
  fps: number;
  /** Film segments needed to map a shot-local review seek onto film time. */
  segments: Array<
    Pick<
      IAutoMovieFilmTimeline["segments"][number],
      "shot" | "startFrame" | "endFrame" | "sourceInFrame" | "sourceOutFrame"
    >
  >;
  /** Receipts carrying both final-byte visemes and their explicit join verdict. */
  receipts: IAutoMovieProductionTtsReceipt[];
  /** Available, gap-free actor mouth timelines consumed by the viewer. */
  timelines: IAutoMovieDialogueVisemeTimeline[];
}

/** Runtime state served to every scaffold viewer page. */
export interface IAutoMovieProductionViewerRuntime {
  /** Final-byte dialogue state, or null before a render has prepared it. */
  dialogue: IAutoMovieProductionDialogueRuntime | null;
  /** Exact authored live-soft admission order. */
  liveWearableSoftBodies: string[];
}

let captureDialogueRuntime: IAutoMovieProductionDialogueRuntime | null = null;

/** Install one immutable dialogue runtime for the current capture process. */
export const installProductionDialogueRuntime = (
  runtime: IAutoMovieProductionDialogueRuntime | null,
): void => {
  captureDialogueRuntime = runtime === null ? null : structuredClone(runtime);
};

/** Read the current immutable dialogue runtime for the viewer middleware. */
export const currentProductionDialogueRuntime =
  (): IAutoMovieProductionDialogueRuntime | null =>
    captureDialogueRuntime === null
      ? null
      : structuredClone(captureDialogueRuntime);

/** Content identity included in page reuse and render-source fingerprints. */
export const productionDialogueRuntimeIdentity = (): string | null => {
  if (captureDialogueRuntime === null) return null;
  return createHash("sha256")
    .update(Buffer.from(JSON.stringify(captureDialogueRuntime), "utf8"))
    .digest("hex");
};

/** Resolve a shot-local seek only when exactly one film occurrence fits. */
export const productionDialogueFrameForShotTime = (props: {
  shot: string;
  time: number;
}): number | null => {
  const runtime = captureDialogueRuntime;
  if (
    runtime === null ||
    Number.isFinite(props.time) === false ||
    props.time < 0
  )
    return null;
  const sourceFrame = Math.round(props.time * runtime.fps);
  const candidates = runtime.segments.filter(
    (segment) =>
      segment.shot === props.shot &&
      sourceFrame >= segment.sourceInFrame &&
      sourceFrame < segment.sourceOutFrame,
  );
  if (candidates.length !== 1) return null;
  const segment = candidates[0]!;
  return segment.startFrame + sourceFrame - segment.sourceInFrame;
};
