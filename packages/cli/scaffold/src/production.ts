import type { IAutoMovieProductionDesign } from "@automovie/interface";

import config from "../automovie.config";

/**
 * The production-owned clear color used by every viewer surface.
 *
 * @evidence settings/050-art-direction.md#art-palette-scale Implements the
 *   single production background swatch reused by every viewer surface.
 * @evidenceReview settings/050-art-direction.md#art-palette-scale #958a50f Read settings/050-art-direction.md#art-palette-scale and PRODUCTION_BACKGROUND; confirmed the exported value is exactly the one authored `#182235` background swatch and every viewer imports it.
 * @evidence principles/production-sources.md#shared-visual-grammar Defines the
 *   shared clear color once rather than copying a viewer-local background.
 * @evidenceReview principles/production-sources.md#shared-visual-grammar #348c26d Read principles/production-sources.md#shared-visual-grammar and PRODUCTION_BACKGROUND; confirmed the value is production-scoped and reused rather than independently authored by a viewer.
 */
export const PRODUCTION_BACKGROUND = "#182235";

/**
 * The frame clock, visual grammar and required outputs of the whole film.
 *
 * Not a subject: nothing performs it and nothing is composed from it. It is
 * what the other records are measured against, which is why it is emitted
 * before them. A shot's duration has to land on this frame clock and a
 * deliverable has to carry this runtime, so a production record stored after
 * the shots would be checking work already accepted.
 *
 * The id is read from the configuration the project scripts open the production
 * with rather than written again here. A design whose id disagrees with the
 * opened production is refused outright, and a second copy of the name is how
 * the two come to disagree.
 *
 * @evidence settings/000-governing-aim.md#delivery-contract Serializes the
 *   film identity, 11.5-second edit, frame convention, and five required
 *   outputs without adding audience content.
 * @evidenceReview settings/000-governing-aim.md#delivery-contract #28c4cbc Read settings/000-governing-aim.md#delivery-contract and production; confirmed configured identity and working title derivation, exact logline, runtime, deterministic film shape, units, and all five required output kinds are serialized consistently.
 * @evidence settings/050-art-direction.md#art-delivery-review-condition Keeps
 *   the delivered frame grammar sized around the readable cue and formation.
 * @evidenceReview settings/050-art-direction.md#art-delivery-review-condition #c9d7e44 Read settings/050-art-direction.md#art-delivery-review-condition and production; confirmed its deterministic mode and 1280-by-720, 24 fps, sRGB frame format exactly serialize the declared final review condition.
 * @evidence settings/050-art-direction.md#art-palette-scale Serializes the
 *   one shared primitive-3D palette and scale grammar.
 * @evidenceReview settings/050-art-direction.md#art-palette-scale #958a50f Read settings/050-art-direction.md#art-palette-scale and production; confirmed the primitive-3D style, five exact swatches in authored order, silhouette priority, and scale grammar carry the production-wide visual decision.
 * @evidence settings/050-art-direction.md#art-effects-audio-absence Requires
 *   only the declared structural zero-gain audio output at production scope.
 * @evidenceReview settings/050-art-direction.md#art-effects-audio-absence #c799fa1 Read settings/050-art-direction.md#art-effects-audio-absence and production; confirmed the required mix promises pipeline structure without authoring audible audience content.
 * @evidenceExclude settings/010-soloist.md#soloist-identity-scale Subject
 *   scale is realized by the soloist model source, not this production record.
 * @evidenceExcludeReview settings/010-soloist.md#soloist-identity-scale #5386f50 Read the soloist identity unit and production; confirmed Soloist owns its 1.8 m scale and this record publishes only the shared scale grammar.
 * @evidenceExclude settings/010-soloist.md#soloist-hand-capability Figure
 *   articulation is realized by model, motion, and shot sources.
 * @evidenceExcludeReview settings/010-soloist.md#soloist-hand-capability #92a349c Read the hand-capability unit and production; confirmed the model, cue motion, and shots own it and production emits no articulation field.
 * @evidenceExclude settings/020-chorus.md#chorus-group-identity Formation
 *   identity is realized by the chorus model source.
 * @evidenceExcludeReview settings/020-chorus.md#chorus-group-identity #cfc06d1 Read the chorus identity unit and production; confirmed Chorus owns rows, columns, and member scale while production emits only shared grammar.
 * @evidenceExclude settings/020-chorus.md#chorus-advance-capability Formation
 *   travel is realized by motion and shot sources.
 * @evidenceExcludeReview settings/020-chorus.md#chorus-advance-capability #ea566f7 Read the advance unit and production; confirmed chorus motion and opening shot own the 2 m travel and production has no motion value.
 * @evidenceExclude settings/020-chorus.md#chorus-hold-capability Formation
 *   holding is realized by motion and shot sources.
 * @evidenceExcludeReview settings/020-chorus.md#chorus-hold-capability #3a5ff68 Read the hold unit and production; confirmed chorus hold motion and both shots own the fixed endpoint and production has no formation state.
 * @evidenceExclude settings/020-chorus.md#chorus-break-capability The unused
 *   reusable break belongs to formation and motion sources.
 * @evidenceExcludeReview settings/020-chorus.md#chorus-break-capability #84105c2 Read the break unit and production; confirmed the reusable formation and motion owners expose it while production neither selects nor parameterizes it.
 * @evidenceExclude settings/030-gate.md#gate-identity-placement Gate identity
 *   and placement are realized by its model and answer-shot sources.
 * @evidenceExcludeReview settings/030-gate.md#gate-identity-placement #64a3d40 Read the gate identity unit and production; confirmed PlazaGate and answer own its dimensions and derived placement and production emits no gate data.
 * @evidenceExclude settings/030-gate.md#gate-hinge-capability Gate
 *   articulation is realized by its model source.
 * @evidenceExcludeReview settings/030-gate.md#gate-hinge-capability #6e34234 Read the hinge unit and production; confirmed PlazaGate owns the 0-to-100-degree interface and production exposes no prop articulation.
 * @evidenceExclude settings/040-plaza.md#plaza-ground-landmark Ground and
 *   landmark construction are realized by the plaza model source.
 * @evidenceExcludeReview settings/040-plaza.md#plaza-ground-landmark #196da0d Read the plaza landmark unit and production; confirmed Plaza owns the origin and derived ground while production only declares shared world units in prose.
 * @evidenceExclude settings/040-plaza.md#plaza-background-role Background
 *   geometry and haze are realized by plaza and shot sources.
 * @evidenceExcludeReview settings/040-plaza.md#plaza-background-role #992c6f4 Read the plaza background unit and production; confirmed Plaza and opening own ground and haze geometry while production owns only the clear-color grammar.
 * @evidence principles/production-sources.md#settings-only-serialization Maps
 *   reviewed settings to a production design without creating story action.
 * @evidenceReview principles/production-sources.md#settings-only-serialization #0ce718f Read principles/production-sources.md#settings-only-serialization and production; confirmed every creative field maps to governing-aim or art-direction settings and no subject, action, or edit is implemented here.
 * @evidence principles/production-sources.md#delivery-identity Emits one
 *   mutually consistent identity, runtime, format, mode, and output list.
 * @evidenceReview principles/production-sources.md#delivery-identity #fbf8931 Read principles/production-sources.md#delivery-identity and production; confirmed identity, logline, runtime, format, deterministic mode, and required deliverables agree with the non-visual authored boundary while visual grammar remains separately owned.
 * @evidence principles/production-sources.md#shared-visual-grammar Owns only
 *   production-wide palette, silhouette, and scale values.
 * @evidenceReview principles/production-sources.md#shared-visual-grammar #348c26d Read principles/production-sources.md#shared-visual-grammar and production; confirmed subject materials stay in model sources while this record owns only shared palette, silhouette, scale, and background.
 */
