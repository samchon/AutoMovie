/** Build one {@link IAutoMovieConstraintViolation}. Defaults to `"error"`. */
export const violation = (kind, path, expected, value, overshoot, severity = "error") => overshoot === undefined
    ? { kind, path, expected, value, severity }
    : { kind, path, expected, value, overshoot, severity };
/**
 * Wrap a violation list into an {@link IAutoMovieValidation}. Any
 * `"error"`-severity violation fails the run (and the whole list, warnings
 * included, rides along for the correction round); a list of only `"warning"`s
 * still succeeds but surfaces them; an empty list is a clean success.
 */
export const toValidation = (violations) => {
    if (violations.some((v) => v.severity === "error"))
        return { success: false, violations };
    if (violations.length > 0)
        return { success: true, warnings: violations };
    return { success: true };
};
/**
 * A small append-only sink for violations, so each validator can push with a
 * stable path prefix without threading arrays through every call.
 */
export class ViolationCollector {
    items = [];
    push(kind, path, expected, value, overshoot, severity = "error") {
        this.items.push(violation(kind, path, expected, value, overshoot, severity));
    }
    /**
     * Push a `"warning"`-severity violation, physical-plausibility advice that
     * does not fail validation (see
     * {@link IAutoMovieConstraintViolation.severity}).
     */
    warn(kind, path, expected, value, overshoot) {
        this.push(kind, path, expected, value, overshoot, "warning");
    }
    /** Finite range check `[min, max]`; pushes a `range` violation if outside. */
    range(path, value, min, max, label = "value") {
        if (!Number.isFinite(value) || value < min || value > max)
            this.push("range", path, `${label} must be a finite number within [${min}, ${max}], but was ${value}`, value);
    }
    toValidation() {
        return toValidation(this.items);
    }
}
//# sourceMappingURL=violation.js.map