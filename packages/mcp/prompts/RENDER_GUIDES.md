# Render & Guide Passes

AutoMovie's render output is the deterministic control layer a diffusion pass follows — motion, depth, silhouettes, pose hints — not the final image. Same input, same frames, every time.

## planRender

`planRender` turns a committed shot or the committed film into a deterministic render plan: exact rational frame times (`t = i/fps`, never accumulated), frame paths, and the ffmpeg argument vector. Request `passes` to plan guide-pass outputs alongside the beauty frames.

## Guide Passes

Five passes, each a reversible viewer override applied at capture time (the engine result is never mutated):

- `beauty` — the plain render (untagged frame names, byte-compatible with plain plans).
- `depth` — depth-to-grayscale (a depth-material swap).
- `mask` — per-node flat colors on black: a segmentation map (deterministic golden-angle palette).
- `outline` — a normal-material pass as the edge source (line extraction is host post-processing).
- `pose` — meshes hidden, bone→child-bone line overlay: the skeleton hint pass.

Pass-tagged frames insert the pass name before the extension (`frame_00042.depth.png`), so per-pass sequences coexist in one frame directory.

## seeFrame

`seeFrame` plans one frame+pass and hands the request to a **host-injected capture adapter**; it returns the real image, or an honest `status: "no-capture-adapter"` when the host attached none. Adapter failures propagate as tool errors. The server plans and validates; pixels belong to the adapter. Use it as your eyes in the review loop: sample the frames a verdict depends on instead of imagining them.

## Long Timelines

A long film renders in bounded, independently-renderable chunks (frame-atomic boundaries — no frame duplicated or dropped; a transition straddling a boundary keeps each frame's exact blend), reassembled losslessly by an ffmpeg concat plan. A single chunk re-renders frame-identical to the same frames of the whole, so you regenerate one shot's window without touching the rest.
