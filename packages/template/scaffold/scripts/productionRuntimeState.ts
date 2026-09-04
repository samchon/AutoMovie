import type { IAutoMovieDialogueVisemeTimeline } from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  IAutoMovieCompiledFilmEffect,
  IAutoMovieDeliveryCrop,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionFrameRate,
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
  /** Exact rational film clock when the legacy scalar is fractional. */
  frameRate?: IAutoMovieProductionFrameRate;
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
  /** Normalized production delivery crop, or null for the complete gate. */
  deliveryCrop: IAutoMovieDeliveryCrop | null;
  /** Exact authored live-soft admission order. */
  liveWearableSoftBodies: string[];
  /** Current compiler-owned film-global effect runtimes. */
  filmEffects: IAutoMovieCompiledFilmEffect[];
}

/** Clone one delivery crop without sharing mutable authoring input. */
export const cloneProductionDeliveryCrop = (
  crop: IAutoMovieDeliveryCrop | null,
): IAutoMovieDeliveryCrop | null => (crop === null ? null : { ...crop });

/** Clone one immutable dialogue runtime at an invocation boundary. */
export const cloneProductionDialogueRuntime = (
  runtime: IAutoMovieProductionDialogueRuntime | null,
): IAutoMovieProductionDialogueRuntime | null =>
  runtime === null ? null : structuredClone(runtime);

/** Content identity included in page reuse and render-source fingerprints. */
export const productionDialogueRuntimeIdentity = (
  runtime: IAutoMovieProductionDialogueRuntime | null,
): AutoMovieContentDigest | null => {
  if (runtime === null) return null;
  return `sha256:${createHash("sha256")
    .update(Buffer.from(JSON.stringify(runtime), "utf8"))
    .digest("hex")}`;
};

/** Resolve a shot-local seek only when exactly one film occurrence fits. */
export const productionDialogueFrameForShotTime = (
  runtime: IAutoMovieProductionDialogueRuntime | null,
  props: {
    shot: string;
    time: number;
  },
): number | null => {
  if (
    runtime === null ||
    Number.isFinite(props.time) === false ||
    props.time < 0
  )
    return null;
  const sourceFrame = Math.floor(props.time * runtime.fps);
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
