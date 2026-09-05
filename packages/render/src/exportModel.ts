import { tessellate } from "@automovie/engine";
import { IAutoMovieModel, IAutoMovieTransform } from "@automovie/interface";
import type { Document, Material, Node } from "@gltf-transform/core";

/**
 * Serialize an {@link IAutoMovieModel} AST into a binary glTF (`.glb`) byte
 * buffer: the **export** half of automovie's glTF round-trip (ingest is the
 * import half).
 *
 * The model's skeleton becomes a glTF node hierarchy (one node per bone, parent
 * links preserved, rest transforms intact). Each part is tessellated (a
 * primitive through the engine's {@link tessellate}, a mesh passed through) and
 * attached as a mesh node: a rigid part is parented to its `attachedBone` node
 * so the exported file articulates by rotating those bone nodes (no skinning
 * needed), everything else sits at the scene root. Materials map onto glTF's
 * metallic-roughness model, which {@link IAutoMovieMaterial} already mirrors.
 *
 * The result is a self-contained `.glb` (geometry embedded in one buffer) that
 * any glTF viewer, or automovie's own ingest, can load. Geometry that the
 * engine only approximates (a capsule tessellates to its bounding cylinder)
 * exports at that fidelity.
 *
 * **Fidelity reductions against the live viewer (#1088).** A skinned mesh part
 * (`attachedBone: null` with `skin` data) exports as a STATIC mesh (no
 * `JOINTS_0`/`WEIGHTS_0`, no glTF skin), so it renders at its rest shape in
 * external viewers; only rigid `attachedBone` parts articulate in the export. A
 * mesh without authored normals exports SMOOTH vertex normals when indexed (the
 * same area-weighted computation the viewer's `computeVertexNormals` performs);
 * a non-indexed triangle soup omits `NORMAL`, and glTF's mandated flat shading
 * equals what the viewer computes for a soup anyway.
 *
 * @evidence requirements/product/scope-and-exclusions.md#product-editor-export-exclusion Limits this operation to one model artifact instead of claiming generic scene editing or export.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-prototype-exclusion-compatibility Preserves the product boundary while emitting a reproducible downstream fidelity artifact.
 * @evidenceExclude requirements/asset-authoring/README.md#자산-저작-요구사항 GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/era-and-style.md#asset-style-as-input GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/era-and-style.md#asset-style-catalogue-refusal GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/era-and-style.md#asset-style-mixing GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/era-and-style.md#asset-style-reference-role GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-bounded-decoder GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-adoption-mode GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-conversion-receipt GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-gltf-scene GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-group-composition GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-provenance-digest GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-replacement GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-resource-closure GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-scene-graph-preservation GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-secret-boundary GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-semantic-enrichment GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md#asset-generated-adoption-modes GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md#asset-generation-attempt-lineage GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md#asset-generation-fixed-output GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md#asset-generation-input-rights GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md#asset-generation-refusal GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md#asset-generation-reproducibility-boundary GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md#asset-procedural-generation-distinction GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/geometry.md#asset-composable-geometry-operations GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/geometry.md#asset-degenerate-geometry-refusal GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/geometry.md#asset-geometry-dimensions GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/geometry.md#asset-geometry-topology GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/identity-and-instances.md#asset-compression-individuality GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/identity-and-instances.md#asset-instance-override-provenance GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/identity-and-instances.md#asset-logical-group GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/identity-and-instances.md#asset-variant-inheritance GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/materials-and-textures.md#asset-material-composition GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/materials-and-textures.md#asset-material-image-independence GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/materials-and-textures.md#asset-material-state GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/materials-and-textures.md#asset-texture-coordinates-scale GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/materials-and-textures.md#asset-texture-provenance GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/materials-and-textures.md#asset-user-authored-texture GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/patterns-and-procedural-composition.md#asset-deterministic-variation GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/patterns-and-procedural-composition.md#asset-pattern-boundary-exception GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/patterns-and-procedural-composition.md#asset-pattern-local-stability GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/patterns-and-procedural-composition.md#asset-physical-module GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/patterns-and-procedural-composition.md#asset-procedural-rule GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-bounds-state-motion GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-declared-measured-bounds GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-proxy-lineage GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-transition-stability GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-representation-selection GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-representation-semantic-preservation The serializer deliberately discloses static-skin and normal-generation fidelity reductions, so it cannot claim the full representation-substitution invariant.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-representation-stale-refusal GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-deformable-surface GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-derived-deformation-basis GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-general-joint-relations GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-invalid-rig-refusal GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-motion-retargeting GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-state-motion-distinction GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-external-generated-validation GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-geometry-validation GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-purpose-validation GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-representation-bounds-validation GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-rig-validation GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-surface-validation GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-validation-gap GLB serialization preserves a supplied bounded model; asset acquisition, creation, editing, and validation remain with their owning authoring layer.
 * @evidenceExclude requirements/product/README.md#제품-계약-요구사항 GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/authorability.md#product-authoring-choice-space GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/authorability.md#product-discoverable-control GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/authorability.md#product-explicit-control GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/authorability.md#product-hidden-inference-refusal GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/capability-and-content.md#product-catalogue-refusal GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/capability-and-content.md#product-era-independent-composition GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/capability-and-content.md#product-example-role GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/capability-and-content.md#product-project-owned-content GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/capability-and-content.md#product-unplanted-subject-authoring GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/charter.md#product-author-owned-film GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/charter.md#product-reproducible-judgment GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/charter.md#product-structural-output GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/choice-and-external-services.md#product-delegation-not-proxy-decision GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/choice-and-external-services.md#product-deterministic-external-adoption GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/choice-and-external-services.md#product-external-substitution-choice GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/choice-and-external-services.md#product-provider-neutral-capability GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/extensibility-and-compatibility.md#product-capability-gap GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/extensibility-and-compatibility.md#product-explicit-protocol-change GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/extensibility-and-compatibility.md#product-independent-extension-axes GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/extensibility-and-compatibility.md#product-omission-compatibility GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/prototype-quality.md#product-authored-variation-determinism GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/prototype-quality.md#product-prototype-geometry GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/prototype-quality.md#product-prototype-handoff GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/prototype-quality.md#product-prototype-motion-time GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/prototype-quality.md#product-prototype-readability GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/scope-and-exclusions.md#product-content-catalogue-exclusion GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/scope-and-exclusions.md#product-exclusion-reopening GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude requirements/product/scope-and-exclusions.md#product-nondeterministic-completion-exclusion GLB serialization preserves a supplied bounded model; product scope, governance, and authoring choice remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/README.md#자산과-표현-시스템-사양 GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-alternative-failure-compatibility GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-alternative-selection-output GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-deterministic-instance-generation GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-external-adoption-alternatives GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-group-individuality GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-instance-override-resolution GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-variant-inheritance GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-bounds-inputs GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-bounds-lod-failures GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-dynamic-bounds-invariants GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-output-costs GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-selection-policy GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-transition-invariants GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-proxy-purpose-lineage GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-compatibility-ceiling GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-current-evidence GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-motion-transitions GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-purpose-inputs GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-status-failures GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-surface-visual GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-adoption-failures GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-adoption-output GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-attempt-identity GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-credential-boundary GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-reproducibility GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-derivation-validation GLB serialization emits bytes for one supplied model snapshot; it neither accepts repaint identities nor validates a repaint derivation chain.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-eligibility-source-lock GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-execution-eligibility GLB serialization receives no repaint provider, reference, review, or delivery request, so repaint execution eligibility belongs to the calling workflow.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-failure-publication GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-manual-routing GLB serialization never selects or invokes a repaint route; it deterministically preserves the supplied model as GLB bytes.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-structure-continuity GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-adoption-output GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-identity-failure-compatibility GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-identity-inputs GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-lifecycle-states GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-model-resource-separation GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-source-revision-content GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-era-style-inputs GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-procedural-pattern-inputs GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-surface-coordinate-convention GLB serialization carries a coordinate set it neither lays nor re-cuts, so it names no coordinate-set kind and runs no operation whose handedness this unit fixes.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-surface-resource-closure GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-surface-states-substitution GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-derived-deformation-staleness GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-joint-control-invariants GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-retarget-compatibility GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-output-failures GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-skin-morph-facts GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-state-motion-separation GLB serialization converts a supplied bounded model; asset adoption, representation authoring, and fidelity validation remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/README.md#저작과-권한-시스템-명세 GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-extension-compatibility GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-failure-gap GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-not-content-invariant GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-state GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-system-project-responsibility GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-agent-input-output GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-violation-failure GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-decision-authority-state GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-runtime-evidence-authority-invariant GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-user-director-input GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-basis Model serialization writes one bounded asset payload from already-validated geometry and owns no project derived ledger, generator basis, generation attempt, compile-time freshness decision, publication path gate, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-budget-boundary Model serialization writes one bounded asset payload from already-validated geometry and owns no project derived ledger, generator basis, generation attempt, compile-time freshness decision, publication path gate, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-freshness Model serialization writes one bounded asset payload from already-validated geometry and owns no project derived ledger, generator basis, generation attempt, compile-time freshness decision, publication path gate, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-generation Model serialization writes one bounded asset payload from already-validated geometry and owns no project derived ledger, generator basis, generation attempt, compile-time freshness decision, publication path gate, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-manifest Model serialization writes one bounded asset payload from already-validated geometry and owns no project derived ledger, generator basis, generation attempt, compile-time freshness decision, publication path gate, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-portability Model serialization writes one bounded asset payload from already-validated geometry and owns no project derived ledger, generator basis, generation attempt, compile-time freshness decision, publication path gate, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-adoption-output GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-execution-state GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-failure-substitution GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-request-output GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-selection-input GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-provider-compatibility GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-provider-source-invariant GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-boundary-compatibility GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-content-side-effect-invariant GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-diagnostic-failure GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-atomic-invariant GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-omission-failure GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-result-checkpoint GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-resume-compatibility GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-work-state GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-choice-determinism-invariant GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-deterministic-input-identity GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-downstream-fidelity-output GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-structural-output-invariant GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-derivation-output-lineage GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-change-impact-report GLB serialization emits bytes for one supplied model snapshot; it does not compare source revisions or report which downstream targets and evidence became stale.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-change-impact-invariant GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-ownership-failure GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-resume-compatibility GLB serialization converts a supplied bounded model; authoring authority, delegation, and production control remain with their owning layer.
 * @author Samchon
 * @evidenceExclude specifications/authoring-and-authority/production-language.md#spec-authoring-production-language-module The render package schedules frames and plans captions from compiled artifacts; the production language module and the delivery index are generated-project authoring contracts owned by the evidence and template packages.
 */
