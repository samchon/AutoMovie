import { IAutoMovieEnvironmentContext } from "../analysis/IAutoMovieEnvironmentContext";
import { AutoMovieGuidePass, IAutoMovieDeliveryCrop } from "../cinematics";
import { IAutoMovieProfile } from "../core";
import {
  IAutoMovieHeightRule,
  IAutoMovieQuaternion,
  IAutoMovieVector3,
} from "../geometry";
import { IAutoMovieRenderBudget } from "../render/IAutoMovieRenderBudget";
import { IAutoMovieProductionLighting } from "../scene/IAutoMovieProductionLighting";
import { AutoMovieHumanoidBone } from "../skeleton";
import type { IAutoMovieExternalMotionAdoption } from "./IAutoMovieAssetManifest";
import type {
  IAutoMovieAcousticResponseProfile,
  IAutoMovieProductionTtsReceipt,
  IAutoMovieSoundPropagationProfile,
} from "./IAutoMovieProductionSound";
import { IAutoMovieSceneEvidence } from "./IAutoMovieScreenplayIndex";
import type {
  IAutoMovieRepaintExecutionPolicy,
  IAutoMovieRepaintGeneratorAdoption,
  IAutoMovieRepaintParameters,
  IAutoMovieRepaintReferenceInput,
  IAutoMovieRepaintRequestEvidence,
} from "./capture/IAutoMovieRepaintShot";

/**
 * A SHA-256 value computed by AutoMovie from authoritative project bytes.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `AutoMovieContentDigest` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `AutoMovieContentDigest` for the narrative intent story design ownership system contract.
 */
export type AutoMovieContentDigest = `sha256:${string}`;

/**
 * One deliverable the production must eventually materialize.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieProductionDeliverable` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieProductionDeliverable` for the narrative intent story design ownership system contract.
 */
export interface IAutoMovieProductionDeliverable {
  /**
   * Non-blank id, unique within this production.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `id` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `id` for the narrative intent story design ownership system contract.
   */
  id: string;
  /**
   * Output class.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `kind` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `kind` for the narrative intent story design ownership system contract.
   */
  kind: "preview" | "feature" | "guide-pass" | "captions" | "audio-mix";
  /**
   * Structural render pass owned by a guide-pass deliverable.
   *
   * Omitted only for legacy production records, which retain the pose default.
   * New production contracts declare one pass per guide deliverable so depth,
   * normal, mask, outline, and pose outputs have distinct typed ownership.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `pass` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `pass` for the narrative intent story design ownership system contract.
   */
  pass?: Exclude<AutoMovieGuidePass, "beauty">;
  /**
   * Whether final compilation requires the deliverable.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `required` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `required` for the narrative intent story design ownership system contract.
   */
  required: boolean;
}

/**
 * The timeline a production asserts its events happened on.
 *
 * The edit is presentation, not chronology: a cut list can only place shots one
 * after another, so two groups acting at the same moment are merely adjacent in
 * it and nothing can check the claim. The story clock is the second timeline,
 * independent of the cut, on which each pinned shot occupies a real interval.
 * Two shots may overlap on it, and a shot may carry an earlier story time than
 * the one it is cut after.
 *
 * Declaring the clock is what makes shot pins and cross-shot criteria legal. A
 * production that asserts nothing about story time omits it and is unaffected.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieStoryClock` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieStoryClock` for the narrative intent story design ownership system contract.
 */
export interface IAutoMovieStoryClock {
  /**
   * Story-clock unit.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `units` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `units` for the narrative intent story design ownership system contract.
   */
  units: "second";
  /**
   * Non-blank statement of what story time zero denotes.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `epoch` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `epoch` for the narrative intent story design ownership system contract.
   */
  epoch: string;
}

/**
 * Where one shot sits on the production story clock.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieShotStoryTime` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieShotStoryTime` for the narrative intent story design ownership system contract.
 */
export interface IAutoMovieShotStoryTime {
  /**
   * Finite story-clock time in seconds at shot-local time zero.
   *
   * Two shots sharing an origin open on the same story moment however far apart
   * the cut places them, and a shot cut later may carry the smaller origin.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `originSeconds` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `originSeconds` for the narrative intent story design ownership system contract.
   */
  originSeconds: number;
  /**
   * Story seconds elapsed per shot-local second; finite and strictly above
   * zero. Omitted means one, so shot time and story time run together.
   *
   * A shot that stretches or compresses time still maps onto the clock: the
   * story time of shot-local `t` is `originSeconds + t * rate`.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `rate` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `rate` for the narrative intent story design ownership system contract.
   */
  rate?: number;
}

/**
 * Production-owned caption readability thresholds for one language.
 *
 * AutoMovie ships no threshold preset. The user or authoring agent chooses the
 * language, segmentation revision, and every boundary; omission means metrics
 * may be reported but no readability verdict may be inferred.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Makes readability thresholds a production-owned, opt-in decision.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Carries the versioned segmentation and numeric boundaries used by validation.
 * @author Samchon
 */
export interface IAutoMovieCaptionReadabilityProfile {
  /**
   * Stable profile identity within the production.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Makes the selected threshold set addressable.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Joins each verdict to the exact production profile.
   */
  id: string;
  /**
   * Production-controlled schema revision.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Versions the declared threshold semantics.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Prevents results from silently crossing profile revisions.
   */
  version: number;
  /**
   * RFC 5646 well-formed language tag whose cues this profile evaluates.
   *
   * Authored spelling is retained while identity comparison is ASCII
   * case-insensitive. Registry membership and Preferred-Value replacement are
   * outside this field's validation contract.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Keeps thresholds language-specific and production-owned.
   * @evidence requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-language-selection Preserves authored display spelling while language lookup uses one case-insensitive identity.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Selects which cue population the profile evaluates.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-localization Applies the shared RFC 5646 syntax and comparison boundary.
   */
  language: string;
  /**
   * Production-selected versioned grapheme segmentation rule.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Requires segmentation identity alongside numeric thresholds.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Makes grapheme measurement reproducible without hardcoding one Unicode family.
   */
  segmentation: IAutoMovieCaptionGraphemeSegmentationIdentity;
  /**
   * Maximum displayed graphemes per second and its boundary semantics.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Declares rate and equality behavior together.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Supplies the explicit rate comparison boundary.
   */
  maxGraphemesPerSecond: IAutoMovieCaptionReadabilityBoundary;
  /**
   * Maximum authored lines in one cue and its boundary semantics.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Declares line-count and equality behavior together.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Supplies the explicit line-count comparison boundary.
   */
  maxLinesPerCue: IAutoMovieCaptionReadabilityBoundary;
  /**
   * Maximum displayed graphemes in one line and its boundary semantics.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Declares line-length and equality behavior together.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Supplies the explicit line-length comparison boundary.
   */
  maxGraphemesPerLine: IAutoMovieCaptionReadabilityBoundary;
  /**
   * Minimum cue duration in frames and its boundary semantics.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Declares duration and equality behavior together.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Supplies the explicit duration comparison boundary.
   */
  minDurationFrames: IAutoMovieCaptionReadabilityBoundary;
  /**
   * Minimum inter-cue gap in frames and its boundary semantics.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Declares gap and equality behavior together.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Supplies the explicit gap comparison boundary.
   */
  minGapFrames: IAutoMovieCaptionReadabilityBoundary;
}

/**
 * Complete execution identity of one caption grapheme segmenter.
 *
 * Locale-sensitive runtimes retain both the requested locale and the locale
 * they actually resolved. An implementation may claim locale neutrality only
 * when locale is not an input to its segmentation behavior.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Makes the actual grapheme execution basis observable beside every measurement.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Defines the complete identity a profile must select before it can produce a verdict.
 * @author Samchon
 */
export interface IAutoMovieCaptionGraphemeSegmentationIdentity {
  /** Non-blank algorithm identity supported by the selected validator. */
  algorithm: string;
  /** Exact algorithm or segmentation-data revision. */
  version: string;
  /** Grapheme-cluster granularity used to measure caption text. */
  granularity: "grapheme";
  /** Locale participation in the actual segmentation execution. */
  locale:
    | {
        /** The runtime resolves a requested locale before segmenting. */
        kind: "requested-resolved";
        /** Non-blank locale passed to the runtime. */
        requested: string;
        /** Non-blank locale reported by the runtime after resolution. */
        resolved: string;
      }
    | {
        /** The algorithm does not consume or resolve locale state. */
        kind: "locale-neutral";
      };
}

/**
 * One production-owned numeric caption boundary.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Makes equality behavior part of the declared threshold.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Carries each numeric value with inclusive or exclusive semantics.
 * @author Samchon
 */
export interface IAutoMovieCaptionReadabilityBoundary {
  /**
   * Finite non-negative threshold value.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Carries the production's numeric threshold.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Supplies the value used by deterministic comparison.
   */
  value: number;
  /**
   * Whether equality satisfies this boundary.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Declares inclusive versus exclusive equality semantics.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Prevents validators from assuming one boundary convention.
   */
  inclusive: boolean;
}

/**
 * Global frame and art-direction invariants for one production.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-source-ownership Defines the typed production-design root as authored project source rather than treating references or renders as design authority.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-design-authority-boundary Provides the public boundary for the production's canonical design decisions and their downstream consumers.
 */
