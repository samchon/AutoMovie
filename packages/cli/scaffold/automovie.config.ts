/** Project-owned production paths and loopback viewer settings. */
export default {
  sourceRoots: ["src"],
  generatedRoot: "generated",
  renderRoot: "renders",
  viewer: {
    host: "127.0.0.1",
  },
} as const;
