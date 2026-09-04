import * as THREE from "three";

import { disposeCrossDissolve } from "./applyDissolve";
import { disposeFadeToBlack } from "./applyFade";

/**
 * Release a viewer's renderer AND the auxiliary GPU state frames created for
 * it: today the cross-dissolve FBO/quad, which #1050 gave a dispose that
 * nothing wired (#1090). `mountViewer`'s `stop()` calls this; a host that owns
 * its renderer directly (a capture harness) calls it the same way. Idempotent
 * and safe when no dissolve ever ran.
 *
 * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-lifecycle Releases the renderer and every viewer-owned auxiliary resource together.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Implements explicit acquisition and release for viewer runtime resources.
 */
export const releaseViewerRenderer = (renderer: THREE.WebGLRenderer): void => {
  disposeCrossDissolve(renderer);
  disposeFadeToBlack(renderer);
  renderer.dispose();
};

/**
 * Handle returned by {@link mountViewer}; call `stop()` to end the loop and
 * release the renderer, including any dissolve GPU state the frames created.
 *
 * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-lifecycle Exposes the mounted renderer and its matching release operation.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Keeps viewer runtime ownership and cleanup explicit.
 * @author Samchon
 */
export interface IAutoMovieViewerHandle {
  /**
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-lifecycle Identifies the renderer resource owned by this viewer handle.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Keeps the runtime resource inside its explicit ownership boundary.
   */
  renderer: THREE.WebGLRenderer;
  /**
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-lifecycle Releases the loop and every resource owned by this handle.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Closes the viewer's explicit runtime ownership boundary.
   */
  stop: () => void;
}

