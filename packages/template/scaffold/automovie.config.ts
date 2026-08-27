import type { AutoMovieCaptureBrowserConfig } from "./scripts/capture-browser";
import type { IAutoMovieProductionConfiguration } from "./scripts/productionConfiguration";

/**
 * Viewer-host settings. Production ownership roots are the harness's fixed
 * layout rather than a project declaration, so they are not restated here.
 */
export default {
  /** Stable production namespace selected by project scripts. */
  productionId: "{{name}}",
  capture: {
    browser: {
      source: "playwright-chromium",
    } satisfies AutoMovieCaptureBrowserConfig,
  },
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
     * each request mechanically serializes reviewed settings and design owners
     * for one compiled shot. Prompt, seed, strength, controls, and references
     * never enter through an ephemeral command-line override.
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
  viewer: {
    host: "127.0.0.1",
    basePath: "/viewer/",
  },
} as const satisfies IAutoMovieProductionConfiguration;
