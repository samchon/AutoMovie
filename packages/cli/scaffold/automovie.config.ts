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
  viewer: {
    host: "127.0.0.1",
    basePath: "/viewer/",
  },
} as const;
