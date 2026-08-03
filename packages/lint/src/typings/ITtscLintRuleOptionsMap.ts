import type { IAutoMovieAssetProvenanceRuleOptions } from "../structures/IAutoMovieAssetProvenanceRuleOptions";
import type { IAutoMovieScreenplayContractRuleOptions } from "../structures/IAutoMovieScreenplayContractRuleOptions";
import type { IAutoMovieStatePresenceRuleOptions } from "../structures/IAutoMovieStatePresenceRuleOptions";

declare module "@ttsc/lint" {
  interface ITtscLintRuleOptionsMap {
    /** Binds distributable asset bytes to source, license, processing and use. */
    "automovie/asset-provenance": IAutoMovieAssetProvenanceRuleOptions;
    /**
     * Checks treatment coverage, screenplay headings, scene lock ledgers,
     * downstream evidence, catalogs, continuity ownership and realization.
     */
    "automovie/screenplay-contract": IAutoMovieScreenplayContractRuleOptions;
    /**
     * Rejects a resident downstream record whose configured upstream slot is
     * absent, without inspecting record prose or collection length.
     */
    "automovie/state-presence": IAutoMovieStatePresenceRuleOptions;
  }
}
