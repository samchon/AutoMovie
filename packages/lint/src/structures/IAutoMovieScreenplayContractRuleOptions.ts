/** Project paths consumed by `automovie/screenplay-contract`. */
export interface IAutoMovieScreenplayContractRuleOptions {
  /** Legacy and namespaced screenplay-index files. */
  indexes: string[];
  /** Markdown files that may be named by an index. */
  documents: string[];
  /** Legacy and namespaced shot-contract records. */
  shots: string[];
  /** Legacy and namespaced acceptance-scenario records. */
  acceptance: string[];
  /** Shared and legacy model-recipe records cited by character bindings. */
  models: string[];
  /** Shared and legacy formation records cited by faction bindings. */
  formations: string[];
  /** Shared and legacy world records cited by location bindings. */
  worlds: string[];
  /** Compiler-owned shot-realization records. */
  realizations: string[];
  /** Evidence-bound acceptance review records. */
  reviews: string[];
}
