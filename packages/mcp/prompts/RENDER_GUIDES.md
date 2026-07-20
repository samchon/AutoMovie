# Render & Guide Passes

AutoMovie's render output is the deterministic control layer a diffusion pass follows (motion, depth, silhouettes, pose hints), not the final image. Same input, same frames, every time.

## planRender

`planRender` turns a committed shot or the committed film into a deterministic render plan: exact rational frame times (`t = i/fps`, never accumulated), frame paths, and the ffmpeg argument vector, which pins the encoded frame to `spec.frameFormat.width`x`height` (`-s`), so the video is that size on every host. Both dimensions must be **even** whole numbers: `yuv420p` can only encode even axes, so an odd or fractional value is rejected up front rather than silently rounded. Keep the `{fps,width,height}` object as one `frameFormat` value and reuse that exact value for the caption and pose-keypoint sidecars. Request `passes` to plan guide-pass outputs alongside the beauty frames.

Like every stateful tool, `planRender` (and `seeFrame`) is resident-or-explicit: **omit `slate`** and it plans the resident project, so a two-hour film never re-sends its whole state to plan a render. Resident plans default their frame and video paths into the project's `renders/` directory (an explicit `frameDir`/`outputPath` still overrides); an explicit slate keeps the legacy `frames/<stem>` paths. Byte-writing stays the host adapter's job. Track written outputs with `registerAsset` if you want them in the manifest.

## Guide Passes

Six passes, each a reversible viewer override applied at capture time (the engine result is never mutated):

- `beauty`: the plain render (untagged frame names, byte-compatible with plain plans).
- `depth`: depth-to-grayscale on a scene-stable metric range (same world depth, same gray, across shots).
- `mask`: per-node flat colors on black, a segmentation map (deterministic golden-angle palette).
- `normal`: the unlit surface-normal render, the normal-map hint.
- `outline`: real white silhouette edges on black (inverted-hull contour), the line hint, no post-processing.
- `pose`: meshes hidden, bone→child-bone line overlay, the skeleton hint pass.

Pass-tagged frames insert the pass name before the extension (`frame_00042.depth.png`), so per-pass sequences coexist in one frame directory.

## seeFrame

`seeFrame` plans one frame+pass and hands the request to a **host-injected capture adapter**; it returns the real image, or an honest `status: "no-capture-adapter"` when the host attached none. Adapter failures propagate as tool errors. The server plans and validates; pixels belong to the adapter. Use it as your eyes in the review loop: sample the frames a verdict depends on instead of imagining them.

## Long Timelines: planChunkedRender

`planChunkedRender` splits the committed film into `chunkFrames`-sized, independently-renderable chunks so a two-hour render is produced in bounded windows and regenerated one window at a time. Boundaries are **frame-atomic** (no frame duplicated or dropped, a transition straddling a boundary keeps each frame's exact blend), so concatenating the chunks (via the returned `reassembly` ffmpeg concat plan) reproduces the whole render, and re-rendering a single chunk is frame-identical to the same frames of the whole. Request `passes` to plan each chunk's guide-pass outputs; tagged passes terminate as frame sequences (`passManifests` gives their whole-timeline walk order), while `beauty` reassembles as video. Resident-or-explicit like `planRender`; the target must be the film (a single shot renders whole via `planRender`).

## Captions: planCaptions

`planCaptions` plans the caption sidecar: the per-shot diffusion-prompt track a render host reads beside the guide frames. Pass the exact `frameFormat` object nested in the companion render spec; the shared object makes its output clock and pixel geometry one contract instead of separately restated scalars. It resolves which beat's shot is live at every output frame and joins each span to the screenplay's caption and scene slug. Pass `chunkFrames` to also get one chunk-local sidecar per render chunk, aligned with `planChunkedRender`'s windows, so each chunk carries its own caption track. Resident-or-explicit; the committed script and film supply the captions and the cut.

## Camera Intent & Coverage

The performed shot carries two pieces of structural camera metadata beside the frames. `cameraIntent` records each frame span's directorial intent: framing, move, the resolved world focus point, and the focal-length intent in millimetres. It is intent, not optics: the scene camera's `fovY` stays the geometric truth, and depth-of-field blur is the diffusion pass's job, never simulated here. `coverage` is the multi-angle companion: one entry per alternate camera take of the beat, each pairing a staged camera with its own compiled move (the same framing grammar as the hero take) and its own per-span intent. Read both beside the guide frames: render the hero take as planned, or cut to a coverage angle of the same performed beat without re-performing it.

## Pose Keypoints: planPoseKeypoints

`planPoseKeypoints` plans the numeric companion to the `pose` pass: a per-frame OpenPose-style sidecar giving each named joint's projected 2D frame position (and whether it is in frame), the exact data an OpenPose ControlNet reads beside the rendered pose guide. Pass the exact `frameFormat` object nested in the companion render spec. The keypoints project through its `width/height` camera aspect and sample on its `fps` clock, while the render pins captured and encoded frames to those same even dimensions; reusing the object holds the sidecar on the guide pixels by construction. Motions are derived, never stored, so supply the `motions` registry the shots reference and the `skeletons` they target, exactly as `commitShot` does. Resident-or-explicit; deterministic (same inputs, byte-identical sidecar).
