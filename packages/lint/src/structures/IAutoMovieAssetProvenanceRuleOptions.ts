/** Project paths consumed by `automovie/asset-provenance`. */
export interface IAutoMovieAssetProvenanceRuleOptions {
  /** Canonical project-global provenance ledger. */
  manifests: string[];
  /** Distributable asset files that must be ledger-owned and byte-exact. */
  assets: string[];
}