export interface IAutoMovieProductionDesign {
  /**
   * Non-blank stable production id; film-level acceptance targets use it.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-exceptions Exposes `id` as the portable data boundary for the production design art direction exceptions requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-graphics-style-exceptions Types `id` for the narrative intent graphics style exceptions system contract.
   */
  id: string;
  /**
   * Non-blank human-facing title.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-exceptions Exposes `title` as the portable data boundary for the production design art direction exceptions requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-graphics-style-exceptions Types `title` for the narrative intent graphics style exceptions system contract.
   */
  title: string;
  /**
   * Non-blank one-sentence narrative promise.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-exceptions Exposes `logline` as the portable data boundary for the production design art direction exceptions requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-graphics-style-exceptions Types `logline` for the narrative intent graphics style exceptions system contract.
   */
  logline: string;
  /**
   * Finite intended finished runtime in seconds, strictly above zero and on the
   * production frame clock.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-exceptions Exposes `targetRuntimeSeconds` as the portable data boundary for the production design art direction exceptions requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-graphics-style-exceptions Types `targetRuntimeSeconds` for the narrative intent graphics style exceptions system contract.
   */
  targetRuntimeSeconds: number;
  /**
   * Final visual delivery layer.
   *
   * Deterministic delivery uses compiler/render output directly. Repainted
   * delivery keeps that output as technical truth and additionally requires a
   * required feature plus a receipt-bound rendition review for every delivered
   * shot.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-exceptions Exposes `visualDelivery` as the portable data boundary for the production design art direction exceptions requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-graphics-style-exceptions Types `visualDelivery` for the narrative intent graphics style exceptions system contract.
   */
  visualDelivery: "deterministic" | "repainted";
  /**
   * Story clock every pinned shot and cross-shot criterion is measured on.
   *
   * Omitted means the production asserts nothing about story time; shots may
   * then carry no pin and no cross-shot criterion is admissible.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-exceptions Exposes `storyClock` as the portable data boundary for the production design art direction exceptions requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-graphics-style-exceptions Types `storyClock` for the narrative intent graphics style exceptions system contract.
   */
  storyClock?: IAutoMovieStoryClock;
  /**
   * The production's own light sources and their motion on the story clock.
   *
   * Where {@link storyClock} says when a shot happens, this says what the light
   * is doing then. A shot's `lightMotions` is the right unit for a light that
   * belongs to the moment and the wrong unit for one that belongs to the
   * production: stated per shot, every shot restages the same source and
   * nothing relates the light in the first shot to the light in the last. A
   * production that runs across a stretch of story could not say that its light
   * travelled over that stretch, whatever the subject.
   *
   * Declared once here, each shot reads the state at its own story moment
   * ({@link IAutoMovieShotStoryTime}); a shot still states its own local light
   * on top. Optional and purely additive: a production declaring none is
   * unaffected in every respect, and so is any shot carrying no story pin.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-exceptions Exposes `lighting` as the portable data boundary for the production design art direction exceptions requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-graphics-style-exceptions Types `lighting` for the narrative intent graphics style exceptions system contract.
   */
  lighting?: IAutoMovieProductionLighting;
  /**
   * Render cost limits this production holds its own artifacts to, by tier.
   *
   * The engine ships no preset tiers. A budget is a claim about what this
   * production is willing to draw, which nobody else can make for it, so a
   * production that declares none is measured and reported without a verdict
   * rather than judged against a number it never chose.
   *
   * Each entry names its own `tier`, such as `review` or `delivery`, and a
   * render job checks an artifact against the one it targets. Optional and
   * purely additive: a production declaring none behaves exactly as it did
   * before the field existed.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-exceptions Exposes `renderBudgets` as the portable data boundary for the production design art direction exceptions requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-graphics-style-exceptions Types `renderBudgets` for the narrative intent graphics style exceptions system contract.
   */
  renderBudgets?: IAutoMovieRenderBudget[];
  /**
   * User-selected external motion adoptions, unique by id and clip.
   *
   * The compiler validates and applies these records but does not choose an
   * asset, take, actor, adoption mode, or retarget mapping. Omission preserves
   * the legacy source-computed motion path.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Makes every external-motion adoption decision explicit and optional.
   * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-selection-override-resolution Carries the selected source, member, target, and mode into compilation.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-exceptions Exposes `externalMotions` as the portable data boundary for the production design art direction exceptions requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-graphics-style-exceptions Types `externalMotions` for the narrative intent graphics style exceptions system contract.
   */
  externalMotions?: IAutoMovieExternalMotionAdoption[];
  /**
   * Production-owned caption readability profiles, unique by language.
   *
   * Omission provides no implicit thresholds: measurements may be reported, but
   * their verdict is `not-run` and existing compiled output is unchanged.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Gives the production sole ownership of language-specific thresholds.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Distinguishes measure-only operation from profile-backed evaluation.
   */
  captionReadabilityProfiles?: IAutoMovieCaptionReadabilityProfile[];
  /**
   * Optional production-owned propagation, room-response, and dialogue
   * choices.
   *
   * Omitting propagation or the room response preserves the legacy dry path.
   * The engine does not choose a physical profile, external provider, adopted
   * asset, or room mapping.
   *
   * The same record carries the two dialogue decisions nothing else can make
   * for the production: which generator it adopted under which reviewed rights,
   * and which compiled actor each screenplay speaker performs through.
   *
   * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Makes propagation an explicit production input rather than an engine default.
   * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Carries only selected bounded models into deterministic planning.
   * @evidence requirements/sound/sources-and-external-assets.md#sound-source-provenance Keeps the adopted generator's provider, model, version, rights, and reviewed terms date with the production that chose them.
   * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#external-result-provider-neutrality Types the adoption as provider-neutral authored data that a credential can neither supply nor start.
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Names the actor whose performance shares the film interval with the voice rather than inferring one from cast order.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Supplies the join key the viseme evaluation resolves at a target film time.
   */
  sound?: {
    /** Selected direct-path propagation model. */
    propagation?: IAutoMovieSoundPropagationProfile;
    /** Selected bounded derived or externally adopted room-response source. */
    acousticResponse?: IAutoMovieAcousticResponseProfile;
    /**
     * The exact dialogue generator this production adopted, if any.
     *
     * The choice of a voice is a delivery decision the production makes and
     * answers for, so it is stated here beside the rest of the design rather
     * than in a runtime declaration that no reviewed document owns. The record
     * carries no credential: it names where the generator came from, which
     * rights and terms were reviewed on which calendar day, the authored cost
     * basis, and why this production needs synthesized dialogue at all.
     *
     * The host runtime narrows this to the adapter it actually implements and
     * refuses a provider, model revision, dtype, or device it cannot produce;
     * this contract stays provider-neutral so the decision is portable.
     * Omission means the production synthesizes no dialogue.
     */
    dialogueSynthesis?: {
      /** Non-blank generator identity the host runtime must implement. */
      provider: string;
      /** Non-blank exact model repository or local tool identity. */
      model: string;
      /** Non-blank immutable model revision. */
      modelRevision: string;
      /** Non-blank weight quantization the adopted revision was taken at. */
      dtype: string;
      /** Non-blank execution device the adoption was reviewed for. */
      device: string;
      /** Non-blank voice identity inside that model revision. */
      voice: string;
      /** Finite speaking rate strictly above zero. */
      speed: number;
      /** Reviewed source, rights, terms date, cost, and consumer reason. */
      generatorProvenance: IAutoMovieProductionTtsReceipt["generatorProvenance"];
    };
    /**
     * Joins from a screenplay speaker identity to the compiled actor whose
     * mouth performs that line.
     *
     * The screenplay names who speaks and source names the actor node, and
     * nothing between them is inferable: cast order and a similar name are
     * both wrong answers. Stating the join in the design is what lets the
     * compiler refuse a speaker with no line, a duplicate identity, and an
     * actor absent from the shot the line lands in.
     *
     * A binding is for an audible identity with a mouth on screen. An
     * off-screen narrator or machine voice still needs a settings owner and a
     * screenplay source, but it has no actor to bind. Omission means the
     * production binds no speaker to a mouth.
     */
    speakerBindings?: Array<{
      /** Non-blank speaker identity carried by the dialogue line. */
      speaker: string;
      /** Non-blank compiled actor node id that owns the mouth layer. */
      actor: string;
    }>;
  };
  /**
   * The proxy and final visual deliverables this production renders at.
   *
   * A tier is a delivery contract rather than a filename: the raster scale and
   * the frame decimation say what the review pass and the final pass actually
   * are, and a proxy that succeeded is not clearance for the final. Declaring
   * both here keeps the pair addressable by the same design revision every
   * other delivery decision is read from.
   *
   * Optional and purely additive: a production declaring none is rendered at
   * the host's shipped review and delivery tiers, exactly as it was before the
   * field existed.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-source-ownership Keeps the review and delivery raster a tracked design decision rather than an input a render command supplies on the production's behalf.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-design-authority-boundary Types the tier pair as part of the canonical design record its downstream render consumers read.
   */
  renderTiers?: {
    /**
     * Review tier, which must be cheaper than the final one in at least one of
     * its two axes. A proxy that reduces neither is refused rather than run.
     */
    proxy: {
      /** Stable tier identity used in slots, chunks, and publication paths. */
      kind: "proxy";
      /** Output raster multiplier in `(0, 1]`. */
      resolutionScale: number;
      /** Keep every Nth source frame; an integer from 1 through 16. */
      frameStep: number;
    };
    /** Delivery tier; `resolutionScale` and `frameStep` are exactly one. */
    final: {
      /** Stable tier identity used in slots, chunks, and publication paths. */
      kind: "final";
      /** Output raster multiplier; exactly one at the final tier. */
      resolutionScale: number;
      /** Source frame stride; exactly one at the final tier. */
      frameStep: number;
    };
  };
  /**
   * The appearance rendition this production adopted, and its exact requests.
   *
   * A repaint is a derived appearance over deterministic truth, so what it may
   * do has to be decided before anything is drawn: which generator, on which
   * execution boundary, under which bounded retry and cost policy, and with
   * which exact prompt, seed, preservation strength, and role-specific
   * references per shot. Holding that here means a request cannot appear as an
   * ephemeral command-line override, and a changed request stales the compile
   * that consumed it.
   *
   * The post-generation selection review is deliberately not part of this
   * record: reviewing a candidate must not stale the deterministic render that
   * produced it, so the host joins that observation by shot from its own
   * control-plane sidecar. Omission means deterministic visual delivery.
   *
   * @evidence requirements/repaint/providers-models-and-credentials.md#repaint-execution-boundary Keeps the chosen generator and its execution boundary an authored production decision rather than host state.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-execution-eligibility Supplies the one adoption record an executor is allowed to bind an adapter to.
   * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-budget-stop Makes attempts, timeout, elapsed time, cost, retryability, and deterministic backoff authored inputs rather than hidden host behavior.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Types the bounded policy consumed before an external call and reread when a candidate is selected.
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Locks each shot prompt, seed, preservation strength, and role-specific reference to the shot it was reviewed for.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types the controls and references one request carries into execution.
   */
  repaint?: {
    /** Adopted runtime identity and reviewed rights for the generator. */
    generator: IAutoMovieRepaintGeneratorAdoption;
    /** Bounded attempts, timeouts, cost, backoff, and retryable failures. */
    executionPolicy: IAutoMovieRepaintExecutionPolicy;
    /** One immutable reviewed request per delivered shot, unique by shot. */
    requests: Array<{
      /** Authored shot id this request repaints. */
      shot: string;
      /** Prompt, seed, preservation strength, and optional scalar controls. */
      parameters: IAutoMovieRepaintParameters;
      /** At least one manifest-registered role-specific reference. */
      references: IAutoMovieRepaintReferenceInput[];
      /** Stable addresses of the owners this request answers to. */
      evidence: IAutoMovieRepaintRequestEvidence;
    }>;
  };
  /**
   * Soft-body domains this production admits to a live moving-boundary solve.
   *
   * A moving anchor or a body capsule makes a domain expensive in a way a
   * static one is not, so which domains are worth that cost is a production
   * decision rather than a solver default. The list is production-wide, so a
   * domain may be absent from a shot that does not stage it; across every
   * compiled shot, however, this set must equal the set of domains that
   * actually declare a moving boundary, and list order is the stable subject
   * budget order every shot shares.
   *
   * Omission admits none. That is correct for a production staging no
   * moving-boundary domain, and refused for one that stages any.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Separates the domains whose anchors move with a performance from the static ones, which is exactly what admission costs.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Types the production-wide selection the solver reads before it samples an owner pose at a fixed-step boundary.
   */
  simulation?: {
    /** Unique, non-blank, trimmed domain ids in stable budget order. */
    liveWearableSoftBodies: string[];
  };
  /**
   * Read-only site context every environmental analysis is measured against.
   *
   * Sun, sky, reference ground and neighbouring occluder masses are conditions
   * a building is subject to, not parts of it. Declaring them here keeps that
   * direction one-way: an analysis reads the context and the building, and
   * neither the context nor a result it produces can become design.
   *
   * The compiler refuses a context whose ids collide with the building's own
   * elements, spaces or boundaries, because a shading mass sharing an id with a
   * wall is a mass the building would appear to own. Optional and purely
   * additive: a production declaring none runs no analysis and is otherwise
   * unaffected.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-exceptions Exposes `environmentContext` as the portable data boundary for the production design art direction exceptions requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-graphics-style-exceptions Types `environmentContext` for the narrative intent graphics style exceptions system contract.
   */
  environmentContext?: IAutoMovieEnvironmentContext;
  /**
   * Deterministic frame clock and raster format.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-exceptions Exposes `frameFormat` as the portable data boundary for the production design art direction exceptions requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-graphics-style-exceptions Types `frameFormat` for the narrative intent graphics style exceptions system contract.
   */
  frameFormat: {
    /**
     * Integer pixel width from 16 through 16,384. Width times height may not
     * exceed 16,777,216 pixels, the exact-frame review capture ceiling.
     */
    width: number;
    /**
     * Integer pixel height from 16 through 16,384. Width times height may not
     * exceed 16,777,216 pixels, the exact-frame review capture ceiling.
     */
    height: number;
    /** Finite frames per second, strictly above zero. */
    fps: number;
    /** Output color space. */
    colorSpace: "srgb";
    /**
     * Optional normalized delivery-gate window projected onto the full output
     * raster. Omission and the complete `0,0,1,1` window are geometric no-ops.
     */
    crop?: IAutoMovieDeliveryCrop;
  };
  /**
   * Bounded visual grammar rather than screenplay prose.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-exceptions Exposes `artDirection` as the portable data boundary for the production design art direction exceptions requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-graphics-style-exceptions Types `artDirection` for the narrative intent graphics style exceptions system contract.
   */
  artDirection: {
    /** Foundation visual style. */
    style: "primitive-3d";
    /** Non-empty unique CSS-compatible palette colors. */
    palette: string[];
    /** Non-blank rules that keep important silhouettes legible. */
    silhouettePriority: string;
    /** Non-blank rules for conveying scale with primitive geometry. */
    scaleGrammar: string;
  };
  /**
   * At least one output, with every deliverable id unique.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-exceptions Exposes `deliverables` as the portable data boundary for the production design art direction exceptions requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-graphics-style-exceptions Types `deliverables` for the narrative intent graphics style exceptions system contract.
   */
  deliverables: IAutoMovieProductionDeliverable[];
}

