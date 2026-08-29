import type { IAutoMovieProductionConfiguration } from "./scripts/productionConfiguration";

/**
 * The production's authored delivery decisions, serialized for the runtime.
 *
 * Every value here changes delivered pixels, delivered sound, external rights,
 * runtime cost, or the meaning of a review, and each one answers to a reviewed
 * settings, research, or design H2 that owns it. Host facts do not belong here:
 * the production namespace is derived from `package.json`, and the capture
 * browser and local viewer server are host boundaries selected on the invoking
 * command (see `scripts/projectIdentity.ts` and `scripts/hostBoundary.ts`).
 */
export default {
  render: {
    /**
     * Authored review delivery. Its scale and frame decimation implement the
     * settings delivery-review condition; they are not viewer wiring.
     */
    proxy: {
      kind: "proxy",
      resolutionScale: 0.5,
      frameStep: 2,
    },
    /**
     * Authored final delivery. Keep this choice aligned with the production's
     * declared fidelity and delivery owner before publishing.
     */
    final: {
      kind: "final",
      resolutionScale: 1,
      frameStep: 1,
    },
  },
  visual: {
    /**
     * Select this only for a settings-owned repainted delivery. The generator
     * records its exact runtime, source, rights, terms, cost, and consumer;
     * the execution policy bounds retries, time, and cost; each request retains
     * exact prompt, continuity, settings, design, screenplay or brief, and shot
     * owners. Resolve selectionReview by shot from repaintSelectionReviews.ts;
     * leave the entry absent until a candidate exists, then bind the
     * post-playback review to its exact attempt id and output digest before an
     * explicit selection or reversal.
     * Prompt, seed, strength, controls, references, policy, and review never
     * enter through an ephemeral command-line override.
     */
    repaint: null,
  },
  sound: {
    /**
     * Add an explicit provider/model/revision/voice selection and its source,
     * license, reviewed terms, cost basis, and reasoned consumer when synthesis
     * exists.
     */
    dialogueSynthesis: null,
    /**
     * Join a screenplay speaker to the exact settings-subject id serialized as
     * its compiled actor. Off-screen audible identities have no mouth binding.
     */
    speakerBindings: [],
  },
  simulation: {
    /**
     * Soft-body domain ids explicitly admitted to moving-anchor/body-capsule
     * solves. The list order is the reported production budget order. It must
     * exactly equal the moving-boundary domain ids compiled across the work;
     * an omitted domain and a selected static domain are both refused.
     */
    liveWearableSoftBodies: [],
  },
} as const satisfies IAutoMovieProductionConfiguration;
