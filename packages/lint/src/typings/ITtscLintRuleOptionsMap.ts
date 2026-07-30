import type { IAutoMovieStatePresenceRuleOptions } from "../structures/IAutoMovieStatePresenceRuleOptions";

declare module "@ttsc/lint" {
  interface ITtscLintRuleOptionsMap {
    /**
     * Rejects a resident downstream record whose configured upstream slot is
     * absent, without inspecting record prose or collection length.
     */
    "automovie/state-presence": IAutoMovieStatePresenceRuleOptions;
  }
}