/**
 * One distance-specific recipe reference emitted as authoring/runtime metadata.
 *
 * The foundation compiler materializes every referenced recipe. The scaffold
 * viewer automatically selects anonymous formation tiers from distance and
 * projected contribution with hysteresis; ordinary scene nodes do not yet
 * switch model tiers automatically.
 *
 * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-reference-realization Exposes `IAutoMovieModelLodRecipe` as the portable data boundary for the production design reference realization requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-design-reference-realization Types `IAutoMovieModelLodRecipe` for the narrative intent design reference realization system contract.
 */
export interface IAutoMovieModelLodRecipe {
  /**
   * Detail tier.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-reference-realization Exposes `tier` as the portable data boundary for the production design reference realization requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-design-reference-realization Types `tier` for the narrative intent design reference realization system contract.
   */
  tier: "hero" | "near" | "far";
  /**
   * Positive maximum viewing distance in meters, strictly increasing between
   * tiers, or null only on the final unbounded tier.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-reference-realization Exposes `maxDistance` as the portable data boundary for the production design reference realization requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-design-reference-realization Types `maxDistance` for the narrative intent design reference realization system contract.
   */
  maxDistance: number | null;
  /**
   * Existing recipe id used at this tier; self-reference is allowed.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-reference-realization Exposes `recipe` as the portable data boundary for the production design reference realization requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-design-reference-realization Types `recipe` for the narrative intent design reference realization system contract.
   */
  recipe: string;
}

/**
 * A bounded primitive model recipe compiled into deterministic model data.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieModelRecipe` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieModelRecipe` for the narrative intent story design ownership system contract.
 */
