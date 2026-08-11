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
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `AutoMovieDesignLifecycleRole` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `AutoMovieDesignLifecycleRole` for the narrative intent reference lineage system contract.
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
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `AutoMovieDesignPresence` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `AutoMovieDesignPresence` for the narrative intent reference lineage system contract.
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
 *
 * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `IAutoMovieDesignSubject` as the portable data boundary for the provenance lineage gaps requirement.
 * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `IAutoMovieDesignSubject` for the evp lineage gap representation system contract.
 */
export interface IAutoMovieDesignSubject {
  /**
   * Stable id of one record in some other graph.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `id` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `id` for the evp lineage gap representation system contract.
   */
  id: string;
  /**
   * Open name of the graph the id belongs to, such as `element`, `space`,
   * `opening`, `material-layer`, `service-port`, `instance-slot`, or `asset`.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `graph` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `graph` for the evp lineage gap representation system contract.
   */
  graph: string;
  /**
   * SHA-256 of the bytes this identity stands for, or null when the identity is
   * authored source rather than bytes.
   *
   * An imported texture, mesh, or drawing is an input whose content can change
   * without one character of the design changing, so a derived artifact that
   * cites it has to cite its bytes too; that is what
   * {@link IAutoMovieDesignAssetCitation} is for. Authored subjects carry null
   * because their content is the revision's own digest, and repeating it here
   * would be a second copy free to disagree with the first.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `digest` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `digest` for the evp lineage gap representation system contract.
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
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignPhase` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignPhase` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignPhase {
  /**
   * Stable phase identity within the lineage.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `id` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `id` for the narrative intent reference lineage system contract.
   */
  id: string;
  /**
   * Human label such as `demolition`, `structure`, `services`, `finishes`.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `label` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `label` for the narrative intent reference lineage system contract.
   */
  label: string;
  /**
   * Phase ids that must complete before this one; empty for a first phase.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `requires` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `requires` for the narrative intent reference lineage system contract.
   */
  requires: string[];
}

/**
 * When one subject enters and leaves the work.
 *
 * Every declared subject carries exactly one of these. Totality is the point:
 * the alternative is a default, and any default here would be a claim nobody
 * made, either that an element predates the work or that it survives it.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignLifecycle` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignLifecycle` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignLifecycle {
  /**
   * Declared subject id this record is about.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `subject` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `subject` for the narrative intent reference lineage system contract.
   */
  subject: string;
  /**
   * Phase that installs it, or null when it predates the work.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `introducedIn` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `introducedIn` for the narrative intent reference lineage system contract.
   */
  introducedIn: string | null;
  /**
   * Phase that removes it, or null when it outlives the work.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `removedIn` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `removedIn` for the narrative intent reference lineage system contract.
   */
  removedIn: string | null;
}

/**
 * One immutable state of the authored design source.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignRevision` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignRevision` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignRevision {
  /**
   * Stable revision identity within the lineage.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `id` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `id` for the narrative intent reference lineage system contract.
   */
  id: string;
  /**
   * Revision this one supersedes, or null for the first.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `parent` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `parent` for the narrative intent reference lineage system contract.
   */
  parent: string | null;
  /**
   * SHA-256 over the authored source this revision names.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `digest` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `digest` for the narrative intent reference lineage system contract.
   */
  digest: AutoMovieContentDigest;
}

/**
 * One deterministic edit a variant applies to its base revision.
 *
 * The edit is recorded as an author-serialized value rather than a typed patch
 * because lineage does not know the shape of the graph it is editing. Two
 * alternatives are compared by comparing these strings verbatim, so the same
 * authored value always reads as the same decision.
 *
 * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `IAutoMovieDesignChange` as the portable data boundary for the provenance lineage gaps requirement.
 * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `IAutoMovieDesignChange` for the evp lineage gap representation system contract.
 */
export interface IAutoMovieDesignChange {
  /**
   * Stable change identity within the lineage.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `id` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `id` for the evp lineage gap representation system contract.
   */
  id: string;
  /**
   * Declared subject id this change edits.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `subject` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `subject` for the evp lineage gap representation system contract.
   */
  subject: string;
  /**
   * Open aspect label such as `material`, `layout`, `lighting`, `opening`.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `aspect` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `aspect` for the evp lineage gap representation system contract.
   */
  aspect: string;
  /**
   * Author-serialized replacement value, compared verbatim across variants.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `value` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `value` for the evp lineage gap representation system contract.
   */
  value: string;
  /**
   * Why this alternative makes the change.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `rationale` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `rationale` for the evp lineage gap representation system contract.
   */
  rationale: string;
}

