/**
 * One recipe's exact parameter map, as the design gate accepted it.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-geometry-dimensions Carries only the explicit dimensions and discriminators accepted for one recipe.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Preserves the accepted geometry facts without a second normalized store.
 * @author Samchon
 */
export type AutoMovieArchetypeParameters = Readonly<
  Record<string, number | string | boolean>
>;

/**
 * Read one parameter as the number the design gate already accepted.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-geometry-dimensions Reads the explicit metric value that controls generated geometry.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Preserves the numeric input accepted by the design gate.
 * @author Samchon
 */
export const numberParameter = (
  parameters: AutoMovieArchetypeParameters,
  key: string,
): number => parameters[key] as number;

/**
 * Read one parameter as the string the design gate already accepted.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-geometry-dimensions Reads the explicit discriminator that selects a geometry interpretation.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Preserves the string input accepted by the design gate.
 * @author Samchon
 */
export const stringParameter = (
  parameters: AutoMovieArchetypeParameters,
  key: string,
): string => parameters[key] as string;

/**
 * Read one parameter as a finite number, or zero when it is neither.
 *
 * Measurement runs before geometry and outside the design gate, so a recipe
 * that never passed it must still yield a number instead of poisoning a bound
 * with `NaN`.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-geometry-dimensions Reads a dimension only when it is a finite authored number, so unvalidated input cannot introduce `NaN`.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Provides a total pre-build reader while leaving acceptance authority with the design gate.
 * @author Samchon
 */
export const numberOf = (
  parameters: AutoMovieArchetypeParameters,
  key: string,
): number => {
  const value = parameters[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};