export const production = {
  id: config.productionId,
  /**
   * The starter is titled after itself.
   *
   * Derived rather than spelled out, because a title that repeated the name in
   * its own string would be the same name written twice. Give the film a title
   * of its own here the moment it has one; nothing downstream reads this as an
   * identity.
   */
  title: config.productionId,
  /**
   * The promise every sequence answers for, quoted from the document that owns
   * it.
   *
   * `docs/settings/000-governing-aim.md` is the first canon document, the one every
   * rung of the ladder is sized against, and this is the same sentence. It is
   * copied rather than read, because reading it would mean recovering one
   * sentence out of a Markdown document by rule, and a rule that guesses which
   * sentence is the logline is a second author.
   */
  logline: "A soloist raises a hand, and a chorus standing in rows answers it.",
  /**
   * The finished runtime, in seconds.
   *
   * The edit in `src/film.ts` has to land exactly here: this number times the
   * frame rate is the delivered frame count, and the compiler compares a
   * deliverable's parsed media against it rather than against the manifest's
   * claim about itself.
   */
  targetRuntimeSeconds: 11.5,
  visualDelivery: "deterministic",
  frameFormat: {
    width: 1280,
    height: 720,
    fps: 24,
    colorSpace: "srgb",
  },
  /**
   * The bounded visual grammar, specified by `docs/settings/050-art-direction.md`.
   *
   * Palette and scale rules live here rather than inside a subject because they
   * are decisions about the film. The list bounds the actual background,
   * subject, and effect swatches; each model or effect owner then binds its one
   * chosen swatch without inventing another visual zone.
   */
  artDirection: {
    style: "primitive-3d",
    palette: [
      PRODUCTION_BACKGROUND,
      "#d7b56d",
      "#8f9d74",
      "#6f746e",
      "#89918a",
    ],
    silhouettePriority:
      "The soloist and the raised hand remain distinct from the ground and background.",
    scaleGrammar:
      "A named soloist and the promoted formation heroes remain readable against simultaneous near and far anonymous rows.",
  },
  /**
   * What the production owes on delivery.
   *
   * Each required entry is a gate the final compile refuses without, so this
   * list is the shape of the finished film rather than a wish: the starter
   * proves a preview, a feature, one structural guide pass, captions and a
   * mix.
   */
  deliverables: [
    {
      id: "starter-preview",
      kind: "preview",
      required: true,
    },
    {
      id: "starter-feature",
      kind: "feature",
      required: true,
    },
    {
      id: "starter-pose-guide",
      kind: "guide-pass",
      pass: "pose",
      required: true,
    },
    {
      id: "starter-captions",
      kind: "captions",
      required: true,
    },
    {
      id: "starter-audio",
      kind: "audio-mix",
      required: true,
    },
  ],
} satisfies IAutoMovieProductionDesign;