/**
 * One design alternative: a change set over a common base revision.
 *
 * An alternative is never a copy of the building. Duplicating the design is
 * precisely what destroys the identity that makes two schemes comparable, so a
 * variant carries only what it changes and every subject it does not name keeps
 * the id, the geometry, and the citations the base revision gave it.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignVariant` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignVariant` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignVariant {
  /**
   * Stable variant identity within the lineage.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `id` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `id` for the narrative intent reference lineage system contract.
   */
  id: string;
  /**
   * Human label such as `warm-oak` or `open-plan`.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `label` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `label` for the narrative intent reference lineage system contract.
   */
  label: string;
  /**
   * Revision every change in this variant applies to.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `base` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `base` for the narrative intent reference lineage system contract.
   */
  base: string;
  /**
   * Edits this alternative makes; at most one per subject and aspect.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `changes` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `changes` for the narrative intent reference lineage system contract.
   */
  changes: IAutoMovieDesignChange[];
}

/**
 * One comparison between alternatives, and the choice if it has been made.
 *
 * Selecting an option does not delete the others. The rejected alternatives
 * stay in the record with their changes and their reasons intact, because the
 * question "why not the other one" outlives the decision.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignDecision` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignDecision` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignDecision {
  /**
   * Stable decision identity within the lineage.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `id` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `id` for the narrative intent reference lineage system contract.
   */
  id: string;
  /**
   * What is being decided.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `question` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `question` for the narrative intent reference lineage system contract.
   */
  question: string;
  /**
   * Variant ids compared; at least two, all sharing one base revision.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `options` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `options` for the narrative intent reference lineage system contract.
   */
  options: string[];
  /**
   * Chosen option id, or null while the decision is still open.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `selected` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `selected` for the narrative intent reference lineage system contract.
   */
  selected: string | null;
}

/**
 * The exact view one derived artifact was produced under.
 *
 * Every field is required because a missing one is the failure mode this record
 * exists to prevent: a quantity take-off that does not say which alternative it
 * counted, or a render that does not say which phase it depicts, is a number
 * and a picture that cannot be checked against anything.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-original-derived Exposes `IAutoMovieDesignStamp` as the portable data boundary for the production design reference original derived requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignStamp` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignStamp {
  /**
   * Revision the artifact was derived from.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-original-derived Exposes `revision` as the portable data boundary for the production design reference original derived requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `revision` for the narrative intent reference lineage system contract.
   */
  revision: string;
  /**
   * Variant applied, or null for the base design.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-original-derived Exposes `variant` as the portable data boundary for the production design reference original derived requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `variant` for the narrative intent reference lineage system contract.
   */
  variant: string | null;
  /**
   * Phase the artifact depicts, or null when it is phase-independent.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-original-derived Exposes `phase` as the portable data boundary for the production design reference original derived requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `phase` for the narrative intent reference lineage system contract.
   */
  phase: string | null;
  /**
   * SHA-256 over the lowering configuration that produced the artifact.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-original-derived Exposes `configuration` as the portable data boundary for the production design reference original derived requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `configuration` for the narrative intent reference lineage system contract.
   */
  configuration: AutoMovieContentDigest;
}

/**
 * The bytes of one imported input, as they stood when an artifact read them.
 *
 * A stamp says which design the artifact was produced from, and the revision
 * digest pins that design exactly. Imported bytes are the one input the
 * revision cannot pin: a texture, a mesh, or a scanned drawing can be replaced
 * without one character of the design moving, and an output baked from the old
 * bytes then goes on looking current. Recording the digest the artifact
 * actually read is what turns that into a disagreement somebody can detect.
 *
 * The record is deliberately a second copy of {@link IAutoMovieDesignSubject}'s
 * digest, for the same reason a stamp repeats the revision the work is on: the
 * two disagreeing is not the flaw, it is the signal.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignAssetCitation` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignAssetCitation` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignAssetCitation {
  /**
   * Declared subject id whose bytes were read.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `subject` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `subject` for the narrative intent reference lineage system contract.
   */
  subject: string;
  /**
   * SHA-256 that subject carried at the moment this artifact was produced.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `digest` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `digest` for the narrative intent reference lineage system contract.
   */
  digest: AutoMovieContentDigest;
}

