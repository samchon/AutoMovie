import { autoMovieAnalysisRunDigest } from "@automovie/engine";
import {
  IAutoMovieAnalysisRun,
  IAutoMovieEnvironmentContext,
  IAutoMovieHalfSpacePlane,
  IAutoMovieVector3,
} from "@automovie/interface";

/**
 * Builders shared by the environmental-analysis scenarios.
 *
 * They exist so every scenario measures the same declared world: an analysis
 * that quietly changed its context between cases would make two results
 * incomparable, which is exactly what the analysis contract is supposed to
 * stop.
 */

/** A ground-level site with three declared instants and no neighbours. */
export const analysisContext = (
  overrides: Partial<IAutoMovieEnvironmentContext> = {},
): IAutoMovieEnvironmentContext => ({
  version: 1,
  id: "site",
  units: "meter",
  north: { x: 0, y: 0, z: -1 },
  ground: { up: { x: 0, y: 1, z: 0 }, elevation: 0 },
  instants: [
    {
      id: "noon",
      label: "equinox-1200",
      time: 0,
      sun: { x: 0, y: 1, z: 0 },
      directNormalIlluminance: 1000,
      diffuseHorizontalIlluminance: 200,
      outdoorAirTemperature: 0,
      outdoorRelativeHumidity: 0.8,
    },
    {
      id: "afternoon",
      label: "equinox-1500",
      time: 3600,
      sun: { x: 1, y: 1, z: 0 },
      directNormalIlluminance: 800,
      diffuseHorizontalIlluminance: 150,
      outdoorAirTemperature: 5,
      outdoorRelativeHumidity: 0.6,
    },
    {
      id: "night",
      label: "equinox-0000",
      time: 7200,
      sun: { x: 0, y: -1, z: 0 },
      directNormalIlluminance: 0,
      diffuseHorizontalIlluminance: 0,
      outdoorAirTemperature: null,
      outdoorRelativeHumidity: null,
    },
  ],
  occluders: [],
  ...overrides,
});

/** An axis-aligned box as the intersection of its six half-spaces. */
export const boxSolid = (
  id: string,
  min: IAutoMovieVector3,
  max: IAutoMovieVector3,
): { id: string; planes: IAutoMovieHalfSpacePlane[] } => ({
  id,
  planes: [
    { normal: { x: 1, y: 0, z: 0 }, offset: max.x },
    { normal: { x: -1, y: 0, z: 0 }, offset: -min.x },
    { normal: { x: 0, y: 1, z: 0 }, offset: max.y },
    { normal: { x: 0, y: -1, z: 0 }, offset: -min.y },
    { normal: { x: 0, y: 0, z: 1 }, offset: max.z },
    { normal: { x: 0, y: 0, z: -1 }, offset: -min.z },
  ],
});

/**
 * Seal a hand-authored run without asking the engine builder to approve it.
 *
 * The builder refuses to emit an invalid run, which is what it is for, so a
 * scenario proving that the validator catches a malformed run has to write one
 * itself. The digest is taken with the engine's own sealing rule, so what the
 * validator then complains about is the structure and never the seal.
 */
export const sealedAnalysisRun = (
  draft: Omit<IAutoMovieAnalysisRun, "digest">,
): IAutoMovieAnalysisRun => ({
  ...draft,
  digest: autoMovieAnalysisRunDigest(draft),
});
