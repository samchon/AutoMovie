# Diffusion Enhancement Handbook

Read this handbook only when production design declares visual delivery `repainted`. Diffusion is a structure-preserving visual rendition stage, not the source of geometry, event timing, continuity, physical truth, or review completion.

The boundary is worth stating plainly, because the temptation runs the other way every time a deterministic frame looks plain. Repaint does not generate the shot: subject placement, camera, contact, and timing were decided deterministically, and this stage may only re-dress them. It does not repair a defect, since a wrong contact, a missing prop, or a late reaction survives every prompt you write at it and returns in the next reroll. It does not complete a review. And it is not what a production gets by default; a design that never declares `repainted` never routes here, and delivering the deterministic output is a finished result rather than a missing feature.

## Choose the current method

AutoMovie runs no diffusion model of its own. The adapter is host-owned: it receives the verified deterministic frames, the authorized reference bytes, and the exact parameters, and it hands back encoded video with its provider, model, version, and execution boundary named. A host with no adapter configured gets a concrete provisioning script instead of a rendition, which is a configuration answer rather than a generation that failed.

Model quality, licensing, deployment, controls, and provider behavior change quickly. Before choosing an adapter, search current official model cards, documentation, license terms, supported control inputs, temporal consistency method, resolution and duration bounds, privacy or retention policy, and reproducibility limits. Record the evidence and date. Do not treat this handbook’s publication date or a remembered leaderboard as current SOTA.

Prefer a method that accepts:

- ordered deterministic video or frame input;
- the structural control passes this engine renders;
- fixed style and character references;
- explicit model/deployment version, seed, strength, and stable scalar parameters;
- full-shot temporal output at exact raster, frame rate, frame count, and duration.

Those structural passes are fixed vocabulary rather than a suggestion. They are `depth`, `mask`, `normal`, `outline`, and `pose` beside the shaded `beauty` pass, and that is the whole family. A model that names its own controls differently still has to be driven from these, because nothing else is captured to drive it with, and a control the shot never captured is a control the receipt cannot honestly claim.

The returned rendition is one encoded MP4 covering the interval. A directory of PNG frames or another container cannot be adopted however good it looks, so an adapter that only emits frames needs its own encode step before it hands anything back. A better-looking model that cannot bind identity, controls, provenance, or media facts is not a better production adapter.

## Prepare deterministic truth

Complete source, engine checks, acceptance, and the deterministic beauty/control render first. Inspect it. If subject count, pose, camera, contact, event order, screen direction, or timing is wrong, correct deterministic source and recapture. Do not ask a prompt to cover a structural defect.

Select style and character references from the current asset manifest. Use stable, representative views with known rights and explicit rendition-reference permission for the exact shot. Keep the same references, role, and identity across related shots unless art direction declares a change.

## Prompt and controls

Describe materials, texture, atmosphere, lighting character, lens character, palette, and rendering finish. Reinforce what must remain: subject identity and count, costume, silhouette, action, camera, layout, contacts, expression, screen direction, and event timing. Use a negative prompt for concrete failure modes, not a vast generic quality incantation.

Set structural strength high enough to preserve measured action and low enough to permit the declared appearance. Change one factor at a time. Keep seed and controls explicit.

The recorded parameters are a fixed shape rather than an open bag. The positive prompt is non-blank, the negative prompt is optional, the seed is required rather than optional, the structural strength is a finite number in the closed zero-to-one range, and any further adapter-specific control is a string, a number, or a boolean. A control that is not one of those scalars cannot be recorded, and a control that was not recorded did not happen as far as the next reader of the receipt is concerned.

## Evaluate the rendition

Compare deterministic and repainted output side by side through the full interval. Inspect:

- identity and costume consistency within and across shots;
- subject count, limbs, props, weapon orientation, and contact;
- camera path, framing, eyeline, and screen direction;
- temporal shimmer, texture crawl, background mutation, and exposure flicker;
- event and reaction timing;
- exact raster, clock, duration, frame count, codec, and output integrity.

The deterministic original remains the technical truth and its `shot` review must complete first. The repaint receives a separate `rendition` review because visual delivery changed. Open the exact `prepareReview.renditions[].path`, inspect the full interval, and cite that entry as `kind:"rendition"` evidence. Its output digest, canonical receipt digest, deterministic-source and source-review fingerprints, adapter identity, parameters, and fresh media probe are rechecked on submission; a deterministic frame cannot approve repainted appearance.

The same entry also carries the control frames the request was conditioned on and the references it was given, so the question "which pass and which reference produced this" is answered from the evidence rather than from memory of the call.

## Reroll discipline

Every reroll is a new output, even when prompt, references, and seed are unchanged. Provider or runtime changes may also alter it. A new output digest invalidates the rendition, sequence, and film reviews while leaving the unchanged deterministic source review current. Keep fixed style and character references across rerolls, compare failures, commit only one accepted provenance chain, and run the exact visual review chain again.

If current methods cannot preserve the required structure, deliver deterministic output or revise art direction. Never hide the limitation behind selective stills.
