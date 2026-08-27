import { HUMANOID_GAITS } from "@automovie/archetypes";
import {
  AutoMovieSubject,
  type IAutoMovieSubjectContribution,
} from "@automovie/engine";
import type {
  IAutoMovieModelRecipe,
  IAutoMovieProfile,
  IAutoMovieShotBuildContext,
} from "@automovie/interface";

import { soloist } from "./soloist";

/** One reviewed walk-only profile shared structurally by every chorus tier. */
const chorusProfile = (recipe: string): IAutoMovieProfile => ({
  id: `${recipe}-stride`,
  name: "stride",
  controls: [],
  drivers: [],
  limits: [],
  gaits: [HUMANOID_GAITS.walk],
});

/**
 * One member of the chorus, at hero detail, with its two coarser tiers.
 *
 * A member never appears alone: the film asks the audience to read the group,
 * not an individual inside it. So this subject renders nothing on its own and
 * the formation that holds it is what a shot stages. What it owns is the
 * member's measured facts and the LOD ladder those facts imply.
 *
 * @evidence models/020-chorus.md Owns the reviewed hero member recipe and its
 *   LOD selection without claiming formation layout or an independent subject.
 * @evidenceReview models/020-chorus.md #3e77761 Read models/020-chorus.md and ChorusMember in src/units/chorusHero.ts; confirmed that the class owns the reviewed hero member recipe and LOD selection without claiming formation layout or an independent subject, while its H2 citation delimits the member subset it realizes.
 * @evidence models/020-chorus.md#chorus-member-tier-representation Implements
 *   the hero recipe, scale check, material, walk profile, and LOD ladder.
 * @evidenceReview models/020-chorus.md#chorus-member-tier-representation #53a9c29 Read models/020-chorus.md#chorus-member-tier-representation and ChorusMember in src/units/chorusHero.ts; confirmed this citation after checking the claim that implements the hero recipe, scale check, material, walk profile, and LOD ladder.
 * @evidence obligations/model-sources.md#design-owned-construction Keeps height,
 *   radii, palette, and tier thresholds owned by the cited model design.
 * @evidenceReview obligations/model-sources.md#design-owned-construction #41ffc4f Read obligations/model-sources.md#design-owned-construction and ChorusMember in src/units/chorusHero.ts; confirmed this citation after checking the claim that keeps height, radii, palette, and tier thresholds owned by the cited model design.
 * @evidence obligations/model-sources.md#deterministic-build Builds the same
 *   recipe and validation result from the same reviewed fields.
 * @evidenceReview obligations/model-sources.md#deterministic-build #288cbb3 Read obligations/model-sources.md#deterministic-build and ChorusMember in src/units/chorusHero.ts; confirmed this citation after checking the claim that builds the same recipe and validation result from the same reviewed fields.
 * @evidence obligations/model-sources.md#unsupported-fidelity-is-explicit
 *   Refuses a member scale that contradicts the reviewed reference relation.
 * @evidenceReview obligations/model-sources.md#unsupported-fidelity-is-explicit #35050b3 Read obligations/model-sources.md#unsupported-fidelity-is-explicit and ChorusMember in src/units/chorusHero.ts; confirmed this citation after checking the claim that refuses a member scale that contradicts the reviewed reference relation.
 */
export class ChorusMember extends AutoMovieSubject<IAutoMovieModelRecipe> {
  public readonly id = "chorus-hero";

  /** Chosen height difference from the 1.8 m human reference, in metres. */
  public static readonly REFERENCE_HEIGHT_DELTA: number = 0.1;

