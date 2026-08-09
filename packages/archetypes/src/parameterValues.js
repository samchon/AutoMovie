/** Read one parameter as the number the design gate already accepted. */
export const numberParameter = (parameters, key) => parameters[key];
/** Read one parameter as the string the design gate already accepted. */
export const stringParameter = (parameters, key) => parameters[key];
/**
 * Read one parameter as a finite number, or zero when it is neither.
 *
 * Measurement runs before geometry and outside the design gate, so a recipe
 * that never passed it must still yield a number instead of poisoning a bound
 * with `NaN`.
 */
export const numberOf = (parameters, key) => {
    const value = parameters[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
};
//# sourceMappingURL=parameterValues.js.map