/**
 * Mount a render loop onto a canvas: create a `WebGLRenderer`, drive
 * `onFrame(elapsedSeconds)` each animation frame, then render `scene` from
 * `camera`.
 *
 * This is the one browser-only entry point. `onFrame` is where a
 * {@link AutoMoviePlayer} advances: the viewer stays a thin shell around the
 * deterministic engine. `elapsedSeconds` is measured from the first frame. If
 * `onFrame` returns `true` it has **already drawn** the frame itself (e.g. a
 * multi-pass cross-dissolve composite), so the loop skips its own default
 * `render`; returning `void`/`false` keeps the plain single-pass render.
 *
 * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-lifecycle Owns the browser renderer and animation loop until the returned handle releases them.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Keeps that interactive runtime state inside one explicit viewer lifecycle.
 * @evidenceExclude requirements/acceptance/approval-exceptions-and-publication.md The viewer presents resolved frames; approval authority, exceptions, and publication decisions remain in review and production orchestration.
 * @evidenceExclude requirements/acceptance/case-matrix-and-counterexamples.md The viewer presents resolved frames; approval authority, exceptions, and publication decisions remain in review and production orchestration.
 * @evidenceExclude requirements/acceptance/change-regression-and-revalidation.md The viewer presents resolved frames; approval authority, exceptions, and publication decisions remain in review and production orchestration.
 * @evidenceExclude requirements/acceptance/criteria-and-observables.md The viewer presents resolved frames; approval authority, exceptions, and publication decisions remain in review and production orchestration.
 * @evidenceExclude requirements/acceptance/evidence-and-freshness.md The viewer presents resolved frames; approval authority, exceptions, and publication decisions remain in review and production orchestration.
 * @evidenceExclude requirements/acceptance/profiles-and-aggregation.md The viewer presents resolved frames; approval authority, exceptions, and publication decisions remain in review and production orchestration.
 * @evidenceExclude requirements/acceptance/README.md The viewer presents resolved frames; approval authority, exceptions, and publication decisions remain in review and production orchestration.
 * @evidenceExclude requirements/acceptance/review-surfaces-and-sampling.md The viewer presents resolved frames; approval authority, exceptions, and publication decisions remain in review and production orchestration.
 * @evidenceExclude requirements/acceptance/scope-targets-and-authority.md The viewer presents resolved frames; approval authority, exceptions, and publication decisions remain in review and production orchestration.
 * @evidenceExclude requirements/acceptance/tolerances-and-boundaries.md The viewer presents resolved frames; approval authority, exceptions, and publication decisions remain in review and production orchestration.
 * @evidenceExclude requirements/acceptance/uncertainty-and-partial-success.md The viewer presents resolved frames; approval authority, exceptions, and publication decisions remain in review and production orchestration.
 * @evidenceExclude requirements/actors/appearance-costume-and-attachments.md The viewer performs compiled actor state; casting, identity, costume, and performance-authoring decisions remain upstream.
 * @evidenceExclude requirements/actors/body-scale-and-landmarks.md The viewer performs compiled actor state; casting, identity, costume, and performance-authoring decisions remain upstream.
 * @evidenceExclude requirements/actors/inputs-selection-and-replacement.md The viewer performs compiled actor state; casting, identity, costume, and performance-authoring decisions remain upstream.
 * @evidenceExclude requirements/actors/performance-and-story-binding.md The viewer performs compiled actor state; casting, identity, costume, and performance-authoring decisions remain upstream.
 * @evidenceExclude requirements/actors/populations-and-doubles.md The viewer performs compiled actor state; casting, identity, costume, and performance-authoring decisions remain upstream.
 * @evidenceExclude requirements/actors/pose-expression-and-gaze.md The viewer performs compiled actor state; casting, identity, costume, and performance-authoring decisions remain upstream.
 * @evidenceExclude requirements/actors/README.md The viewer performs compiled actor state; casting, identity, costume, and performance-authoring decisions remain upstream.
 * @evidenceExclude requirements/actors/representation-tiers-and-fidelity-boundary.md The viewer performs compiled actor state; casting, identity, costume, and performance-authoring decisions remain upstream.
 * @evidenceExclude requirements/actors/scope-and-identity.md The viewer performs compiled actor state; casting, identity, costume, and performance-authoring decisions remain upstream.
 * @evidenceExclude requirements/actors/skeleton-rig-and-retargeting.md The viewer performs compiled actor state; casting, identity, costume, and performance-authoring decisions remain upstream.
 * @evidenceExclude requirements/actors/state-and-continuity.md The viewer performs compiled actor state; casting, identity, costume, and performance-authoring decisions remain upstream.
 * @evidenceExclude requirements/actors/validation.md The viewer performs compiled actor state; casting, identity, costume, and performance-authoring decisions remain upstream.
 * @evidenceExclude requirements/actors/voice-and-utterance-identity.md The viewer performs compiled actor state; casting, identity, costume, and performance-authoring decisions remain upstream.
 * @evidenceExclude requirements/agent-authoring/capability-discovery.md The viewer consumes compiled artifacts; agent instructions, authoring workflow, and source ownership remain outside this runtime.
 * @evidenceExclude requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-closed-basis The viewer mounts already-compiled scene data for playback; it runs no generator, seals no basis, refuses no stale artifact, publishes no derived bytes, and holds no provenance ledger.
 * @evidenceExclude requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-compile-refusal The viewer mounts already-compiled scene data for playback; it runs no generator, seals no basis, refuses no stale artifact, publishes no derived bytes, and holds no provenance ledger.
 * @evidenceExclude requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-explicit-generation The viewer mounts already-compiled scene data for playback; it runs no generator, seals no basis, refuses no stale artifact, publishes no derived bytes, and holds no provenance ledger.
 * @evidenceExclude requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-portable-publication The viewer mounts already-compiled scene data for playback; it runs no generator, seals no basis, refuses no stale artifact, publishes no derived bytes, and holds no provenance ledger.
 * @evidenceExclude requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-provenance-separation The viewer mounts already-compiled scene data for playback; it runs no generator, seals no basis, refuses no stale artifact, publishes no derived bytes, and holds no provenance ledger.
 * @evidenceExclude requirements/agent-authoring/knowledge-boundary.md The viewer consumes compiled artifacts; agent instructions, authoring workflow, and source ownership remain outside this runtime.
 * @evidenceExclude requirements/agent-authoring/partial-work.md The viewer consumes compiled artifacts; agent instructions, authoring workflow, and source ownership remain outside this runtime.
 * @evidenceExclude requirements/agent-authoring/project-ownership.md The viewer consumes compiled artifacts; agent instructions, authoring workflow, and source ownership remain outside this runtime.
 * @evidenceExclude requirements/agent-authoring/README.md The viewer consumes compiled artifacts; agent instructions, authoring workflow, and source ownership remain outside this runtime.
 * @evidenceExclude requirements/agent-authoring/roles-and-authorities.md The viewer consumes compiled artifacts; agent instructions, authoring workflow, and source ownership remain outside this runtime.
 * @evidenceExclude requirements/agent-authoring/source-owned-loop.md The viewer consumes compiled artifacts; agent instructions, authoring workflow, and source ownership remain outside this runtime.
 * @evidenceExclude requirements/asset-authoring/era-and-style.md The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-bounded-decoder The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-adoption-mode The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-conversion-receipt The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-gltf-scene The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-group-composition The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-provenance-digest The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-replacement The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-resource-closure The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-secret-boundary The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/geometry.md The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/identity-and-instances.md The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/materials-and-textures.md The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/patterns-and-procedural-composition.md The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/README.md The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/asset-authoring/validation.md The viewer materializes compiled assets; authoring, validation, provenance, and refusal remain upstream.
 * @evidenceExclude requirements/building-exterior/balconies-terraces-and-courtyards.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/building-integrated-water.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/coordinates-and-shared-boundaries.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/deliverables.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/existing-phases-and-alternatives.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/external-assets-and-placement.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/external-circulation-and-attached-elements.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/facades-and-walls.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/lighting-and-optics.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/massing-area-and-height.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/materials-and-assemblies.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/openings-and-fenestration.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/patterns-and-instances.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/README.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/representations-lod-and-fidelity.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/roofs-and-rooftops.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/scope-and-building-identity.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/services-and-envelope-interfaces.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/site-placement-and-orientation.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/storeys-levels-and-heights.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/structure-and-envelope.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/validation-and-interior-consistency.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/building-exterior/weather-drainage-and-temporal-state.md The viewer draws compiled building geometry; envelope authoring, validation, and construction semantics remain upstream.
 * @evidenceExclude requirements/camera/axis-eyeline-and-screen-direction.md The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clearance The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-dynamic-spatial-sampling The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-intended-obstruction The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-obstruction-contract The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-occlusion-metric The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-spatial-alternatives The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-spatial-geometry-revision The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/continuity-and-intentional-violations.md The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/framing-and-shot-size.md#camera-framing-source-trace The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/framing-and-shot-size.md#camera-landmark-framing The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/framing-and-shot-size.md#camera-headroom-lead-room The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/framing-and-shot-size.md#camera-multi-subject-composition The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/framing-and-shot-size.md#camera-framing-range The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/framing-and-shot-size.md#camera-intentional-crop The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/position-and-movement.md The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/projection-lens-and-sensor.md#camera-aperture-distinction The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/projection-lens-and-sensor.md#camera-gate-offset The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/projection-lens-and-sensor.md#camera-lens-character The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/projection-lens-and-sensor.md#camera-optical-conventions The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/projection-lens-and-sensor.md#camera-optical-refusal The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/projection-lens-and-sensor.md#camera-orthographic-scale The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/projection-lens-and-sensor.md#camera-projection-time-sampling The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/projection-lens-and-sensor.md#camera-sensor-gate-fit The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/README.md The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/scope-and-identity.md The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/shutter-exposure-and-sampling.md The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/targets-focus-and-depth-boundary.md The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/camera/validation.md The viewer applies resolved camera state; camera authorship, analysis, and constraint refusal remain upstream.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-description-and-alternatives.md The viewer projects frames; encoding, packaging, accessibility policy, and delivery acceptance remain in the render and publication lanes.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-streams-and-channels.md The viewer projects frames; encoding, packaging, accessibility policy, and delivery acceptance remain in the render and publication lanes.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md The viewer projects frames; encoding, packaging, accessibility policy, and delivery acceptance remain in the render and publication lanes.
 * @evidenceExclude requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md The viewer projects frames; encoding, packaging, accessibility policy, and delivery acceptance remain in the render and publication lanes.
 * @evidenceExclude requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md The viewer projects frames; encoding, packaging, accessibility policy, and delivery acceptance remain in the render and publication lanes.
 * @evidenceExclude requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md The viewer projects frames; encoding, packaging, accessibility policy, and delivery acceptance remain in the render and publication lanes.
 * @evidenceExclude requirements/delivery-and-accessibility/localization-and-language-versions.md The viewer projects frames; encoding, packaging, accessibility policy, and delivery acceptance remain in the render and publication lanes.
 * @evidenceExclude requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md The viewer projects frames; encoding, packaging, accessibility policy, and delivery acceptance remain in the render and publication lanes.
 * @evidenceExclude requirements/delivery-and-accessibility/picture-color-and-image-sequences.md The viewer projects frames; encoding, packaging, accessibility policy, and delivery acceptance remain in the render and publication lanes.
 * @evidenceExclude requirements/delivery-and-accessibility/publication-and-retention.md The viewer projects frames; encoding, packaging, accessibility policy, and delivery acceptance remain in the render and publication lanes.
 * @evidenceExclude requirements/delivery-and-accessibility/README.md The viewer projects frames; encoding, packaging, accessibility policy, and delivery acceptance remain in the render and publication lanes.
 * @evidenceExclude requirements/delivery-and-accessibility/scope-and-profiles.md The viewer projects frames; encoding, packaging, accessibility policy, and delivery acceptance remain in the render and publication lanes.
 * @evidenceExclude requirements/delivery-and-accessibility/validation.md The viewer projects frames; encoding, packaging, accessibility policy, and delivery acceptance remain in the render and publication lanes.
 * @evidenceExclude requirements/diagnostics/budgets-and-limits.md The viewer consumes valid runtime state; diagnostic vocabulary, aggregation, and remediation remain in validators and compilers.
 * @evidenceExclude requirements/diagnostics/collection-fail-fast-and-determinism.md The viewer consumes valid runtime state; diagnostic vocabulary, aggregation, and remediation remain in validators and compilers.
 * @evidenceExclude requirements/diagnostics/external-input-and-security.md The viewer consumes valid runtime state; diagnostic vocabulary, aggregation, and remediation remain in validators and compilers.
 * @evidenceExclude requirements/diagnostics/identity-path-and-context.md The viewer consumes valid runtime state; diagnostic vocabulary, aggregation, and remediation remain in validators and compilers.
 * @evidenceExclude requirements/diagnostics/input-and-result-classification.md The viewer consumes valid runtime state; diagnostic vocabulary, aggregation, and remediation remain in validators and compilers.
 * @evidenceExclude requirements/diagnostics/localization-and-machine-results.md The viewer consumes valid runtime state; diagnostic vocabulary, aggregation, and remediation remain in validators and compilers.
 * @evidenceExclude requirements/diagnostics/partial-artifacts-and-recovery.md The viewer consumes valid runtime state; diagnostic vocabulary, aggregation, and remediation remain in validators and compilers.
 * @evidenceExclude requirements/diagnostics/README.md The viewer consumes valid runtime state; diagnostic vocabulary, aggregation, and remediation remain in validators and compilers.
 * @evidenceExclude requirements/editorial/clips-source-ranges-and-handles.md The viewer plays resolved cuts; editorial authorship, versioning, transition policy, and delivery planning remain upstream.
 * @evidenceExclude requirements/editorial/conform-and-media-references.md The viewer plays resolved cuts; editorial authorship, versioning, transition policy, and delivery planning remain upstream.
 * @evidenceExclude requirements/editorial/continuity-and-film-grammar.md The viewer plays resolved cuts; editorial authorship, versioning, transition policy, and delivery planning remain upstream.
 * @evidenceExclude requirements/editorial/markers-effects-and-metadata.md The viewer plays resolved cuts; editorial authorship, versioning, transition policy, and delivery planning remain upstream.
 * @evidenceExclude requirements/editorial/pacing-and-rhythm.md The viewer plays resolved cuts; editorial authorship, versioning, transition policy, and delivery planning remain upstream.
 * @evidenceExclude requirements/editorial/picture-and-sound-edits.md The viewer plays resolved cuts; editorial authorship, versioning, transition policy, and delivery planning remain upstream.
 * @evidenceExclude requirements/editorial/rational-time-and-ranges.md The viewer plays resolved cuts; editorial authorship, versioning, transition policy, and delivery planning remain upstream.
 * @evidenceExclude requirements/editorial/README.md The viewer plays resolved cuts; editorial authorship, versioning, transition policy, and delivery planning remain upstream.
 * @evidenceExclude requirements/editorial/scope-and-identity.md The viewer plays resolved cuts; editorial authorship, versioning, transition policy, and delivery planning remain upstream.
 * @evidenceExclude requirements/editorial/tracks-stacks-and-composition.md The viewer plays resolved cuts; editorial authorship, versioning, transition policy, and delivery planning remain upstream.
 * @evidenceExclude requirements/editorial/transitions-and-overlaps.md The viewer plays resolved cuts; editorial authorship, versioning, transition policy, and delivery planning remain upstream.
 * @evidenceExclude requirements/editorial/validation.md The viewer plays resolved cuts; editorial authorship, versioning, transition policy, and delivery planning remain upstream.
 * @evidenceExclude requirements/editorial/versions-and-alternative-cuts.md The viewer plays resolved cuts; editorial authorship, versioning, transition policy, and delivery planning remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/budgets-and-bounded-work.md The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/clock-seek-and-determinism.md The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/damage-and-destruction-boundary.md The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/environment-coupling.md The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/fire-smoke-and-atmosphere.md The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-conservation-account The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-object-interaction The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-refusal The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-seek-state The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-volume-boundary The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/particles-and-emission.md#effects-emitter-geometry The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/particles-and-emission.md#effects-particle-contact-consequence The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/particles-and-emission.md#effects-particle-lifetime-state The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/particles-and-emission.md#effects-particle-refusal The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/particles-and-emission.md#effects-spawn-interval-boundary The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/README.md The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/scope-and-simulation-tiers.md The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-discretization-identity The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-fidelity-boundary The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/effects-and-simulation/validation-and-evidence.md The viewer displays resolved effects; simulation solving, budgets, validation, and refusal remain upstream.
 * @evidenceExclude requirements/evidence-and-provenance/canonical-digests-and-content-identity.md The viewer renders compiled state; provenance capture, evidence retention, and audit authority remain outside this projection layer.
 * @evidenceExclude requirements/evidence-and-provenance/chain-of-custody-and-tamper-detection.md The viewer renders compiled state; provenance capture, evidence retention, and audit authority remain outside this projection layer.
 * @evidenceExclude requirements/evidence-and-provenance/completeness-freshness-and-refusal.md The viewer renders compiled state; provenance capture, evidence retention, and audit authority remain outside this projection layer.
 * @evidenceExclude requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md The viewer renders compiled state; provenance capture, evidence retention, and audit authority remain outside this projection layer.
 * @evidenceExclude requirements/evidence-and-provenance/generation-transformation-and-derivation.md The viewer renders compiled state; provenance capture, evidence retention, and audit authority remain outside this projection layer.
 * @evidenceExclude requirements/evidence-and-provenance/observations-claims-and-human-judgments.md The viewer renders compiled state; provenance capture, evidence retention, and audit authority remain outside this projection layer.
 * @evidenceExclude requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md The viewer renders compiled state; provenance capture, evidence retention, and audit authority remain outside this projection layer.
 * @evidenceExclude requirements/evidence-and-provenance/README.md The viewer renders compiled state; provenance capture, evidence retention, and audit authority remain outside this projection layer.
 * @evidenceExclude requirements/evidence-and-provenance/retention-invalidation-and-disposal.md The viewer renders compiled state; provenance capture, evidence retention, and audit authority remain outside this projection layer.
 * @evidenceExclude requirements/evidence-and-provenance/scope-identity-and-status.md The viewer renders compiled state; provenance capture, evidence retention, and audit authority remain outside this projection layer.
 * @evidenceExclude requirements/evidence-and-provenance/third-party-sources-rights-and-attribution.md The viewer renders compiled state; provenance capture, evidence retention, and audit authority remain outside this projection layer.
 * @evidenceExclude requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-group-composition The viewer consumes adopted runtime assets; ingestion, identity mapping, trust, and refusal remain in ingest and compilation.
 * @evidenceExclude requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-intent-persistence The viewer consumes adopted runtime assets; ingestion, identity mapping, trust, and refusal remain in ingest and compilation.
 * @evidenceExclude requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-native-reinterpretation The viewer consumes adopted runtime assets; ingestion, identity mapping, trust, and refusal remain in ingest and compilation.
 * @evidenceExclude requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-selection-overrides The viewer consumes adopted runtime assets; ingestion, identity mapping, trust, and refusal remain in ingest and compilation.
 * @evidenceExclude requirements/external-inputs/conversion-receipts-and-determinism.md The viewer consumes adopted runtime assets; ingestion, identity mapping, trust, and refusal remain in ingest and compilation.
 * @evidenceExclude requirements/external-inputs/credentials-rights-and-provenance.md The viewer consumes adopted runtime assets; ingestion, identity mapping, trust, and refusal remain in ingest and compilation.
 * @evidenceExclude requirements/external-inputs/identity-coordinates-and-units.md The viewer consumes adopted runtime assets; ingestion, identity mapping, trust, and refusal remain in ingest and compilation.
 * @evidenceExclude requirements/external-inputs/media-families-and-declared-facts.md The viewer consumes adopted runtime assets; ingestion, identity mapping, trust, and refusal remain in ingest and compilation.
 * @evidenceExclude requirements/external-inputs/README.md The viewer consumes adopted runtime assets; ingestion, identity mapping, trust, and refusal remain in ingest and compilation.
 * @evidenceExclude requirements/external-inputs/refresh-version-pinning-and-offline.md The viewer consumes adopted runtime assets; ingestion, identity mapping, trust, and refusal remain in ingest and compilation.
 * @evidenceExclude requirements/external-inputs/resource-closure-and-acquisition.md The viewer consumes adopted runtime assets; ingestion, identity mapping, trust, and refusal remain in ingest and compilation.
 * @evidenceExclude requirements/external-inputs/source-selection-and-provider-neutrality.md The viewer consumes adopted runtime assets; ingestion, identity mapping, trust, and refusal remain in ingest and compilation.
 * @evidenceExclude requirements/external-inputs/unsupported-and-degradation.md The viewer consumes adopted runtime assets; ingestion, identity mapping, trust, and refusal remain in ingest and compilation.
 * @evidenceExclude requirements/external-inputs/validation-and-quarantine.md The viewer consumes adopted runtime assets; ingestion, identity mapping, trust, and refusal remain in ingest and compilation.
 * @evidenceExclude requirements/formations/budgets-and-validation.md The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/heroes-variation-and-state.md#formation-authored-variation-profile The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/heroes-variation-and-state.md#formation-continuity The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/heroes-variation-and-state.md#formation-group-state The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/heroes-variation-and-state.md#formation-hero-overrides The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/heroes-variation-and-state.md#formation-stable-background-identity The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/hierarchies-and-units.md The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/layouts-and-slots.md#formation-layout-capacity The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/layouts-and-slots.md#formation-layout-dressing The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/layouts-and-slots.md#formation-local-frame The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/layouts-and-slots.md#formation-slot-assignment-policy The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/layouts-and-slots.md#formation-slot-identity The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/README.md The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/reform-and-group-motion.md#formation-command-response-events The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/reform-and-group-motion.md#formation-reform-interior-state The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/reform-and-group-motion.md#formation-reform-local-blend The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/reform-and-group-motion.md#formation-reform-refusal The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/reform-and-group-motion.md#formation-reform-slot-assignment The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/resolution-culling-and-evidence.md#formation-resolution-culling-refusal The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/resolution-culling-and-evidence.md#formation-resolution-semantic-minimum The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/scope-and-identity.md#formation-all-repeated-subjects The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/scope-and-identity.md#formation-authoring-mode-selection The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/scope-and-identity.md#formation-open-kinds The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/scope-and-identity.md#formation-scope-refusal The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/scope-and-identity.md#formation-story-binding The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/spacing-overlap-and-avoidance.md The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/terrain-and-routes.md#formation-relief-adaptation The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/terrain-and-routes.md#formation-route-interior The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/terrain-and-routes.md#formation-route-layout-envelope The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/terrain-and-routes.md#formation-terrain-refusal The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/formations/terrain-and-routes.md#formation-terrain-support-profile The viewer displays resolved formations; formation authoring, solving, budget decisions, and validation remain upstream.
 * @evidenceExclude requirements/interior/acoustics-and-sound-boundaries.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/ceilings-and-overhead-zones.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/clearance-anthropometrics-and-accessibility.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/color-style-form-and-art.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/columns-beams-and-architectural-elements.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/connections-and-circulation.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/construction-maintenance-and-safety.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/deliverables-and-quantities.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/doors-windows-and-openings.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/existing-conditions-phases-and-alternatives.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/external-assets-and-placement.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/floors-and-raised-floors.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/furniture-fixtures-and-equipment.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/grain-seams-and-continuity.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/groups-instances-and-repetition.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/joints-edges-and-transitions.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/lighting-daylight-and-optics.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/materials-and-physical-properties.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/README.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/scope-and-host-boundary.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/services-and-environment.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/soft-materials-plants-and-deformation.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/spaces-and-occupancy.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/spatial-hierarchy-and-zones.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/surface-assemblies.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/textures-patterns-and-variation.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/tolerances-and-imperfections.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/validation-and-iteration.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/walls-partitions-and-linings.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/water-and-fluid-features.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/wear-soiling-and-aging.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/interior/wet-areas-and-waterproofing.md The viewer draws compiled interiors; spatial authoring, construction semantics, validation, and refusal remain upstream.
 * @evidenceExclude requirements/lighting/alternatives-and-intentional-deviations.md The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/analysis-and-visual-validation.md The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/budgets-and-representation.md The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/color-exposure-and-display-boundary.md#lighting-camera-exposure The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/color-exposure-and-display-boundary.md#lighting-color-comparison-boundary The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/color-exposure-and-display-boundary.md#lighting-color-provenance The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/color-exposure-and-display-boundary.md#lighting-color-refusal The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/color-exposure-and-display-boundary.md#lighting-single-effective-transform The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/color-exposure-and-display-boundary.md#lighting-white-balance-adaptation The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/practicals-and-local-lights.md The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/README.md The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/scope-and-identity.md The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/shadows-reflections-and-transmission.md#lighting-intentional-optical-break The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/shadows-reflections-and-transmission.md#lighting-optical-approximation The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/shadows-reflections-and-transmission.md#lighting-reflection-identity The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/shadows-reflections-and-transmission.md#lighting-result-findings The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/shadows-reflections-and-transmission.md#lighting-shadow-time-sampling The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/shadows-reflections-and-transmission.md#lighting-structural-passes The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/shadows-reflections-and-transmission.md#lighting-transparent-boundary The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/shape-filters-and-linking.md The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/sources-and-photometry.md#lighting-distance-falloff The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/sources-and-photometry.md#lighting-emitting-geometry The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/sources-and-photometry.md#lighting-intensity-basis The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/sources-and-photometry.md#lighting-photometric-quantity-semantics The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/sources-and-photometry.md#lighting-profile-provenance The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/sources-and-photometry.md#lighting-source-color-temperature The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/sources-and-photometry.md#lighting-source-refusal The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/sun-sky-and-environment.md#lighting-declared-sun The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/sun-sky-and-environment.md#lighting-environment-alternatives The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/sun-sky-and-environment.md#lighting-environment-background-illumination The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/sun-sky-and-environment.md#lighting-environment-claim-boundary The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/sun-sky-and-environment.md#lighting-environment-geometry-trace The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/sun-sky-and-environment.md#lighting-environment-spatial-variation The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/lighting/temporal-state-and-continuity.md The viewer applies resolved lights; lighting authorship, analysis, safety policy, and validation remain upstream.
 * @evidenceExclude requirements/map/bridges-and-tunnels.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/coasts-and-oceans.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/deliverables-and-validation.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/external-assets-and-placement.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/geology-and-ground-surfaces.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/infrastructure-and-utilities.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/movement-and-visibility.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/parcels-and-land-use.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/parks-and-public-space.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/rail-and-transport.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/README.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/rivers-and-inland-water.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/roads-and-paths.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/scale-and-populations.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/scope-and-coordinates.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/settlements-and-urban-form.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/temporal-change.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/terrain-and-landforms.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/vegetation-and-ecology.md#map-ecology-gap The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/vegetation-and-ecology.md#map-habitat-ecological-relations The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/vegetation-and-ecology.md#map-vegetation-disturbance-recovery The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/vegetation-and-ecology.md#map-vegetation-layers-form The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/vegetation-and-ecology.md#map-vegetation-season-growth The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/vegetation-and-ecology.md#map-vegetation-terrain-water The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/map/weather-and-seasons.md The viewer draws compiled world state; site authoring, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude requirements/motion/channels-controls-and-drivers.md The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/clips-keyframes-and-interpolation.md The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/constraints-and-inverse-kinematics.md The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/contact-weight-and-support.md The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/external-motion-inputs.md The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-blend-refusal The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-layer-event-composition The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-layer-mask-weight The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-phase-alignment The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-transition-window The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/object-motion-and-interaction.md#motion-coupled-objects The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/object-motion-and-interaction.md#motion-interaction-refusal The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/object-motion-and-interaction.md#motion-multi-subject-interaction The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/object-motion-and-interaction.md#motion-object-handoff The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/procedural-motion-and-gaits.md The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/README.md The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/retargeting-and-scale.md#motion-retarget-contact-preservation The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/retargeting-and-scale.md#motion-retarget-non-humanoid The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/retargeting-and-scale.md#motion-retarget-proportion The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/retargeting-and-scale.md#motion-retarget-refusal The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/retargeting-and-scale.md#motion-retarget-source-provenance The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-facing-travel The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-path-fit-warp The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-path-timing The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-root-ground-clearance The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-trajectory-refusal The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/scope-and-identity.md The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/secondary-motion.md#motion-secondary-adoption-choice The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/secondary-motion.md#motion-secondary-claim-boundary The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/secondary-motion.md#motion-secondary-moving-boundary The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/secondary-motion.md#motion-secondary-static-compatibility The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-event-identity-payload The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-event-markers The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-retime-event-preservation The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-story-film-time The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-timing-refusal The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/motion/validation-and-determinism.md The viewer samples and applies resolved clips; motion authoring, retargeting policy, solving, and validation remain upstream.
 * @evidenceExclude requirements/operations-and-recovery/audit-and-operator-authority.md The viewer owns one local render loop; production orchestration, retries, recovery, and publication operations remain outside it.
 * @evidenceExclude requirements/operations-and-recovery/cache-integrity-and-dependency-loss.md The viewer owns one local render loop; production orchestration, retries, recovery, and publication operations remain outside it.
 * @evidenceExclude requirements/operations-and-recovery/cancellation-and-interruption.md The viewer owns one local render loop; production orchestration, retries, recovery, and publication operations remain outside it.
 * @evidenceExclude requirements/operations-and-recovery/checkpoints-resume-and-retry.md The viewer owns one local render loop; production orchestration, retries, recovery, and publication operations remain outside it.
 * @evidenceExclude requirements/operations-and-recovery/concurrent-runs-and-locking.md The viewer owns one local render loop; production orchestration, retries, recovery, and publication operations remain outside it.
 * @evidenceExclude requirements/operations-and-recovery/disaster-recovery.md The viewer owns one local render loop; production orchestration, retries, recovery, and publication operations remain outside it.
 * @evidenceExclude requirements/operations-and-recovery/failure-modes-and-recovery.md The viewer owns one local render loop; production orchestration, retries, recovery, and publication operations remain outside it.
 * @evidenceExclude requirements/operations-and-recovery/idempotency-and-side-effects.md The viewer owns one local render loop; production orchestration, retries, recovery, and publication operations remain outside it.
 * @evidenceExclude requirements/operations-and-recovery/migration-and-compatibility.md The viewer owns one local render loop; production orchestration, retries, recovery, and publication operations remain outside it.
 * @evidenceExclude requirements/operations-and-recovery/observability-and-secret-protection.md The viewer owns one local render loop; production orchestration, retries, recovery, and publication operations remain outside it.
 * @evidenceExclude requirements/operations-and-recovery/partial-artifacts-and-publication.md The viewer owns one local render loop; production orchestration, retries, recovery, and publication operations remain outside it.
 * @evidenceExclude requirements/operations-and-recovery/README.md The viewer owns one local render loop; production orchestration, retries, recovery, and publication operations remain outside it.
 * @evidenceExclude requirements/operations-and-recovery/resource-budgets-and-backpressure.md The viewer owns one local render loop; production orchestration, retries, recovery, and publication operations remain outside it.
 * @evidenceExclude requirements/operations-and-recovery/retention-and-cleanup.md The viewer owns one local render loop; production orchestration, retries, recovery, and publication operations remain outside it.
 * @evidenceExclude requirements/operations-and-recovery/scope-job-identity-and-state.md The viewer owns one local render loop; production orchestration, retries, recovery, and publication operations remain outside it.
 * @evidenceExclude requirements/product/authorability.md The viewer is a deterministic projection library; product strategy, capability governance, and evaluation policy remain repository-level concerns.
 * @evidenceExclude requirements/product/capability-and-content.md The viewer is a deterministic projection library; product strategy, capability governance, and evaluation policy remain repository-level concerns.
 * @evidenceExclude requirements/product/charter.md The viewer is a deterministic projection library; product strategy, capability governance, and evaluation policy remain repository-level concerns.
 * @evidenceExclude requirements/product/choice-and-external-services.md The viewer is a deterministic projection library; product strategy, capability governance, and evaluation policy remain repository-level concerns.
 * @evidenceExclude requirements/product/extensibility-and-compatibility.md The viewer is a deterministic projection library; product strategy, capability governance, and evaluation policy remain repository-level concerns.
 * @evidenceExclude requirements/product/prototype-quality.md The viewer is a deterministic projection library; product strategy, capability governance, and evaluation policy remain repository-level concerns.
 * @evidenceExclude requirements/product/README.md The viewer is a deterministic projection library; product strategy, capability governance, and evaluation policy remain repository-level concerns.
 * @evidenceExclude requirements/product/scope-and-exclusions.md The viewer is a deterministic projection library; product strategy, capability governance, and evaluation policy remain repository-level concerns.
 * @evidenceExclude requirements/production-design/art-direction-and-visual-language.md The viewer consumes compiled production state; design authority, authoring gates, reconciliation, and refusal remain upstream.
 * @evidenceExclude requirements/production-design/budgets-and-feasibility.md The viewer consumes compiled production state; design authority, authoring gates, reconciliation, and refusal remain upstream.
 * @evidenceExclude requirements/production-design/continuity-change-and-deliverables.md The viewer consumes compiled production state; design authority, authoring gates, reconciliation, and refusal remain upstream.
 * @evidenceExclude requirements/production-design/locations-and-world-context.md The viewer consumes compiled production state; design authority, authoring gates, reconciliation, and refusal remain upstream.
 * @evidenceExclude requirements/production-design/palette-material-and-state.md The viewer consumes compiled production state; design authority, authoring gates, reconciliation, and refusal remain upstream.
 * @evidenceExclude requirements/production-design/README.md The viewer consumes compiled production state; design authority, authoring gates, reconciliation, and refusal remain upstream.
 * @evidenceExclude requirements/production-design/references-and-provenance.md The viewer consumes compiled production state; design authority, authoring gates, reconciliation, and refusal remain upstream.
 * @evidenceExclude requirements/production-design/scale-proportion-and-silhouette.md The viewer consumes compiled production state; design authority, authoring gates, reconciliation, and refusal remain upstream.
 * @evidenceExclude requirements/production-design/scope-and-source-of-truth.md The viewer consumes compiled production state; design authority, authoring gates, reconciliation, and refusal remain upstream.
 * @evidenceExclude requirements/production-design/subject-breakdown-and-asset-plan.md The viewer consumes compiled production state; design authority, authoring gates, reconciliation, and refusal remain upstream.
 * @evidenceExclude requirements/production-design/visual-delivery-and-fidelity-tiers.md The viewer consumes compiled production state; design authority, authoring gates, reconciliation, and refusal remain upstream.
 * @evidenceExclude requirements/README.md The repository requirement root spans product authority beyond the viewer; this package implements only the directly cited projection leaves.
 * @evidenceExclude requirements/production-evidence/README.md The viewer projects admitted production state and does not configure or validate the generated project's authoring evidence graph.
 * @evidenceExclude requirements/production-evidence/graph.md The viewer projects admitted production state and does not configure or validate the generated project's authoring evidence graph.
 * @evidenceExclude requirements/production-evidence/input.md The viewer projects admitted production state and does not configure or validate the generated project's authoring evidence graph.
 * @evidenceExclude requirements/rendering/budgets.md#rendering-budget-decision The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/budgets.md#rendering-budget-refusal The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/budgets.md#rendering-budget-tiers The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/budgets.md#rendering-expansion-bounds The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/budgets.md#rendering-geometry-memory-budget The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/budgets.md#rendering-runtime-budget-enforcement The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/chunks-resume-and-recovery.md The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/frame-identity-and-content-addressing.md The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-boundary-convention The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-schedule-audio-cues The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-schedule-refusal The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-shutter-samples The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-subrange-stability The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/geometry-visibility-and-culling.md#rendering-culling-diagnostics The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/geometry-visibility-and-culling.md#rendering-culling-refusal The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/geometry-visibility-and-culling.md#rendering-deformed-bounds The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/geometry-visibility-and-culling.md#rendering-frustum-boundaries The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/geometry-visibility-and-culling.md#rendering-room-region-culling The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/geometry-visibility-and-culling.md#rendering-visibility-state The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/headless-and-platform-determinism.md The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/materials-lighting-and-color.md#rendering-color-recovery The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/materials-lighting-and-color.md#rendering-external-materials The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/materials-lighting-and-color.md#rendering-lighting-evaluation The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/materials-lighting-and-color.md#rendering-material-refusal The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/materials-lighting-and-color.md#rendering-texture-decode The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/materials-lighting-and-color.md#rendering-transparency-alpha The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-partial-product-set The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-pass-dependencies The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-pass-refusal The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/README.md The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-partial-retry The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-refusal The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-time-update The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/rendering/validation.md The viewer owns interactive projection only; render scheduling, headless capture policy, encoding, packaging, and publication remain in the render lane.
 * @evidenceExclude requirements/repaint/eligibility-and-prerequisites.md The viewer produces deterministic structural frames; repaint providers, generation policy, retries, selection, and publication remain outside this package.
 * @evidenceExclude requirements/repaint/identity-and-provenance.md The viewer produces deterministic structural frames; repaint providers, generation policy, retries, selection, and publication remain outside this package.
 * @evidenceExclude requirements/repaint/prompts-controls-and-constraints.md The viewer produces deterministic structural frames; repaint providers, generation policy, retries, selection, and publication remain outside this package.
 * @evidenceExclude requirements/repaint/providers-models-and-credentials.md The viewer produces deterministic structural frames; repaint providers, generation policy, retries, selection, and publication remain outside this package.
 * @evidenceExclude requirements/repaint/README.md The viewer produces deterministic structural frames; repaint providers, generation policy, retries, selection, and publication remain outside this package.
 * @evidenceExclude requirements/repaint/retries-seeds-and-variation.md The viewer produces deterministic structural frames; repaint providers, generation policy, retries, selection, and publication remain outside this package.
 * @evidenceExclude requirements/repaint/scope-and-user-choice.md The viewer produces deterministic structural frames; repaint providers, generation policy, retries, selection, and publication remain outside this package.
 * @evidenceExclude requirements/repaint/sequence-continuity-and-publication.md The viewer produces deterministic structural frames; repaint providers, generation policy, retries, selection, and publication remain outside this package.
 * @evidenceExclude requirements/repaint/source-frames-and-reference-locking.md The viewer produces deterministic structural frames; repaint providers, generation policy, retries, selection, and publication remain outside this package.
 * @evidenceExclude requirements/repaint/structural-comparison-and-review.md The viewer produces deterministic structural frames; repaint providers, generation policy, retries, selection, and publication remain outside this package.
 * @evidenceExclude requirements/review/README.md The viewer exposes observable frames; oracle policy, acceptance judgment, evidence adjudication, and review state remain outside this projection layer.
 * @evidenceExclude requirements/review/subject-description-and-structural-change.md The viewer draws a subject and reads the frame back; describing a compiled subject in words and comparing two revisions of it structurally are text products held outside this projection layer.
 * @evidenceExclude requirements/review/subject-inspection.md#review-library-delivery-coverage The viewer can render one selected subject, but deriving every active library H2 owner, reopening nonvisual facts and artifacts, and aggregating current receipts belong to the production review gate rather than this projection instrument.
 * @evidenceExclude requirements/review/subject-inspection.md#review-subject-time-noninterchange The viewer marks its subject observations as unfit for delivery evidence; reopening the frames, ranges and sibling placements a confirmed subject defect implicates is review state held outside this projection layer.
 * @evidenceExclude requirements/review/visual-change-reporting.md The viewer draws one frame at one moment and never accumulates a catalog of image digests across revisions; naming a stable view identity, classifying it as changed, unchanged, new or gone, and keeping that progress fact apart from review evidence are all held outside this projection layer.
 * @evidenceExclude requirements/sound/ambience-and-sustained-sources.md The viewer is the visual projection boundary; sound authoring, acoustics, mixing, synchronization policy, and audio delivery remain outside it.
 * @evidenceExclude requirements/sound/dialogue-voice-and-visemes.md The viewer is the visual projection boundary; sound authoring, acoustics, mixing, synchronization policy, and audio delivery remain outside it.
 * @evidenceExclude requirements/sound/editing-synchronization-and-continuity.md The viewer is the visual projection boundary; sound authoring, acoustics, mixing, synchronization policy, and audio delivery remain outside it.
 * @evidenceExclude requirements/sound/event-cues-and-timing.md The viewer is the visual projection boundary; sound authoring, acoustics, mixing, synchronization policy, and audio delivery remain outside it.
 * @evidenceExclude requirements/sound/foley-and-sound-effects.md The viewer is the visual projection boundary; sound authoring, acoustics, mixing, synchronization policy, and audio delivery remain outside it.
 * @evidenceExclude requirements/sound/interior-acoustics.md The viewer is the visual projection boundary; sound authoring, acoustics, mixing, synchronization policy, and audio delivery remain outside it.
 * @evidenceExclude requirements/sound/mix-hierarchy-and-loudness.md The viewer is the visual projection boundary; sound authoring, acoustics, mixing, synchronization policy, and audio delivery remain outside it.
 * @evidenceExclude requirements/sound/music-and-silence.md The viewer is the visual projection boundary; sound authoring, acoustics, mixing, synchronization policy, and audio delivery remain outside it.
 * @evidenceExclude requirements/sound/README.md The viewer is the visual projection boundary; sound authoring, acoustics, mixing, synchronization policy, and audio delivery remain outside it.
 * @evidenceExclude requirements/sound/scope-and-identity.md The viewer is the visual projection boundary; sound authoring, acoustics, mixing, synchronization policy, and audio delivery remain outside it.
 * @evidenceExclude requirements/sound/sources-and-external-assets.md The viewer is the visual projection boundary; sound authoring, acoustics, mixing, synchronization policy, and audio delivery remain outside it.
 * @evidenceExclude requirements/sound/spatialization-and-propagation.md The viewer is the visual projection boundary; sound authoring, acoustics, mixing, synchronization policy, and audio delivery remain outside it.
 * @evidenceExclude requirements/sound/validation-and-delivery.md The viewer is the visual projection boundary; sound authoring, acoustics, mixing, synchronization policy, and audio delivery remain outside it.
 * @evidenceExclude requirements/staging/budgets-safety-and-validation.md The viewer materializes resolved staging; blocking authorship, spatial solving, alternatives, and validation remain upstream.
 * @evidenceExclude requirements/staging/coverage-and-alternative-takes.md The viewer materializes resolved staging; blocking authorship, spatial solving, alternatives, and validation remain upstream.
 * @evidenceExclude requirements/staging/events-and-timing.md The viewer materializes resolved staging; blocking authorship, spatial solving, alternatives, and validation remain upstream.
 * @evidenceExclude requirements/staging/interactions-and-choreography.md The viewer materializes resolved staging; blocking authorship, spatial solving, alternatives, and validation remain upstream.
 * @evidenceExclude requirements/staging/marks-zones-and-blocking.md The viewer materializes resolved staging; blocking authorship, spatial solving, alternatives, and validation remain upstream.
 * @evidenceExclude requirements/staging/README.md The viewer materializes resolved staging; blocking authorship, spatial solving, alternatives, and validation remain upstream.
 * @evidenceExclude requirements/staging/scope-and-source-of-truth.md#staging-authored-blocking The viewer materializes resolved staging; blocking authorship, spatial solving, alternatives, and validation remain upstream.
 * @evidenceExclude requirements/staging/scope-and-source-of-truth.md#staging-autofill-refusal The viewer materializes resolved staging; blocking authorship, spatial solving, alternatives, and validation remain upstream.
 * @evidenceExclude requirements/staging/scope-and-source-of-truth.md#staging-open-style The viewer materializes resolved staging; blocking authorship, spatial solving, alternatives, and validation remain upstream.
 * @evidenceExclude requirements/staging/scope-and-source-of-truth.md#staging-plan-alternatives The viewer materializes resolved staging; blocking authorship, spatial solving, alternatives, and validation remain upstream.
 * @evidenceExclude requirements/staging/scope-and-source-of-truth.md#staging-story-distinction The viewer materializes resolved staging; blocking authorship, spatial solving, alternatives, and validation remain upstream.
 * @evidenceExclude requirements/staging/scope-and-source-of-truth.md#staging-upstream-source-trace The viewer materializes resolved staging; blocking authorship, spatial solving, alternatives, and validation remain upstream.
 * @evidenceExclude requirements/staging/shot-contracts-and-deliveries.md The viewer materializes resolved staging; blocking authorship, spatial solving, alternatives, and validation remain upstream.
 * @evidenceExclude requirements/staging/state-handoff-and-continuity.md The viewer materializes resolved staging; blocking authorship, spatial solving, alternatives, and validation remain upstream.
 * @evidenceExclude requirements/staging/subjects-and-object-staging.md The viewer materializes resolved staging; blocking authorship, spatial solving, alternatives, and validation remain upstream.
 * @evidenceExclude requirements/staging/visibility-and-readability.md The viewer materializes resolved staging; blocking authorship, spatial solving, alternatives, and validation remain upstream.
 * @evidenceExclude requirements/story/beats-and-causality.md The viewer plays compiled scenes; narrative intent, story structure, revision authority, and screenplay authorship remain upstream.
 * @evidenceExclude requirements/story/coverage-and-acceptance.md The viewer plays compiled scenes; narrative intent, story structure, revision authority, and screenplay authorship remain upstream.
 * @evidenceExclude requirements/story/dialogue-language-and-silence.md The viewer plays compiled scenes; narrative intent, story structure, revision authority, and screenplay authorship remain upstream.
 * @evidenceExclude requirements/story/dramatic-characters-goals-and-relations.md The viewer plays compiled scenes; narrative intent, story structure, revision authority, and screenplay authorship remain upstream.
 * @evidenceExclude requirements/story/logline-and-premise.md The viewer plays compiled scenes; narrative intent, story structure, revision authority, and screenplay authorship remain upstream.
 * @evidenceExclude requirements/story/README.md The viewer plays compiled scenes; narrative intent, story structure, revision authority, and screenplay authorship remain upstream.
 * @evidenceExclude requirements/story/revision-and-change-impact.md The viewer plays compiled scenes; narrative intent, story structure, revision authority, and screenplay authorship remain upstream.
 * @evidenceExclude requirements/story/scenes-and-observable-action.md The viewer plays compiled scenes; narrative intent, story structure, revision authority, and screenplay authorship remain upstream.
 * @evidenceExclude requirements/story/scope-and-source-of-truth.md The viewer plays compiled scenes; narrative intent, story structure, revision authority, and screenplay authorship remain upstream.
 * @evidenceExclude requirements/story/story-clock-and-state.md The viewer plays compiled scenes; narrative intent, story structure, revision authority, and screenplay authorship remain upstream.
 * @evidenceExclude requirements/story/themes-motifs-and-subtext.md The viewer plays compiled scenes; narrative intent, story structure, revision authority, and screenplay authorship remain upstream.
 * @evidenceExclude requirements/story/treatment-and-sequences.md The viewer plays compiled scenes; narrative intent, story structure, revision authority, and screenplay authorship remain upstream.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-alternative-failure-compatibility The viewer materializes resolved representations; asset authority, authoring, validation, and compatibility refusal remain upstream.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-alternative-selection-output The viewer materializes resolved representations; asset authority, authoring, validation, and compatibility refusal remain upstream.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-deterministic-instance-generation The viewer materializes resolved representations; asset authority, authoring, validation, and compatibility refusal remain upstream.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-group-individuality The viewer materializes resolved representations; asset authority, authoring, validation, and compatibility refusal remain upstream.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-instance-override-resolution The viewer materializes resolved representations; asset authority, authoring, validation, and compatibility refusal remain upstream.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance The viewer materializes resolved representations; asset authority, authoring, validation, and compatibility refusal remain upstream.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-variant-inheritance The viewer materializes resolved representations; asset authority, authoring, validation, and compatibility refusal remain upstream.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md The viewer materializes resolved representations; asset authority, authoring, validation, and compatibility refusal remain upstream.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md The viewer materializes resolved representations; asset authority, authoring, validation, and compatibility refusal remain upstream.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md The viewer materializes resolved representations; asset authority, authoring, validation, and compatibility refusal remain upstream.
 * @evidenceExclude specifications/asset-and-representation/identity-resources-and-lifecycle.md The viewer materializes resolved representations; asset authority, authoring, validation, and compatibility refusal remain upstream.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md The viewer materializes resolved representations; asset authority, authoring, validation, and compatibility refusal remain upstream.
 * @evidenceExclude specifications/asset-and-representation/README.md The viewer materializes resolved representations; asset authority, authoring, validation, and compatibility refusal remain upstream.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md The viewer materializes resolved representations; asset authority, authoring, validation, and compatibility refusal remain upstream.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md The viewer consumes compiled state; authoring authority, source lineage, reconciliation, and refusal remain outside this runtime.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md The viewer consumes compiled state; authoring authority, source lineage, reconciliation, and refusal remain outside this runtime.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-basis The viewer renders compiled results and implements no derived ledger, basis closure, generation attempt, compile freshness matrix, publication path invariant, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-budget-boundary The viewer renders compiled results and implements no derived ledger, basis closure, generation attempt, compile freshness matrix, publication path invariant, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-freshness The viewer renders compiled results and implements no derived ledger, basis closure, generation attempt, compile freshness matrix, publication path invariant, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-generation The viewer renders compiled results and implements no derived ledger, basis closure, generation attempt, compile freshness matrix, publication path invariant, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-manifest The viewer renders compiled results and implements no derived ledger, basis closure, generation attempt, compile freshness matrix, publication path invariant, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-portability The viewer renders compiled results and implements no derived ledger, basis closure, generation attempt, compile freshness matrix, publication path invariant, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md The viewer consumes compiled state; authoring authority, source lineage, reconciliation, and refusal remain outside this runtime.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md The viewer consumes compiled state; authoring authority, source lineage, reconciliation, and refusal remain outside this runtime.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md The viewer consumes compiled state; authoring authority, source lineage, reconciliation, and refusal remain outside this runtime.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md The viewer consumes compiled state; authoring authority, source lineage, reconciliation, and refusal remain outside this runtime.
 * @evidenceExclude specifications/authoring-and-authority/README.md The viewer consumes compiled state; authoring authority, source lineage, reconciliation, and refusal remain outside this runtime.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md The viewer consumes compiled state; authoring authority, source lineage, reconciliation, and refusal remain outside this runtime.
 * @evidenceExclude specifications/building-envelope/exterior-spaces-circulation-and-optics.md The viewer draws compiled envelope geometry; building semantics, derivation, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/building-envelope/external-assets-patterns-and-instances.md The viewer draws compiled envelope geometry; building semantics, derivation, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/building-envelope/facade-roof-and-openings.md The viewer draws compiled envelope geometry; building semantics, derivation, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/building-envelope/identity-scope-and-coordinates.md The viewer draws compiled envelope geometry; building semantics, derivation, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/building-envelope/linked-interior-coordination.md The viewer draws compiled envelope geometry; building semantics, derivation, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/building-envelope/massing-area-and-storeys.md The viewer draws compiled envelope geometry; building semantics, derivation, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/building-envelope/phases-deliverables-and-validation.md The viewer draws compiled envelope geometry; building semantics, derivation, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/building-envelope/README.md The viewer draws compiled envelope geometry; building semantics, derivation, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/building-envelope/representation-lod-and-fidelity.md The viewer draws compiled envelope geometry; building semantics, derivation, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/building-envelope/services-water-weather-and-site.md The viewer draws compiled envelope geometry; building semantics, derivation, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/building-envelope/structure-envelope-and-materials.md The viewer draws compiled envelope geometry; building semantics, derivation, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/alternatives-deviations-and-evidence.md The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-camera-authority-spatial-binding The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-projection-sampling-refusal The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-sensor-gate-delivery-mapping The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/framing-axis-and-camera-path.md The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/light-transport-color-and-budget.md#clv-color-comparison-refusal The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/light-transport-color-and-budget.md#clv-light-budget-report-refusal The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/light-transport-color-and-budget.md#clv-light-budget-selection The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/light-transport-color-and-budget.md#clv-light-result-passes-findings The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/light-transport-color-and-budget.md#clv-reflection-transmission-approximation The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/practical-shaping-and-linking.md The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/README.md The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/temporal-state-and-continuity.md The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-computable-geometry-results The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-intended-obstruction-unreadability The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-observation-validation-cases The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-occlusion-image-metrics The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-rational-visibility-sampling The viewer applies resolved camera, light, and visibility state; authoring, analysis, and constraint refusal remain upstream.
 * @evidenceExclude specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md The viewer projects resolved frames; editorial planning, render scheduling, encoding, packaging, and delivery authority remain outside it.
 * @evidenceExclude specifications/editorial-render-and-delivery/delivery-package-provenance-and-publication.md The viewer projects resolved frames; editorial planning, render scheduling, encoding, packaging, and delivery authority remain outside it.
 * @evidenceExclude specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md The viewer projects resolved frames; editorial planning, render scheduling, encoding, packaging, and delivery authority remain outside it.
 * @evidenceExclude specifications/editorial-render-and-delivery/delivery-validation-and-release-status.md The viewer projects resolved frames; editorial planning, render scheduling, encoding, packaging, and delivery authority remain outside it.
 * @evidenceExclude specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md The viewer projects resolved frames; editorial planning, render scheduling, encoding, packaging, and delivery authority remain outside it.
 * @evidenceExclude specifications/editorial-render-and-delivery/editorial-version-conform-and-validation.md The viewer projects resolved frames; editorial planning, render scheduling, encoding, packaging, and delivery authority remain outside it.
 * @evidenceExclude specifications/editorial-render-and-delivery/rational-timeline-and-composition.md The viewer projects resolved frames; editorial planning, render scheduling, encoding, packaging, and delivery authority remain outside it.
 * @evidenceExclude specifications/editorial-render-and-delivery/README.md The viewer projects resolved frames; editorial planning, render scheduling, encoding, packaging, and delivery authority remain outside it.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery The viewer projects resolved frames; editorial planning, render scheduling, encoding, packaging, and delivery authority remain outside it.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity The viewer projects resolved frames; editorial planning, render scheduling, encoding, packaging, and delivery authority remain outside it.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-raster-admission-bound The viewer applies an admitted canvas size but does not compute or enforce the production raster pixel limit.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-target-dependency-fingerprint The viewer draws supplied runtime state and does not construct the target dependency closure used for render identity.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-target-fingerprint-protocol The viewer draws supplied runtime state and does not define or encode the versioned target fingerprint protocol.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-encoding-and-validation.md The viewer projects resolved frames; editorial planning, render scheduling, encoding, packaging, and delivery authority remain outside it.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle The viewer projects resolved frames; editorial planning, render scheduling, encoding, packaging, and delivery authority remain outside it.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-capture-runtime-identity The viewer owns a renderer lifecycle but does not canonicalize or record the browser, executable, platform, graphics, and capture-mode identity.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform The viewer projects resolved frames; editorial planning, render scheduling, encoding, packaging, and delivery authority remain outside it.
 * @evidenceExclude specifications/evidence-and-provenance/canonical-digests-and-content-identity.md The viewer renders compiled state; evidence policy, provenance lineage, audit retention, and adjudication remain outside this projection layer.
 * @evidenceExclude specifications/evidence-and-provenance/chain-of-custody-and-tamper-detection.md The viewer renders compiled state; evidence policy, provenance lineage, audit retention, and adjudication remain outside this projection layer.
 * @evidenceExclude specifications/evidence-and-provenance/completeness-freshness-and-refusal.md The viewer renders compiled state; evidence policy, provenance lineage, audit retention, and adjudication remain outside this projection layer.
 * @evidenceExclude specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md The viewer renders compiled state; evidence policy, provenance lineage, audit retention, and adjudication remain outside this projection layer.
 * @evidenceExclude specifications/evidence-and-provenance/generation-transformation-and-derivation.md The viewer renders compiled state; evidence policy, provenance lineage, audit retention, and adjudication remain outside this projection layer.
 * @evidenceExclude specifications/evidence-and-provenance/observations-claims-and-human-judgments.md The viewer renders compiled state; evidence policy, provenance lineage, audit retention, and adjudication remain outside this projection layer.
 * @evidenceExclude specifications/evidence-and-provenance/privacy-credentials-and-disclosure.md The viewer renders compiled state; evidence policy, provenance lineage, audit retention, and adjudication remain outside this projection layer.
 * @evidenceExclude specifications/evidence-and-provenance/README.md The viewer renders compiled state; evidence policy, provenance lineage, audit retention, and adjudication remain outside this projection layer.
 * @evidenceExclude specifications/evidence-and-provenance/retention-invalidation-and-disposal.md The viewer renders compiled state; evidence policy, provenance lineage, audit retention, and adjudication remain outside this projection layer.
 * @evidenceExclude specifications/evidence-and-provenance/scope-identity-and-status.md The viewer renders compiled state; evidence policy, provenance lineage, audit retention, and adjudication remain outside this projection layer.
 * @evidenceExclude specifications/evidence-and-provenance/third-party-sources-rights-and-attribution.md The viewer renders compiled state; evidence policy, provenance lineage, audit retention, and adjudication remain outside this projection layer.
 * @evidenceExclude specifications/execution-and-recovery/artifacts-and-atomic-publication.md The viewer owns a local deterministic loop; workflow execution, retries, recovery, checkpoints, and publication operations remain outside it.
 * @evidenceExclude specifications/execution-and-recovery/cancellation-timeout-and-preemption.md The viewer owns a local deterministic loop; workflow execution, retries, recovery, checkpoints, and publication operations remain outside it.
 * @evidenceExclude specifications/execution-and-recovery/checkpoints-resume-cache-and-dependencies.md The viewer owns a local deterministic loop; workflow execution, retries, recovery, checkpoints, and publication operations remain outside it.
 * @evidenceExclude specifications/execution-and-recovery/concurrent-ownership-and-locking.md The viewer owns a local deterministic loop; workflow execution, retries, recovery, checkpoints, and publication operations remain outside it.
 * @evidenceExclude specifications/execution-and-recovery/failure-reconciliation-and-disaster-recovery.md The viewer owns a local deterministic loop; workflow execution, retries, recovery, checkpoints, and publication operations remain outside it.
 * @evidenceExclude specifications/execution-and-recovery/operational-evidence-and-authority.md The viewer owns a local deterministic loop; workflow execution, retries, recovery, checkpoints, and publication operations remain outside it.
 * @evidenceExclude specifications/execution-and-recovery/portability-migration-and-compatibility.md The viewer owns a local deterministic loop; workflow execution, retries, recovery, checkpoints, and publication operations remain outside it.
 * @evidenceExclude specifications/execution-and-recovery/progress-heartbeats-and-observation.md The viewer owns a local deterministic loop; workflow execution, retries, recovery, checkpoints, and publication operations remain outside it.
 * @evidenceExclude specifications/execution-and-recovery/README.md The viewer owns a local deterministic loop; workflow execution, retries, recovery, checkpoints, and publication operations remain outside it.
 * @evidenceExclude specifications/execution-and-recovery/resource-budgets-and-backpressure.md The viewer owns a local deterministic loop; workflow execution, retries, recovery, checkpoints, and publication operations remain outside it.
 * @evidenceExclude specifications/execution-and-recovery/retention-cleanup-and-quarantine.md The viewer owns a local deterministic loop; workflow execution, retries, recovery, checkpoints, and publication operations remain outside it.
 * @evidenceExclude specifications/execution-and-recovery/retry-backoff-and-idempotency.md The viewer owns a local deterministic loop; workflow execution, retries, recovery, checkpoints, and publication operations remain outside it.
 * @evidenceExclude specifications/execution-and-recovery/scope-and-execution-identities.md The viewer owns a local deterministic loop; workflow execution, retries, recovery, checkpoints, and publication operations remain outside it.
 * @evidenceExclude specifications/execution-and-recovery/state-machine-and-admission.md The viewer owns a local deterministic loop; workflow execution, retries, recovery, checkpoints, and publication operations remain outside it.
 * @evidenceExclude specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-adoption-intent-replay The viewer consumes adopted assets; parsing, identity mapping, trust, retargeting policy, and refusal remain upstream.
 * @evidenceExclude specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-group-composition-boundary The viewer consumes adopted assets; parsing, identity mapping, trust, retargeting policy, and refusal remain upstream.
 * @evidenceExclude specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-native-reinterpretation-boundary The viewer consumes adopted assets; parsing, identity mapping, trust, retargeting policy, and refusal remain upstream.
 * @evidenceExclude specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-selection-override-resolution The viewer consumes adopted assets; parsing, identity mapping, trust, retargeting policy, and refusal remain upstream.
 * @evidenceExclude specifications/interchange-and-adoption/conversion-receipts-and-determinism.md The viewer consumes adopted assets; parsing, identity mapping, trust, retargeting policy, and refusal remain upstream.
 * @evidenceExclude specifications/interchange-and-adoption/identity-coordinates-and-units.md The viewer consumes adopted assets; parsing, identity mapping, trust, retargeting policy, and refusal remain upstream.
 * @evidenceExclude specifications/interchange-and-adoption/intake-authority-and-routing.md The viewer consumes adopted assets; parsing, identity mapping, trust, retargeting policy, and refusal remain upstream.
 * @evidenceExclude specifications/interchange-and-adoption/media-inspection-boundaries.md The viewer consumes adopted assets; parsing, identity mapping, trust, retargeting policy, and refusal remain upstream.
 * @evidenceExclude specifications/interchange-and-adoption/provenance-rights-and-secrets.md The viewer consumes adopted assets; parsing, identity mapping, trust, retargeting policy, and refusal remain upstream.
 * @evidenceExclude specifications/interchange-and-adoption/README.md The viewer consumes adopted assets; parsing, identity mapping, trust, retargeting policy, and refusal remain upstream.
 * @evidenceExclude specifications/interchange-and-adoption/resource-closure-and-acquisition.md The viewer consumes adopted assets; parsing, identity mapping, trust, retargeting policy, and refusal remain upstream.
 * @evidenceExclude specifications/interchange-and-adoption/revision-refresh-and-offline-cache.md The viewer consumes adopted assets; parsing, identity mapping, trust, retargeting policy, and refusal remain upstream.
 * @evidenceExclude specifications/interchange-and-adoption/support-degradation-and-refusal.md The viewer consumes adopted assets; parsing, identity mapping, trust, retargeting policy, and refusal remain upstream.
 * @evidenceExclude specifications/interchange-and-adoption/validation-and-quarantine.md The viewer consumes adopted assets; parsing, identity mapping, trust, retargeting policy, and refusal remain upstream.
 * @evidenceExclude specifications/interior-space/boundaries-openings-and-circulation.md The viewer draws compiled interior space; topology authoring, construction semantics, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/interior-space/construction-phases-and-alternatives.md The viewer draws compiled interior space; topology authoring, construction semantics, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/interior-space/deliverables-and-validation.md The viewer draws compiled interior space; topology authoring, construction semantics, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/interior-space/elements-furnishing-and-clearance.md The viewer draws compiled interior space; topology authoring, construction semantics, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/interior-space/external-assets-and-groups.md The viewer draws compiled interior space; topology authoring, construction semantics, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/interior-space/lighting-acoustics-and-environment.md The viewer draws compiled interior space; topology authoring, construction semantics, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/interior-space/materials-style-and-art.md The viewer draws compiled interior space; topology authoring, construction semantics, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/interior-space/patterns-tolerances-and-aging.md The viewer draws compiled interior space; topology authoring, construction semantics, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/interior-space/README.md The viewer draws compiled interior space; topology authoring, construction semantics, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/interior-space/scope-and-host.md The viewer draws compiled interior space; topology authoring, construction semantics, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/interior-space/services-wet-and-fluid.md The viewer draws compiled interior space; topology authoring, construction semantics, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/interior-space/space-level-zone-topology.md The viewer draws compiled interior space; topology authoring, construction semantics, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/interior-space/surface-assemblies.md The viewer draws compiled interior space; topology authoring, construction semantics, constraint solving, and validation remain upstream.
 * @evidenceExclude specifications/narrative-and-intent/alternatives-revisions-and-compatibility.md The viewer plays compiled scenes; narrative intent, story authority, revision, and screenplay structure remain upstream.
 * @evidenceExclude specifications/narrative-and-intent/budgets-continuity-and-deliverables.md The viewer plays compiled scenes; narrative intent, story authority, revision, and screenplay structure remain upstream.
 * @evidenceExclude specifications/narrative-and-intent/characters-relations-and-state.md The viewer plays compiled scenes; narrative intent, story authority, revision, and screenplay structure remain upstream.
 * @evidenceExclude specifications/narrative-and-intent/design-authority-and-visual-language.md The viewer plays compiled scenes; narrative intent, story authority, revision, and screenplay structure remain upstream.
 * @evidenceExclude specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md The viewer plays compiled scenes; narrative intent, story authority, revision, and screenplay structure remain upstream.
 * @evidenceExclude specifications/narrative-and-intent/events-causality-and-time.md The viewer plays compiled scenes; narrative intent, story authority, revision, and screenplay structure remain upstream.
 * @evidenceExclude specifications/narrative-and-intent/fidelity-references-and-provenance.md The viewer plays compiled scenes; narrative intent, story authority, revision, and screenplay structure remain upstream.
 * @evidenceExclude specifications/narrative-and-intent/locations-subjects-and-assets.md The viewer plays compiled scenes; narrative intent, story authority, revision, and screenplay structure remain upstream.
 * @evidenceExclude specifications/narrative-and-intent/README.md The viewer plays compiled scenes; narrative intent, story authority, revision, and screenplay structure remain upstream.
 * @evidenceExclude specifications/narrative-and-intent/scale-palette-material-and-state.md The viewer plays compiled scenes; narrative intent, story authority, revision, and screenplay structure remain upstream.
 * @evidenceExclude specifications/narrative-and-intent/scene-coverage-and-acceptance.md The viewer plays compiled scenes; narrative intent, story authority, revision, and screenplay structure remain upstream.
 * @evidenceExclude specifications/narrative-and-intent/story-authority-and-hierarchy.md The viewer plays compiled scenes; narrative intent, story authority, revision, and screenplay structure remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-sounding-membership-handoff The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-spacing-overlap-avoidance The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-static-clearance The viewer instances already-resolved slots and does not derive body bounds or validate static member clearance.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-bounds-framing-culling-failures The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-budget-worst-case-cost The viewer applies already-admitted formations; worst-case formation budget calculation and admission remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-geometry-layout-motion-validation The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-layout-ground-validation The viewer instances compiled placements and does not validate resolved slot uniqueness, body clearance, or support-surface contact.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-member-exception-command-event The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-motion-validation The viewer samples compiled formation cues and exceptions but does not validate their identities, bounds, or shot-local intervals.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-determinism-compatibility The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-layer-mask-transition-composition The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/README.md The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-compatibility-fidelity-ceiling The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-retarget-preservation-failure The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-semantic-joint-mapping The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-space-state-and-choreography.md The viewer applies resolved performance state; authoring, solving, retargeting policy, budgets, and validation remain upstream.
 * @evidenceExclude specifications/README.md The repository specification root spans system authority beyond the viewer; this package implements only the directly cited projection leaves.
 * @evidenceExclude specifications/production-evidence/README.md The viewer starts after authoring admission and does not implement evidence stages, graph construction, or project-tree validation.
 * @evidenceExclude specifications/production-evidence/graph.md The viewer starts after authoring admission and does not implement evidence stages, graph construction, or project-tree validation.
 * @evidenceExclude specifications/production-evidence/input.md The viewer starts after authoring admission and does not implement evidence stages, graph construction, or project-tree validation.
 * @evidenceExclude specifications/review-and-acceptance/alternatives-regression-and-revalidation.md The viewer exposes observable frames; oracle policy, review state, acceptance authority, and publication judgment remain outside it.
 * @evidenceExclude specifications/review-and-acceptance/approval-waiver-and-publication.md The viewer exposes observable frames; oracle policy, review state, acceptance authority, and publication judgment remain outside it.
 * @evidenceExclude specifications/review-and-acceptance/case-matrix.md The viewer exposes observable frames; oracle policy, review state, acceptance authority, and publication judgment remain outside it.
 * @evidenceExclude specifications/review-and-acceptance/criteria-tolerance-and-comparison.md The viewer exposes observable frames; oracle policy, review state, acceptance authority, and publication judgment remain outside it.
 * @evidenceExclude specifications/review-and-acceptance/evidence-freshness-and-completeness.md The viewer exposes observable frames; oracle policy, review state, acceptance authority, and publication judgment remain outside it.
 * @evidenceExclude specifications/review-and-acceptance/profiles-aggregation-and-partial-results.md The viewer exposes observable frames; oracle policy, review state, acceptance authority, and publication judgment remain outside it.
 * @evidenceExclude specifications/review-and-acceptance/README.md The viewer exposes observable frames; oracle policy, review state, acceptance authority, and publication judgment remain outside it.
 * @evidenceExclude specifications/review-and-acceptance/subject-description-and-structural-diff.md The viewer draws a subject and reads the frame back; the description record, its bounds authority, and the structural diff between revisions are text products held outside this projection layer.
 * @evidenceExclude specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage The viewer can render one selected subject, but deriving every active library H2 owner, reopening nonvisual facts and artifacts, and aggregating current receipts belong to the production review gate rather than this projection instrument.
 * @evidenceExclude specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-freshness The viewer produces one observation at a time; whether an earlier observation has gone stale is state the review surface keeps, not the instrument that took it.
 * @evidenceExclude specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-coverage The viewer names the planned viewpoints and marks which observation came from which; tallying planned against observed populations across a review is aggregation held outside this projection layer.
 * @evidenceExclude specifications/review-and-acceptance/surfaces-and-sampling.md The viewer exposes observable frames; oracle policy, review state, acceptance authority, and publication judgment remain outside it.
 * @evidenceExclude specifications/review-and-acceptance/target-scope-and-context.md The viewer exposes observable frames; oracle policy, review state, acceptance authority, and publication judgment remain outside it.
 * @evidenceExclude specifications/review-and-acceptance/verdict-authority-and-dissent.md The viewer exposes observable frames; oracle policy, review state, acceptance authority, and publication judgment remain outside it.
 * @evidenceExclude specifications/review-and-acceptance/visual-change-reporting.md The viewer produces pixels a caller may hash; the revision snapshot contract, the deterministic four-state join, its no-render execution boundary, and its separation from review evidence and structural diff are all held outside this projection layer.
 * @evidenceExclude specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/budget-admission.md The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#coupled-world-snapshot-contract The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-moving-object-interaction The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-seek-and-checkpoint-state The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#world-coupling-invalidation-and-refusal The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#atmosphere-composition-light-visibility-output The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#fire-source-fuel-and-lifecycle-state The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#particle-fire-refusal-and-claim-boundary The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#particle-lifecycle-contact-consequence The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#smoke-wind-and-domain-boundary The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/README.md The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/rigid-collision-and-damage.md The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/scope-tiers-and-identities.md The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-failure-and-fidelity-boundary The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md The viewer displays resolved visual effects; solvers, acoustics, sound, budgets, validation, and refusal remain upstream.
 * @evidenceExclude specifications/validation-and-diagnostics/budget-and-truncation.md The viewer consumes validated runtime state; diagnostic taxonomy, aggregation, remediation, and refusal remain in validators and compilers.
 * @evidenceExclude specifications/validation-and-diagnostics/classification-and-causality.md The viewer consumes validated runtime state; diagnostic taxonomy, aggregation, remediation, and refusal remain in validators and compilers.
 * @evidenceExclude specifications/validation-and-diagnostics/collection-order-and-termination.md The viewer consumes validated runtime state; diagnostic taxonomy, aggregation, remediation, and refusal remain in validators and compilers.
 * @evidenceExclude specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md The viewer consumes validated runtime state; diagnostic taxonomy, aggregation, remediation, and refusal remain in validators and compilers.
 * @evidenceExclude specifications/validation-and-diagnostics/external-security-and-redaction.md The viewer consumes validated runtime state; diagnostic taxonomy, aggregation, remediation, and refusal remain in validators and compilers.
 * @evidenceExclude specifications/validation-and-diagnostics/localization-and-machine-results.md The viewer consumes validated runtime state; diagnostic taxonomy, aggregation, remediation, and refusal remain in validators and compilers.
 * @evidenceExclude specifications/validation-and-diagnostics/partial-artifacts-and-refusal.md The viewer consumes validated runtime state; diagnostic taxonomy, aggregation, remediation, and refusal remain in validators and compilers.
 * @evidenceExclude specifications/validation-and-diagnostics/README.md The viewer consumes validated runtime state; diagnostic taxonomy, aggregation, remediation, and refusal remain in validators and compilers.
 * @evidenceExclude specifications/world-and-site/delivery-and-validation.md The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/ecology-weather-and-calendar.md#world-site-calendar-time-celestial-input The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/ecology-weather-and-calendar.md#world-site-ecology-gap-limit The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/ecology-weather-and-calendar.md#world-site-growth-season-disturbance The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/ecology-weather-and-calendar.md#world-site-season-spatial-weather The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-habitat-relation The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/ecology-weather-and-calendar.md#world-site-weather-continuity-source-refusal The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/ecology-weather-and-calendar.md#world-site-weather-sampling-consequence The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/hydrology-coast-and-groundwater.md The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/land-settlements-and-public-space.md The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/partition-lod-streaming-and-seams.md The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/README.md The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/spatial-imports-and-placement.md The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/spatial-reference-and-identity.md The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/temporal-state-and-staleness.md The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/terrain-ground-and-geology.md The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/transport-crossings-and-utilities.md The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @evidenceExclude specifications/world-and-site/traversal-and-visibility.md The viewer draws compiled world state; site authority, geospatial policy, traversal analysis, and validation remain upstream.
 * @author Samchon
 */
