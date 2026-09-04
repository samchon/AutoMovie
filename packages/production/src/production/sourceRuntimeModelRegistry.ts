import type { IAutoMovieModel } from "@automovie/interface";

/**
 * Build the exact own-key registry used while deterministic source adds models.
 *
 * The portable build context remains a record, but membership never consults
 * `Object.prototype`: compiler keys and accepted source ids are defined as own
 * enumerable data properties, and every lookup, key, and value projection reads
 * only that population. A compiler key may differ from the contained model id,
 * so `resolve` preserves both identities without admitting inherited names.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-evidence Preserves every accepted current source model under the exact id its reviewed result declared.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-freshness Projects current source models into runtime lookup and enumeration without prototype-derived or unavailable entries.
 * @author Samchon
 */
export const createAutoMovieSourceRuntimeModelRegistry = (
  initial: Readonly<Record<string, IAutoMovieModel>>,
) => {
  const records = Object.create(null) as Record<string, IAutoMovieModel>;
  const define = (key: string, model: IAutoMovieModel): void => {
    Object.defineProperty(records, key, {
      configurable: true,
      enumerable: true,
      value: model,
      writable: true,
    });
  };
  for (const [key, model] of Object.entries(initial)) define(key, model);
  const values = (): IAutoMovieModel[] => Object.values(records);
  return Object.freeze({
    /** Portable record handed to the existing shot build context. */
    record: records as Readonly<Record<string, IAutoMovieModel>>,
    /** Register one accepted source model under its exact authored id. */
    define,
    /** Test exact registered-key membership without prototype inheritance. */
    has: (key: string): boolean => Object.hasOwn(records, key),
    /** Read one exact registered key, or undefined when it is absent. */
    get: (key: string): IAutoMovieModel | undefined =>
      Object.hasOwn(records, key) ? records[key] : undefined,
    /** Preserve deterministic own-key insertion order. */
    keys: (): string[] => Object.keys(records),
    /** Preserve deterministic own-value insertion order. */
    values,
    /** Resolve either a compiler registry key or the model's own public id. */
    resolve: (identity: string): IAutoMovieModel | undefined =>
      Object.hasOwn(records, identity)
        ? records[identity]
        : values().find((model) => model.id === identity),
  });
};