export const exportModelToGLB = async (
  model: IAutoMovieModel,
): Promise<Uint8Array> => {
  // Acquired here rather than at module scope, because this is the workspace's
  // only runtime edge to `@gltf-transform/core` and the barrel re-exports this
  // module. `@automovie/production` imports one path helper from that barrel,
  // so an eager import made every generated project's `scripts/compile.ts` load
  // a glTF serializer it never calls. Under Node 22 that load fails outright:
  // the package's `require` condition serves `dist/index.cjs`, whose first act
  // is `require("property-graph")`, and `property-graph` is ESM-only, so the
  // ESM-to-CJS translator's synthetic `require` returns undefined and the
  // compile dies with `Cannot read properties of undefined (reading 'exports')`.
  // Every `@gltf-transform/core` import in `@automovie/ingest` is `import type`
  // and erases, which is why ingest never showed this and render did.
  //
  // This is containment, not a cure. The translator defect is the Node line's:
  // the identical command succeeds on 24.18.0 and fails on the 22.15.0 that
  // `useNodeVersion` pins. Deferring the load to the call means the path that
  // never calls this function never pays for it, and the callers that do are
  // CommonJS entries where `require` of an ESM package is supported.
  const { Document: GLTFDocument, NodeIO } =
    await import("@gltf-transform/core");
  const doc: Document = new GLTFDocument();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(model.name ?? model.id);

  // ── materials → glTF metallic-roughness ──
  const materials = new Map<string, Material>();
  for (const m of model.materials) {
    const mat = doc
      .createMaterial(m.name ?? m.id)
      .setBaseColorFactor([
        m.baseColor.r,
        m.baseColor.g,
        m.baseColor.b,
        // The live viewer renders `opacity` (three's material opacity) and
        // ignores baseColor.a, so `{opacity: 0.5, a: null}` was 50%
        // transparent live yet fully opaque exported (#1088). Fold opacity
        // into the one alpha glTF has.
        (m.baseColor.a ?? 1) * m.opacity,
      ])
      .setMetallicFactor(m.metallic)
      .setRoughnessFactor(m.roughness);
    if (m.emissive !== null)
      mat.setEmissiveFactor([m.emissive.r, m.emissive.g, m.emissive.b]);
    if (m.opacity < 1) mat.setAlphaMode("BLEND");
    materials.set(m.id, mat);
  }

  // ── skeleton → node hierarchy ──
  const boneNodes = new Map<string, Node>();
  if (model.skeleton !== null) {
    for (const b of model.skeleton.bones)
      boneNodes.set(b.bone, setBoneRest(doc.createNode(b.bone), b.rest));
    for (const b of model.skeleton.bones) {
      const node = boneNodes.get(b.bone)!;
      if (b.parent === null) {
        scene.addChild(node);
        continue;
      }
      const parent = boneNodes.get(b.parent);
      if (parent === undefined)
        throw new Error(
          `skeleton bone "${b.bone}" references missing parent "${b.parent}"`,
        );
      parent.addChild(node);
    }
  }

  // ── parts → mesh nodes ──
  for (const part of model.parts) {
    const t =
      part.geometry.type === "primitive"
        ? tessellate(part.geometry.shape)
        : {
            positions: part.geometry.mesh.positions,
            // The viewer computes smooth vertex normals when none are
            // authored; omitting NORMAL here meant glTF-mandated flat
            // shading instead (#1088). Match the viewer for indexed meshes;
            // a non-indexed soup's computed normals ARE flat, which the
            // glTF default already provides.
            normals:
              part.geometry.mesh.normals ??
              (part.geometry.mesh.indices === null
                ? []
                : computeSmoothNormals(
                    part.geometry.mesh.positions,
                    part.geometry.mesh.indices,
                  )),
            indices: part.geometry.mesh.indices ?? [],
          };

    const prim = doc
      .createPrimitive()
      .setAttribute(
        "POSITION",
        doc
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(t.positions))
          .setBuffer(buffer),
      );
    if (t.normals.length !== 0)
      prim.setAttribute(
        "NORMAL",
        doc
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(t.normals))
          .setBuffer(buffer),
      );
    if (t.indices.length !== 0)
      prim.setIndices(
        doc
          .createAccessor()
          .setType("SCALAR")
          .setArray(new Uint32Array(t.indices))
          .setBuffer(buffer),
      );
    if (part.material !== null) {
      const mat = materials.get(part.material);
      if (mat === undefined)
        throw new Error(
          `part "${part.id}" references missing material "${part.material}"`,
        );
      prim.setMaterial(mat);
    }

    const label = part.name ?? part.id;
    const node = setTRS(
      doc.createNode(label).setMesh(doc.createMesh(label).addPrimitive(prim)),
      part.transform,
    );
    if (part.attachedBone === null) {
      scene.addChild(node);
      continue;
    }
    const boneNode = boneNodes.get(part.attachedBone);
    if (boneNode === undefined)
      throw new Error(
        `part "${part.id}" references missing attachedBone "${part.attachedBone}"`,
      );
    boneNode.addChild(node);
  }

  return new NodeIO().writeBinary(doc);
};

