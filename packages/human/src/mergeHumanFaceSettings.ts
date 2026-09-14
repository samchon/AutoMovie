import type { AutoMovieHumanFaceOverride } from "./IAutoMovieHumanFaceDocument";

/**
 * Merge typed face settings without retaining caller-owned objects. An omitted
 * value retains its basis, object fields recurse, and arrays replace in full.
 * This is composition, not raw-document validation; part admission still checks
 * the resolved dimensions and relationships before geometry can be published.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Implements omission, nested overrides and whole-array replacement without input mutation.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Gives detail and side overrides one history-independent composition rule.
 */
export function mergeHumanFaceSettings<T>(
  basis: T,
  override?: NoInfer<AutoMovieHumanFaceOverride<T>>,
): T {
  const merge = (base: unknown, patch: unknown): unknown => {
    if (patch === undefined) return structuredClone(base);
    if (patch === null || typeof patch !== "object" || Array.isArray(patch))
      return structuredClone(patch);
    if (
      base !== undefined &&
      (base === null || typeof base !== "object" || Array.isArray(base))
    )
      throw new Error(
        "An object override cannot replace a scalar or array face setting.",
      );
    const result: Record<string, unknown> = structuredClone(
      base ?? {},
    ) as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) {
      if (key === "__proto__" || key === "prototype" || key === "constructor")
        throw new Error("Face settings cannot contain prototype keys.");
      result[key] = merge(result[key], value);
    }
    return result;
  };
  return merge(basis, override) as T;
}
