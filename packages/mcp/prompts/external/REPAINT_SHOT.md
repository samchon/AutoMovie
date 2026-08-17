# `repaintShot` Contract

Read this guide and `DIFFUSION_ENHANCE` before `repaintShot`. This optional tool is routed only when production design declares visual delivery `repainted`. Deterministic source remains the technical truth; repaint is a separately reviewed visual delivery layer.

## Preconditions

- The production's tracked design declares visual delivery `repainted`. A production still on `deterministic` is refused as soon as its design is read, before any source, review, reference, or adapter is inspected. Changing that contract means recompiling current source, and only then does this tool also demand session credit for `DIFFUSION_ENHANCE`.
- Source compiles cleanly and the shot exists in the current compiler registry.
- One current deterministic render bundle covers the whole shot frame grid twice over. The grid is the shot's `durationSeconds` times the production `fps`, rounded, indexed from zero; `beauty` is required at every index, and at least one structural pass has to be complete across the same indices. A four-second shot at 24fps is therefore 96 beauty captures plus 96 control captures of one chosen pass before this tool will run, and half a grid of `depth` beside half a grid of `outline` satisfies neither. One attractive still is insufficient for a video rendition.
- The deterministic `shot` review is current and complete. Repaint binds that exact source-review fingerprint and refuses to run when it changes.
- At least one style or character reference is supplied, and every reference is a current asset-manifest entry authorized for this shot as a rendition reference. A reference the manifest generated rather than fetched carries the extra rule that a `reproducible` claim requires the seed that reproduces it; that one is refused at compile as incomplete provenance, so it reaches repaint as a stale compile rather than as a reference diagnostic. `ASSET_SOURCING` owns that ledger.
- The host has an explicit local or API repaint adapter. The server never fabricates output when one is absent.

## Request

Name the exact `productionId` and `shot`. Lock references by role and project-relative manifest path. Supply a non-blank positive prompt, explicit safe-integer seed, structural-preservation `strength` in `[0, 1]`, and only stable finite scalar adapter controls. A negative prompt is optional.

The prompt describes appearance while preserving registered subjects, camera, motion, contacts, event timing, screen direction, and required frame content. Do not ask diffusion to repair a deterministic geometry or continuity defect; correct source and recapture first.

## Success evidence

`repainted:true` means output media was parsed, matched exact shot raster, rational clock, runtime and frame count, proved conformable without decoding or changing its reviewed presentation, and committed atomically together with the shot's active-rendition pointer. Older content-addressed outputs may remain for provenance, but only the active receipt enters review. The receipt binds:

- compiler, deterministic source-render, and completed source-shot review fingerprints;
- ordered beauty source bundle and structural control-frame digests;
- fixed style and character reference digests;
- adapter provider, model, version, and execution identity;
- exact prompt, seed, strength, and controls;
- the attempt id AutoMovie generated for this invocation, plus content-addressed output path, byte digest, length, and parsed media facts.

Open and watch the committed MP4 itself, then prepare `target:{kind:"rendition",id:<shot>}`. This independent worksheet returns the current output path, output and receipt digests, deterministic-source and source-review fingerprints, structural controls, fixed references, adapter identity, parameters, and freshly parsed media facts. Cite that exact `kind:"rendition"` evidence. Only after each rendition review completes should sequence and film review approve the selected cross-shot result. Film review also preflights the current cut, decoder configuration, and selected clip presentation before it can complete.

## Refusal catalog

- Delivery disabled: the tracked production design still says `deterministic`. Change that contract and recompile; do not route around it.
- Host unavailable: follow the diagnostic provisioning contract; do not claim a rendition.
- Compile stale, registry unavailable, or shot absent: correct and compile current source before sending anything to an adapter.
- Request incomplete: a blank prompt, a seed that is not a safe integer, a `strength` outside `[0, 1]`, a non-finite control, or an empty reference list is refused as invalid input, not as a missing capability.
- Source unavailable or incomplete: capture the full deterministic beauty/control grid described above.
- Source review incomplete or stale: complete the current deterministic `shot` review before sending pixels to an adapter.
- Reference invalid: register and authorize the exact current bytes for this shot.
- Input raced: source, manifest, or reference identity changed during adapter execution. Discard output and prepare again.
- Output invalid: reject wrong media, raster, duration, frame count, runtime, decoder configuration, or presentation facts.
- Commit refusal: no accepted receipt exists; resolve the named provenance disagreement.

Every reroll changes output identity and requires a new visual review, even with the same seed or prompt.

## The rendition owes its own review

An adopted rendition never inherits the deterministic shot's verdict. Complete the `shot` review first, because a repaint of a shot nobody accepted is a repaint of an unaccepted shot.

Then run `prepareReview` and `submitReview` on the `rendition` target under `REVIEW_SHOT`. Every reroll changes output identity and stales that review, so the last rendition anybody looked at is the only one the film may ship.