/** Apply an automovie TRS transform onto a glTF node (no-op for `null`). */
const setTRS = (node: Node, t: IAutoMovieTransform | null): Node => {
  if (t === null) return node;
  return node
    .setTranslation([t.translation.x, t.translation.y, t.translation.z])
    .setRotation([t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w])
    .setScale([t.scale.x, t.scale.y, t.scale.z]);
};

/**
 * Area-weighted smooth vertex normals over an indexed triangle list, the same
 * computation three's `computeVertexNormals` performs for the live viewer
 * (#1088): each triangle's unnormalized cross product accumulates onto its
 * three vertices (the magnitude IS the area weight), then each vertex normal is
 * normalized. A degenerate vertex (no area) stays zero rather than NaN.
 */
const computeSmoothNormals = (
  positions: number[],
  indices: number[],
): number[] => {
  const normals = new Array<number>(positions.length).fill(0);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i]!, indices[i + 1]!, indices[i + 2]!];
    const abx = positions[b * 3]! - positions[a * 3]!;
    const aby = positions[b * 3 + 1]! - positions[a * 3 + 1]!;
    const abz = positions[b * 3 + 2]! - positions[a * 3 + 2]!;
    const acx = positions[c * 3]! - positions[a * 3]!;
    const acy = positions[c * 3 + 1]! - positions[a * 3 + 1]!;
    const acz = positions[c * 3 + 2]! - positions[a * 3 + 2]!;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const v of [a, b, c]) {
      normals[v * 3] = normals[v * 3]! + nx;
      normals[v * 3 + 1] = normals[v * 3 + 1]! + ny;
      normals[v * 3 + 2] = normals[v * 3 + 2]! + nz;
    }
  }
  for (let v = 0; v < normals.length; v += 3) {
    const len = Math.hypot(normals[v]!, normals[v + 1]!, normals[v + 2]!);
    if (len === 0) continue;
    normals[v] = normals[v]! / len;
    normals[v + 1] = normals[v + 1]! / len;
    normals[v + 2] = normals[v + 2]! / len;
  }
  return normals;
};

/**
 * Apply a bone REST transform: rotation + translation only, unit scale, the
 * decision-309 rig convention (#1052, #1086). The engine's FK and the live
 * viewer both ignore bone-rest scale, so exporting it verbatim would let
 * external glTF viewers compose into every descendant a scale no automovie
 * renderer or validator ever saw. PART node scale stays first-class through
 * {@link setTRS}. Parts are not rig bones on either side of the convention.
 */
const setBoneRest = (node: Node, rest: IAutoMovieTransform): Node =>
  node
    .setTranslation([
      rest.translation.x,
      rest.translation.y,
      rest.translation.z,
    ])
    .setRotation([
      rest.rotation.x,
      rest.rotation.y,
      rest.rotation.z,
      rest.rotation.w,
    ]);
