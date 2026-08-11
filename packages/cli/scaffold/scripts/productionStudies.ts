import type { IAutoMovieAcousticRequest } from "@automovie/engine";

import type { IAutoMovieBuildingStudies } from "./buildingReport";

/** One authored room study with a stable identity shared by reports and sound. */
export interface IAutoMovieProductionAcousticStudy {
  /** Stable production-local study identity. */
  id: string;
  /** Exact room-analysis question, without script-owned run identity/revision. */
  request: Omit<IAutoMovieAcousticRequest, "id" | "inputRevision">;
}

/** Explicit join from one sound occurrence to its selected room facts. */
export interface IAutoMovieProductionAcousticBinding {
  /** Exact sound occurrence id emitted by the immutable film sound plan. */
  event: string;
  /** Declared emitter room, or null when the emitter is outdoors. */
  sourceSpace: string | null;
  /** Declared listener room, or null when the listener is outdoors. */
  listenerSpace: string | null;
  /** Selected study id, or null only when both endpoints are outdoors. */
  study: string | null;
}

/**
 * Environmental questions this production asks.
 *
 * The starter declares none. Add measured inputs here; scripts never infer a
 * material coefficient, room mapping, climate, provider, or solver profile.
 */
export const productionAcousticStudies: readonly IAutoMovieProductionAcousticStudy[] =
  [];

/**
 * Sound-occurrence to room-response joins selected by this production.
 *
 * Occurrence ids are visible in audio evidence. A selected acoustic profile
 * requires one exact binding per event, so a stale room or study never becomes
 * an apparently successful dry mix.
 */
export const productionAcousticBindings: readonly IAutoMovieProductionAcousticBinding[] =
  [];

/** Every building report study, sharing acoustic declarations with the mix. */
export const productionBuildingStudies: IAutoMovieBuildingStudies = {
  daylight: [],
  envelope: [],
  acoustic: productionAcousticStudies.map((study) => study.request),
  air: [],
  // One required domain prevents a report over no questions from reading as a
  // pass. Widen this list as the production adopts further obligations.
  required: ["daylight"],
};
