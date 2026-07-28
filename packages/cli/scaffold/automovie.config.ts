/**
 * Viewer-host settings. Production ownership roots live only in the
 * authoritative `.automovie/manifest.json` read by the compiler and plugin.
 */
export default {
  capture: {
    browser: {
      source: "playwright-chromium",
    },
  },
  viewer: {
    host: "127.0.0.1",
    basePath: "/viewer/",
  },
} as const;