  /**
   * The height the specification states, in metres.
   *
   * Kept beside the derivation so the two can be compared. The document says
   * both things at once, that a member is 1.7 m and that its scale is checked
   * against the 1.8 m soloist reference, and a subject that only derived would go on being
   * internally consistent while drifting away from the number the film was
   * written around.
   * @evidence models/020-chorus.md#chorus-member-tier-representation Holds the
   *   separately stated member height against its reviewed reference relation.
   * @evidenceReview models/020-chorus.md#chorus-member-tier-representation #53a9c29 Read models/020-chorus.md#chorus-member-tier-representation and SPECIFIED_HEIGHT in src/units/chorusHero.ts; confirmed this citation after checking the claim that holds the separately stated member height against its reviewed reference relation.
   */
  public static readonly SPECIFIED_HEIGHT: number = 1.7;

  /**
   * How far a derived scale may land from the stated one, in metres.
   *
   * A nanometre. Small enough that no scale a document could state slips
   * through, large enough that a subtraction of two authored metres is not
   * mistaken for one.
   * @evidence models/020-chorus.md#chorus-member-tier-representation States the
   *   numeric tolerance used to check the reviewed height derivation.
   * @evidenceReview models/020-chorus.md#chorus-member-tier-representation #53a9c29 Read models/020-chorus.md#chorus-member-tier-representation and SCALE_TOLERANCE in src/units/chorusHero.ts; confirmed this citation after checking the claim that states the numeric tolerance used to check the reviewed height derivation.
   */
  public static readonly SCALE_TOLERANCE: number = 1e-9;

  /**
   * Member height in metres, stated against the production's reference scale.
   *
   * The model design requires all represented subjects to derive from the
   * nominated human reference, so this is derived from the soloist rather than
   * restated as a disconnected second number. {@link design} checks that the
   * relation still lands on {@link SPECIFIED_HEIGHT}.
   */
  public readonly height = soloist.height - ChorusMember.REFERENCE_HEIGHT_DELTA;

  /**
   * Head radius in metres, at hero detail.
   *
   * A field rather than a literal inside the record, because the coarser tiers
   * state themselves against it: {@link ChorusTier} exists to keep this figure
   * readable further away, and a tier that could not see the number it is
   * coarsening would be a second opinion about the same head.
   */
  public readonly headRadius: number = 0.14;

  /** Limb radius in metres, at hero detail. */
  public readonly limbRadius: number = 0.05;

  /**
   * The one body colour, worn at every tier.
   *
   * Shared rather than authored per tier on purpose. A member changes tier as
   * the camera moves, and a tier that also changed colour would make the
   * boundary itself visible: the audience would read a costume change where the
   * renderer only swapped a mesh.
   */
  public readonly bodyColor: string = "#8f9d74";

  /**
   * The walk-only profile baked for hero-distance formation members.
   *
   * @evidence models/020-chorus.md#chorus-member-tier-representation Supplies
   *   the hero tier's reviewed profile id, name, and only gait.
   * @evidenceReview models/020-chorus.md#chorus-member-tier-representation #53a9c29 Read models/020-chorus.md#chorus-member-tier-representation and profile in src/units/chorusHero.ts; confirmed this citation after checking the claim that supplies the hero tier's reviewed profile id, name, and only gait.
   */
  public profile(): IAutoMovieProfile {
    return chorusProfile(this.id);
  }

