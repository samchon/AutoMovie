/** One recipe's exact parameter map, as the design gate accepted it. */
export type AutoMovieArchetypeParameters = Readonly<
  Record<string, number | string | boolean>
>;

/** Read one parameter as the number the design gate already accepted. */
export const numberParameter = (
  parameters: AutoMovieArchetypeParameters,
  key: string,
): number => parameters[key] as number;

/** Read one parameter as the string the design gate already accepted. */
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
 */
export const numberOf = (
  parameters: AutoMovieArchetypeParameters,
  key: string,
): number => {
  const value = parameters[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};