export const mountViewer = (
  canvas: HTMLCanvasElement,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  onFrame: (elapsedSeconds: number) => boolean | undefined,
  options?: {
    /**
     * Multisample antialiasing (#1169). Defaults to `true` for live viewing; a
     * CAPTURE path turns it off so structural guide passes (mask/pose/
     * outline/depth) read back crisp and GPU-independent. AA blends segment
     * colors across edges and varies by hardware, breaking byte-stable frames.
     * A WebGL context's AA is fixed at creation, so this is per-mount (the
     * capture route), not per-pass.
     */
    antialias?: boolean;

    /**
     * Canvas pixel ratio (#1169). Defaults to the renderer's own default; a
     * capture path pins `1` so frame pixel dimensions never follow the host's
     * device-pixel-ratio.
     */
    pixelRatio?: number;

    /**
     * Keep the last drawn framebuffer available to a deterministic capture host
     * after its explicit render call. Defaults to `false` for live playback;
     * screenshot and readback hosts opt in.
     */
    preserveDrawingBuffer?: boolean;
  },
): IAutoMovieViewerHandle => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: options?.antialias ?? true,
    preserveDrawingBuffer: options?.preserveDrawingBuffer ?? false,
  });
  if (options?.pixelRatio !== undefined)
    renderer.setPixelRatio(options.pixelRatio);
  const resize = (): void => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();

  let running = true;
  let startMs: number | null = null;

  const loop = (nowMs: number): void => {
    if (!running) return;
    if (startMs === null) startMs = nowMs;
    const handled = onFrame((nowMs - startMs) / 1000);
    if (handled !== true) renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return {
    renderer,
    stop: (): void => {
      running = false;
      releaseViewerRenderer(renderer);
    },
  };
};
