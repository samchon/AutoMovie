import type { IAutoMovieProductionDesign } from "@automovie/interface";

/**
 * The production-owned clear color used by every viewer surface.
 *
 * @evidence settings/050-art-direction.md#art-palette Implements the
 *   single production background swatch reused by every viewer surface.
 * @evidenceReview settings/050-art-direction.md#art-palette #d26ffe8 Compared settings/050-art-direction.md#art-palette with the complete src/production.ts file. Verified relationship: Implements the single production background swatch reused by every viewer surface.
 * @evidence obligations/delivery/production-sources.md#shared-visual-grammar Defines the
 *   shared clear color once rather than copying a viewer-local background.
 * @evidenceReview obligations/delivery/production-sources.md#shared-visual-grammar #af7c4d8 Read obligations/delivery/production-sources.md#shared-visual-grammar and PRODUCTION_BACKGROUND; confirmed the value is production-scoped and reused rather than independently authored by a viewer.
 * @evidence principles/core/source-units.md#source-scope-preservation PRODUCTION_BACKGROUND keeps responsibility for the exported PRODUCTION_BACKGROUND source owner and its declared value or behavior in this declaration; the implementation fragment "#182235" introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PRODUCTION_BACKGROUND declaration and implementation with the settings-owned identity, timing, frame, output, and runtime policy; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion PRODUCTION_BACKGROUND is a usable source artifact for the exported PRODUCTION_BACKGROUND source owner and its declared value or behavior; it is implemented directly as "#182235" rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PRODUCTION_BACKGROUND signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/delivery/production-sources.md#settings-revision-from-production-source-work Implementing PRODUCTION_BACKGROUND tested the settings-owned identity, timing, frame, output, and runtime policy through the exported PRODUCTION_BACKGROUND source owner and its declared value or behavior; the implementation fragment "#182235" shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/delivery/production-sources.md#settings-revision-from-production-source-work #b78cab8 I compared the complete PRODUCTION_BACKGROUND implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
 *   film identity, 11.5-second edit, required English-caption deliverable, and
 *   inert zero-gain audio output without adding audience content.
 * @evidenceReview settings/000-governing-aim.md#delivery-contract #c5ab39f Compared settings/000-governing-aim.md#delivery-contract with the complete src/production.ts file. Verified relationship: Serializes the film identity, 11.5-second edit, required English-caption deliverable, and inert zero-gain audio output while film source owns the exact track mapping and intentionally absent products receive no empty deliverable.
 * @evidence settings/000-governing-aim.md#governing-aim Serializes the exact
 *   raised-hand and ordered-chorus-answer logline as the production promise.
 * @evidenceReview settings/000-governing-aim.md#governing-aim #81fee69 Compared settings/000-governing-aim.md#governing-aim with the complete src/production.ts file. Verified relationship: Serializes the exact raised-hand and ordered-chorus-answer logline as the production promise.
 * @evidence settings/000-governing-aim.md#coordinate-time-convention Uses
 *   seconds for the exact runtime and a 24 fps frame clock while leaving world
 *   axes to model and world source.
 * @evidenceReview settings/000-governing-aim.md#coordinate-time-convention #8aa0cd6 Compared settings/000-governing-aim.md#coordinate-time-convention with the complete src/production.ts file. Verified relationship: Uses seconds for the exact runtime and a 24 fps frame clock while leaving world axes to model and world source.
 * @evidenceExclude settings/000-governing-aim.md#audience-access Audience
 *   access is realized by screenplay, shot, and film source, not this design
 *   envelope.
 * @evidenceExcludeReview settings/000-governing-aim.md#audience-access #4aa8ba3 Compared settings/000-governing-aim.md#audience-access with the complete production-source property population represented by the complete src/production.ts file. Verified relationship: Audience access is realized by screenplay, shot, and film source, not this design envelope.
 * @evidenceExclude settings/000-governing-aim.md#production-language Final
 *   English caption content is authored in screenplay and mapped by film
 *   source; this record only requires the caption deliverable kind.
 * @evidenceExcludeReview settings/000-governing-aim.md#production-language #6330b70 Compared settings/000-governing-aim.md#production-language with the complete production-source property population represented by the complete src/production.ts file. Verified relationship: Final English caption content is authored in screenplay and mapped by film source; this record only requires the caption deliverable kind.
 * @evidenceExclude settings/000-governing-aim.md#settings-coverage-map The
 *   work-specific settings requirement allocation governs authoring
 *   completeness and is not serialized as a runtime production field.
 * @evidenceExcludeReview settings/000-governing-aim.md#settings-coverage-map #a95e1fc Compared settings/000-governing-aim.md#settings-coverage-map with the complete production-source property population represented by the complete src/production.ts file. Verified relationship: The work-specific settings requirement allocation governs authoring completeness and is not serialized as a runtime production field.
 * @evidence settings/050-art-direction.md#art-delivery-review-condition Keeps
 *   the delivered frame grammar sized around the readable cue and formation.
 * @evidenceReview settings/050-art-direction.md#art-delivery-review-condition #04d2491 Read settings/050-art-direction.md#art-delivery-review-condition and production; confirmed its deterministic mode and 1280-by-720, 24 fps, sRGB frame format exactly serialize the declared final review condition.
 * @evidence settings/050-art-direction.md#art-palette Serializes the one
 *   shared primitive-3D palette and reserved subject accent.
 * @evidenceReview settings/050-art-direction.md#art-palette #d26ffe8 Compared settings/050-art-direction.md#art-palette with the complete src/production.ts file. Verified relationship: Serializes the one shared primitive-3D palette and reserved subject accent.
 * @evidence settings/050-art-direction.md#art-scale Serializes the 1.8 m
 *   human reference as the production-wide relative-scale grammar.
 * @evidenceReview settings/050-art-direction.md#art-scale #eebef5f Compared settings/050-art-direction.md#art-scale with the complete src/production.ts file. Verified relationship: Serializes the 1.8 m human reference as the production-wide relative-scale grammar.
 * @evidenceExclude settings/050-art-direction.md#art-effects-boundary Haze
 *   construction and use belong to plaza and opening-shot source, not the
 *   production design envelope.
 * @evidenceExcludeReview settings/050-art-direction.md#art-effects-boundary #e03b2d7 Compared settings/050-art-direction.md#art-effects-boundary with the complete production-source property population represented by the complete src/production.ts file. Verified relationship: Haze construction and use belong to plaza and opening-shot source, not the production design envelope.
 * @evidence settings/050-art-direction.md#art-audio-boundary Requires
 *   only the declared structural zero-gain audio output at production scope.
 * @evidenceReview settings/050-art-direction.md#art-audio-boundary #bcbbe3f Compared settings/050-art-direction.md#art-audio-boundary with the complete src/production.ts file. Verified relationship: Requires only the declared structural zero-gain audio output at production scope.
 * @evidenceExclude settings/010-soloist.md#soloist-identity-scale Subject
 *   scale is realized by the soloist model source, not this production record.
 * @evidenceExcludeReview settings/010-soloist.md#soloist-identity-scale #7a10a48 Read the soloist identity unit and production; confirmed Soloist owns its 1.8 m scale and this record publishes only the shared scale grammar.
 * @evidenceExclude settings/010-soloist.md#soloist-hand-capability Figure
 *   articulation is realized by model, motion, and shot sources.
 * @evidenceExcludeReview settings/010-soloist.md#soloist-hand-capability #d3c19de Read the hand-capability unit and production; confirmed the model, cue motion, and shots own it and production emits no articulation field.
 * @evidenceExclude settings/020-chorus.md#chorus-group-identity Formation
 *   identity is realized by the chorus model source.
 * @evidenceExcludeReview settings/020-chorus.md#chorus-group-identity #445f574 Read the chorus identity unit and production; confirmed Chorus owns rows, columns, and member scale while production emits only shared grammar.
 * @evidenceExclude settings/020-chorus.md#chorus-advance-capability Formation
 *   travel is realized by motion and shot sources.
 * @evidenceExcludeReview settings/020-chorus.md#chorus-advance-capability #64d9119 Read the advance unit and production; confirmed chorus motion and opening shot own the 2 m travel and production has no motion value.
 * @evidenceExclude settings/020-chorus.md#chorus-hold-capability Formation
 *   holding is realized by motion and shot sources.
 * @evidenceExcludeReview settings/020-chorus.md#chorus-hold-capability #b9504eb Read the hold unit and production; confirmed chorus hold motion and both shots own the fixed endpoint and production has no formation state.
 * @evidenceExclude settings/020-chorus.md#chorus-break-capability The unused
 *   reusable break belongs to formation and motion sources.
 * @evidenceExcludeReview settings/020-chorus.md#chorus-break-capability #9b04a80 Read the break unit and production; confirmed the reusable formation and motion owners expose it while production neither selects nor parameterizes it.
 * @evidenceExclude settings/030-gate.md#gate-identity Gate identity is
 *   realized by its model and answer-shot sources.
 * @evidenceExcludeReview settings/030-gate.md#gate-identity #cc8741b Compared settings/030-gate.md#gate-identity with the complete production-source property population represented by the complete src/production.ts file. Verified relationship: Gate identity is realized by its model and answer-shot sources.
 * @evidenceExclude settings/030-gate.md#gate-placement Gate placement is
 *   derived by its model and used by the answer shot.
 * @evidenceExcludeReview settings/030-gate.md#gate-placement #a2dfd9f Compared settings/030-gate.md#gate-placement with the complete production-source property population represented by the complete src/production.ts file. Verified relationship: Gate placement is derived by its model and used by the answer shot.
 * @evidenceExclude settings/030-gate.md#gate-hinge-capability Gate
 *   articulation is realized by its model source.
 * @evidenceExcludeReview settings/030-gate.md#gate-hinge-capability #18cef82 Read the hinge unit and production; confirmed PlazaGate owns the 0-to-100-degree interface and production exposes no prop articulation.
 * @evidenceExclude settings/040-plaza.md#plaza-ground Ground construction is
 *   realized by the plaza model source.
 * @evidenceExcludeReview settings/040-plaza.md#plaza-ground #6aa537d Compared settings/040-plaza.md#plaza-ground with the complete production-source property population represented by the complete src/production.ts file. Verified relationship: Ground construction is realized by the plaza model source.
 * @evidenceExclude settings/040-plaza.md#plaza-center The shared origin is
 *   realized by the plaza model and consumed by shots rather than serialized
 *   here.
 * @evidenceExcludeReview settings/040-plaza.md#plaza-center #1122438 Compared settings/040-plaza.md#plaza-center with the complete production-source property population represented by the complete src/production.ts file. Verified relationship: The shared origin is realized by the plaza model and consumed by shots rather than serialized here.
 * @evidenceExclude settings/040-plaza.md#plaza-background-role Background
 *   geometry and haze are realized by plaza and shot sources.
 * @evidenceExcludeReview settings/040-plaza.md#plaza-background-role #29cf787 Read the plaza background unit and production; confirmed Plaza and opening own ground and haze geometry while production owns only the clear-color grammar.
 * @evidence obligations/delivery/production-sources.md#settings-only-serialization Maps
 *   reviewed settings to a production design without creating story action.
 * @evidenceReview obligations/delivery/production-sources.md#settings-only-serialization #87e2574 Read obligations/delivery/production-sources.md#settings-only-serialization and production; confirmed every creative field maps to governing-aim or art-direction settings and no subject, action, or edit is implemented here.
 * @evidence obligations/delivery/production-sources.md#delivery-identity Emits one
 *   mutually consistent identity, runtime, format, mode, and output list.
 * @evidenceReview obligations/delivery/production-sources.md#delivery-identity #18c6107 Read obligations/delivery/production-sources.md#delivery-identity and production; confirmed identity, logline, runtime, format, deterministic mode, and required deliverables agree with the non-visual authored boundary while visual grammar remains separately owned.
 * @evidence obligations/delivery/production-sources.md#shared-visual-grammar Serializes
 *   only the authored production-wide palette, silhouette, scale, background,
 *   and deterministic fidelity values.
 * @evidenceReview obligations/delivery/production-sources.md#shared-visual-grammar #af7c4d8 Read obligations/delivery/production-sources.md#shared-visual-grammar and production; confirmed subject materials stay in model sources while this record faithfully serializes the shared palette, silhouette, scale, background, and deterministic fidelity tier without adding an aesthetic choice.
 * @evidence principles/core/source-units.md#source-scope-preservation production keeps responsibility for the exported production source owner and its declared value or behavior in this declaration; the implementation fragment { id: "{{name}}", /** * The starter is titled after itself. * * Derived rather than spelled out, because a title that repeated the name in * its own string would be introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete production declaration and implementation with the settings-owned identity, timing, frame, output, and runtime policy; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion production is a usable source artifact for the exported production source owner and its declared value or behavior; it is implemented directly as { id: "{{name}}", /** * The starter is titled after itself. * * Derived rather than spelled out, because a title that repeated the name in * its own string would be rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable production signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/delivery/production-sources.md#settings-revision-from-production-source-work Implementing production tested the settings-owned identity, timing, frame, output, and runtime policy through the exported production source owner and its declared value or behavior; the implementation fragment { id: "{{name}}", /** * The starter is titled after itself. * * Derived rather than spelled out, because a title that repeated the name in * its own string would be shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/delivery/production-sources.md#settings-revision-from-production-source-work #b78cab8 I compared the complete production implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
 */
export const production = {
  id: "{{name}}",
  /**
   * The starter is titled after itself.
   *
   * The starter has no title of its own yet, so it carries its own name. Give
   * the film a real title here the moment it has one; nothing downstream reads
   * this as an identity.
   */
  title: "{{name}}",
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
      "A 1.8 m soloist is the human reference for every metre-based represented extent.",
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
