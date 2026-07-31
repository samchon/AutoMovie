# Production Capture, Repaint, and Render

`captureFrame` is the MCP visual-evidence boundary; full feature rendering, chunk resume, audio mux, and delivery are repeatable CLI work.

A successful capture requires a current source compile, a project-fixed capture host, an exact frame clock, non-empty decodable PNG bytes, requested dimensions, and a content-addressed bundle manifest with an MCP-owned receipt. `captured:false` is not visual evidence. Width and height overrides may accelerate iteration, but required review frames must use the exact production raster.

Capture paths include the target-local generated/viewer/capture identity, validated structured browser/executable/platform/graphics identity, and render-spec fingerprint. The manifest also retains the aggregate compile fingerprint as provenance and records every frame index, rational time, guide pass, path, digest, and dimensions. A change that can alter this target's pixels, renderer, frame, or manifest makes old visual review stale; an unrelated shot-source edit does not discard still-current evidence.

`repaintShot` is optional and host-provisioned. It accepts only a current compiler-registry shot, verified beauty plus structural source passes, and byte-current style or character references from the asset manifest. AutoMovie parses the returned H.264 MP4 and atomically records the deterministic source fingerprint, controls, references, adapter/model identity, parameters, output digest, and media facts. A missing adapter or stale evidence is a refusal, never an invented rendition.

The full render command must atomically commit the active production's `.automovie/productions/<production>/render-manifest.json` and its renderer-owned v2 receipt after probing the actual outputs. Final compile reopens every file and independently decodes or parses it; filenames, MIME strings, declared codecs, hashes, and receipt metadata cannot substitute for current media bytes. A guide-pass deliverable owns one typed `pass`; it publishes one H.264 stream plus an exact continuous full-raster PNG control sequence for every final frame. Required WebVTT must contain ordered, syntactically valid, non-empty cues whose end times stay inside the production runtime.

Proxy publication is immutable under a fingerprint over compile, EDL, tier, runtime, chunks, and tracks. Final conform requires a proxy publication with the same compile and EDL fingerprints. Garbage collection ignores stale plans, refuses live render workers, revalidates physical ancestry, and quarantines each exact candidate before deletion.

Use beauty for appearance, depth for spatial separation, mask for identity and occlusion, normal for surface direction, pose for skeleton readability, and outline for silhouette. Capture the passes named by the shot contract and acceptance scenarios.

Do not send shell commands, arbitrary URLs, browser selectors, or evaluation code through MCP. The scaffold host owns browser, filesystem, and ffmpeg under a loopback-only project route.
