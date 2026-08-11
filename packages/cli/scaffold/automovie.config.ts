import type { AutoMovieCaptureBrowserConfig } from "./scripts/capture-browser";

/**
 * Viewer-host settings. Production ownership roots live only in the
 * authoritative `.automovie/manifest.json` read by the compiler and plugin.
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
    /**
     * Production-selected local dialogue source.
     *
     * This is an authored choice rather than host discovery. Change or remove
     * it deliberately; the render script never substitutes another provider,
     * model, revision, voice, device, or speed.
     */
    dialogueSynthesis: {
      provider: "kokoro-local-v1",
      model: "onnx-community/Kokoro-82M-v1.0-ONNX",
      modelRevision: "1939ad2a8e416c0acfeecc08a694d14ef25f2231",
      dtype: "q8",
      device: "cpu",
      voice: "af_heart",
      speed: 1,
    },
    /** Authored speaker identities joined to exact compiled actor nodes. */
    speakerBindings: [{ speaker: "soloist", actor: "soloist" }],
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
