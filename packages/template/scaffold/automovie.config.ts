import type { AutoMovieCaptureBrowserConfig } from "./scripts/capture-browser";

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
    proxy: {
      kind: "proxy",
      resolutionScale: 0.5,
      frameStep: 2,
    },
    final: {
      kind: "final",
      resolutionScale: 1,
      frameStep: 1,
    },
  },
  sound: {
    /** Add an explicit provider/model/revision/voice choice when dialogue exists. */
    dialogueSynthesis: null,
    /** Add authored speaker-to-actor identities when dialogue exists. */
    speakerBindings: [],
  },
  simulation: {
    /**
     * Soft-body domain ids explicitly admitted to moving-anchor/body-capsule
     * solves. The list order is the reported subject budget order; an omitted
     * moving domain is never selected or rendered as a static substitute.
     */
    liveWearableSoftBodies: [],
  },
  viewer: {
    host: "127.0.0.1",
    basePath: "/viewer/",
  },
} as const;