/**
 * One output computed from stable identities under one lineage stamp.
 *
 * A mesh, a finish cut, a schedule line, an analysis result, and a render frame
 * are all the same kind of thing here: something that stops being true when one
 * of its inputs moves. Declaring the inputs is what lets a change name exactly
 * what it invalidated instead of everything.
 *
 * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `IAutoMovieDerivedArtifact` as the portable data boundary for the provenance lineage gaps requirement.
 * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `IAutoMovieDerivedArtifact` for the evp lineage gap representation system contract.
 */
export interface IAutoMovieDerivedArtifact {
  /**
   * Stable artifact identity, distinct from every declared subject id.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `id` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `id` for the evp lineage gap representation system contract.
   */
  id: string;
  /**
   * Open output family such as `mesh`, `cut`, `quantity`, or `render`.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `kind` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `kind` for the evp lineage gap representation system contract.
   */
  kind: string;
  /**
   * Subject or artifact ids this output was computed from; at least one.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `inputs` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `inputs` for the evp lineage gap representation system contract.
   */
  inputs: string[];
  /**
   * The imported bytes it read: exactly one citation per input carrying any.
   *
   * This sits beside the stamp rather than inside it because the two answer
   * different questions. A stamp is the view, and two alternatives being
   * compared share one; the bytes are this computation's own, and an output
   * derived only from authored identities cites none at all.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `assets` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `assets` for the evp lineage gap representation system contract.
   */
  assets: IAutoMovieDesignAssetCitation[];
  /**
   * The view it was computed under.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `stamp` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `stamp` for the evp lineage gap representation system contract.
   */
  stamp: IAutoMovieDesignStamp;
  /**
   * SHA-256 of the output's own bytes.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `digest` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `digest` for the evp lineage gap representation system contract.
   */
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
 *
 * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `IAutoMovieDesignLineage` as the portable data boundary for the provenance lineage gaps requirement.
 * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `IAutoMovieDesignLineage` for the evp lineage gap representation system contract.
 */
export interface IAutoMovieDesignLineage {
  /**
   * Schema version.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `version` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `version` for the evp lineage gap representation system contract.
   */
  version: 1;
  /**
   * Stable lineage identity within the production.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `id` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `id` for the evp lineage gap representation system contract.
   */
  id: string;
  /**
   * Revision the work is on now; every derived artifact must stamp it.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `head` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `head` for the evp lineage gap representation system contract.
   */
  head: string;
  /**
   * Every identity this lineage speaks about.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `subjects` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `subjects` for the evp lineage gap representation system contract.
   */
  subjects: IAutoMovieDesignSubject[];
  /**
   * Every recorded state of the authored source; at least one.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `revisions` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `revisions` for the evp lineage gap representation system contract.
   */
  revisions: IAutoMovieDesignRevision[];
  /**
   * The construction plan, as a graph of prerequisites.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `phases` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `phases` for the evp lineage gap representation system contract.
   */
  phases: IAutoMovieDesignPhase[];
  /**
   * Exactly one entry per declared subject.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `lifecycles` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `lifecycles` for the evp lineage gap representation system contract.
   */
  lifecycles: IAutoMovieDesignLifecycle[];
  /**
   * Alternatives preserved side by side over their base revisions.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `variants` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `variants` for the evp lineage gap representation system contract.
   */
  variants: IAutoMovieDesignVariant[];
  /**
   * Open and settled comparisons between those alternatives.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `decisions` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `decisions` for the evp lineage gap representation system contract.
   */
  decisions: IAutoMovieDesignDecision[];
  /**
   * Outputs computed from the identities above.
   *
   * @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps Exposes `derived` as the portable data boundary for the provenance lineage gaps requirement.
   * @evidence specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation Types `derived` for the evp lineage gap representation system contract.
   */
  derived: IAutoMovieDerivedArtifact[];
}

/**
 * One subject's classification and presence at one phase.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignPhaseState` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignPhaseState` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignPhaseState {
  /**
   * Declared subject id.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `subject` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `subject` for the narrative intent reference lineage system contract.
   */
  subject: string;
  /**
   * The graph that owns the id, carried through from its declaration.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `graph` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `graph` for the narrative intent reference lineage system contract.
   */
  graph: string;
  /**
   * How the subject relates to the work as a whole.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `role` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `role` for the narrative intent reference lineage system contract.
   */
  role: AutoMovieDesignLifecycleRole;
  /**
   * Whether it is in place once this phase completes.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `presence` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `presence` for the narrative intent reference lineage system contract.
   */
  presence: AutoMovieDesignPresence;
}

