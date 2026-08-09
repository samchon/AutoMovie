import { violation } from "./violation";
/**
 * Structural shape predicates over the artifacts the engine emits and consumes.
 *
 * These live in `engine` rather than beside the MCP validators because the
 * question they answer, "is this object internally well formed", belongs to the
 * artifact contract itself, not to any one consumer of it. The producer
 * (`performShot`) and the MCP commit gate must agree about that contract by
 * sharing this code, not by two hand-maintained copies that drift until an
 * artifact passes one and fails the other (#1320).
 *
 * @author Samchon
 */
/** A value as an array, or an empty one: shape errors are reported separately. */
export const asArray = (value) => Array.isArray(value) ? value : [];
export const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
export const validateObjectArtifact = (value, path, label, violations) => {
    if (isRecord(value))
        return true;
    pushViolation(violations, "type", path, `${label} must be a JSON object`, value);
    return false;
};
export const validateArrayArtifact = (value, path, label, violations) => {
    if (Array.isArray(value))
        return true;
    pushViolation(violations, "type", path, `${label} must be an array`, value);
    return false;
};
export const validateUniqueIds = (items, path, label, violations) => {
    if (!validateArrayArtifact(items, path, label, violations))
        return;
    validateUniqueBy(items.map((item, index) => ({
        id: isRecord(item) ? item.id : undefined,
        path: `${path}[${index}].id`,
    })), label, violations);
};
export const validateUniqueBy = (entries, label, violations) => {
    const seen = new Set();
    for (const entry of entries) {
        if (typeof entry.id !== "string")
            continue;
        if (seen.has(entry.id))
            pushViolation(violations, "type", entry.path, `${label} "${entry.id}" must be unique`, entry.id);
        seen.add(entry.id);
    }
};
export const validateNonEmptyId = (id, path, label, violations) => {
    if (typeof id !== "string") {
        pushViolation(violations, "type", path, `${label} must be a string`, id);
        return;
    }
    if (id.trim().length === 0)
        pushViolation(violations, "type", path, `${label} must be a non-empty id`, id);
};
export const validateVectorArtifact = (vector, path, label, violations) => {
    if (!validateObjectArtifact(vector, path, label, violations))
        return;
    for (const axis of ["x", "y", "z"])
        if (!Number.isFinite(vector[axis]))
            pushViolation(violations, "range", `${path}.${axis}`, `${label} component must be finite, but was ${vector[axis]}`, vector[axis]);
};
export const validateRange = (value, path, min, max, label, violations, inclusiveMin = true) => {
    const numeric = typeof value === "number" ? value : NaN;
    const aboveMin = inclusiveMin ? numeric >= min : numeric > min;
    const belowMax = max === Infinity ? true : numeric <= max;
    if (!Number.isFinite(numeric) || !aboveMin || !belowMax)
        pushViolation(violations, "range", path, max === Infinity
            ? `${label} must be finite and ${inclusiveMin ? ">=" : ">"} ${min}, but was ${value}`
            : `${label} must be finite and within ${inclusiveMin ? "[" : "("}${min}, ${max}], but was ${value}`, value);
};
/** Record one violation into a collector the caller owns. */
export const pushViolation = (violations, kind, path, expected, value) => {
    violations.push(violation(kind, path, expected, value));
};
//# sourceMappingURL=artifactShape.js.map