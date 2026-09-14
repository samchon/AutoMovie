import {
  materializeProductionFilmEffects,
  productionFilmEffectEditFingerprint,
  projectProductionShotEffectFilmIntervals,
  resolveProductionFrameRate,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieCompiledContractRealization,
  IAutoMovieCompiledFilmEdit,
  IAutoMovieCompiledFilmEffect,
  IAutoMovieCompiledShotSource,
  IAutoMovieExternalMotionConversionReceipt,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionDesign,
  IAutoMovieWorldDesign,
} from "@automovie/interface";

import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";
import { AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL } from "./productionBuildProtocol";
import { IProductionExternalMotionConversionDraft } from "./productionExternalMotion";
import {
  FILM_SOURCE_EXPORT,
  FILM_SOURCE_PATH,
  ICompiledFilmDraft,
} from "./productionFilmAssembly";

/** Serialize the resolved models, shots and motion conversions into generated files. */
export const materializeGeneratedFiles = (
  productionId: string,
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
  runtimeModels: ReadonlyMap<
    string,
    IAutoMovieCompiledShotSource["models"][number]
  >,
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>,
  externalMotionConversions: ReadonlyMap<
    string,
    IProductionExternalMotionConversionDraft
  >,
  realizations: ReadonlyMap<string, IAutoMovieCompiledContractRealization>,
  film: {
    edit: IAutoMovieCompiledFilmEdit;
    timeline: IAutoMovieFilmTimeline;
    effects: IAutoMovieCompiledFilmEffect[];
  } | null,
  inputFingerprint: AutoMovieContentDigest,
): ReadonlyMap<string, Uint8Array> => {
  const files = new Map<string, Uint8Array>();
  const put = (file: string, value: unknown): void => {
    files.set(
      file,
      Buffer.concat([
        Buffer.from(canonicalAutoMovieJsonBytes(value)),
        Buffer.from("\n", "utf8"),
      ]),
    );
  };
  put("contracts/production.json", graph.production);
  put("contracts/world.json", graph.world);
  for (const [id, value] of graph.models)
    put(`contracts/models/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [id, value] of graph.formations)
    put(`contracts/formations/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [id, value] of graph.shots)
    put(`contracts/shots/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [id, value] of graph.acceptance)
    put(`contracts/acceptance/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [id, value] of runtimeModels)
    put(`models/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [id, value] of compiled)
    put(`shots/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [adoption, draft] of [...externalMotionConversions].sort(
    ([left], [right]) => compareCodeUnits(left, right),
  )) {
    const outputPath = `shots/${encodeAutoMoviePathSegment(draft.decision.shot)}.json`;
    const outputBytes = files.get(outputPath);
    if (outputBytes === undefined)
      throw new Error(
        `External motion conversion "${adoption}" has no materialized shot output "${outputPath}".`,
      );
    const { motion, ...receipt } = draft;
    const compiledShot = compiled.get(draft.decision.shot);
    const resultMotionId = compiledShot?.shot.performances.find(
      (performance) => performance.node === draft.decision.actor,
    )?.motion;
    const resultMotion = compiledShot?.motions.find(
      (candidate) => candidate.id === resultMotionId,
    );
    if (resultMotion === undefined)
      throw new Error(
        `External motion conversion "${adoption}" for actor "${draft.decision.actor}" has no canonical enacted performance in materialized shot "${draft.decision.shot}".`,
      );
    const value: IAutoMovieExternalMotionConversionReceipt = {
      ...receipt,
      result: {
        motionId: resultMotion.id,
        motionDigest: digestAutoMovieBytes(
          canonicalAutoMovieJsonBytes(resultMotion),
        ),
        outputPath,
        outputDigest: digestAutoMovieBytes(outputBytes),
      },
    };
    put(
      `receipts/external-motion/${encodeAutoMoviePathSegment(adoption)}.json`,
      value,
    );
  }
  for (const [id, value] of realizations)
    put(`realizations/${encodeAutoMoviePathSegment(id)}.json`, value);
  if (film !== null) {
    put("contracts/film-edit.json", film.edit);
    put("film-timeline.json", film.timeline);
    put("film-effects.json", film.effects);
  }
  put("manifests/compile.json", {
    version: 2,
    builder: AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL,
    productionId,
    inputFingerprint,
    assets: [...runtimeModels.keys()].sort(compareCodeUnits).map((id) => ({
      id,
      path: `models/${encodeAutoMoviePathSegment(id)}.json`,
    })),
    shots: [...compiled.keys()].sort(compareCodeUnits).map((id) => ({
      id,
      path: `shots/${encodeAutoMoviePathSegment(id)}.json`,
    })),
    film: film?.timeline.id ?? null,
  });
  return files;
};

/** Serialize the film timeline and effect streams independently of rendered media.
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Emits timeline and effect data separately from rendered files.
 */
export const materializeFilmArtifacts = (
  draft: ICompiledFilmDraft,
  sourceDigest: AutoMovieContentDigest,
  inputFingerprint: AutoMovieContentDigest,
  production: IAutoMovieProductionDesign,
  world: IAutoMovieWorldDesign,
  shots: ReadonlyMap<string, IAutoMovieCompiledShotSource>,
): {
  edit: IAutoMovieCompiledFilmEdit;
  timeline: IAutoMovieFilmTimeline;
  effects: IAutoMovieCompiledFilmEffect[];
} => {
  const timeline: IAutoMovieFilmTimeline = {
    ...draft.timeline,
    builder: AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL,
    inputFingerprint,
    sourceDigest,
  };
  const editFingerprint = productionFilmEffectEditFingerprint(timeline);
  // Shot cues are projected onto film frames by the same exact rational
  // half-open boundary the effect runtime samples with, so a cue second that
  // sits off the frame grid owns the frame whose interval contains it rather
  // than the frame a float product happens to round to.
  const shotEffects = projectProductionShotEffectFilmIntervals({
    timeline,
    shots,
  });
  return {
    edit: {
      version: 1,
      builder: AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL,
      inputFingerprint,
      source: {
        path: FILM_SOURCE_PATH,
        export: FILM_SOURCE_EXPORT,
        digest: sourceDigest,
      },
      edit: draft.edit,
    },
    timeline,
    effects: materializeProductionFilmEffects({
      identity: {
        production: production.id,
        film: timeline.id,
        compileFingerprint: inputFingerprint,
        editFingerprint,
      },
      frameRate: resolveProductionFrameRate(timeline),
      world,
      effects: timeline.tracks.effects,
      shotEffects,
    }),
  };
};
