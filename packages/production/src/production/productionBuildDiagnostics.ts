import { IAutoMovieDiagnostic } from "@automovie/interface";
import fs from "node:fs";
import path from "node:path";

import {
  AutoMovieProductionProject,
  AutoMovieProductionSourcePathError,
} from "./AutoMovieProductionProject";
import {
  compareCodeUnits,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";
import { FILM_SOURCE_EXPORT, FILM_SOURCE_PATH } from "./productionFilmAssembly";

/** Locate missing production and world records before source assembly. */
export const missingDesignDiagnostics = (
  project: AutoMovieProductionProject,
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
): IAutoMovieDiagnostic[] => {
  const productionSegment = encodeAutoMoviePathSegment(project.productionId);
  const diagnostics: IAutoMovieDiagnostic[] = [];
  if (graph.production === null)
    diagnostics.push({
      code: "design-missing",
      category: "error",
      phase: "design",
      target: "production",
      path: `automovie/design/${productionSegment}/production.json`,
      message:
        "Production design is missing. Create the tracked production design record.",
    });
  if (graph.world === null)
    diagnostics.push({
      code: "design-missing",
      category: "error",
      phase: "design",
      target: "world",
      path: "automovie/design/shared/world.json",
      message:
        "World design is missing. Create the tracked world design record.",
    });
  if (graph.shots.size === 0)
    diagnostics.push({
      code: "design-missing",
      category: "error",
      phase: "design",
      target: "shots",
      path: `automovie/design/${productionSegment}/shots`,
      message:
        "No shot contract exists. Create the first tracked shot contract record.",
    });
  return diagnostics;
};

/** Report a source path failure at the shot that selected it. */
export const sourcePathDiagnostic = (
  id: string,
  sourcePath: string,
  error: unknown,
): IAutoMovieDiagnostic => {
  const message = errorMessage(error);
  return {
    code:
      error instanceof AutoMovieProductionSourcePathError &&
      error.reason === "outside-root"
        ? "source-path-outside-root"
        : "source-path-missing",
    category: "error",
    phase: "source",
    target: `shot:${id}`,
    path: sourcePath,
    message,
  };
};

/** Report a source path failure at the film entry. */
export const filmSourcePathDiagnostic = (
  error: unknown,
): IAutoMovieDiagnostic => ({
  code:
    error instanceof AutoMovieProductionSourcePathError &&
    error.reason === "outside-root"
      ? "source-path-outside-root"
      : "source-path-missing",
  category: "error",
  phase: "source",
  target: "film",
  path: FILM_SOURCE_PATH,
  message: `${errorMessage(error)} Export "${FILM_SOURCE_EXPORT}" with build(context) from ${FILM_SOURCE_PATH}.`,
});

/** Preserve an Error message when formatting an unknown thrown value. */
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Recognize supported TypeScript module extensions. */
export const isTypeScriptSourcePath = (file: string): boolean =>
  [".ts", ".tsx", ".mts", ".cts"].includes(path.extname(file).toLowerCase());

/** Enumerate regular files beneath the selected directory. */
export const listFiles = (root: string): string[] => {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareCodeUnits(left.name, right.name))) {
      const child = path.join(directory, entry.name);
      const status = fs.lstatSync(child);
      if (status.isSymbolicLink()) files.push(child);
      else if (status.isDirectory()) visit(child);
      else if (status.isFile()) files.push(child);
    }
  };
  visit(root);
  return files;
};

/** Order diagnostics consistently by their owning address. */
export const compareDiagnostics = (
  left: IAutoMovieDiagnostic,
  right: IAutoMovieDiagnostic,
): number =>
  compareCodeUnits(left.phase, right.phase) ||
  compareCodeUnits(left.path ?? "", right.path ?? "") ||
  compareCodeUnits(left.code, right.code) ||
  compareCodeUnits(left.message, right.message);

/** Use portable slash separators in diagnostic and artifact paths. */
export const normalizeSlash = (value: string): string =>
  value.split(path.sep).join("/");
