import {
  readAutoMovieImageFacts,
  validateTextureAssets,
} from "@automovie/engine";
import type { IAutoMovieSceneEnvironmentUse } from "@automovie/engine";
import type {
  IAutoMovieAssetProvenance,
  IAutoMovieBuiltEnvironment,
  IAutoMovieDiagnostic,
  IAutoMovieModel,
} from "@automovie/interface";

/**
 * Close material and lighting image uses over either timed or library output.
 *
 * Built environments own models too. Reading only a shot's model list or a
 * library's standalone model contributions leaves those material uses unpaid.
 * Keep every occurrence: equal ids across environments must not hide different
 * material records behind a last-writer-wins map.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-surface-validation Checks sampled material images against their registered uses and actual image headers.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures Applies the same resource closure to standalone and building-contained models before publication.
 */
export const productionTextureClosureDiagnostics = (props: {
  production: string;
  models: readonly IAutoMovieModel[];
  environments: readonly Pick<IAutoMovieBuiltEnvironment, "models">[];
  scenes: readonly IAutoMovieSceneEnvironmentUse[];
  assets: readonly IAutoMovieAssetProvenance[];
  content: readonly { path: string; bytes: Uint8Array }[];
}): IAutoMovieDiagnostic[] => {
  const bytes = new Map(
    props.content.map((entry) => [entry.path, entry.bytes]),
  );
  const result = validateTextureAssets({
    production: props.production,
    models: [
      ...props.models,
      ...props.environments.flatMap((entry) => entry.models),
    ],
    scenes: props.scenes,
    assets: props.assets,
    facts: (asset) => readAutoMovieImageFacts(bytes.get(asset)) ?? undefined,
  });
  return result.success
    ? []
    : result.violations.map((violation) => ({
        code: "asset-texture-unclosed",
        category: "error",
        phase: "compile",
        target: "asset-manifest",
        path: "automovie/assets.json",
        message: `${violation.path} ${violation.expected}. Register the image, correct its typed use, or stop binding it before compiling.`,
      }));
};