export interface IAutoMovieModelRecipe {
  /**
   * Non-blank stable recipe id, unique under portable case folding.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `id` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `id` for the narrative intent story design ownership system contract.
   */
  id: string;
  /**
   * Production role.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `role` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `role` for the narrative intent story design ownership system contract.
   */
  role: "performer" | "mount" | "prop" | "set";
  /**
   * Non-blank id of the registered archetype that builds this recipe.
   *
   * The compiler resolves this identifier against the archetype catalogue the
   * production registers and refuses a recipe naming nothing registered. It is
   * opaque here on purpose: which archetypes exist is a decision of that
   * catalogue, not of this contract.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `archetype` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `archetype` for the narrative intent story design ownership system contract.
   */
  archetype: string;
  /**
   * Registered external appearance asset, or omitted for compiler-generated
   * primitive geometry. The active production asset ledger must carry one
   * matching `model-recipe` use for this exact recipe id.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `asset` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `asset` for the narrative intent story design ownership system contract.
   */
  asset?: string;
  /**
   * Exact archetype-specific parameter map.
   *
   * The registered archetype owns this contract: which keys are required, which
   * are accepted at all, and the value kind and range of each. Read
   * `MODEL_RECIPE`, then the definition itself; an unsupported key is refused
   * rather than stored.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `parameters` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `parameters` for the narrative intent story design ownership system contract.
   */
  parameters: Record<string, number | string | boolean>;
  /**
   * Exactly one named six-digit `#RRGGBB` material color in the foundation
   * compiler. Multiple semantic part materials remain unsupported and are
   * refused instead of silently discarded.
   *
   * The value is an sRGB swatch, and the compiler decodes it with
   * `srgbHexToLinearColor` on its way into the material's linear `baseColor`.
   * The same swatch written here and in `IAutoMovieInstanceVariation.palette`
   * therefore renders one color, which is the whole reason both go through one
   * decode.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `palette` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `palette` for the narrative intent story design ownership system contract.
   */
  palette: Record<string, string>;
  /**
   * Non-empty unique tiers ordered `hero`, `near`, `far`, with increasing
   * positive distances and an optional unbounded tier only at the end.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `lod` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `lod` for the narrative intent story design ownership system contract.
   */
  lod: IAutoMovieModelLodRecipe[];
  /**
   * Semantic abilities visible to source and review, unique within the recipe.
   *
   * The registered archetype decides which labels are meaningful and the
   * compiler refuses any other; declaring one it does implement still leaves
   * source to author the motion that earns it.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `capabilities` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `capabilities` for the narrative intent story design ownership system contract.
   */
  capabilities: string[];
  /**
   * Unique semantic bone sockets.
   *
   * A bone is accepted only when the registered archetype's builder actually
   * materializes it, so an archetype without a compiler-owned skeleton accepts
   * none. The materializer does not create attached scene nodes automatically.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `attachments` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `attachments` for the narrative intent story design ownership system contract.
   */
  attachments: Array<{
    /** Non-blank attachment id, unique within the recipe. */
    id: string;
    /** Bone id used as the attachment parent. */
    bone: AutoMovieHumanoidBone;
  }>;
  /**
   * Declarative capability profiles copied onto the compiler-owned runtime
   * model. Omitted means that trait-gated engine verbs such as mounting are
   * unavailable.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `profiles` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `profiles` for the narrative intent story design ownership system contract.
   */
  profiles?: IAutoMovieProfile[];
}

/**
 * Compact deterministic placement algorithm for a general instance set.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieInstanceSetLayout` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieInstanceSetLayout` for the narrative intent story design ownership system contract.
 */
export type IAutoMovieInstanceSetLayout =
  | {
      /** Rectangular grid. */
      kind: "grid";
      /** Positive integer rows. */
      rows: number;
      /** Positive integer columns; rows times columns must cover count. */
      columns: number;
      /** Positive center-to-center spacing in meters. */
      spacing: { x: number; z: number };
    }
  | {
      /** Uniform seeded disk scatter. */
      kind: "scatter";
      /** Positive disk radius in meters. */
      radius: number;
    }
  | {
      /** Seeded placement along one named world route. */
      kind: "along-route";
      /** Existing route id. */
      route: string;
      /** Maximum lateral offset from the route centerline in meters. */
      lateralJitter: number;
    }
  | {
      /** Three-dimensional rectangular lattice. */
      kind: "lattice";
      /** Positive integer rows along local Z. */
      rows: number;
      /** Positive integer columns along local X. */
      columns: number;
      /** Positive integer layers along local Y. */
      layers: number;
      /** Positive center-to-center spacing in meters. */
      spacing: IAutoMovieVector3;
    }
  | {
      /** Source-authored exact transform block. */
      kind: "explicit";
      /** One exact entry per declared slot, in stable slot order. */
      transforms: IAutoMovieExplicitInstanceTransform[];
    };

/**
 * One exact source-authored instance transform and sparse override.
 *
 * @evidence requirements/map/scope-and-coordinates.md#map-coordinate-transform-precision Exposes `IAutoMovieExplicitInstanceTransform` as the portable data boundary for the map coordinate transform precision requirement.
 * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-transform-lineage-precision Types `IAutoMovieExplicitInstanceTransform` for the world site transform lineage precision system contract.
 */
export interface IAutoMovieExplicitInstanceTransform {
  /**
   * Stable non-blank identity unique inside the set.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-coordinate-transform-precision Exposes `id` as the portable data boundary for the map coordinate transform precision requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-transform-lineage-precision Types `id` for the world site transform lineage precision system contract.
   */
  id: string;
  /**
   * Translation relative to the set anchor, in meters.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-coordinate-transform-precision Exposes `translation` as the portable data boundary for the map coordinate transform precision requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-transform-lineage-precision Types `translation` for the world site transform lineage precision system contract.
   */
  translation: IAutoMovieVector3;
  /**
   * Exact unit quaternion in glTF `(x, y, z, w)` order.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-coordinate-transform-precision Exposes `rotation` as the portable data boundary for the map coordinate transform precision requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-transform-lineage-precision Types `rotation` for the world site transform lineage precision system contract.
   */
  rotation: IAutoMovieQuaternion;
  /**
   * Strictly positive scale on each local axis.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-coordinate-transform-precision Exposes `scale` as the portable data boundary for the map coordinate transform precision requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-transform-lineage-precision Types `scale` for the world site transform lineage precision system contract.
   */
  scale: IAutoMovieVector3;
  /**
   * Optional prototype id; omitted selects the set's default prototype.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-coordinate-transform-precision Exposes `prototype` as the portable data boundary for the map coordinate transform precision requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-transform-lineage-precision Types `prototype` for the world site transform lineage precision system contract.
   */
  prototype?: string;
  /**
   * Omitted means visible.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-coordinate-transform-precision Exposes `visible` as the portable data boundary for the map coordinate transform precision requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-transform-lineage-precision Types `visible` for the world site transform lineage precision system contract.
   */
  visible?: boolean;
  /**
   * Optional exact `#RRGGBB` palette override.
   *
   * Decoded from sRGB by `srgbHexToLinearColor` like every other palette entry;
   * see `IAutoMovieInstanceVariation.palette` for how that differs from
   * `IAutoMovieColor`.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-coordinate-transform-precision Exposes `palette` as the portable data boundary for the map coordinate transform precision requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-transform-lineage-precision Types `palette` for the world site transform lineage precision system contract.
   */
  palette?: string;
  /**
   * Optional exact overrides for declared numeric traits.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-coordinate-transform-precision Exposes `traits` as the portable data boundary for the map coordinate transform precision requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-transform-lineage-precision Types `traits` for the world site transform lineage precision system contract.
   */
  traits?: Record<string, number>;
}

/**
 * One reusable model prototype selectable by slots in a logical set.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieInstancePrototypeDesign` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieInstancePrototypeDesign` for the narrative intent story design ownership system contract.
 */
export interface IAutoMovieInstancePrototypeDesign {
  /**
   * Stable non-blank id unique inside the set.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `id` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `id` for the narrative intent story design ownership system contract.
   */
  id: string;
  /**
   * Existing model recipe used by this prototype.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `modelRecipe` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `modelRecipe` for the narrative intent story design ownership system contract.
   */
  modelRecipe: string;
  /**
   * Positive deterministic selection weight.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `weight` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `weight` for the narrative intent story design ownership system contract.
   */
  weight: number;
}

/**
 * Seed-derived per-instance visual and semantic variation.
 *
 * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-consistency-variation Exposes `IAutoMovieInstanceVariation` as the portable data boundary for the production design consistency variation requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-language-variation Types `IAutoMovieInstanceVariation` for the narrative intent visual language variation system contract.
 */
export interface IAutoMovieInstanceVariation {
  /**
   * Inclusive uniform scale range, both strictly above zero.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-consistency-variation Exposes `scale` as the portable data boundary for the production design consistency variation requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-language-variation Types `scale` for the narrative intent visual language variation system contract.
   */
  scale: { min: number; max: number };
  /**
   * Optional independent scale ranges per local axis.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-consistency-variation Exposes `scale3` as the portable data boundary for the production design consistency variation requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-language-variation Types `scale3` for the narrative intent visual language variation system contract.
   */
  scale3?: { min: IAutoMovieVector3; max: IAutoMovieVector3 };
  /**
   * Optional seeded XYZ Euler offsets in degrees, applied after facing.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-consistency-variation Exposes `rotationDeg` as the portable data boundary for the production design consistency variation requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-language-variation Types `rotationDeg` for the narrative intent visual language variation system contract.
   */
  rotationDeg?: {
    x: { min: number; max: number };
    y: { min: number; max: number };
    z: { min: number; max: number };
  };
  /**
   * Seeded probability that a procedural slot is visible.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-consistency-variation Exposes `visibleProbability` as the portable data boundary for the production design consistency variation requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-language-variation Types `visibleProbability` for the narrative intent visual language variation system contract.
   */
  visibleProbability?: number;
  /**
   * Non-empty exact `#RRGGBB` palette choices applied per instance.
   *
   * An entry is the color itself rather than a label for one, so the viewer
   * decodes it from sRGB to linear with `srgbHexToLinearColor` before it
   * reaches the instance. A model recipe palette is decoded by that same
   * function on its way into `baseColor`, so the identical swatch authored
   * either way now renders the identical color.
   *
   * `IAutoMovieColor` holds the opposite convention: its components are
   * authored linear and its `hex` is a derived label the renderer never
   * decodes. Reach for `srgbHexToLinearColor` when carrying a swatch across
   * that boundary. Pasting the digits straight into a triple renders about
   * 2.3x too bright at midtones, and instanced slots covering the same surface
   * as such a material is how one production ended up drawing one roof in two
   * colors.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-consistency-variation Exposes `palette` as the portable data boundary for the production design consistency variation requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-language-variation Types `palette` for the narrative intent visual language variation system contract.
   */
  palette: string[];
  /**
   * Named bounded numeric traits regenerated from seed and slot.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-consistency-variation Exposes `traits` as the portable data boundary for the production design consistency variation requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-language-variation Types `traits` for the narrative intent visual language variation system contract.
   */
  traits: Array<{
    /** Stable trait name unique in this set. */
    name: string;
    /** Inclusive minimum. */
    min: number;
    /** Inclusive maximum. */
    max: number;
  }>;
}