  /**
   * The measured recipe, with the tier ladder the group is seen through.
   *
   * The ladder exists because the group is seen at every distance from a close
   * row to the far edge of the plaza; a single tier would either cost too much
   * at the back or lose the interval at the front.
   *
   * The scale is checked here rather than in a constructor. A subclass that
   * overrides a measurement sets its own fields after the base constructor has
   * already run, so a constructor would validate numbers the subject no longer
   * has. `design()` is where the record leaves the class, which makes it the
   * one place every construction has to pass through.
   *
   * @evidence models/020-chorus.md#chorus-member-tier-representation Emits the
   *   reviewed hero recipe and its distance-tier ladder.
   * @evidenceReview models/020-chorus.md#chorus-member-tier-representation #53a9c29 Read models/020-chorus.md#chorus-member-tier-representation and design in src/units/chorusHero.ts; confirmed this citation after checking the claim that emits the reviewed hero recipe, walk profile, and distance-tier ladder.
   */
  public design(): IAutoMovieModelRecipe {
    // Compared within a tolerance, not exactly. The height is a difference of
    // two authored metres, and a subtraction that lands a billionth away is the
    // float representation rather than a scale the document did not state.
    if (
      Math.abs(this.height - ChorusMember.SPECIFIED_HEIGHT) >
      ChorusMember.SCALE_TOLERANCE
    )
      throw new Error(
        `docs/models/020-chorus.md states a member is ${ChorusMember.SPECIFIED_HEIGHT} m against the ${soloist.height} m human reference, but the ${ChorusMember.REFERENCE_HEIGHT_DELTA} m reference delta derives ${this.height} m. Correct the reference scale or the delta, not this record.`,
      );
    return {
      id: this.id,
      role: "performer",
      archetype: "stickman",
      parameters: {
        height: this.height,
        headRadius: this.headRadius,
        limbRadius: this.limbRadius,
      },
      palette: { body: this.bodyColor },
      lod: [
        { tier: "hero", maxDistance: 5, recipe: "chorus-hero" },
        { tier: "near", maxDistance: 12, recipe: "chorus-near" },
        { tier: "far", maxDistance: null, recipe: "chorus-far" },
      ],
      capabilities: [],
      attachments: [],
      profiles: [this.profile()],
    };
  }

  /**
   * Nothing, because a member is never staged by itself.
   *
   * The formation materializes its members from count, layout, anchor, facing
   * and seed, so staging one here would put a second answer beside the
   * engine's. A member that did render individually would also be the first
   * step toward two thousand scene nodes.
   *
   * @evidence models/020-chorus.md#chorus-formation-representation Leaves
   *   staging to the reviewed instance formation rather than duplicating it.
   * @evidenceReview models/020-chorus.md#chorus-formation-representation #b75fb56 Read models/020-chorus.md#chorus-formation-representation and render in src/units/chorusHero.ts; confirmed this citation after checking the claim that leaves staging to the reviewed instance formation rather than duplicating it.
   */
  public render(
    _context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return {};
  }
}

/**
 * The production's one chorus-member recipe.
 *
 * The class owns the exact model file; this exported instance separately
 * answers for constructing the reviewed hero recipe once.
 *
 * @evidence models/020-chorus.md#chorus-member-tier-representation Instantiates
 *   the reviewed hero member recipe once.
 * @evidenceReview models/020-chorus.md#chorus-member-tier-representation #53a9c29 Read models/020-chorus.md#chorus-member-tier-representation and chorusHero in src/units/chorusHero.ts; confirmed this citation after checking the claim that instantiates the reviewed hero member recipe once.
 */
export const chorusHero = new ChorusMember();

