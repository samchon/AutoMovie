import {
  AutoMovieContentDigest,
  IAutoMovieGeneratedFile,
  IAutoMovieMaterializedFile,
} from "@automovie/interface";

import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import {
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";

export const statusesOf = (
  project: AutoMovieProductionProject,
  files: readonly IAutoMovieGeneratedFile[],
): IAutoMovieMaterializedFile[] => {
  return files.map((file) => {
    let before: AutoMovieContentDigest | null = null;
    try {
      before = digestAutoMovieBytes(project.readGeneratedFile(file.path));
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("does not exist") === false
      )
        throw error;
    }
    return {
      ...file,
      status:
        before === null
          ? "created"
          : before === file.digest
            ? "unchanged"
            : "updated",
    };
  });
};

export const sourceTargetsOf = (
  file: string,
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
): string[] => {
  if (
    file === "contracts/film-edit.json" ||
    file === "film-timeline.json" ||
    file === "film-effects.json"
  )
    return ["film"];
  for (const [id] of graph.shots)
    if (
      file === `shots/${encodeAutoMoviePathSegment(id)}.json` ||
      file === `realizations/${encodeAutoMoviePathSegment(id)}.json` ||
      file === `contracts/shots/${encodeAutoMoviePathSegment(id)}.json`
    )
      return [`shot:${id}`];
  for (const adoption of graph.production?.externalMotions ?? [])
    if (
      file ===
      `receipts/external-motion/${encodeAutoMoviePathSegment(adoption.id)}.json`
    )
      return [`external-motion:${adoption.id}`, `shot:${adoption.shot}`];
  for (const [id] of graph.models)
    if (
      file === `models/${encodeAutoMoviePathSegment(id)}.json` ||
      file === `contracts/models/${encodeAutoMoviePathSegment(id)}.json`
    )
      return [`model:${id}`];
  for (const [id] of graph.formations)
    if (file === `contracts/formations/${encodeAutoMoviePathSegment(id)}.json`)
      return [`formation:${id}`];
  for (const [id] of graph.acceptance)
    if (file === `contracts/acceptance/${encodeAutoMoviePathSegment(id)}.json`)
      return [`acceptance:${id}`];
  return [
    file === "contracts/production.json"
      ? "production"
      : file === "contracts/world.json"
        ? "world"
        : "builder",
  ];
};
