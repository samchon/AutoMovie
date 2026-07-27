# Production Preview and Render

`previewFrame` is the MCP visual oracle; full feature rendering, chunk resume, audio mux, and delivery are repeatable CLI work.

A successful preview requires a current source compile, a project-fixed capture host, an exact frame clock, non-empty decodable PNG bytes, requested dimensions, and a content-addressed bundle manifest. `captured:false` is not visual evidence.

Preview paths include target, compile fingerprint, and render-spec fingerprint. The manifest records every frame index, rational time, guide pass, path, digest, and dimensions. A source, design, compile, frame, or manifest change makes old visual review stale.

Use beauty for appearance, depth for spatial separation, mask for identity and occlusion, normal for surface direction, pose for skeleton readability, and outline for silhouette. Capture the passes named by the shot contract and acceptance scenarios.

Do not send shell commands, arbitrary URLs, browser selectors, or evaluation code through MCP. The scaffold host owns browser, filesystem, and ffmpeg under a loopback-only project route.
