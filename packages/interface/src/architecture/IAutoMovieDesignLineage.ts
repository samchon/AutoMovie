import { AutoMovieContentDigest } from "../production/IAutoMovieProductionDesign";

/**
 * How one subject relates to the work as a whole.
 *
 * This is a classification of the whole construction plan, not of one moment in
 * it: a wall that is taken down in the demolition phase is `demolished` for the
 * entire work, including the phases before the demolition where it is still
 * standing. Ask {@link AutoMovieDesignPresence} for the moment.
 *
 * The four families are exactly the ones a renovation has to keep apart. What
 * predates the work is `retained` when it survives and `demolished` when it
 * does not; what the work installs is `new` when it survives and `temporary`
 * when it is taken out again, which is how shoring, a hoarding, or a protection
 * deck stays distinguishable from the building it protects.
 */
export type AutoMovieDesignLifecycleRole =
  | "retained"
  | "demolished"
  | "temporary"
  | "new";

/**
 * Whether one subject is in place once a phase has completed.
 *
 * A phase plan is a graph, not a line, so `pending` also covers a subject
 * installed on a branch that neither precedes nor follows this phase. Saying
 * "not yet here" about work that is merely incomparable is the honest answer;
 * inventing an order between independent branches is not.
 */
export type AutoMovieDesignPresence = "pending" | "present" | "removed";

/**
 * One stable identity this lineage is allowed to speak about.
 *
 * Lineage deliberately imports none of the graphs it annotates. It attaches to
 * a bare id and the open name of the graph that id came from, so an element, a
 * logical space, an opening, a material layer, a service port, an instance
 * slot, or a fold that does not exist yet can all be phased, varied, and
 * impact-traced without this record gaining a field. Registering an identity
 * here is the whole act of opting a graph into lineage.
 */
export interface IAutoMovieDesignSubject {
  /** Stable id of one record in some other graph. */
  id: string;
  /**
   * Open name of the graph the id belongs to, such as `element`, `space`,
   * `opening`, `material-layer`, `service-port`, `instance-slot`, or `asset`.
   */
  graph: string;
  /**
   * SHA-256 of the bytes this identity stands for, or null when the identity is
   * authored source rather than bytes.
   *
   * An imported texture, mesh, or drawing is an input whose content can change
   * without one character of the design changing, so a derived artifact that
   * cites it has to cite its bytes too. Authored subjects carry null because
   * their content is the revision's own digest, and repeating it here would be
   * a second copy free to disagree with the first.
   */
  digest: AutoMovieContentDigest | null;
}

/**
 * One step of the construction plan.
 *
 * Prerequisites make this a directed acyclic graph rather than a numbered list:
 * two wings can be stripped independently and still both precede a shared
 * structural phase. A cycle is refused rather than broken at an arbitrary edge,
 * because there is no correct place to break one.
 */
export interface IAutoMovieDesignPhase {
  /** Stable phase identity within the lineage. */
  id: string;
  /** Human label such as `demolition`, `structure`, `services`, `finishes`. */
  label: string;
  /** Phase ids that must complete before this one; empty for a first phase. */
  requires: string[];
}

/**
 * When one subject enters and leaves the work.
 *
 * Every declared subject carries exactly one of these. Totality is the point:
 * the alternative is a default, and any default here would be a claim nobody
 * made, either that an element predates the work or that it survives it.
 */
export interface IAutoMovieDesignLifecycle {
  /** Declared subject id this record is about. */
  subject: string;
  /** Phase that installs it, or null when it predates the work. */
  introducedIn: string | null;
  /** Phase that removes it, or null when it outlives the work. */
  removedIn: string | null;
}

/** One immutable state of the authored design source. */
export interface IAutoMovieDesignRevision {
  /** Stable revision identity within the lineage. */
  id: string;
  /** Revision this one supersedes, or null for the first. */
  parent: string | null;
  /** SHA-256 over the authored source this revision names. */
  digest: AutoMovieContentDigest;
}

/**
 * One deterministic edit a variant applies to its base revision.
 *
 * The edit is recorded as an author-serialized value rather than a typed patch
 * because lineage does not know the shape of the graph it is editing. Two
 * alternatives are compared by comparing these strings verbatim, so the same
 * authored value always reads as the same decision.
 */
export interface IAutoMovieDesignChange {
  /** Stable change identity within the lineage. */
  id: string;
  /** Declared subject id this change edits. */
  subject: string;
  /** Open aspect label such as `material`, `layout`, `lighting`, `opening`. */
  aspect: string;
  /** Author-serialized replacement value, compared verbatim across variants. */
  value: string;
  /** Why this alternative makes the change. */
  rationale: string;
}

/**
 * One design alternative: a change set over a common base revision.
 *
 * An alternative is never a copy of the building. Duplicating the design is
 * precisely what destroys the identity that makes two schemes comparable, so a
 * variant carries only what it changes and every subject it does not name keeps
 * the id, the geometry, and the citations the base revision gave it.
 */
export interface IAutoMovieDesignVariant {
  /** Stable variant identity within the lineage. */
  id: string;
  /** Human label such as `warm-oak` or `open-plan`. */
  label: string;
  /** Revision every change in this variant applies to. */
  base: string;
  /** Edits this alternative makes; at most one per subject and aspect. */
  changes: IAutoMovieDesignChange[];
}

/**
 * One comparison between alternatives, and the choice if it has been made.
 *
 * Selecting an option does not delete the others. The rejected alternatives
 * stay in the record with their changes and their reasons intact, because the
 * question "why not the other one" outlives the decision.
 */
