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
   * `settings/000-governing-aim.md` is the first canon document, the one every
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
   * The bounded visual grammar, specified by `settings/050-art-direction.md`.
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