/**
 * A compact non-formation crowd, vegetation, prop, or debris set.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieInstanceSetDesign` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieInstanceSetDesign` for the narrative intent story design ownership system contract.
 */
export interface IAutoMovieInstanceSetDesign {
  /**
   * Stable id unique within the world.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `id` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `id` for the narrative intent story design ownership system contract.
   */
  id: string;
  /**
   * Existing model recipe rendered by every member.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `modelRecipe` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `modelRecipe` for the narrative intent story design ownership system contract.
   */
  modelRecipe: string;
  /**
   * Optional weighted prototype table; `modelRecipe` remains the default.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `prototypes` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `prototypes` for the narrative intent story design ownership system contract.
   */
  prototypes?: IAutoMovieInstancePrototypeDesign[];
  /**
   * Integer slot count from one through 100,000.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `count` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `count` for the narrative intent story design ownership system contract.
   */
  count: number;
  /**
   * Compact deterministic placement law.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `layout` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `layout` for the narrative intent story design ownership system contract.
   */
  layout: IAutoMovieInstanceSetLayout;
  /**
   * World-space origin for grid and scatter layouts.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `anchor` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `anchor` for the narrative intent story design ownership system contract.
   */
  anchor: IAutoMovieVector3;
  /**
   * Finite base heading in degrees.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `facingDeg` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `facingDeg` for the narrative intent story design ownership system contract.
   */
  facingDeg: number;
  /**
   * Full non-negative safe-integer seed.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `seed` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `seed` for the narrative intent story design ownership system contract.
   */
  seed: number;
  /**
   * Seed-derived per-slot differences.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `variation` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `variation` for the narrative intent story design ownership system contract.
   */
  variation: IAutoMovieInstanceVariation;
}

/**
 * A named point in the production world.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieWorldLandmark` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieWorldLandmark` for the narrative intent story design ownership system contract.
 */
export interface IAutoMovieWorldLandmark {
  /**
   * Stable landmark id.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `id` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `id` for the narrative intent story design ownership system contract.
   */
  id: string;
  /**
   * Center in meters.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `position` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `position` for the narrative intent story design ownership system contract.
   */
  position: IAutoMovieVector3;
  /**
   * Finite selection and clearance radius in meters, strictly above zero.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `radius` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `radius` for the narrative intent story design ownership system contract.
   */
  radius: number;
  /**
   * Non-blank narrative or tactical meaning.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `meaning` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `meaning` for the narrative intent story design ownership system contract.
   */
  meaning: string;
}

/**
 * A bounded horizontal polygon with a deterministic height function.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieWorldSurface` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieWorldSurface` for the narrative intent story design ownership system contract.
 */
export interface IAutoMovieWorldSurface {
  /**
   * Stable surface id.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `id` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `id` for the narrative intent story design ownership system contract.
   */
  id: string;
  /**
   * At least three distinct finite XZ vertices forming a simple,
   * non-self-intersecting polygon with non-zero area.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `polygon` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `polygon` for the narrative intent story design ownership system contract.
   */
  polygon: Array<{
    /** World X in meters. */
    x: number;
    /** World Z in meters. */
    z: number;
  }>;
  /**
   * Surface height function.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `height` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `height` for the narrative intent story design ownership system contract.
   */
  height: IAutoMovieHeightRule;
  /**
   * Whether performers may traverse the surface.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `walkable` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `walkable` for the narrative intent story design ownership system contract.
   */
  walkable: boolean;
}

/**
 * A named route whose width constrains formations.
 *
 * @evidence requirements/map/movement-and-visibility.md#map-route-connectivity Exposes `IAutoMovieWorldRoute` as the portable data boundary for the map route connectivity requirement.
 * @evidence specifications/world-and-site/traversal-and-visibility.md#world-site-route-connectivity-time-state Types `IAutoMovieWorldRoute` for the world site route connectivity time state system contract.
 */
export interface IAutoMovieWorldRoute {
  /**
   * Stable route id.
   *
   * @evidence requirements/map/movement-and-visibility.md#map-route-connectivity Exposes `id` as the portable data boundary for the map route connectivity requirement.
   * @evidence specifications/world-and-site/traversal-and-visibility.md#world-site-route-connectivity-time-state Types `id` for the world site route connectivity time state system contract.
   */
  id: string;
  /**
   * At least two finite ordered centerline points in world XZ coordinates.
   *
   * @evidence requirements/map/movement-and-visibility.md#map-route-connectivity Exposes `waypoints` as the portable data boundary for the map route connectivity requirement.
   * @evidence specifications/world-and-site/traversal-and-visibility.md#world-site-route-connectivity-time-state Types `waypoints` for the world site route connectivity time state system contract.
   */
  waypoints: Array<{
    /** World X in meters. */
    x: number;
    /** World Z in meters. */
    z: number;
  }>;
  /**
   * Finite maximum formation width in meters, strictly above zero.
   *
   * @evidence requirements/map/movement-and-visibility.md#map-route-connectivity Exposes `allowedFormationWidth` as the portable data boundary for the map route connectivity requirement.
   * @evidence specifications/world-and-site/traversal-and-visibility.md#world-site-route-connectivity-time-state Types `allowedFormationWidth` for the world site route connectivity time state system contract.
   */
  allowedFormationWidth: number;
}

/**
 * An axis-aligned world-space effect volume.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieWorldBounds` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieWorldBounds` for the narrative intent story design ownership system contract.
 */
export interface IAutoMovieWorldBounds {
  /**
   * Minimum corner.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `min` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `min` for the narrative intent story design ownership system contract.
   */
  min: IAutoMovieVector3;
  /**
   * Maximum corner.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `max` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `max` for the narrative intent story design ownership system contract.
   */
  max: IAutoMovieVector3;
}

/**
 * One bounded deterministic environmental-effect emitter recipe.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieEffectRecipe` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieEffectRecipe` for the narrative intent story design ownership system contract.
 */
export interface IAutoMovieEffectRecipe {
  /**
   * Stable recipe id.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `id` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `id` for the narrative intent story design ownership system contract.
   */
  id: string;
  /**
   * Supported primitive effect family.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `kind` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `kind` for the narrative intent story design ownership system contract.
   */
  kind: "fog" | "smoke" | "dust";
  /**
   * Explicit deterministic recipe seed.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `seed` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `seed` for the narrative intent story design ownership system contract.
   */
  seed: number;
  /**
   * Bounded deterministic emission.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `emission` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `emission` for the narrative intent story design ownership system contract.
   */
  emission: {
    /** Particles emitted per second. */
    rate: number;
    /** Particles emitted at cue start. */
    burst: number;
    /** Maximum emitting duration in seconds. */
    duration: number;
  };
  /**
   * Bounded billboard appearance.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `particle` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `particle` for the narrative intent story design ownership system contract.
   */
  particle: {
    /** Inclusive lifetime range in seconds. */
    lifetime: { min: number; max: number };
    /** Inclusive world-size range in meters. */
    size: { min: number; max: number };
    /** Exact opaque hexadecimal RGB color. */
    color: string;
    /** Inclusive alpha range from zero through one. */
    opacity: { min: number; max: number };
  };
  /**
   * Bounded deterministic transport.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `motion` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `motion` for the narrative intent story design ownership system contract.
   */
  motion: {
    /** World-space meters per second. */
    wind: IAutoMovieVector3;
    /** Additional upward meters per second. */
    rise: number;
    /** Maximum seeded lateral velocity deviation. */
    turbulence: number;
  };
  /**
   * Hard runtime and LOD budgets.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `budget` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `budget` for the narrative intent story design ownership system contract.
   */
  budget: {
    /** Maximum live billboard instances. */
    maxParticles: number;
    /** Distance beyond which deterministic thinning applies. */
    lodDistance: number;
  };
  /**
   * Only supported transparency law.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `blend` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `blend` for the narrative intent story design ownership system contract.
   */
  blend: "alpha";
}

/**
 * An axis-aligned world-space effect volume.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieWorldEffectZone` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieWorldEffectZone` for the narrative intent story design ownership system contract.
 */
