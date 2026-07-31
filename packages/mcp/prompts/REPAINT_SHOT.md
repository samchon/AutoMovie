# `repaintShot` Contract

Read this guide and `DIFFUSION_ENHANCE` before `repaintShot`. This optional tool is routed only when production design declares visual delivery `repainted`. Deterministic source remains the technical truth; repaint is a separately reviewed visual delivery layer.

## Preconditions

- The shot exists in the current compiler registry.
- A current deterministic render bundle covers the complete shot frame grid in beauty and required structural passes. One attractive still is insufficient for a video rendition.
- Every style or character reference is a current asset-manifest entry authorized for this shot as a rendition reference.
- The host has an explicit local or API repaint adapter. The server never fabricates output when one is absent.

## Request

Name the exact `productionId` and `shot`. Lock references by role and project-relative manifest path. Supply a non-blank positive prompt, explicit integer seed, structural-preservation `strength` in `[0, 1]`, and only stable scalar adapter controls. A negative prompt is optional.

The prompt describes appearance while preserving registered subjects, camera, motion, contacts, event timing, screen direction, and required frame content. Do not ask diffusion to repair a deterministic geometry or continuity defect; correct source and recapture first.

## Success evidence

`repainted:true` means output media was parsed, matched exact shot raster, clock, runtime and frame count, and committed atomically together with the shot's active-rendition pointer. Older content-addressed outputs may remain for provenance, but only the active receipt enters review. The receipt binds:

- compiler and deterministic source-render fingerprints;
- ordered beauty source bundle and structural control-frame digests;
- fixed style and character reference digests;
- adapter provider, model, version, and execution identity;
- exact prompt, seed, strength, and controls;
- content-addressed output path, byte digest, length, and parsed media facts.

Open and watch the committed MP4 itself, then prepare the addressed shot, sequence, or film review. For repainted delivery, `prepareReview.renditions` returns the current output path, output and receipt digests, deterministic-source fingerprint, structural controls, fixed references, adapter identity, parameters, and freshly parsed media facts. Cite that exact `kind:"rendition"` evidence when judging repainted appearance. A deterministic PNG review does not automatically approve its rendition.

## Refusal catalog

- Host unavailable: follow the diagnostic provisioning contract; do not claim a rendition.
- Source unavailable or incomplete: capture the full deterministic beauty/control grid.
- Reference invalid: register and authorize the exact current bytes for this shot.
- Input raced: source, manifest, or reference identity changed during adapter execution. Discard output and prepare again.
- Output invalid: reject wrong media, raster, duration, frame count, or runtime facts.
- Commit refusal: no accepted receipt exists; resolve the named provenance disagreement.

Every reroll changes output identity and requires a new visual review, even with the same seed or prompt.
