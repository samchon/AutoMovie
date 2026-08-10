import type { IAutoMovieProductionDesign } from "@automovie/interface";

import config from "../automovie.config";

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
   * `docs/{{name}}/01-logline.md` is the root of the prose ladder and this is
   * the same sentence. It is copied rather than read, because reading it would
   * mean recovering one sentence out of a Markdown document by rule, and a rule
   * that guesses which sentence is the logline is a second author.
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
   * What this production is willing to draw, per render tier.
   *
   * The tier names are the ones a render job targets, because a budget filed
   * under a name no job asks for is a limit that never runs. The proxy pass is
   * the one an author looks at all day, so it is the tighter of the two; the
   * final pass is allowed the textures and lights the proxy does without.
   *
   * These are this starter's numbers, not the engine's: nothing ships preset
   * tiers, and a production that deletes this field is measured and reported
   * without a verdict rather than judged against a number it never chose.
   */
  renderBudgets: [
    {
      version: 1,
      tier: "proxy",
      limits: {
        triangles: 400_000,
        drawCalls: 128,
        materials: 32,
        textures: 16,
        lights: 8,
        shadowMaps: 4,
      },
    },
    {
      version: 1,
      tier: "final",
      limits: {
        triangles: 2_000_000,
        drawCalls: 512,
        materials: 64,
        textures: 64,
        lights: 16,
        shadowMaps: 8,
      },
    },
  ],
  /**
   * The bounded visual grammar, specified by `docs/art-direction.md`.
   *
   * Palette and scale rules live here rather than inside a subject because they
   * are decisions about the film: a subject picks its color out of this list,
   * and a list assembled from whatever the subjects happen to be painted would
   * be a palette that can never be violated.
   */
  artDirection: {
    style: "primitive-3d",
    palette: ["#182235", "#d7b56d", "#b13f36"],
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