/**
 * The same member, coarsened for one of the distances the group is seen from.
 *
 * A tier is not a second character. It is one figure further away, so the
 * measurement the specification fixes, the height, is taken from
 * {@link chorusHero} rather than restated, and only the coarseness a distance
 * asks for is authored here.
 *
 * It stays an articulated figure on purpose, which is the whole reason this
 * class exists rather than a cheaper box. An anonymous member is never posed:
 * it is an instance matrix and a phase, and what lets it walk anyway is a cycle
 * baked once per tier from the first gait of the first profile on that tier's
 * built model. A tier with no skeleton and no profile bakes nothing, so a box
 * tier is a row standing frozen behind rows that walk, which is the one thing
 * the group must never look like.
 *
 * @evidence models/020-chorus.md Owns one reviewed coarse distance tier that
 *   preserves CHORUS member height, articulation, palette, and gait identity.
 * @evidenceReview models/020-chorus.md #3e77761 Read models/020-chorus.md and ChorusTier in src/units/chorusHero.ts; confirmed that each instance owns one reviewed coarse distance tier preserving member height, articulation, palette, and gait identity, while its H2 citation delimits the distance-tier subset it realizes.
 * @evidence models/020-chorus.md#chorus-member-tier-representation Preserves
 *   member height, articulation, palette, and gait silhouette in coarse tiers.
 * @evidenceReview models/020-chorus.md#chorus-member-tier-representation #53a9c29 Read models/020-chorus.md#chorus-member-tier-representation and ChorusTier in src/units/chorusHero.ts; confirmed this citation after checking the claim that preserves member height, articulation, palette, and the exact walk-only profile in coarse tiers.
 * @evidence obligations/model-sources.md#design-owned-construction Uses only
 *   dimensions and tier identity owned by the cited model design.
 * @evidenceReview obligations/model-sources.md#design-owned-construction #41ffc4f Read obligations/model-sources.md#design-owned-construction and ChorusTier in src/units/chorusHero.ts; confirmed this citation after checking the claim that uses only dimensions and tier identity owned by the cited model design.
 * @evidence obligations/model-sources.md#deterministic-build Produces the same
 *   coarse recipe and gait profile from the same constructor fields.
 * @evidenceReview obligations/model-sources.md#deterministic-build #288cbb3 Read obligations/model-sources.md#deterministic-build and ChorusTier in src/units/chorusHero.ts; confirmed this citation after checking the claim that produces the same coarse recipe and gait profile from the same constructor fields.
 * @evidence obligations/model-sources.md#unsupported-fidelity-is-explicit
 *   Refuses a tier whose radii are finer than the hero it claims to coarsen.
 * @evidenceReview obligations/model-sources.md#unsupported-fidelity-is-explicit #35050b3 Read obligations/model-sources.md#unsupported-fidelity-is-explicit and ChorusTier in src/units/chorusHero.ts; confirmed this citation after checking the claim that refuses a tier whose radii are finer than the hero it claims to coarsen.
 */
export class ChorusTier extends AutoMovieSubject<IAutoMovieModelRecipe> {
  public constructor(
    /** Recipe id the ladder in {@link ChorusMember.design} names. */
    public readonly id: string,
    /** Which rung of that ladder this recipe answers for. */
    public readonly tier: "near" | "far",
    /**
     * Head radius in metres at this distance.
     *
     * Authored rather than derived, because it answers a question about pixels
     * rather than about the body: the head has to survive being small, and how
     * small it gets is what the tier is for. The height it sits on is the
     * member's, so no tier can quietly restate the scale.
     */
    public readonly headRadius: number,
    /**
     * Limb radius in metres at this distance.
     *
     * Thickening is the only cheapening this catalogue offers. Its one
     * articulated archetype builds a fixed set of parts from `height`, so a
     * coarser tier cannot have fewer of them; what it can do is stop a limb
     * from thinning below what a distant frame resolves, which is what keeps
     * the stride legible at the back of the group.
     */
    public readonly limbRadius: number,
  ) {
    super();
  }

  /**
   * The stride every member of this tier walks, each at its own point in it.
   *
   * One declared gait, not the catalogue's whole locomotion vocabulary. The
   * bake takes the first gait of the first profile and never asks for a second,
   * so shipping four more would be four tables of intent nothing reads.
   *
   * The gait is the catalogue's own walk rather than a table transcribed here.
   * Phase, duty and amplitude per limb are facts about a humanoid body, and a
   * production that retyped them would own a second humanoid that drifts from
   * the first.
   *
   * @evidence models/020-chorus.md#chorus-member-tier-representation Supplies
   *   the one reviewed articulated gait profile used by this tier.
   * @evidenceReview models/020-chorus.md#chorus-member-tier-representation #53a9c29 Read models/020-chorus.md#chorus-member-tier-representation and profile in src/units/chorusHero.ts; confirmed this citation after checking the claim that supplies the one reviewed walk-only articulated gait profile with the design-owned id and name.
   */
  public profile(): IAutoMovieProfile {
    return chorusProfile(this.id);
  }

