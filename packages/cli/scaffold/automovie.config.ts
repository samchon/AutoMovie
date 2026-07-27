/**
 * Viewer-host settings. Production ownership roots live only in the
 * authoritative `.automovie/manifest.json` read by the compiler and plugin.
 */
export default {
  viewer: {
    host: "127.0.0.1",
    basePath: "/viewer/",
  },
} as const;
