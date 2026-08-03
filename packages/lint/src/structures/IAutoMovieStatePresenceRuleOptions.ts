/**
 * One addressable record slot in the project state dependency graph.
 *
 * Presence means that at least one configured path exists. File contents and
 * array lengths are deliberately outside this rule: a valid empty record is
 * resident, while schema and semantic validity belong to their owning rules.
 */
export interface IAutoMovieStatePresenceSlot {
  /** Stable diagnostic name of the slot. */
  name: string;

  /**
   * Project-relative files or globs that make the slot resident.
   *
   * `*`, `?`, and path-segment `**` are supported. Paths may not escape the
   * TypeScript project root.
   */
  files: string[];

  /** Slot names that must be resident before this slot may be resident. */
  requires: string[];
}

/** Options accepted by `automovie/state-presence`. */
export interface IAutoMovieStatePresenceRuleOptions {
  /** Complete dependency graph, in stable diagnostic order. */
  slots: IAutoMovieStatePresenceSlot[];
}