  /**
   * The measured recipe for this rung of the ladder.
   *
   * No capability is claimed. A capability is a motion some source can author
   * for a named performer, and nothing can author one for a member that has no
   * node: this tier moves because its cycle is baked, not because a shot asked
   * it to.
   *
   * The refusal is checked here rather than in the constructor, for the reason
   * {@link ChorusMember.design} gives: a subclass sets its own fields after the
   * base constructor has run, and `design()` is the one gate every construction
   * passes through.
   *
   * @evidence models/020-chorus.md#chorus-member-tier-representation Preserves
   *   the reviewed articulated proxy instead of degrading to a rigid box.
   * @evidenceReview models/020-chorus.md#chorus-member-tier-representation #53a9c29 Read models/020-chorus.md#chorus-member-tier-representation and design in src/units/chorusHero.ts; confirmed this citation after checking the claim that preserves the reviewed walk-profiled articulated proxy instead of degrading to a rigid box.
   */
  public design(): IAutoMovieModelRecipe {
    if (
      this.headRadius < chorusHero.headRadius ||
      this.limbRadius < chorusHero.limbRadius
    )
      throw new Error(
        `docs/models/020-chorus.md requires the walk to read at every distance, so the "${this.id}" tier cannot be finer than the hero tier it stands behind: ${this.headRadius} m head and ${this.limbRadius} m limbs against ${chorusHero.headRadius} m and ${chorusHero.limbRadius} m. Coarsen this tier or refine the hero.`,
      );
    return {
      id: this.id,
      role: "performer",
      archetype: "stickman",
      parameters: {
        height: chorusHero.height,
        headRadius: this.headRadius,
        limbRadius: this.limbRadius,
      },
      palette: { body: chorusHero.bodyColor },
      lod: [{ tier: this.tier, maxDistance: null, recipe: this.id }],
      capabilities: [],
      attachments: [],
      profiles: [this.profile()],
    };
  }

  /**
   * Nothing, for the same reason {@link ChorusMember.render} stages nothing.
   *
   * A tier is even further from being staged than a member is: it is the body
   * the formation instances at a distance, and it has no individual existence
   * for a shot to place.
   *
   * @evidence models/020-chorus.md#chorus-formation-representation Leaves
   *   staging to the reviewed complete formation.
   * @evidenceReview models/020-chorus.md#chorus-formation-representation #b75fb56 Read models/020-chorus.md#chorus-formation-representation and render in src/units/chorusHero.ts; confirmed this citation after checking the claim that leaves staging to the reviewed complete formation.
   */
  public render(
    _context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return {};
  }
}

/**
 * The tier the middle of the group is seen at.
 *
 * The class owns the exact model file; this exported instance separately
 * answers for constructing the reviewed near tier once.
 *
 * @evidence models/020-chorus.md#chorus-member-tier-representation Instantiates
 *   the reviewed near-distance member tier.
 * @evidenceReview models/020-chorus.md#chorus-member-tier-representation #53a9c29 Read models/020-chorus.md#chorus-member-tier-representation and chorusNear in src/units/chorusHero.ts; confirmed this citation after checking the claim that instantiates the reviewed near-distance member tier.
 */
export const chorusNear = new ChorusTier("chorus-near", "near", 0.15, 0.065);

/**
 * The tier the back of the group is seen at.
 *
 * The class owns the exact model file; this exported instance separately
 * answers for constructing the reviewed far tier once.
 *
 * @evidence models/020-chorus.md#chorus-member-tier-representation Instantiates
 *   the reviewed far-distance member tier.
 * @evidenceReview models/020-chorus.md#chorus-member-tier-representation #53a9c29 Read models/020-chorus.md#chorus-member-tier-representation and chorusFar in src/units/chorusHero.ts; confirmed this citation after checking the claim that instantiates the reviewed far-distance member tier.
 */
export const chorusFar = new ChorusTier("chorus-far", "far", 0.17, 0.085);
