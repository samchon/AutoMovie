import { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { IAutoMovieCompiledShotSource } from "./IAutoMovieProductionCompiler";

/**
 * Kinds of stable subjects available from one compiled shot artifact.
 *
 * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Distinguishes the subject roles a reviewer may describe without merging prototype and placement.
 * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Types the role namespace carried by every compiled-subject description.
 */
export type AutoMovieSubjectKind =
  | "element"
  | "part"
  | "prototype"
  | "instance-set"
  | "instance"
  | "space";

/**
 * One compiled shot paired with the revision that makes its answers fresh.
 *
 * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Binds every subject answer to the compiled revision that supplied it.
 * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Supplies the artifact and revision inputs of deterministic subject inspection.
 */
export interface IAutoMovieSubjectArtifact {
  /**
   * Stable content or compile revision of {@link compiled}.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Makes the answer's source revision explicit to the reviewer.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Types the revision copied into every description record.
   */
  revision: string;
  /**
   * Fully compiled shot data inspected by the engine.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-compiled-truth Makes render-consumed compiled data the authority for subject answers.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-bounds Supplies the compiled geometry and placement facts measured by inspection.
   */
  compiled: IAutoMovieCompiledShotSource;
}

/**
 * Inclusive axis-aligned box in the description's stated coordinate space.
 *
 * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-compiled-truth Exposes measurable compiled subject extent without requiring a render.
 * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-bounds Types the measured minimum and maximum corners.
 */
export interface IAutoMovieSubjectBox {
  /**
   * Inclusive minimum corner in metres.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-compiled-truth Reports the lower coordinate limits of compiled subject content.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-bounds Types the box minimum produced by deterministic measurement.
   */
  min: IAutoMovieVector3;
  /**
   * Inclusive maximum corner in metres.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-compiled-truth Reports the upper coordinate limits of compiled subject content.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-bounds Types the box maximum produced by deterministic measurement.
   */
  max: IAutoMovieVector3;
}

/**
 * Declared and measured extents kept separate for honest inspection.
 *
 * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-compiled-truth Keeps a logical space's declared volume distinct from what its placed content actually fills.
 * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-bounds Types the separate declared and content measurements.
 */
export interface IAutoMovieSubjectBounds {
  /**
   * Authored or compiler-declared extent, or null when none exists.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-compiled-truth Preserves absence instead of fabricating a declared extent.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-bounds Carries the independently derived logical-space or compact-set declaration.
   */
  declared: IAutoMovieSubjectBox | null;
  /**
   * Extent measured from resident compiled content, or null when empty.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-compiled-truth Reports actual compiled geometry independently from declarations.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-bounds Carries the deterministic content measurement or explicit absence.
   */
  content: IAutoMovieSubjectBox | null;
  /**
   * Coordinate basis shared by both non-null boxes.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Makes spatial answers judgeable without an implicit coordinate frame.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-bounds Distinguishes model-local prototype boxes from world-space placement and space boxes.
   */
  coordinateSpace: "model" | "world";
}

/**
 * One material directly used by the described subject.
 *
 * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Makes subject material composition available to a reviewer.
 * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Types the compact material projection of the compiled model.
 */
export interface IAutoMovieSubjectMaterial {
  /**
   * Stable material id inside its model.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Identifies the material a subject uses.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Carries the compiled material identity.
   */
  id: string;
  /**
   * Human-readable compiled material name, or null when unnamed.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Gives material identity a reviewable label when one was authored.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Projects the compiled material label without inventing one.
   */
  name: string | null;
}

/**
 * Bounded inventory summary used for subject members and diff consequences.
 *
 * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-diff-tolerance-fanout Prevents review output from expanding with every repeated member.
 * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-diff-tolerance-fanout Types an exact total with a bounded deterministic id sample.
 */
export interface IAutoMovieSubjectMemberSummary {
  /**
   * Exact number of members represented by the summary.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Reports complete subject membership cardinality despite bounded output.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Types the exact membership total.
   */
  total: number;
  /**
   * Code-unit-sorted bounded sample of stable member ids.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-diff-tolerance-fanout Keeps repeated membership inspectable without unbounded expansion.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-diff-tolerance-fanout Carries the deterministic bounded sample.
   */
  items: string[];
  /**
   * Number of members not present in {@link items}.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-diff-tolerance-fanout Makes truncation explicit rather than silently incomplete.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-diff-tolerance-fanout Types the exact omitted-member count.
   */
  omitted: number;
}

/**
 * Renderer-independent answer to "what is this compiled subject?".
 *
 * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Exposes stable identity, composition, placement, materials, membership, and extent without rendering.
 * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Defines the portable compiled-subject description record.
 */
export interface IAutoMovieSubjectDescription {
  /**
   * Description schema version.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Makes the portable answer version explicit.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Types the first description schema.
   */
  version: 1;
  /**
   * Revision of the compiled artifact that supplied this answer.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Binds every answer to current compiled truth.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Carries the artifact revision correlation key.
   */
  revision: string;
  /**
   * Namespaced stable subject id.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Gives the reviewer a durable subject address.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Follows the role-specific subject id namespace.
   */
  id: string;
  /**
   * Structural role of this subject.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Distinguishes elements, parts, prototypes, instances, sets, and spaces.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Types the subject-role discriminator.
   */
  kind: AutoMovieSubjectKind;
  /**
   * Open compiled semantic label such as a building-element or space kind.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Reports what the compiled subject represents without a closed catalogue.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Carries the source-owned semantic kind.
   */
  semanticKind: string;
  /**
   * Human-readable compiled name, or null when unnamed.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Reports the subject's authored label without inventing one.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Carries the optional compiled display name.
   */
  name: string | null;
  /**
   * Reusable prototype subject used by this placement, or null.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Preserves prototype identity separately from placement identity.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Links a placement to its reusable model or part subject.
   */
  prototype: string | null;
  /**
   * Placement subject represented by this record, or null for reusable data.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Keeps placement identity explicit rather than collapsing it into a prototype.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Links placed subjects to their stable placement address.
   */
  placement: string | null;
  /**
   * Immediate owning subject, or null for a root subject.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Reports inspectable ownership and composition.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Carries the owner link of the subject hierarchy.
   */
  owner: string | null;
  /**
   * Compiled runtime model id supplying geometry, or null.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Identifies the compiled geometry source for prototype and placement subjects.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Carries the runtime model relation.
   */
  model: string | null;
  /**
   * Owning logical-space subject, or null.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Reports the spatial membership of compiled placements.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Carries the explicit logical-space relation.
   */
  space: string | null;
  /**
   * Model- or world-placement transform when the subject has one, otherwise null.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Reports the transform needed to judge subject placement.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Carries the compiled placement or part transform.
   */
  transform: IAutoMovieTransform | null;
  /**
   * Declared and measured spatial extent.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-compiled-truth Makes compiled subject geometry measurable without rendering.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-bounds Carries coordinate-explicit declared and content boxes.
   */
  bounds: IAutoMovieSubjectBounds;
  /**
   * Code-unit-sorted materials directly used by the subject.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Makes compiled material composition reviewable.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Projects material identity and name from compiled models.
   */
  materials: IAutoMovieSubjectMaterial[];
  /**
   * Exact member count and bounded stable-id sample.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Reports composition without expanding large populations.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Carries deterministic bounded membership.
   */
  members: IAutoMovieSubjectMemberSummary;
}