/**
 * The complete state of a work once one phase has completed.
 *
 * Every declared subject appears exactly once, in ascending id order, whether
 * it is present or not, so a scene, a drawing, a schedule, and a render can
 * read one answer about what is standing instead of computing four.
 *
 * None of the four reads it yet. `designLineagePhaseSnapshot` is called by the
 * engine's own phase filter and view digest, by the scaffold's renovation
 * example, and by the test suite, and no compiled artifact is derived from it.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-original-derived Exposes `IAutoMovieDesignPhaseSnapshot` as the portable data boundary for the production design reference original derived requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignPhaseSnapshot` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignPhaseSnapshot {
  /**
   * Phase this snapshot describes, or null for the completed work.
   *
   * The completed work is a real question and not a missing answer: a lineage
   * that records alternatives without recording a construction sequence still
   * has to say what stands at the end.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-original-derived Exposes `phase` as the portable data boundary for the production design reference original derived requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `phase` for the narrative intent reference lineage system contract.
   */
  phase: string | null;
  /**
   * Every declared subject, in ascending id order.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-original-derived Exposes `states` as the portable data boundary for the production design reference original derived requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `states` for the narrative intent reference lineage system contract.
   */
  states: IAutoMovieDesignPhaseState[];
}

/**
 * One aspect on which two alternatives differ.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignDifference` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignDifference` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignDifference {
  /**
   * The one subject id both alternatives are talking about.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `subject` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `subject` for the narrative intent reference lineage system contract.
   */
  subject: string;
  /**
   * Aspect the two alternatives disagree on.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `aspect` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `aspect` for the narrative intent reference lineage system contract.
   */
  aspect: string;
  /**
   * Left alternative's value, or null when it leaves the base untouched.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `left` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `left` for the narrative intent reference lineage system contract.
   */
  left: string | null;
  /**
   * Right alternative's value, or null when it leaves the base untouched.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `right` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `right` for the narrative intent reference lineage system contract.
   */
  right: string | null;
}

/**
 * The result of comparing two alternatives on their common basis.
 *
 * Both alternatives must apply to the same revision, so the comparison is
 * between two schemes and not between two buildings. Every difference names a
 * subject id both schemes share, which is the mechanical proof that identity
 * survived the alternative.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignComparison` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignComparison` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignComparison {
  /**
   * Base revision both alternatives apply to.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `revision` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `revision` for the narrative intent reference lineage system contract.
   */
  revision: string;
  /**
   * Left variant id.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `left` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `left` for the narrative intent reference lineage system contract.
   */
  left: string;
  /**
   * Right variant id.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `right` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `right` for the narrative intent reference lineage system contract.
   */
  right: string;
  /**
   * Subject ids neither alternative edits, in ascending order.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `common` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `common` for the narrative intent reference lineage system contract.
   */
  common: string[];
  /**
   * Every differing subject and aspect, in ascending order.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `differences` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `differences` for the narrative intent reference lineage system contract.
   */
  differences: IAutoMovieDesignDifference[];
}

/**
 * What one set of changed identities invalidates.
 *
 * The unaffected artifacts are reported beside the invalidated ones on purpose.
 * "Only these are stale" is a claim about the complement, and a report that
 * names one side alone cannot be checked.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignImpact` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignImpact` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignImpact {
  /**
   * Identities the question was asked about, in ascending order.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `changed` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `changed` for the narrative intent reference lineage system contract.
   */
  changed: string[];
  /**
   * Derived artifact ids that must be recomputed, in ascending order.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `invalidated` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `invalidated` for the narrative intent reference lineage system contract.
   */
  invalidated: string[];
  /**
   * Derived artifact ids provably unaffected, in ascending order.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `unaffected` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `unaffected` for the narrative intent reference lineage system contract.
   */
  unaffected: string[];
}