export interface IAutoMovieWorldEffectZone {
  /**
   * Stable zone id.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `id` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `id` for the narrative intent story design ownership system contract.
   */
  id: string;
  /**
   * Existing deterministic effect recipe id.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `recipe` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `recipe` for the narrative intent story design ownership system contract.
   */
  recipe: string;
  /**
   * World-space volume.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `bounds` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `bounds` for the narrative intent story design ownership system contract.
   */
  bounds: IAutoMovieWorldBounds;
  /**
   * Explicit deterministic zone seed.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `seed` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `seed` for the narrative intent story design ownership system contract.
   */
  seed: number;
}

/**
 * Named spatial constraints and semantic anchors for a production.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieWorldDesign` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieWorldDesign` for the narrative intent story design ownership system contract.
 */
export interface IAutoMovieWorldDesign {
  /**
   * Non-blank stable world id.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `id` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `id` for the narrative intent story design ownership system contract.
   */
  id: string;
  /**
   * World unit.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `units` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `units` for the narrative intent story design ownership system contract.
   */
  units: "meter";
  /**
   * Named tactical or narrative landmarks.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `landmarks` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `landmarks` for the narrative intent story design ownership system contract.
   */
  landmarks: IAutoMovieWorldLandmark[];
  /**
   * Queryable surfaces.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `surfaces` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `surfaces` for the narrative intent story design ownership system contract.
   */
  surfaces: IAutoMovieWorldSurface[];
  /**
   * Named formation routes.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `routes` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `routes` for the narrative intent story design ownership system contract.
   */
  routes: IAutoMovieWorldRoute[];
  /**
   * Bounded deterministic environmental-effect recipes.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `effectRecipes` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `effectRecipes` for the narrative intent story design ownership system contract.
   */
  effectRecipes: IAutoMovieEffectRecipe[];
  /**
   * Deterministic effect regions bound to recipes.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `effectZones` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `effectZones` for the narrative intent story design ownership system contract.
   */
  effectZones: IAutoMovieWorldEffectZone[];
  /**
   * Compact non-formation instance sets such as civilians, trees, or debris.
   *
   * Omitted is equivalent to an empty list for backwards compatibility.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `instanceSets` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `instanceSets` for the narrative intent story design ownership system contract.
   */
  instanceSets?: IAutoMovieInstanceSetDesign[];
}

/**
 * Review-facing formation behavior vocabulary.
 *
 * The compiler does not infer or restrict source motion from these labels.
 * Observable shot predicates and review evidence remain authoritative.
 *
 * @evidence requirements/formations/budgets-and-validation.md#formation-motion-validation Exposes `AutoMovieFormationCapability` as the portable data boundary for the formation motion validation requirement.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-geometry-layout-motion-validation Types `AutoMovieFormationCapability` for the performance formation geometry layout motion validation system contract.
 */
export type AutoMovieFormationCapability =
  | "hold"
  | "advance"
  | "wheel"
  | "charge"
  | "break"
  | "retreat";

/**
 * A compact formation layout; individual members are derived slots.
 *
 * @evidence requirements/formations/layouts-and-slots.md#formation-layout-selection-parameters Exposes `IAutoMovieFormationLayout` as the portable data boundary for the formation layout selection parameters requirement.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `IAutoMovieFormationLayout` for the performance formation layout slot assignment system contract.
 */
export type IAutoMovieFormationLayout =
  | {
      /** Rectangular line. */
      kind: "line";
      /** Integer ranks from 1 through count. */
      ranks: number;
      /** Integer files from 1 through count; ranks times files covers count. */
      files: number;
      /** Finite inter-slot spacing in meters, strictly above zero. */
      spacing: {
        /** Left-to-right spacing between files. */
        lateral: number;
        /** Front-to-back spacing between ranks. */
        depth: number;
      };
      /**
       * How far a member may stand off its exact slot, in meters.
       *
       * Formed troops are dressed to a tolerance, not to a lattice, and that
       * tolerance is what makes a unit read as many people holding a line
       * rather than one figure repeated on a grid. Omit it, or leave both
       * numbers at zero, for exact geometry.
       *
       * The deviation is derived from the formation seed and the slot index, so
       * it costs no storage, regenerates identically everywhere, and the same
       * design always compiles to the same crowd.
       */
      dressing?: {
        /** Maximum left-to-right deviation in meters, zero or above. */
        lateral: number;
        /** Maximum front-to-back deviation in meters, zero or above. */
        depth: number;
      };
    }
  | {
      /** March column. */
      kind: "column";
      /** Integer ranks from 1 through count. */
      ranks: number;
      /** Integer files from 1 through count; ranks times files covers count. */
      files: number;
      /** Finite inter-slot spacing in meters, strictly above zero. */
      spacing: {
        /** Left-to-right spacing between files. */
        lateral: number;
        /** Front-to-back spacing between ranks. */
        depth: number;
      };
      /**
       * How far a member may stand off its exact slot, in meters.
       *
       * Formed troops are dressed to a tolerance, not to a lattice, and that
       * tolerance is what makes a unit read as many people holding a line
       * rather than one figure repeated on a grid. Omit it, or leave both
       * numbers at zero, for exact geometry.
       *
       * The deviation is derived from the formation seed and the slot index, so
       * it costs no storage, regenerates identically everywhere, and the same
       * design always compiles to the same crowd.
       */
      dressing?: {
        /** Maximum left-to-right deviation in meters, zero or above. */
        lateral: number;
        /** Maximum front-to-back deviation in meters, zero or above. */
        depth: number;
      };
    }
  | {
      /** Wedge layout. */
      kind: "wedge";
      /** Integer rows from 1 through count; depth squared must cover count. */
      depth: number;
      /** Finite inter-slot spacing in meters, strictly above zero. */
      spacing: {
        /** Left-to-right spacing between members in one row. */
        lateral: number;
        /** Front-to-back spacing between rows. */
        depth: number;
      };
      /**
       * How far a member may stand off its exact slot, in meters.
       *
       * Formed troops are dressed to a tolerance, not to a lattice, and that
       * tolerance is what makes a unit read as many people holding a line
       * rather than one figure repeated on a grid. Omit it, or leave both
       * numbers at zero, for exact geometry.
       *
       * The deviation is derived from the formation seed and the slot index, so
       * it costs no storage, regenerates identically everywhere, and the same
       * design always compiles to the same crowd.
       */
      dressing?: {
        /** Maximum left-to-right deviation in meters, zero or above. */
        lateral: number;
        /** Maximum front-to-back deviation in meters, zero or above. */
        depth: number;
      };
    }
  | {
      /** Arc layout. */
      kind: "arc";
      /** Finite arc radius in meters, strictly above zero. */
      radius: number;
      /** Finite covered angle, strictly above zero and at most 360 degrees. */
      arcDegrees: number;
      /**
       * How far a member may stand off its exact slot, in meters.
       *
       * Formed troops are dressed to a tolerance, not to a lattice, and that
       * tolerance is what makes a unit read as many people holding a line
       * rather than one figure repeated on a grid. Omit it, or leave both
       * numbers at zero, for exact geometry.
       *
       * The deviation is derived from the formation seed and the slot index, so
       * it costs no storage, regenerates identically everywhere, and the same
       * design always compiles to the same crowd.
       */
      dressing?: {
        /** Maximum left-to-right deviation in meters, zero or above. */
        lateral: number;
        /** Maximum front-to-back deviation in meters, zero or above. */
        depth: number;
      };
    }
  | {
      /** Seeded scatter layout. */
      kind: "scatter";
      /** Finite scatter radius in meters, strictly above zero. */
      radius: number;
      /** Integer layout-specific seed from zero through `MAX_SAFE_INTEGER`. */
      seed: number;
    };

/**
 * A unit-level formation whose members are deterministic derived slots.
 *
 * @evidence requirements/formations/hierarchies-and-units.md#formation-unit-local-variation Exposes `IAutoMovieFormationDesign` as the portable data boundary for the formation unit local variation requirement.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `IAutoMovieFormationDesign` for the performance formation hierarchy membership command system contract.
 */
