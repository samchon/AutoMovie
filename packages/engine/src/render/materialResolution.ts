import type { IAutoMovieMaterial, IAutoMovieModel } from "@automovie/interface";

import { compareAutoMovieRenderIds } from "./renderDigest";

/**
 * Resolve one cross-model material id to one complete material definition.
 *
 * A model part resolves its material inside its own model. Simulated surfaces
 * carry only an id, so their lookup population is every compiled model instead.
 * Repeating an identical record under the same stable id is one definition;
 * repeating that id with any structural difference is an ambiguity and is
 * refused. Candidate and property order cannot affect either the result or the
 * diagnostic.
 *
 * @evidence requirements/rendering/budgets.md#rendering-geometry-memory-budget Resolves each simulated drawable's material to one definition before its material and texture cost is counted.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Defines the deterministic material-identity join used by conservative render preflight.
 * @author Samchon
 */
export const resolveAutoMovieMaterial = (props: {
  models: readonly IAutoMovieModel[];
  material: string;
}): IAutoMovieMaterial => {
  if (props.material.trim().length === 0)
    throw new Error("material id must not be blank.");
  const candidates = props.models
    .flatMap((model) =>
      model.materials
        .filter((material) => material.id === props.material)
        .map((material) => ({ model: model.id, material })),
    )
    .sort((left, right) => compareAutoMovieRenderIds(left.model, right.model));
  if (candidates.length === 0)
    throw new Error(
      `material "${props.material}" is absent from the compiled model population.`,
    );
  const signature = materialSignature(candidates[0]!.material);
  if (
    candidates
      .slice(1)
      .some((candidate) => materialSignature(candidate.material) !== signature)
  )
    throw new Error(
      `material "${props.material}" has conflicting definitions in models: ${candidates
        .map((candidate) => candidate.model)
        .map((model) => `"${model}"`)
        .join(", ")}.`,
    );
  return candidates[0]!.material;
};

/** Canonical structural identity, independent of object property insertion. */
const materialSignature = (material: IAutoMovieMaterial): string =>
  JSON.stringify(canonicalObject(material));

/** Sort every record key recursively; material records contain no arrays. */
const canonicalObject = (value: unknown): unknown =>
  value === null || typeof value !== "object"
    ? value
    : Object.fromEntries(
        Object.keys(value)
          .sort(compareAutoMovieRenderIds)
          .map((key) => [
            key,
            canonicalObject((value as Record<string, unknown>)[key]),
          ]),
      );