export interface IAutoMovieDesignDecision {
  /** Stable decision identity within the lineage. */
  id: string;
  /** What is being decided. */
  question: string;
  /** Variant ids compared; at least two, all sharing one base revision. */
  options: string[];
  /** Chosen option id, or null while the decision is still open. */
  selected: string | null;
}

/**
 * The exact view one derived artifact was produced under.
 *
 * Every field is required because a missing one is the failure mode this record
 * exists to prevent: a quantity take-off that does not say which alternative it
 * counted, or a render that does not say which phase it depicts, is a number
 * and a picture that cannot be checked against anything.
 */
export interface IAutoMovieDesignStamp {
  /** Revision the artifact was derived from. */
  revision: string;
  /** Variant applied, or null for the base design. */
  variant: string | null;
  /** Phase the artifact depicts, or null when it is phase-independent. */
  phase: string | null;
  /** SHA-256 over the lowering configuration that produced the artifact. */
  configuration: AutoMovieContentDigest;
}

/**
 * One output computed from stable identities under one lineage stamp.
 *
 * A mesh, a finish cut, a schedule line, an analysis result, and a render frame
 * are all the same kind of thing here: something that stops being true when one
 * of its inputs moves. Declaring the inputs is what lets a change name exactly
 * what it invalidated instead of everything.
 */
export interface IAutoMovieDerivedArtifact {
  /** Stable artifact identity, distinct from every declared subject id. */
  id: string;
  /** Open output family such as `mesh`, `cut`, `quantity`, or `render`. */
  kind: string;
  /** Subject or artifact ids this output was computed from; at least one. */
  inputs: string[];
  /** The view it was computed under. */
  stamp: IAutoMovieDesignStamp;
  /** SHA-256 of the output's own bytes. */
  digest: AutoMovieContentDigest;
}

/**
 * Phases, alternatives, and derivation for one work, over identities other
 * graphs own.
 *
 * Nothing here is a building. The record annotates ids that already exist
 * elsewhere, which is what keeps a renovation from being modelled as a second
 * building and an alternative from being modelled as a third. A production that
 * declares no lineage at all is unaffected: this fold is additive, and its
 * absence means only that no phase or alternative claim is being made.
 */
export interface IAutoMovieDesignLineage {
  /** Schema version. */
  version: 1;
  /** Stable lineage identity within the production. */
  id: string;
  /** Revision the work is on now; every derived artifact must stamp it. */
  head: string;
  /** Every identity this lineage speaks about. */
  subjects: IAutoMovieDesignSubject[];
  /** Every recorded state of the authored source; at least one. */
  revisions: IAutoMovieDesignRevision[];
  /** The construction plan, as a graph of prerequisites. */
  phases: IAutoMovieDesignPhase[];
  /** Exactly one entry per declared subject. */
  lifecycles: IAutoMovieDesignLifecycle[];
  /** Alternatives preserved side by side over their base revisions. */
  variants: IAutoMovieDesignVariant[];
  /** Open and settled comparisons between those alternatives. */
  decisions: IAutoMovieDesignDecision[];
  /** Outputs computed from the identities above. */
  derived: IAutoMovieDerivedArtifact[];
}

/** One subject's classification and presence at one phase. */
export interface IAutoMovieDesignPhaseState {
  /** Declared subject id. */
  subject: string;
  /** The graph that owns the id, carried through from its declaration. */
  graph: string;
  /** How the subject relates to the work as a whole. */
  role: AutoMovieDesignLifecycleRole;
  /** Whether it is in place once this phase completes. */
  presence: AutoMovieDesignPresence;
}

/**
 * The complete state of a work once one phase has completed.
 *
 * Every declared subject appears exactly once, in ascending id order, whether
 * it is present or not. A scene, a drawing, a schedule, and a render all read
 * this one answer, so the four cannot disagree about what is standing.
 */
export interface IAutoMovieDesignPhaseSnapshot {
  /**
   * Phase this snapshot describes, or null for the completed work.
   *
   * The completed work is a real question and not a missing answer: a lineage
   * that records alternatives without recording a construction sequence still
   * has to say what stands at the end.
   */
  phase: string | null;
  /** Every declared subject, in ascending id order. */
  states: IAutoMovieDesignPhaseState[];
}

/** One aspect on which two alternatives differ. */
export interface IAutoMovieDesignDifference {
  /** The one subject id both alternatives are talking about. */
  subject: string;
  /** Aspect the two alternatives disagree on. */
  aspect: string;
  /** Left alternative's value, or null when it leaves the base untouched. */
  left: string | null;
  /** Right alternative's value, or null when it leaves the base untouched. */
  right: string | null;
}

/**
 * The result of comparing two alternatives on their common basis.
 *
 * Both alternatives must apply to the same revision, so the comparison is
 * between two schemes and not between two buildings. Every difference names a
 * subject id both schemes share, which is the mechanical proof that identity
 * survived the alternative.
 */
export interface IAutoMovieDesignComparison {
  /** Base revision both alternatives apply to. */
  revision: string;
  /** Left variant id. */
  left: string;
  /** Right variant id. */
  right: string;
  /** Subject ids neither alternative edits, in ascending order. */
  common: string[];
  /** Every differing subject and aspect, in ascending order. */
  differences: IAutoMovieDesignDifference[];
}

/**
 * What one set of changed identities invalidates.
 *
 * The unaffected artifacts are reported beside the invalidated ones on purpose.
 * "Only these are stale" is a claim about the complement, and a report that
 * names one side alone cannot be checked.
 */
export interface IAutoMovieDesignImpact {
  /** Identities the question was asked about, in ascending order. */
  changed: string[];
  /** Derived artifact ids that must be recomputed, in ascending order. */
  invalidated: string[];
  /** Derived artifact ids provably unaffected, in ascending order. */
  unaffected: string[];
}