export interface IAutoMovieFormationDesign {
  /**
   * Non-blank stable formation id, unique under portable case folding.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-unit-local-variation Exposes `id` as the portable data boundary for the formation unit local variation requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `id` for the performance formation hierarchy membership command system contract.
   */
  id: string;
  /**
   * Existing model recipe id enforced on every derived slot, including heroes.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-unit-local-variation Exposes `modelRecipe` as the portable data boundary for the formation unit local variation requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `modelRecipe` for the performance formation hierarchy membership command system contract.
   */
  modelRecipe: string;
  /**
   * Integer number of derived slots from 1 through 100,000. Generated output
   * stores bounded chunks and hero exceptions; anonymous slots are regenerated
   * from index and seed and rendered through instancing.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-unit-local-variation Exposes `count` as the portable data boundary for the formation unit local variation requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `count` for the performance formation hierarchy membership command system contract.
   */
  count: number;
  /**
   * Compact layout with only the parameters its algorithm consumes. Line,
   * column and wedge own explicit spacing; arc separation follows radius and
   * angle, while scatter density follows count and radius.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-unit-local-variation Exposes `layout` as the portable data boundary for the formation unit local variation requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `layout` for the performance formation hierarchy membership command system contract.
   */
  layout: IAutoMovieFormationLayout;
  /**
   * Formation origin in world space.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-unit-local-variation Exposes `anchor` as the portable data boundary for the formation unit local variation requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `anchor` for the performance formation hierarchy membership command system contract.
   */
  anchor: IAutoMovieVector3;
  /**
   * Finite world-space heading in degrees.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-unit-local-variation Exposes `facingDeg` as the portable data boundary for the formation unit local variation requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `facingDeg` for the performance formation hierarchy membership command system contract.
   */
  facingDeg: number;
  /**
   * Integer deterministic seed from zero through `MAX_SAFE_INTEGER`.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-unit-local-variation Exposes `seed` as the portable data boundary for the formation unit local variation requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `seed` for the performance formation hierarchy membership command system contract.
   */
  seed: number;
  /**
   * Unique intended formation behaviors for source/review coordination.
   *
   * These labels are not a compiler permission boundary and do not prove that
   * source implemented or avoided a motion.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-unit-local-variation Exposes `capabilities` as the portable data boundary for the formation unit local variation requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `capabilities` for the performance formation hierarchy membership command system contract.
   */
  capabilities: AutoMovieFormationCapability[];
  /**
   * Slots promoted to named hero actors.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-unit-local-variation Exposes `heroOverrides` as the portable data boundary for the formation unit local variation requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `heroOverrides` for the performance formation hierarchy membership command system contract.
   */
  heroOverrides: Array<{
    /** Unique zero-based slot strictly below this formation's count. */
    slot: number;
    /** Non-blank actor id, unique among this formation's hero overrides. */
    actor: string;
  }>;
}

/**
 * A named opening or closing state required by a shot.
 *
 * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `IAutoMovieNamedState` as the portable data boundary for the story time state review scope requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `IAutoMovieNamedState` for the narrative intent temporal state handoff system contract.
 */
export interface IAutoMovieNamedState {
  /**
   * Stable state id.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `id` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `id` for the narrative intent temporal state handoff system contract.
   */
  id: string;
  /**
   * Non-blank human-readable state contract; it is never proof by itself.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `description` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `description` for the narrative intent temporal state handoff system contract.
   */
  description: string;
  /**
   * Machine-checkable facts sampled from compiled pose and transform output.
   *
   * Descriptive prose never discharges a state contract by itself.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `predicates` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `predicates` for the narrative intent temporal state handoff system contract.
   */
  predicates: IAutoMovieShotPredicate[];
}

/**
 * A spatial operand measured from one compiled shot.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieShotSpatialSelector` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieShotSpatialSelector` for the narrative intent story design ownership system contract.
 */
export type IAutoMovieShotSpatialSelector =
  | {
      /** One compiled scene node. */
      kind: "node";
      /** Exact scene-node id. */
      id: string;
    }
  | {
      /** Centroid of every compiler-materialized formation slot. */
      kind: "formation";
      /** Exact formation design id. */
      id: string;
    }
  | {
      /** One named production-world landmark. */
      kind: "landmark";
      /** Exact landmark id. */
      id: string;
    }
  | {
      /** One literal world-space point. */
      kind: "point";
      /** Exact point in meters. */
      position: IAutoMovieVector3;
    };

/**
 * A scalar comparison evaluated by the deterministic compiler.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieScalarPredicate` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieScalarPredicate` for the narrative intent story design ownership system contract.
 */
export interface IAutoMovieScalarPredicate {
  /**
   * Numeric comparison.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `operator` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `operator` for the narrative intent story design ownership system contract.
   */
  operator: "<=" | ">=" | "==";
  /**
   * Finite expected value in the unit implied by the selected predicate.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `value` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `value` for the narrative intent story design ownership system contract.
   */
  value: number;
  /**
   * Finite non-negative absolute comparison tolerance.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `tolerance` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `tolerance` for the narrative intent story design ownership system contract.
   */
  tolerance: number;
}

/**
 * One compiler-evaluable state or event fact.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieShotPredicate` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieShotPredicate` for the narrative intent story design ownership system contract.
 */
export type IAutoMovieShotPredicate =
  | (IAutoMovieScalarPredicate & {
      /** Sample one articulated joint angle. */
      kind: "joint-angle";
      /** Performed scene-node id. */
      actor: string;
      /** Normalized humanoid bone. */
      bone: AutoMovieHumanoidBone;
      /** Semantic pose axis. */
      axis: "flexion" | "abduction" | "twist";
    })
  | (IAutoMovieScalarPredicate & {
      /** Sample one world-space coordinate. */
      kind: "position";
      /** Compiled spatial subject. */
      subject: IAutoMovieShotSpatialSelector;
      /** World-space coordinate axis. */
      axis: "x" | "y" | "z";
    })
  | (IAutoMovieScalarPredicate & {
      /** Measure Euclidean distance between two compiled spatial operands. */
      kind: "distance";
      /** First spatial operand. */
      from: IAutoMovieShotSpatialSelector;
      /** Second spatial operand. */
      to: IAutoMovieShotSpatialSelector;
    });

/**
 * An actor or formation required by a shot.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieShotParticipant` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieShotParticipant` for the narrative intent story design ownership system contract.
 */
export type IAutoMovieShotParticipant =
  | {
      /** Named actor participant. */
      kind: "actor";
      /** Actor id. */
      id: string;
    }
  | {
      /** Formation participant. */
      kind: "formation";
      /** Formation id. */
      id: string;
    };

/**
 * A time-bounded event the shot source must implement.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieShotEventContract` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieShotEventContract` for the narrative intent story design ownership system contract.
 */
export interface IAutoMovieShotEventContract {
  /**
   * Stable event id.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `id` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `id` for the narrative intent story design ownership system contract.
   */
  id: string;
  /**
   * Event family.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `kind` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `kind` for the narrative intent story design ownership system contract.
   */
  kind: "contact" | "arrival" | "break" | "reveal" | "transition";
  /**
   * Inclusive finite event window inside the owning shot's duration.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `window` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `window` for the narrative intent story design ownership system contract.
   */
  window: {
    /** Earliest valid time. */
    from: number;
    /** Latest valid time. */
    to: number;
  };
  /**
   * Non-empty unique actor, formation or object ids involved.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `subjects` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `subjects` for the narrative intent story design ownership system contract.
   */
  subjects: string[];
  /**
   * Non-empty machine-checkable facts required at the realized event time.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `predicates` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `predicates` for the narrative intent story design ownership system contract.
   */
  predicates: IAutoMovieShotPredicate[];
}

/**
 * A frame time and guide passes required for shot review.
 *
 * @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-per-frame-shot-budget Exposes `IAutoMovieShotReviewFrame` as the portable data boundary for the effects per frame shot budget requirement.
 * @evidence specifications/simulation-effects-and-sound/budget-admission.md#budget-frame-shot-sequence-composition Types `IAutoMovieShotReviewFrame` for the budget frame shot sequence composition system contract.
 */
export interface IAutoMovieShotReviewFrame {
  /**
   * Stable frame-contract id.
   *
   * @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-per-frame-shot-budget Exposes `id` as the portable data boundary for the effects per frame shot budget requirement.
   * @evidence specifications/simulation-effects-and-sound/budget-admission.md#budget-frame-shot-sequence-composition Types `id` for the budget frame shot sequence composition system contract.
   */
  id: string;
  /**
   * Time inside the owning shot, snapped exactly to the production frame clock.
   *
   * @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-per-frame-shot-budget Exposes `time` as the portable data boundary for the effects per frame shot budget requirement.
   * @evidence specifications/simulation-effects-and-sound/budget-admission.md#budget-frame-shot-sequence-composition Types `time` for the budget frame shot sequence composition system contract.
   */
  time: number;
  /**
   * Non-empty unique passes that must be captured.
   *
   * @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-per-frame-shot-budget Exposes `passes` as the portable data boundary for the effects per frame shot budget requirement.
   * @evidence specifications/simulation-effects-and-sound/budget-admission.md#budget-frame-shot-sequence-composition Types `passes` for the budget frame shot sequence composition system contract.
   */
  passes: AutoMovieGuidePass[];
}

/**
 * Deliberate grammar breaks that suppress only their matching heuristic.
 *
 * Pure geometric facts remain measurable; this marker records why a director
 * chose to keep one otherwise questionable edit.
 *
 * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-style-drift Exposes `AutoMovieGrammarStyleIntent` as the portable data boundary for the production design style drift requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-design-reference-realization Types `AutoMovieGrammarStyleIntent` for the narrative intent design reference realization system contract.
 */
export type AutoMovieGrammarStyleIntent =
  | "axis-cross"
  | "jump-cut"
  | "eyeline-break"
  | "tight-reestablish"
  | "rhythmic-pacing";

/**
 * A code-bound shot contract, not a dense keyframe list.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieShotContract` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieShotContract` for the narrative intent story design ownership system contract.
 */
