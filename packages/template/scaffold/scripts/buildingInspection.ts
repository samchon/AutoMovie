import {
  builtEnvironmentPlacementOverlapSweep,
  builtEnvironmentSupportSweep,
} from "@automovie/engine";
import type { IAutoMovieBuiltEnvironment } from "@automovie/interface";
import { createHash } from "node:crypto";

/** Measurements an author supplies for a building's reference ground plane. */
export interface IAutoMoviePlacementStudy {
  groundY: number;
  tolerance: number;
}

/**
 * Read placement candidates and storage costs without expanding populations.
 * Support is not run without a declared ground plane. Engine bounds remain
 * bounds: a candidate is not a triangle collision or a structural certificate.
 */
export const inspectAutoMovieBuilding = (props: {
  environment: IAutoMovieBuiltEnvironment;
  inputFingerprint: string;
  study?: IAutoMoviePlacementStudy;
}) => {
  const { environment } = props;
  const populations = environment.populations ?? [];
  const geometry = new Map<string, { copies: number; bytes: number }>();
  let parts = 0;
  for (const model of environment.models)
    for (const part of model.parts) {
      ++parts;
      const json = JSON.stringify(part.geometry);
      const digest = createHash("sha256").update(json).digest("hex");
      const previous = geometry.get(digest);
      if (previous === undefined)
        geometry.set(digest, { copies: 1, bytes: Buffer.byteLength(json) });
      else ++previous.copies;
    }
  return {
    environment: environment.id,
    inputFingerprint: props.inputFingerprint,
    basis: {
      placement: "element and population bounds; part boxes where available",
      populations: "aggregate bounds, not individual member collision checks",
      support:
        "contact with the declared ground plane or another body's part bounds; no load-bearing or stability proof",
      storage:
        "UTF-8 compact JSON, before compression; exact serialized geometry repeats only",
    },
    census: {
      elements: environment.elements.length,
      models: environment.models.length,
      externalModelReferences: environment.modelReferences.length,
      parts,
      populationSets: populations.length,
      populationMembers: populations.reduce(
        (sum, entry) => sum + entry.set.count,
        0,
      ),
    },
    storage: {
      environmentBytes: Buffer.byteLength(JSON.stringify(environment)),
      modelBytes: environment.models.reduce(
        (sum, model) => sum + Buffer.byteLength(JSON.stringify(model)),
        0,
      ),
      geometryRecords: parts,
      uniqueSerializedGeometries: geometry.size,
      repeatedGeometryBytes: [...geometry.values()].reduce(
        (sum, entry) => sum + (entry.copies - 1) * entry.bytes,
        0,
      ),
    },
    support:
      props.study === undefined
        ? {
            status: "not-run" as const,
            reason:
              "Declare this environment's groundY and tolerance in productionPlacementStudies.ts.",
          }
        : {
            status: "measured" as const,
            parameters: props.study,
            report: builtEnvironmentSupportSweep({
              environment,
              ...props.study,
            }),
          },
    overlaps: builtEnvironmentPlacementOverlapSweep({ environment }),
  };
};