export interface IAutoMovieShotContract {
  /**
   * Non-blank stable shot id, unique under portable case folding.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `id` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `id` for the narrative intent story design ownership system contract.
   */
  id: string;
  /**
   * Non-blank narrative beat id owned by the coding-agent treatment.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `beat` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `beat` for the narrative intent story design ownership system contract.
   */
  beat: string;
  /**
   * Coding-agent-owned source export.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `source` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `source` for the narrative intent story design ownership system contract.
   */
  source: {
    /**
     * Canonical project-relative POSIX TypeScript path. Backslashes, absolute
     * paths, dot segments and case-variant aliases are refused.
     */
    module: string;
    /** Named exported builder. */
    export: string;
  };
  /**
   * Screenplay scenes and optional canon claims this shot intends to realize.
   *
   * Project lint requires this field once a screenplay index is resident.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `evidence` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `evidence` for the narrative intent story design ownership system contract.
   */
  evidence?: IAutoMovieSceneEvidence[];
  /**
   * Finite shot runtime in seconds, strictly above zero and on the production
   * frame clock.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `durationSeconds` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `durationSeconds` for the narrative intent story design ownership system contract.
   */
  durationSeconds: number;
  /**
   * Where this shot's local time zero lands on the production story clock.
   *
   * Omitted means the shot asserts nothing about story time, which is the
   * default. A pin is legal only once the production declares `storyClock`, and
   * a cross-shot criterion may only compare events in pinned shots. Pinning is
   * independent of the edit: the pin says when the shot happened, never where
   * it is cut.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `storyTime` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `storyTime` for the narrative intent story design ownership system contract.
   */
  storyTime?: IAutoMovieShotStoryTime;
  /**
   * Unique deliberate film-grammar exceptions. Each value suppresses only its
   * corresponding heuristic diagnostic; unrelated facts remain visible.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `styleIntent` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `styleIntent` for the narrative intent story design ownership system contract.
   */
  styleIntent?: AutoMovieGrammarStyleIntent[];
  /**
   * Unique required actor and formation ids; formations must already exist.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `participants` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `participants` for the narrative intent story design ownership system contract.
   */
  participants: IAutoMovieShotParticipant[];
  /**
   * Required opening states.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `opening` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `opening` for the narrative intent story design ownership system contract.
   */
  opening: IAutoMovieNamedState[];
  /**
   * Required closing states.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `closing` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `closing` for the narrative intent story design ownership system contract.
   */
  closing: IAutoMovieNamedState[];
  /**
   * Camera readability constraints.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `camera` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `camera` for the narrative intent story design ownership system contract.
   */
  camera: {
    /** Non-blank creative camera intent. */
    intent: string;
    /**
     * Non-empty unique compiled scene-node or formation ids that must remain
     * readable.
     */
    requiredSubjects: string[];
    /**
     * Finite maximum allowed pixel-occlusion ratio, inclusive from zero to one.
     *
     * The compiler projects subject root points but does not measure this
     * ratio. The external reviewer must compare current mask, depth, outline or
     * beauty frames against it.
     */
    maxOcclusionRatio: number;
  };
  /**
   * Timed semantic events.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `events` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `events` for the narrative intent story design ownership system contract.
   */
  events: IAutoMovieShotEventContract[];
  /**
   * At least one required visual-review frame.
   *
   * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `reviewFrames` as the portable data boundary for the production design story boundary requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `reviewFrames` for the narrative intent story design ownership system contract.
   */
  reviewFrames: IAutoMovieShotReviewFrame[];
}

/**
 * A measurable acceptance criterion.
 *
 * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-acceptance Exposes `IAutoMovieAcceptanceCriterion` as the portable data boundary for the production design art direction acceptance requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-language-acceptance Types `IAutoMovieAcceptanceCriterion` for the narrative intent visual language acceptance system contract.
 */
export type IAutoMovieAcceptanceCriterion =
  | {
      /** Visual frame criterion. */
      kind: "frame";
      /** Owning shot id; required when the acceptance target is the film. */
      shot?: string;
      /** Review-frame id in the target shot. */
      frame: string;
      /** Render pass to inspect. */
      pass: AutoMovieGuidePass;
      /** Non-blank observable expectation for the cited current frame. */
      expectation: string;
    }
  | {
      /** Semantic event criterion. */
      kind: "event";
      /** Owning shot id; required when the acceptance target is the film. */
      shot?: string;
      /** Event id in the target shot or film. */
      event: string;
      /** Non-blank observable expectation for the cited compiled event. */
      expectation: string;
    }
  | {
      /** Numeric metric criterion. */
      kind: "metric";
      /**
       * Supported compiler-owned metric.
       *
       * Physics and occlusion metrics remain geometry/frame review concerns
       * until their operands and measurement protocols are explicit.
       */
      metric: "runtime-seconds";
      /** Numeric comparison. */
      operator: "<=" | ">=" | "==";
      /** Finite threshold value, in seconds for `runtime-seconds`. */
      value: number;
    }
  | {
      /**
       * Cross-shot simultaneity criterion measured on the production story
       * clock.
       *
       * Adjacency in the cut proves nothing about chronology, so this is the
       * only way a production can state that separate shots show one moment.
       * Each named event is realized by its own shot, mapped through that
       * shot's pin, and the widest resulting gap is compared against the
       * tolerance. The claim is refusable: an unpinned shot, an absent
       * realization, declared windows that cannot possibly land inside the
       * tolerance, or realized times that in fact land outside it all fail it.
       */
      kind: "story-sync";
      /**
       * Two or more realized events, each named with the shot that owns it.
       * Every shot must be pinned; each shot-and-event pair appears once.
       */
      events: Array<{
        /** Owning shot id. */
        shot: string;
        /** Event id declared by that shot. */
        event: string;
      }>;
      /**
       * Finite non-negative tolerance in story seconds. The claim holds when
       * the earliest and latest realized story times differ by no more.
       */
      toleranceSeconds: number;
      /** Non-blank observable expectation for the asserted shared moment. */
      expectation: string;
    };

/**
 * A required or optional acceptance scenario for a shot or film.
 *
 * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-acceptance Exposes `IAutoMovieAcceptanceScenario` as the portable data boundary for the production design art direction acceptance requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-language-acceptance Types `IAutoMovieAcceptanceScenario` for the narrative intent visual language acceptance system contract.
 */
export interface IAutoMovieAcceptanceScenario {
  /**
   * Non-blank stable scenario id, unique under portable case folding.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-acceptance Exposes `id` as the portable data boundary for the production design art direction acceptance requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-language-acceptance Types `id` for the narrative intent visual language acceptance system contract.
   */
  id: string;
  /**
   * Screenplay scenes and optional canon claims this observable check verifies.
   *
   * Traceability is valid for every claim, but only a matching claim
   * verification owner can discharge that claim.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-acceptance Exposes `evidence` as the portable data boundary for the production design art direction acceptance requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-language-acceptance Types `evidence` for the narrative intent visual language acceptance system contract.
   */
  evidence?: IAutoMovieSceneEvidence[];
  /**
   * Scenario target.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-acceptance Exposes `target` as the portable data boundary for the production design art direction acceptance requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-language-acceptance Types `target` for the narrative intent visual language acceptance system contract.
   */
  target:
    | {
        /** Shot target. */
        kind: "shot";
        /** Shot id. */
        id: string;
      }
    | {
        /** Film target. */
        kind: "film";
        /** Film id. */
        id: string;
      };
  /**
   * Observable frame, compiled event or runtime metric criterion. Film-level
   * frame and event criteria also name their owning shot.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-acceptance Exposes `criterion` as the portable data boundary for the production design art direction acceptance requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-language-acceptance Types `criterion` for the narrative intent visual language acceptance system contract.
   */
  criterion: IAutoMovieAcceptanceCriterion;
  /**
   * Whether current review and final compilation require exact passing evidence
   * for this scenario.
   *
   * @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-acceptance Exposes `required` as the portable data boundary for the production design art direction acceptance requirement.
   * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-language-acceptance Types `required` for the narrative intent visual language acceptance system contract.
   */
  required: boolean;
}

/**
 * An addressable design artifact.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieDesignTarget` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieDesignTarget` for the narrative intent story design ownership system contract.
 */
export type IAutoMovieDesignTarget =
  | {
      /** Active production design. */
      kind: "production";
    }
  | {
      /** Model recipe. */
      kind: "model";
      /** Recipe id. */
      id: string;
    }
  | {
      /** Project-shared world design. */
      kind: "world";
    }
  | {
      /** Formation design. */
      kind: "formation";
      /** Formation id. */
      id: string;
    }
  | {
      /** Shot contract. */
      kind: "shot";
      /** Shot id. */
      id: string;
    }
  | {
      /** Acceptance scenario. */
      kind: "acceptance";
      /** Scenario id. */
      id: string;
    };

/**
 * Union of every addressable production design value.
 *
 * @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary Exposes `IAutoMovieDesignArtifact` as the portable data boundary for the production design story boundary requirement.
 * @evidence specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Types `IAutoMovieDesignArtifact` for the narrative intent story design ownership system contract.
 */
export type IAutoMovieDesignArtifact =
  | IAutoMovieProductionDesign
  | IAutoMovieModelRecipe
  | IAutoMovieWorldDesign
  | IAutoMovieFormationDesign
  | IAutoMovieShotContract
  | IAutoMovieAcceptanceScenario;
