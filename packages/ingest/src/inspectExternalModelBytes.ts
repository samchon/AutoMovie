import {
  AutoMovieHumanoidBone,
  IAutoMovieClip,
  IAutoMovieTrack,
  IAutoMovieTransform,
} from "@automovie/interface";

/**
 * One external URI whose exact resident bytes participate in model ingest.
 *
 * @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-media-dependencies Declares every glTF sidecar needed to interpret the selected bytes.
 * @evidence specifications/interchange-and-adoption/resource-closure-and-acquisition.md#interchange-media-dependency-extraction Emits the URI, role, and declared length of each dependency.
 * @author Samchon
 */
export interface IAutoMovieExternalModelResource {
  /**
   * URI as declared by glTF.
   *
   * @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-location-boundary Keeps the declared locator visible for compiler-owned resolution.
   * @evidence specifications/interchange-and-adoption/resource-closure-and-acquisition.md#interchange-locator-redirect-fence Resolution remains outside the inspector's provider-neutral boundary.
   */
  uri: string;
  /**
   * Resource role.
   *
   * @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-media-dependencies Distinguishes buffer and image dependency obligations.
   * @evidence specifications/interchange-and-adoption/resource-closure-and-acquisition.md#interchange-media-dependency-extraction Preserves the media-specific dependency role.
   */
  kind: "buffer" | "image";
  /**
   * Exact declared byte length for buffers; images carry no glTF length.
   *
   * @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-media-dependencies Retains the glTF buffer length needed for closure validation.
   * @evidence specifications/interchange-and-adoption/resource-closure-and-acquisition.md#interchange-media-dependency-extraction Carries the declared bound beside the dependency identity.
   */
  byteLength: number | null;
}

/**
 * Byte-level facts accepted by the external-model compiler boundary.
 *
 * This inspection is intentionally synchronous: the production compiler owns
 * exact resident bytes and must reject malformed glTF/GLB/VRM before source
 * materialization. Hosts still use their native loader to construct the final
 * render mesh from the same content-addressed asset.
 *
 * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-gltf-glb Exposes validated glTF or GLB facts without accepting filename claims alone.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-gltf-glb-inspection Returns the bounded scene, resource, rig, and animation inventory.
 * @author Samchon
 */
export interface IAutoMovieExternalModelInspection {
  /**
   * Fixed normalization profile applied to these facts.
   *
   * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-extensible-families Uses an explicit versioned family profile rather than a guessed decoder.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-extensible-media-profile Makes profile extension additive and named.
   */
  profile: AutoMovieExternalModelIngestProfile;
  /**
   * Parsed container family.
   *
   * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-gltf-glb Distinguishes JSON glTF, GLB, and VRM facts.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-gltf-glb-inspection Reports the verified container family.
   */
  format: "gltf" | "glb" | "vrm";
  /**
   * GlTF asset version.
   *
   * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-gltf-glb Rejects unsupported glTF versions at the family boundary.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-gltf-glb-inspection Fixes the accepted glTF interpretation version.
   */
  version: "2.0";
  /**
   * Declared scene graph inventory.
   *
   * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-gltf-glb Inventories nodes, meshes, skins, and animations from resident bytes.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-gltf-glb-inspection Exposes bounded element counts for adoption preview.
   */
  counts: {
    /** Declared node count. */
    nodes: number;
    /** Declared mesh count. */
    meshes: number;
    /** Declared skin count. */
    skins: number;
    /** Declared animation count. */
    animations: number;
  };
  /**
   * Unique extension identities in code-unit order.
   *
   * @evidence requirements/external-inputs/unsupported-and-degradation.md#external-unsupported-format-feature Makes declared feature identities available for support decisions.
   * @evidence specifications/interchange-and-adoption/support-degradation-and-refusal.md#interchange-format-feature-support-matrix Preserves a deterministic extension inventory.
   */
  extensions: string[];
  /**
   * Unique non-data external buffer/image dependencies in URI order.
   *
   * @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-media-dependencies Enumerates the exact external closure the compiler must bind.
   * @evidence specifications/interchange-and-adoption/resource-closure-and-acquisition.md#interchange-media-dependency-extraction Emits dependencies in deterministic URI order.
   */
  resources: IAutoMovieExternalModelResource[];
  /**
   * Authoritative normalized humanoid mapping proved by the selected profile.
   *
   * @evidence requirements/asset-authoring/validation.md#asset-rig-validation Exposes only mapped joints that resolve inside the validated rig inventory.
   * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Reports normalized rig facts after structural checks.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-output-failures Returns humanoid bone facts only after rig mapping validation succeeds.
   */
  humanoidBones: Array<{
    /** Normalized humanoid role. */
    bone: AutoMovieHumanoidBone;
    /** Source node index carrying the role. */
    node: number;
    /** Whether validated skin weights visibly use the joint. */
    weighted: boolean;
  }>;
  /**
   * Normalized node-track takes under the explicit motion profile.
   *
   * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-motion Exposes take, target, key-time, value, and interpolation facts.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Separates inspected motion facts from later mapping and adoption decisions.
   */
  motion?: IAutoMovieExternalMotionInspection;
}

/**
 * Canonical glTF 2.0 spatial interpretation used by motion inspection.
 *
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Makes meter units, right-handed coordinates, and Y-up orientation explicit instead of inferred downstream.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Fixes the source basis at the first stage of the spatial transform chain.
 */
export const AUTOMOVIE_GLTF_MOTION_INTERPRETATION_PROFILE =
  "gltf-2.0-meter-right-handed-y-up" as const;

/**
 * One source-order node whose local rest basis was read from motion bytes.
 *
 * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-motion Preserves the source skeleton identity and rest basis beside its motion tracks.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Exposes node identity, hierarchy, and local rest facts before any retarget decision.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionNodeInspection {
  /**
   * Stable source-order node identity used by normalized tracks and mappings.
   *
   * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-gltf-glb Keeps every scene node distinct under a deterministic source-local key.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-gltf-glb-inspection Emits an index-stable node inventory.
   */
  id: string;
  /**
   * Exact zero-based node index in the inspected glTF revision.
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-elements-dependencies Retains the format-defined element position beside the normalized identity.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-element-dependency-identity Uses the deterministic source-order key rather than a display label.
   */
  index: number;
  /**
   * Non-empty source display name when one was declared, otherwise null.
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-elements-dependencies Keeps labels separate from the stable source-local identity.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-element-dependency-identity Prevents duplicate or mutable display names from becoming element keys.
   */
  name: string | null;
  /**
   * Stable immediate parent node identity, or null for a source root.
   *
   * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-gltf-glb Preserves the selected source node hierarchy without flattening multiple roots.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-gltf-glb-inspection Reports validated node parentage as an inspection fact.
   */
  parent: string | null;
  /**
   * Parent-local rest transform under the declared glTF interpretation.
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Carries finite source-local TRS values under explicit axis and unit semantics.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Supplies the validated local-transform stage of the source-to-project chain.
   */
  transform: IAutoMovieTransform;
}

/**
 * Animation facts normalized from one exact glTF, GLB, or VRM byte revision.
 *
 * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-motion Normalizes selected external performance data into named node tracks.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Inventories take identity, channel targets, time, values, and interpolation.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionInspection {
  /**
   * Exact path whose container suffix selected the bounded decoder.
   *
   * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-motion Keeps the selected motion source identity visible.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Binds inspected take facts to their source path.
   */
  path: string;
  /**
   * Resident byte length inspected by the decoder.
   *
   * @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-original-bytes Records the resident source byte boundary without rewriting it.
   * @evidence specifications/interchange-and-adoption/resource-closure-and-acquisition.md#interchange-original-byte-preservation Keeps normalized facts tied to the original byte count.
   */
  byteLength: number;
  /**
   * Fixed meter, right-handed, Y-up interpretation of every node and track.
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Declares the source coordinate and unit basis before adoption.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Makes the source basis an explicit transform-chain input.
   */
  interpretation: typeof AUTOMOVIE_GLTF_MOTION_INTERPRETATION_PROFILE;
  /**
   * Source-order node identity, hierarchy, and normalized local rest facts.
   *
   * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-motion Carries the source skeleton and rest basis with the inspected clip.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Provides the byte-grounded node inventory used by later mapping validation.
   */
  nodes: IAutoMovieExternalMotionNodeInspection[];
  /**
   * Stable node identities available to an explicit source-rig mapping.
   *
   * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-motion Exposes motion targets without assigning semantic bones.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Keeps retarget mapping outside inspection facts.
   */
  nodeIds: string[];
  /**
   * Source-order takes rewritten as deterministic AutoMovie node tracks.
   *
   * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-motion Preserves take and track order from the selected bytes.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Returns normalized samples for later explicit adoption.
   */
  takes: IAutoMovieClip[];
}

/**
 * Supported fixed normalization profiles at the compiler ingest boundary.
 *
 * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-extensible-families Adds motion as one explicit, versioned glTF profile.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-extensible-media-profile Keeps format expansion additive and bounded.
 */
export type AutoMovieExternalModelIngestProfile =
  | "gltf-static-v1"
  | "gltf-humanoid-v1"
  | "gltf-motion-v1"
  | "vrm-humanoid-v1";

const INGEST_PROFILE_REGISTRY = {
  "gltf-static-v1": true,
  "gltf-humanoid-v1": true,
  "gltf-motion-v1": true,
  "vrm-humanoid-v1": true,
} satisfies Record<AutoMovieExternalModelIngestProfile, true>;

/**
 * Every supported ingest profile literal, in declaration order.
 *
 * The object above is pinned to the profile union by `satisfies`, so a literal
 * added to or removed from the type changes this runtime vocabulary in the same
 * edit; a command surface that consults it cannot lag behind the inspector.
 *
 * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-extensible-families Publishes the closed, versioned profile vocabulary a caller may select from rather than a guessed family.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-extensible-media-profile Gives profile extension one additive runtime inventory that stays equal to the declared union.
 */
export const AUTO_MOVIE_EXTERNAL_MODEL_INGEST_PROFILES: readonly AutoMovieExternalModelIngestProfile[] =
  Object.freeze(
    Object.keys(INGEST_PROFILE_REGISTRY) as AutoMovieExternalModelIngestProfile[],
  );

/**
 * Whether an untyped selection names one supported ingest profile.
 *
 * @evidence requirements/external-inputs/unsupported-and-degradation.md#external-unsupported-format-feature Refuses a profile name outside the supported vocabulary before any bytes are interpreted under it.
 * @evidence specifications/interchange-and-adoption/support-degradation-and-refusal.md#interchange-format-feature-support-matrix Decides profile membership from the same closed inventory the inspector enforces.
 */
export const isAutoMovieExternalModelIngestProfile = (
  value: unknown,
): value is AutoMovieExternalModelIngestProfile =>
  typeof value === "string" && SUPPORTED_PROFILES.has(value);

/**
 * Parse and validate exact external model bytes before compilation.
 *
 * The inspector accepts glTF 2.0 JSON, GLB 2.0, and VRM 0.x/1.x GLB containers,
 * validates referenced indices and structural profile promises, and returns
 * every sidecar URI the compiler must bind to manifest-owned bytes. It never
 * guesses a profile or repairs malformed input.
 *
 * @evidence requirements/asset-authoring/README.md#자산-저작-요구사항 Provides the bounded external model and motion inspection capability.
 * @evidence requirements/external-inputs/README.md#외부-입력-요구사항 Applies shared external-input validation to resident glTF-family bytes.
 * @evidence specifications/asset-and-representation/README.md#자산과-표현-시스템-사양 Establishes the external representation facts available to later asset stages.
 * @evidence specifications/interchange-and-adoption/README.md#interchange와-adoption-시스템-계약 Implements the resident-byte inspection boundary before adoption.
 * @evidenceExclude requirements/asset-authoring/era-and-style.md#asset-style-as-input Ingest preserves declared model facts but does not author, mix, select, or catalogue visual styles.
 * @evidenceExclude requirements/asset-authoring/era-and-style.md#asset-style-reference-role Ingest preserves declared model facts but does not author, mix, select, or catalogue visual styles.
 * @evidenceExclude requirements/asset-authoring/era-and-style.md#asset-style-mixing Ingest preserves declared model facts but does not author, mix, select, or catalogue visual styles.
 * @evidenceExclude requirements/asset-authoring/era-and-style.md#asset-style-catalogue-refusal Ingest preserves declared model facts but does not author, mix, select, or catalogue visual styles.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Ingest consumes fixed resident bytes and owns no generator, provider, attempt, rights, or generated-output adoption policy.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md#asset-generation-attempt-lineage Ingest consumes fixed resident bytes and owns no generator, provider, attempt, rights, or generated-output adoption policy.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md#asset-generation-reproducibility-boundary Ingest consumes fixed resident bytes and owns no generator, provider, attempt, rights, or generated-output adoption policy.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md#asset-generation-input-rights Ingest consumes fixed resident bytes and owns no generator, provider, attempt, rights, or generated-output adoption policy.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md#asset-generation-fixed-output Ingest consumes fixed resident bytes and owns no generator, provider, attempt, rights, or generated-output adoption policy.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md#asset-procedural-generation-distinction Ingest consumes fixed resident bytes and owns no generator, provider, attempt, rights, or generated-output adoption policy.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md#asset-generated-adoption-modes Ingest consumes fixed resident bytes and owns no generator, provider, attempt, rights, or generated-output adoption policy.
 * @evidenceExclude requirements/asset-authoring/generated-assets.md#asset-generation-refusal Ingest consumes fixed resident bytes and owns no generator, provider, attempt, rights, or generated-output adoption policy.
 * @evidenceExclude requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Ingest validates imported mesh records but does not author geometry operations, dimensions, topology roles, or solids.
 * @evidenceExclude requirements/asset-authoring/geometry.md#asset-geometry-dimensions Ingest validates imported mesh records but does not author geometry operations, dimensions, topology roles, or solids.
 * @evidenceExclude requirements/asset-authoring/geometry.md#asset-geometry-topology Ingest validates imported mesh records but does not author geometry operations, dimensions, topology roles, or solids.
 * @evidenceExclude requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Ingest validates imported mesh records but does not author geometry operations, dimensions, topology roles, or solids.
 * @evidenceExclude requirements/asset-authoring/geometry.md#asset-degenerate-geometry-refusal Ingest validates imported mesh records but does not author geometry operations, dimensions, topology roles, or solids.
 * @evidenceExclude requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance Ingest preserves source nodes but does not create prototypes, instances, logical groups, override provenance, or variants.
 * @evidenceExclude requirements/asset-authoring/identity-and-instances.md#asset-logical-group Ingest preserves source nodes but does not create prototypes, instances, logical groups, override provenance, or variants.
 * @evidenceExclude requirements/asset-authoring/identity-and-instances.md#asset-compression-individuality Ingest preserves source nodes but does not create prototypes, instances, logical groups, override provenance, or variants.
 * @evidenceExclude requirements/asset-authoring/identity-and-instances.md#asset-instance-override-provenance Ingest preserves source nodes but does not create prototypes, instances, logical groups, override provenance, or variants.
 * @evidenceExclude requirements/asset-authoring/identity-and-instances.md#asset-variant-inheritance Ingest preserves source nodes but does not create prototypes, instances, logical groups, override provenance, or variants.
 * @evidenceExclude requirements/asset-authoring/materials-and-textures.md#asset-material-image-independence Ingest closes image dependencies but does not author material relations, texture placement, surface states, or texture provenance.
 * @evidenceExclude requirements/asset-authoring/materials-and-textures.md#asset-material-composition Ingest closes image dependencies but does not author material relations, texture placement, surface states, or texture provenance.
 * @evidenceExclude requirements/asset-authoring/materials-and-textures.md#asset-texture-coordinates-scale Ingest closes image dependencies but does not author material relations, texture placement, surface states, or texture provenance.
 * @evidenceExclude requirements/asset-authoring/materials-and-textures.md#asset-user-authored-texture Ingest closes image dependencies but does not author material relations, texture placement, surface states, or texture provenance.
 * @evidenceExclude requirements/asset-authoring/materials-and-textures.md#asset-material-state Ingest closes image dependencies but does not author material relations, texture placement, surface states, or texture provenance.
 * @evidenceExclude requirements/asset-authoring/materials-and-textures.md#asset-texture-provenance Ingest closes image dependencies but does not author material relations, texture placement, surface states, or texture provenance.
 * @evidenceExclude requirements/asset-authoring/patterns-and-procedural-composition.md#asset-physical-module Ingest performs no modular pattern authoring, procedural rule evaluation, seeded variation, or local-stability update.
 * @evidenceExclude requirements/asset-authoring/patterns-and-procedural-composition.md#asset-procedural-rule Ingest performs no modular pattern authoring, procedural rule evaluation, seeded variation, or local-stability update.
 * @evidenceExclude requirements/asset-authoring/patterns-and-procedural-composition.md#asset-deterministic-variation Ingest performs no modular pattern authoring, procedural rule evaluation, seeded variation, or local-stability update.
 * @evidenceExclude requirements/asset-authoring/patterns-and-procedural-composition.md#asset-pattern-boundary-exception Ingest performs no modular pattern authoring, procedural rule evaluation, seeded variation, or local-stability update.
 * @evidenceExclude requirements/asset-authoring/patterns-and-procedural-composition.md#asset-pattern-local-stability Ingest performs no modular pattern authoring, procedural rule evaluation, seeded variation, or local-stability update.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-declared-measured-bounds Ingest emits no declared or measured bounds, proxy lineage, LOD policy, transition, or derivative freshness result.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-bounds-state-motion Ingest emits no declared or measured bounds, proxy lineage, LOD policy, transition, or derivative freshness result.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-proxy-lineage Ingest emits no declared or measured bounds, proxy lineage, LOD policy, transition, or derivative freshness result.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-representation-selection Ingest emits no declared or measured bounds, proxy lineage, LOD policy, transition, or derivative freshness result.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-representation-semantic-preservation Ingest emits no declared or measured bounds, proxy lineage, LOD policy, transition, or derivative freshness result.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-transition-stability Ingest emits no declared or measured bounds, proxy lineage, LOD policy, transition, or derivative freshness result.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-representation-stale-refusal Ingest emits no declared or measured bounds, proxy lineage, LOD policy, transition, or derivative freshness result.
 * @evidenceExclude requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-loss Ingest returns bounded facts and a motion handoff, while the compiler owns the complete canonical conversion, loss, digest, and freshness receipt.
 * @evidenceExclude requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-canonical-result Ingest returns bounded facts and a motion handoff, while the compiler owns the complete canonical conversion, loss, digest, and freshness receipt.
 * @evidenceExclude requirements/external-inputs/conversion-receipts-and-determinism.md#external-generation-reproducibility-boundary Ingest returns bounded facts and a motion handoff, while the compiler owns the complete canonical conversion, loss, digest, and freshness receipt.
 * @evidenceExclude requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-freshness Ingest returns bounded facts and a motion handoff, while the compiler owns the complete canonical conversion, loss, digest, and freshness receipt.
 * @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-credential-separation Public inspection inputs and results admit no credential, token, provider account, or secret-bearing authority.
 * @evidenceExclude requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-source-record The pure ingest APIs accept no credential authority and own no rights, acquisition, sensitive-data, provenance, or consumer ledger.
 * @evidenceExclude requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-acquisition-activity The pure ingest APIs accept no credential authority and own no rights, acquisition, sensitive-data, provenance, or consumer ledger.
 * @evidenceExclude requirements/external-inputs/credentials-rights-and-provenance.md#external-rights-license-conditions The pure ingest APIs accept no credential authority and own no rights, acquisition, sensitive-data, provenance, or consumer ledger.
 * @evidenceExclude requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-sensitive-data The pure ingest APIs accept no credential authority and own no rights, acquisition, sensitive-data, provenance, or consumer ledger.
 * @evidenceExclude requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-derivation-consumers The pure ingest APIs accept no credential authority and own no rights, acquisition, sensitive-data, provenance, or consumer ledger.
 * @evidenceExclude requirements/external-inputs/identity-coordinates-and-units.md#external-identity-content-provenance Ingest preserves format-local facts but does not own the complete source/provenance identity graph or project coordinate, clock, and value interpretation.
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-elements-dependencies Stable source-order node identities and declared dependency URIs retain source-local correspondence.
 * @evidenceExclude requirements/external-inputs/identity-coordinates-and-units.md#external-identity-time-units Ingest preserves format-local facts but does not own the complete source/provenance identity graph or project coordinate, clock, and value interpretation.
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-value-interpretation The selected versioned profile fixes accessor arity, channel path, interpolation, and quaternion interpretation.
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-collision-ambiguity Invalid indices, duplicate mappings, and ambiguous target facts fail instead of selecting a candidate by order.
 * @evidenceExclude requirements/external-inputs/refresh-version-pinning-and-offline.md#external-provider-tool-version-pinning Ingest performs no provider version pinning, refresh, staleness propagation, offline-state certification, cache lookup, or recovery.
 * @evidenceExclude requirements/external-inputs/refresh-version-pinning-and-offline.md#external-explicit-refresh Ingest performs no provider version pinning, refresh, staleness propagation, offline-state certification, cache lookup, or recovery.
 * @evidenceExclude requirements/external-inputs/refresh-version-pinning-and-offline.md#external-refresh-impact-staleness Ingest performs no provider version pinning, refresh, staleness propagation, offline-state certification, cache lookup, or recovery.
 * @evidenceExclude requirements/external-inputs/refresh-version-pinning-and-offline.md#external-offline-ready-inputs Ingest performs no provider version pinning, refresh, staleness propagation, offline-state certification, cache lookup, or recovery.
 * @evidenceExclude requirements/external-inputs/refresh-version-pinning-and-offline.md#external-cache-identity-trust Ingest performs no provider version pinning, refresh, staleness propagation, offline-state certification, cache lookup, or recovery.
 * @evidenceExclude requirements/external-inputs/refresh-version-pinning-and-offline.md#external-cache-miss-unavailable-source Ingest performs no provider version pinning, refresh, staleness propagation, offline-state certification, cache lookup, or recovery.
 * @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-channel-parity Every caller-resolved byte source enters the same profile, closure, and validation path without channel-specific trust.
 * @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-provider-neutrality The API contains no provider identity, preference, catalogue, account tier, or fallback order.
 * @evidenceExclude requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-transfer-authority Ingest consumes caller-selected resident facts and owns no source dispatch, outbound authorization, acquisition attempt, or fallback.
 * @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-authority-boundary Declared glTF fields remain data and cannot create instructions, credential access, or network authority.
 * @evidenceExclude requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-acquisition-failure Ingest consumes caller-selected resident facts and owns no source dispatch, outbound authorization, acquisition attempt, or fallback.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-bounds-inputs Ingest produces no bounds derivation, proxy purpose lineage, LOD selection, transition, cost report, or stale-result failure.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-dynamic-bounds-invariants Ingest produces no bounds derivation, proxy purpose lineage, LOD selection, transition, cost report, or stale-result failure.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-proxy-purpose-lineage Ingest produces no bounds derivation, proxy purpose lineage, LOD selection, transition, cost report, or stale-result failure.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-selection-policy Ingest produces no bounds derivation, proxy purpose lineage, LOD selection, transition, cost report, or stale-result failure.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-transition-invariants Ingest produces no bounds derivation, proxy purpose lineage, LOD selection, transition, cost report, or stale-result failure.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-output-costs Ingest produces no bounds derivation, proxy purpose lineage, LOD selection, transition, cost report, or stale-result failure.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-bounds-lod-failures Ingest produces no bounds derivation, proxy purpose lineage, LOD selection, transition, cost report, or stale-result failure.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Ingest owns no generation or repaint provider, credential, attempt, control, adoption, provenance, continuity, or publication workflow.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-credential-boundary The resident-byte inspection surface contains no credential, provider call, or secret projection field.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-attempt-identity Ingest owns no generation or repaint provider, credential, attempt, control, adoption, provenance, continuity, or publication workflow.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-reproducibility Ingest owns no generation or repaint provider, credential, attempt, control, adoption, provenance, continuity, or publication workflow.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-adoption-output Ingest owns no generation or repaint provider, credential, attempt, control, adoption, provenance, continuity, or publication workflow.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-adoption-failures Ingest owns no generation or repaint provider, credential, attempt, control, adoption, provenance, continuity, or publication workflow.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-eligibility-source-lock Ingest owns no generation or repaint provider, credential, attempt, control, adoption, provenance, continuity, or publication workflow.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-manual-routing Ingest receives resident model bytes and owns neither production delivery selection nor repaint adapter routing.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-execution-eligibility Model-byte inspection cannot establish source-frame review freshness, control alignment, or an external repaint executor's prerequisites.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Ingest owns no generation or repaint provider, credential, attempt, control, adoption, provenance, continuity, or publication workflow.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Ingest owns no generation or repaint provider, credential, attempt, control, adoption, provenance, continuity, or publication workflow.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-structure-continuity Ingest owns no generation or repaint provider, credential, attempt, control, adoption, provenance, continuity, or publication workflow.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Ingest owns no generation or repaint provider, credential, attempt, control, adoption, provenance, continuity, or publication workflow.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-derivation-validation The inspector validates source-container structure only; it receives no repaint request, candidate, output digest, or rendition receipt whose derivation it could close.
 * @evidenceExclude specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-failure-publication Ingest owns no generation or repaint provider, credential, attempt, control, adoption, provenance, continuity, or publication workflow.
 * @evidenceExclude specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-identity-inputs Ingest emits bounded source facts but does not own the complete asset identity graph, lifecycle ledger, consumer reachability, or replacement compatibility.
 * @evidenceExclude specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-model-resource-separation Ingest emits bounded source facts but does not own the complete asset identity graph, lifecycle ledger, consumer reachability, or replacement compatibility.
 * @evidenceExclude specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links Ingest emits bounded source facts but does not own the complete asset identity graph, lifecycle ledger, consumer reachability, or replacement compatibility.
 * @evidenceExclude specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-lifecycle-states Ingest emits bounded source facts but does not own the complete asset identity graph, lifecycle ledger, consumer reachability, or replacement compatibility.
 * @evidenceExclude specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-identity-failure-compatibility Ingest emits bounded source facts but does not own the complete asset identity graph, lifecycle ledger, consumer reachability, or replacement compatibility.
 * @evidenceExclude specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-content-provenance-identity Ingest preserves format-local facts but does not own the complete source/provenance identity graph or project coordinate, clock, and value interpretation.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-element-dependency-identity Source-order node ids and declared resource roles preserve element and dependency identity.
 * @evidenceExclude specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-time-sample-mapping Ingest preserves format-local facts but does not own the complete source/provenance identity graph or project coordinate, clock, and value interpretation.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-value-interpretation-layer Versioned profiles validate path-specific value width, interpolation, and normalization semantics.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-identity-ambiguity-refusal Structural ambiguity and mapping collisions fail without discovery-order resolution.
 * @evidence specifications/interchange-and-adoption/intake-authority-and-routing.md#interchange-channel-independent-revision Resident bytes from every acquisition channel enter the same bounded inspection contract.
 * @evidence specifications/interchange-and-adoption/intake-authority-and-routing.md#interchange-provider-neutral-dispatch Its resident-byte API prevents provider identity or fallback order from influencing inspection.
 * @evidenceExclude specifications/interchange-and-adoption/intake-authority-and-routing.md#interchange-outbound-transfer-authorization Ingest receives resident caller-selected facts and performs no intake dispatch, external transfer, acquisition attempt, or fallback.
 * @evidence specifications/interchange-and-adoption/intake-authority-and-routing.md#interchange-source-authority-separation Source names and metadata are parsed only as schema data and gain no execution authority.
 * @evidenceExclude specifications/interchange-and-adoption/intake-authority-and-routing.md#interchange-acquisition-failure-envelope Ingest receives resident caller-selected facts and performs no intake dispatch, external transfer, acquisition attempt, or fallback.
 * @evidence specifications/interchange-and-adoption/provenance-rights-and-secrets.md#interchange-secret-reference-boundary The byte inspection contract has no field through which a secret can enter facts, diagnostics, or adoption output.
 * @evidenceExclude specifications/interchange-and-adoption/provenance-rights-and-secrets.md#interchange-source-provenance-snapshot Ingest accepts no secret or rights authority and emits no provenance, generation, sensitivity, derivation, consumer, or publication ledger.
 * @evidenceExclude specifications/interchange-and-adoption/provenance-rights-and-secrets.md#interchange-generated-acquisition-snapshot Ingest accepts no secret or rights authority and emits no provenance, generation, sensitivity, derivation, consumer, or publication ledger.
 * @evidenceExclude specifications/interchange-and-adoption/provenance-rights-and-secrets.md#interchange-rights-publication-gate Ingest accepts no secret or rights authority and emits no provenance, generation, sensitivity, derivation, consumer, or publication ledger.
 * @evidenceExclude specifications/interchange-and-adoption/provenance-rights-and-secrets.md#interchange-sensitive-metadata-projection Ingest accepts no secret or rights authority and emits no provenance, generation, sensitivity, derivation, consumer, or publication ledger.
 * @evidenceExclude specifications/interchange-and-adoption/provenance-rights-and-secrets.md#interchange-derivation-consumer-reachability Ingest accepts no secret or rights authority and emits no provenance, generation, sensitivity, derivation, consumer, or publication ledger.
 * @evidenceExclude specifications/interchange-and-adoption/revision-refresh-and-offline-cache.md#interchange-external-version-snapshot Ingest performs no version snapshot, refresh transaction, stale propagation, offline certification, cache identity, or unavailable-source recovery.
 * @evidenceExclude specifications/interchange-and-adoption/revision-refresh-and-offline-cache.md#interchange-refresh-transaction Ingest performs no version snapshot, refresh transaction, stale propagation, offline certification, cache identity, or unavailable-source recovery.
 * @evidenceExclude specifications/interchange-and-adoption/revision-refresh-and-offline-cache.md#interchange-refresh-staleness-propagation Ingest performs no version snapshot, refresh transaction, stale propagation, offline certification, cache identity, or unavailable-source recovery.
 * @evidenceExclude specifications/interchange-and-adoption/revision-refresh-and-offline-cache.md#interchange-offline-ready-closure Ingest performs no version snapshot, refresh transaction, stale propagation, offline certification, cache identity, or unavailable-source recovery.
 * @evidenceExclude specifications/interchange-and-adoption/revision-refresh-and-offline-cache.md#interchange-cache-entry-identity Ingest performs no version snapshot, refresh transaction, stale propagation, offline certification, cache identity, or unavailable-source recovery.
 * @evidenceExclude specifications/interchange-and-adoption/revision-refresh-and-offline-cache.md#interchange-offline-miss-state Ingest performs no version snapshot, refresh transaction, stale propagation, offline certification, cache identity, or unavailable-source recovery.
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation Checks mesh primitives, POSITION accessors, indices, and payload ranges.
 * @evidence requirements/asset-authoring/validation.md#asset-rig-validation Checks skin joints, normalized humanoid mapping, and weighted influences.
 * @evidence requirements/asset-authoring/validation.md#asset-surface-validation Validates image resource presence but does not claim visual material review.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-purpose-validation The inspector receives no story role, camera distance, or intended use.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-representation-bounds-validation Binary range validation does not validate spatial bounds, pivots, proxies, or representation transitions.
 * @evidence requirements/asset-authoring/validation.md#asset-external-generated-validation Applies the same structural boundary to external bytes regardless of their origin.
 * @evidence requirements/asset-authoring/validation.md#asset-validation-gap Unsupported or unproved structure fails instead of being presented as verified.
 * @evidence requirements/asset-authoring/rig-and-state.md#asset-invalid-rig-refusal Humanoid profiles reject missing roots, dangling joints, malformed weights, and invalid mappings.
 * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-output-failures Invalid skin and humanoid facts fail before a normalized inspection is returned.
 * @evidenceExclude requirements/external-inputs/media-families-and-declared-facts.md#external-media-image-video Image URIs are closure dependencies here; raster and video facts are not decoded.
 * @evidenceExclude requirements/external-inputs/media-families-and-declared-facts.md#external-media-audio The glTF-family inspector accepts no audio container.
 * @evidenceExclude requirements/external-inputs/media-families-and-declared-facts.md#external-media-spatial-data It does not decode map, survey, point-cloud, or georeferenced spatial datasets.
 * @evidenceExclude requirements/external-inputs/media-families-and-declared-facts.md#external-media-text-metadata JSON is parsed as glTF structure, not as an instruction-bearing text input.
 * @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-archive-bounds Rejects declared ranges outside resident buffer bytes; archive expansion is unsupported.
 * @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-network-dependency Requires caller-resolved bytes and performs no live fetch.
 * @evidence requirements/external-inputs/unsupported-and-degradation.md#external-unsupported-format-feature Rejects unknown profiles, versions, paths, interpolation, and target channels.
 * @evidence requirements/external-inputs/unsupported-and-degradation.md#external-unsupported-hard-failure Throws before returning an inspection when required structure is unsupported.
 * @evidenceExclude requirements/external-inputs/unsupported-and-degradation.md#external-user-chosen-degradation Inspection reports no user-approved degraded substitute.
 * @evidenceExclude requirements/external-inputs/unsupported-and-degradation.md#external-partial-adoption-boundary Selection of a partial element subset occurs after byte inspection.
 * @evidenceExclude requirements/external-inputs/unsupported-and-degradation.md#external-placeholder-final-boundary No placeholder artifact is emitted by this inspector.
 * @evidence requirements/external-inputs/unsupported-and-degradation.md#external-fidelity-semantic-boundary Reports structural and semantic mapping facts without claiming visual fidelity.
 * @evidence requirements/external-inputs/unsupported-and-degradation.md#external-support-regression-compatibility Uses explicit versioned profiles so support changes cannot masquerade as the same interpretation.
 * @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-content-facts Compares resident payload lengths and accessor values with declared facts.
 * @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-structure-semantics Validates graph indices, accessor shapes, animation arity, and humanoid mappings.
 * @evidenceExclude requirements/external-inputs/validation-and-quarantine.md#external-validation-active-content The supported glTF subset contains no executable script or active document payload.
 * @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-adoption-gate A thrown inspection prevents malformed bytes from reaching adoption.
 * @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-result-states Success returns facts and every failure throws a specific diagnostic.
 * @evidenceExclude requirements/external-inputs/validation-and-quarantine.md#external-validation-quarantine-handling Storage, exposure, removal, and release of quarantined bytes belong to the caller.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-purpose-inputs The function validates structural asset facts but receives no shot-purpose envelope.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Rejects non-finite motion samples, invalid indices, malformed ranges, and inconsistent weights.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-surface-visual It does not render silhouette, material, UV, or lighting evidence.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-motion-transitions Checks motion key ordering, interpolation, arity, and unit quaternions before playback.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-current-evidence No cached validation artifact or current-review ledger is stored here.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-status-failures Returns complete facts only on success and field-located errors otherwise.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-compatibility-ceiling Structural success makes no finished-fidelity or runtime-compatibility promise.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-era-style-inputs No era, style, location, or design language is interpreted from bytes.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Inventories mesh POSITION accessors, nodes, skins, and source units fixed by glTF.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology No modeling operation or manifold-topology derivation is performed.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Image dependencies are closed, but material semantics and UV roles are not normalized here.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-surface-states-substitution No material state, substitution rule, weathering, or damage state is authored.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-procedural-pattern-inputs The decoder emits no procedural pattern or instance-generation inputs.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-surface-coordinate-convention The decoder adopts an authored coordinate set as it found it, declaring no coordinate-set kind and supplying no transform; the adoption receipt this package does own binds motion sources, not surface coordinates.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-surface-resource-closure Resolves every declared buffer and image dependency to resident bytes.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures Rejects missing meshes for model profiles and malformed resource or rig facts.
 * @evidence specifications/interchange-and-adoption/resource-closure-and-acquisition.md#interchange-expanded-resource-budget Enforces declared byte ranges and refuses archives rather than expanding them.
 * @evidence specifications/interchange-and-adoption/resource-closure-and-acquisition.md#interchange-live-network-dependency-state The resolver supplies resident bytes; the inspector performs no live network access.
 * @evidence specifications/interchange-and-adoption/support-degradation-and-refusal.md#interchange-format-feature-support-matrix The closed profile and target-path sets define the supported subset.
 * @evidence specifications/interchange-and-adoption/support-degradation-and-refusal.md#interchange-hard-refusal-predicate Structural, resource, profile, and sample violations fail explicitly.
 * @evidence specifications/interchange-and-adoption/support-degradation-and-refusal.md#interchange-external-hard-refusal Unsupported containers, structures, and source facts fail with an exact diagnostic and return no substitute artifact.
 * @evidenceExclude specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-design-drawing-inspection This glTF-family inspector accepts no drawing container and derives no drawing extent or unsupported drawing-family result.
 * @evidenceExclude specifications/interchange-and-adoption/support-degradation-and-refusal.md#interchange-explicit-degradation-policy This inspector never chooses or applies a degraded substitute.
 * @evidenceExclude specifications/interchange-and-adoption/support-degradation-and-refusal.md#interchange-partial-adoption-closure Partial element selection is a later adoption decision.
 * @evidenceExclude specifications/interchange-and-adoption/support-degradation-and-refusal.md#interchange-placeholder-status-fence No placeholder or proxy result is returned.
 * @evidence specifications/interchange-and-adoption/support-degradation-and-refusal.md#interchange-appearance-semantics-fence Structural and mapping facts are reported without appearance-quality claims.
 * @evidence specifications/interchange-and-adoption/support-degradation-and-refusal.md#interchange-compatibility-migration-gate Explicit profile literals make a changed interpretation distinguishable.
 * @evidence specifications/interchange-and-adoption/validation-and-quarantine.md#interchange-declared-observed-comparison Compares glTF declarations against exact payloads and decoded accessor values.
 * @evidence specifications/interchange-and-adoption/validation-and-quarantine.md#interchange-layered-validation Separately checks container, graph, resources, accessors, rig, and motion semantics.
 * @evidenceExclude specifications/interchange-and-adoption/validation-and-quarantine.md#interchange-active-content-isolation The supported format subset has no executable active-content surface.
 * @evidence specifications/interchange-and-adoption/validation-and-quarantine.md#interchange-atomic-adoption-gate Returns no partial inspection after any required check fails.
 * @evidence specifications/interchange-and-adoption/validation-and-quarantine.md#interchange-validation-result-envelope Uses explicit diagnostics but leaves the shared status envelope to the compiler.
 * @evidenceExclude specifications/interchange-and-adoption/validation-and-quarantine.md#interchange-quarantine-exposure-removal Quarantine storage and release policy is outside this pure decoder.
 */
export const inspectAutoMovieExternalModelBytes = (props: {
  /** Exact project-relative source path. */
  path: string;
  /** Exact resident container bytes. */
  bytes: Uint8Array;
  /** Caller-selected fixed interpretation profile. */
  profile: string;
  /** Exact sidecar bytes, resolved inside the compiler-owned asset namespace. */
  resolveResource?: (uri: string) => Uint8Array | null;
}): IAutoMovieExternalModelInspection => {
  if (!SUPPORTED_PROFILES.has(props.profile))
    throw new Error(
      `Unsupported external-model ingest profile "${props.profile}".`,
    );
  const extension = fileExtension(props.path);
  const parsed =
    extension === ".gltf"
      ? { json: decodeJson(props.bytes), format: "gltf" as const, bin: null }
      : extension === ".glb" || extension === ".vrm"
        ? decodeGlb(props.bytes, extension === ".vrm")
        : (() => {
            throw new Error(
              `External model "${props.path}" must end in .gltf, .glb, or .vrm.`,
            );
          })();
  const document = object(parsed.json, "glTF root");
  const asset = object(document.asset, "glTF asset");
  if (asset.version !== "2.0")
    throw new Error('External models must declare glTF asset.version "2.0".');

  const nodes = optionalArray(document.nodes, "nodes");
  const meshes = optionalArray(document.meshes, "meshes");
  const skins = optionalArray(document.skins, "skins");
  const animations = optionalArray(document.animations, "animations");
  const scenes = optionalArray(document.scenes, "scenes");
  const buffers = optionalArray(document.buffers, "buffers");
  const bufferViews = optionalArray(document.bufferViews, "bufferViews");
  const accessors = optionalArray(document.accessors, "accessors");
  const images = optionalArray(document.images, "images");

  nodes.forEach((value, index) => {
    const node = object(value, `nodes[${index}]`);
    integerIndex(node.mesh, meshes.length, `nodes[${index}].mesh`);
    integerIndex(node.skin, skins.length, `nodes[${index}].skin`);
    integerIndices(node.children, nodes.length, `nodes[${index}].children`);
  });
  scenes.forEach((value, index) =>
    integerIndices(
      object(value, `scenes[${index}]`).nodes,
      nodes.length,
      `scenes[${index}].nodes`,
    ),
  );
  buffers.forEach((value, index) => {
    const buffer = object(value, `buffers[${index}]`);
    positiveInteger(buffer.byteLength, `buffers[${index}].byteLength`);
    if (parsed.format === "gltf" && buffer.uri === undefined)
      throw new Error(
        `buffers[${index}].uri is required by a JSON glTF container.`,
      );
  });
  meshes.forEach((value, meshIndex) => {
    const mesh = object(value, `meshes[${meshIndex}]`);
    const primitives = requiredArray(
      mesh.primitives,
      `meshes[${meshIndex}].primitives`,
    );
    if (primitives.length === 0)
      throw new Error(`meshes[${meshIndex}] has no render primitive.`);
    primitives.forEach((primitiveValue, primitiveIndex) => {
      const primitive = object(
        primitiveValue,
        `meshes[${meshIndex}].primitives[${primitiveIndex}]`,
      );
      const attributes = object(
        primitive.attributes,
        `meshes[${meshIndex}].primitives[${primitiveIndex}].attributes`,
      );
      integerIndex(
        attributes.POSITION,
        accessors.length,
        `meshes[${meshIndex}].primitives[${primitiveIndex}].attributes.POSITION`,
        true,
      );
      integerIndex(
        primitive.indices,
        accessors.length,
        `meshes[${meshIndex}].primitives[${primitiveIndex}].indices`,
      );
    });
  });
  skins.forEach((value, index) => {
    const skin = object(value, `skins[${index}]`);
    const joints = requiredArray(skin.joints, `skins[${index}].joints`);
    if (joints.length === 0) throw new Error(`skins[${index}] has no joints.`);
    integerIndices(joints, nodes.length, `skins[${index}].joints`);
  });
  bufferViews.forEach((value, index) => {
    const view = object(value, `bufferViews[${index}]`);
    integerIndex(
      view.buffer,
      buffers.length,
      `bufferViews[${index}].buffer`,
      true,
    );
    positiveInteger(view.byteLength, `bufferViews[${index}].byteLength`);
    nonNegativeInteger(
      view.byteOffset ?? 0,
      `bufferViews[${index}].byteOffset`,
    );
    if (
      view.byteStride !== undefined &&
      (typeof view.byteStride !== "number" ||
        Number.isSafeInteger(view.byteStride) === false ||
        view.byteStride < 4 ||
        view.byteStride > 252 ||
        view.byteStride % 4 !== 0)
    )
      throw new Error(
        `bufferViews[${index}].byteStride must be a 4-byte-aligned integer from 4 through 252.`,
      );
  });
  accessors.forEach((value, index) => {
    const accessor = object(value, `accessors[${index}]`);
    integerIndex(
      accessor.bufferView,
      bufferViews.length,
      `accessors[${index}].bufferView`,
    );
    positiveInteger(accessor.count, `accessors[${index}].count`);
    nonNegativeInteger(
      accessor.byteOffset ?? 0,
      `accessors[${index}].byteOffset`,
    );
    if (
      typeof accessor.componentType !== "number" ||
      [5120, 5121, 5122, 5123, 5125, 5126].includes(accessor.componentType) ===
        false ||
      typeof accessor.type !== "string" ||
      ["SCALAR", "VEC2", "VEC3", "VEC4", "MAT2", "MAT3", "MAT4"].includes(
        accessor.type,
      ) === false
    )
      throw new Error(
        `accessors[${index}] has an unsupported componentType or shape.`,
      );
    validateAccessorRange(accessor, index, bufferViews);
    validateSparseAccessor(accessor, index, bufferViews);
  });
  images.forEach((value, index) => {
    const image = object(value, `images[${index}]`);
    if (image.uri === undefined)
      integerIndex(
        image.bufferView,
        bufferViews.length,
        `images[${index}].bufferView`,
        true,
      );
  });

  const extensions = uniqueStrings([
    ...optionalStringArray(document.extensionsUsed, "extensionsUsed"),
    ...Object.keys(optionalObject(document.extensions, "extensions")),
  ]);
  const resources = collectExternalResources(buffers, images);
  const payloads = validatePayloadClosure({
    format: parsed.format,
    bin: parsed.bin,
    buffers,
    bufferViews,
    images,
    resolveResource: props.resolveResource,
  });
  const motion =
    props.profile === "gltf-motion-v1"
      ? inspectExternalMotion({
          path: props.path,
          byteLength: props.bytes.byteLength,
          animations,
          nodes,
          accessors,
          bufferViews,
          payloads,
        })
      : undefined;
  if (props.profile === "gltf-motion-v1" && motion === undefined)
    throw new Error(
      'Profile "gltf-motion-v1" requires at least one animation.',
    );
  if (props.profile !== "gltf-motion-v1" && meshes.length === 0)
    throw new Error("External model has no mesh to render or review.");
  const humanoidMapping =
    props.profile === "gltf-humanoid-v1"
      ? gltfHumanoidBones(nodes, skins)
      : props.profile === "vrm-humanoid-v1"
        ? vrmHumanoidBones(document, nodes)
        : [];
  if (
    props.profile === "gltf-humanoid-v1" &&
    (skins.length === 0 ||
      humanoidMapping.some((bone) => bone.bone === "hips") === false)
  )
    throw new Error(
      'Profile "gltf-humanoid-v1" requires a skin and a normalized hips/pelvis joint.',
    );
  const weightedNodes =
    props.profile === "gltf-static-v1" || props.profile === "gltf-motion-v1"
      ? new Set<number>()
      : validateHumanoidSkinning({
          nodes,
          meshes,
          skins,
          accessors,
          bufferViews,
          payloads,
        });
  const humanoidBones = humanoidMapping.map((mapping) => ({
    ...mapping,
    weighted: weightedNodes.has(mapping.node),
  }));
  if (
    props.profile === "vrm-humanoid-v1" &&
    (parsed.format === "gltf" ||
      extensions.some((name) => name === "VRM" || name === "VRMC_vrm") ===
        false ||
      skins.length === 0 ||
      humanoidBones.some((bone) => bone.bone === "hips") === false)
  )
    throw new Error(
      'Profile "vrm-humanoid-v1" requires a GLB/VRM container with VRM or VRMC_vrm metadata.',
    );

  return {
    profile: props.profile as AutoMovieExternalModelIngestProfile,
    format: extensions.some((name) => name === "VRM" || name === "VRMC_vrm")
      ? "vrm"
      : parsed.format,
    version: "2.0",
    counts: {
      nodes: nodes.length,
      meshes: meshes.length,
      skins: skins.length,
      animations: animations.length,
    },
    extensions,
    resources,
    humanoidBones,
    ...(motion === undefined ? {} : { motion }),
  };
};

const SUPPORTED_PROFILES: ReadonlySet<string> = new Set<string>(
  AUTO_MOVIE_EXTERNAL_MODEL_INGEST_PROFILES,
);

const inspectExternalMotion = (props: {
  path: string;
  byteLength: number;
  animations: unknown[];
  nodes: unknown[];
  accessors: unknown[];
  bufferViews: unknown[];
  payloads: Uint8Array[];
}): IAutoMovieExternalMotionInspection | undefined => {
  if (props.animations.length === 0) return undefined;
  const nodes = inspectExternalMotionNodes(props.nodes);
  const nodeIds = nodes.map((node) => node.id);
  const takes = props.animations.map((value, animationIndex) => {
    const animation = object(value, `animations[${animationIndex}]`);
    const samplers = requiredArray(
      animation.samplers,
      `animations[${animationIndex}].samplers`,
    );
    const channels = requiredArray(
      animation.channels,
      `animations[${animationIndex}].channels`,
    );
    if (samplers.length === 0 || channels.length === 0)
      throw new Error(
        `animations[${animationIndex}] needs at least one sampler and channel.`,
      );
    const targets = new Set<string>();
    const tracks = channels.map((value, channelIndex): IAutoMovieTrack => {
      const channelPath = `animations[${animationIndex}].channels[${channelIndex}]`;
      const channel = object(value, channelPath);
      integerIndex(
        channel.sampler,
        samplers.length,
        `${channelPath}.sampler`,
        true,
      );
      const target = object(channel.target, `${channelPath}.target`);
      integerIndex(
        target.node,
        props.nodes.length,
        `${channelPath}.target.node`,
        true,
      );
      if (
        typeof target.path !== "string" ||
        MOTION_TARGET_PATHS.has(target.path) === false
      )
        throw new Error(
          `${channelPath}.target.path must be translation, rotation, scale, or weights.`,
        );
      const targetKey = `${String(target.node)}\u0000${target.path}`;
      if (targets.has(targetKey))
        throw new Error(
          `${channelPath} duplicates the ${target.path} channel for node ${String(target.node)}.`,
        );
      targets.add(targetKey);

      const samplerPath = `animations[${animationIndex}].samplers[${String(channel.sampler)}]`;
      const sampler = object(samplers[channel.sampler as number], samplerPath);
      integerIndex(
        sampler.input,
        props.accessors.length,
        `${samplerPath}.input`,
        true,
      );
      integerIndex(
        sampler.output,
        props.accessors.length,
        `${samplerPath}.output`,
        true,
      );
      const interpolation = motionInterpolation(
        sampler.interpolation,
        `${samplerPath}.interpolation`,
      );
      const times = readMotionAccessor({
        ...props,
        accessorIndex: sampler.input as number,
        expectedType: "SCALAR",
        path: `${samplerPath}.input`,
      });
      const outputType =
        target.path === "rotation"
          ? "VEC4"
          : target.path === "weights"
            ? "SCALAR"
            : "VEC3";
      const values = readMotionAccessor({
        ...props,
        accessorIndex: sampler.output as number,
        expectedType: outputType,
        path: `${samplerPath}.output`,
      });
      validateMotionTimes(times, `${samplerPath}.input`);
      validateMotionOutput({
        path: `${samplerPath}.output`,
        targetPath: target.path as AutoMovieMotionTargetPath,
        interpolation,
        keyframes: times.length,
        values,
      });
      return {
        channel: {
          kind: "node",
          node: nodeIds[target.node as number]!,
          path: target.path as AutoMovieMotionTargetPath,
        },
        times,
        values,
        interpolation,
      };
    });
    const name = animation.name;
    if (name !== undefined && typeof name !== "string")
      throw new Error(`animations[${animationIndex}].name must be a string.`);
    return {
      id: `clip_${animationIndex}`,
      name: name === undefined || name.length === 0 ? null : name,
      duration: tracks.reduce(
        (maximum, track) =>
          Math.max(maximum, track.times[track.times.length - 1]!),
        0,
      ),
      loop: false,
      tracks,
    } satisfies IAutoMovieClip;
  });
  return {
    path: props.path,
    byteLength: props.byteLength,
    interpretation: AUTOMOVIE_GLTF_MOTION_INTERPRETATION_PROFILE,
    nodes,
    nodeIds,
    takes,
  };
};

const inspectExternalMotionNodes = (
  values: unknown[],
): IAutoMovieExternalMotionNodeInspection[] => {
  const parentByIndex: Array<number | undefined> = new Array(values.length);
  values.forEach((value, parentIndex) => {
    const node = object(value, `nodes[${parentIndex}]`);
    optionalArray(node.children, `nodes[${parentIndex}].children`).forEach(
      (entry) => {
        const childIndex = entry as number;
        const previous = parentByIndex[childIndex];
        if (previous !== undefined)
          throw new Error(
            `nodes[${childIndex}] has multiple parents ${previous} and ${parentIndex}.`,
          );
        parentByIndex[childIndex] = parentIndex;
      },
    );
  });

  const state = new Uint8Array(values.length);
  values.forEach((_value, start) => {
    if (state[start] !== 0) return;
    const path: number[] = [];
    let index: number | undefined = start;
    while (index !== undefined && state[index] === 0) {
      state[index] = 1;
      path.push(index);
      index = parentByIndex[index];
    }
    if (index !== undefined && state[index] === 1)
      throw new Error(`nodes[${index}] belongs to a parent cycle.`);
    path.forEach((entry) => (state[entry] = 2));
  });

  return values.map((value, index) => {
    const node = object(value, `nodes[${index}]`);
    if (node.matrix !== undefined)
      throw new Error(
        `nodes[${index}].matrix is unsupported by the glTF motion interpretation profile; declare translation, rotation, and scale explicitly.`,
      );
    if (node.name !== undefined && typeof node.name !== "string")
      throw new Error(`nodes[${index}].name must be a string.`);
    const translation = finiteTuple(
      node.translation,
      `nodes[${index}].translation`,
      [0, 0, 0],
    );
    const rotation = finiteTuple(
      node.rotation,
      `nodes[${index}].rotation`,
      [0, 0, 0, 1],
    );
    const scale = finiteTuple(node.scale, `nodes[${index}].scale`, [1, 1, 1]);
    if (scale.some((component) => component <= 0))
      throw new Error(
        `nodes[${index}].scale must contain only positive values.`,
      );
    const magnitude = Math.hypot(...rotation);
    if (Math.abs(magnitude - 1) > 1e-4)
      throw new Error(`nodes[${index}].rotation must be a unit quaternion.`);
    return {
      id: `node_${index}`,
      index,
      name:
        typeof node.name === "string" && node.name.length !== 0
          ? node.name
          : null,
      parent:
        parentByIndex[index] === undefined
          ? null
          : `node_${parentByIndex[index]}`,
      transform: {
        translation: {
          x: translation[0]!,
          y: translation[1]!,
          z: translation[2]!,
        },
        rotation: {
          x: rotation[0]! / magnitude,
          y: rotation[1]! / magnitude,
          z: rotation[2]! / magnitude,
          w: rotation[3]! / magnitude,
        },
        scale: { x: scale[0]!, y: scale[1]!, z: scale[2]! },
      },
    };
  });
};

const finiteTuple = (
  value: unknown,
  path: string,
  fallback: readonly number[],
): number[] => {
  if (value === undefined) return [...fallback];
  if (Array.isArray(value) === false || value.length !== fallback.length)
    throw new Error(
      `${path} must contain exactly ${fallback.length} finite numbers.`,
    );
  return value.map((entry, index) => {
    if (typeof entry !== "number" || Number.isFinite(entry) === false)
      throw new Error(`${path}[${index}] must be finite.`);
    return entry;
  });
};

type AutoMovieMotionTargetPath =
  | "translation"
  | "rotation"
  | "scale"
  | "weights";

const MOTION_TARGET_PATHS: ReadonlySet<string> =
  new Set<AutoMovieMotionTargetPath>([
    "translation",
    "rotation",
    "scale",
    "weights",
  ]);

const motionInterpolation = (
  value: unknown,
  path: string,
): IAutoMovieTrack["interpolation"] => {
  if (value === undefined || value === "LINEAR") return "linear";
  if (value === "STEP") return "step";
  if (value === "CUBICSPLINE") return "cubicspline";
  throw new Error(`${path} must be LINEAR, STEP, or CUBICSPLINE.`);
};

const readMotionAccessor = (props: {
  accessors: unknown[];
  bufferViews: unknown[];
  payloads: Uint8Array[];
  accessorIndex: number;
  expectedType: "SCALAR" | "VEC3" | "VEC4";
  path: string;
}): number[] => {
  const accessor = object(
    props.accessors[props.accessorIndex],
    `accessors[${props.accessorIndex}]`,
  );
  if (
    accessor.componentType !== 5126 ||
    accessor.type !== props.expectedType ||
    accessor.bufferView === undefined ||
    accessor.sparse !== undefined
  )
    throw new Error(
      `${props.path} must resolve to a non-sparse FLOAT ${props.expectedType} accessor.`,
    );
  const width =
    props.expectedType === "SCALAR" ? 1 : props.expectedType === "VEC3" ? 3 : 4;
  const values: number[] = [];
  for (let element = 0; element < (accessor.count as number); ++element)
    for (let component = 0; component < width; ++component) {
      const value = readAccessorComponent(
        props,
        props.accessorIndex,
        element,
        component,
      );
      if (Number.isFinite(value) === false)
        throw new Error(`${props.path} contains a non-finite value.`);
      values.push(value);
    }
  return values;
};

const validateMotionTimes = (times: number[], path: string): void => {
  for (let index = 0; index < times.length; ++index)
    if (times[index]! < 0 || (index > 0 && times[index]! <= times[index - 1]!))
      throw new Error(
        `${path} keyframe times must be non-negative and strictly increasing.`,
      );
};

const validateMotionOutput = (props: {
  path: string;
  targetPath: AutoMovieMotionTargetPath;
  interpolation: IAutoMovieTrack["interpolation"];
  keyframes: number;
  values: number[];
}): void => {
  const factor = props.interpolation === "cubicspline" ? 3 : 1;
  const width =
    props.targetPath === "rotation"
      ? 4
      : props.targetPath === "weights"
        ? null
        : 3;
  const group = props.keyframes * factor;
  if (
    group === 0 ||
    (width === null
      ? props.values.length === 0 || props.values.length % group !== 0
      : props.values.length !== group * width)
  )
    throw new Error(
      `${props.path} does not match the ${props.targetPath} keyframe arity.`,
    );
  if (props.targetPath !== "rotation") return;
  for (let frame = 0; frame < props.keyframes; ++frame) {
    const quaternion =
      (props.interpolation === "cubicspline" ? frame * 3 + 1 : frame) * 4;
    const magnitude = Math.hypot(
      ...props.values.slice(quaternion, quaternion + 4),
    );
    if (Math.abs(magnitude - 1) > 1e-4)
      throw new Error(`${props.path} contains a non-unit rotation keyframe.`);
  }
};

const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BIN_CHUNK = 0x004e4942;

const decodeGlb = (
  input: Uint8Array,
  vrmExtension: boolean,
): { json: unknown; format: "glb" | "vrm"; bin: Uint8Array | null } => {
  const bytes = new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 20)
    throw new Error("GLB/VRM container is shorter than its mandatory header.");
  if (view.getUint32(0, true) !== GLB_MAGIC)
    throw new Error("GLB/VRM container has an invalid magic value.");
  if (view.getUint32(4, true) !== 2)
    throw new Error("Only GLB container version 2 is supported.");
  if (view.getUint32(8, true) !== bytes.length)
    throw new Error("GLB declared length does not match resident bytes.");
  const jsonLength = view.getUint32(12, true);
  if (
    jsonLength === 0 ||
    jsonLength % 4 !== 0 ||
    view.getUint32(16, true) !== GLB_JSON_CHUNK ||
    20 + jsonLength > bytes.length
  )
    throw new Error("GLB first chunk is not one aligned JSON chunk.");
  let cursor = 20 + jsonLength;
  let bin: Uint8Array | null = null;
  while (cursor < bytes.length) {
    if (cursor + 8 > bytes.length)
      throw new Error("GLB contains a truncated chunk header.");
    const length = view.getUint32(cursor, true);
    if (length % 4 !== 0 || cursor + 8 + length > bytes.length)
      throw new Error("GLB contains an unaligned or truncated chunk.");
    const type = view.getUint32(cursor + 4, true);
    if (type !== GLB_BIN_CHUNK || bin !== null)
      throw new Error(
        "GLB may contain only one optional BIN chunk after its JSON chunk.",
      );
    bin = bytes.subarray(cursor + 8, cursor + 8 + length);
    cursor += 8 + length;
  }
  return {
    json: decodeJson(bytes.subarray(20, 20 + jsonLength)),
    format: vrmExtension ? "vrm" : "glb",
    bin,
  };
};

const decodeJson = (bytes: Uint8Array): unknown => {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(
      `External model JSON is invalid: ${(error as Error).message}.`,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `External model JSON is invalid: ${(error as Error).message}.`,
    );
  }
  try {
    assertUniqueJsonObjectMembers(text);
  } catch (error) {
    throw new Error(
      `External model JSON is invalid: ${(error as Error).message}.`,
    );
  }
  return value;
};

/** Refuse decoded-equivalent member names before last-wins JSON can escape. */
const assertUniqueJsonObjectMembers = (text: string): void => {
  let cursor = 0;
  const whitespace = (): void => {
    while (/\s/u.test(text.charAt(cursor))) ++cursor;
  };
  const string = (): string => {
    const start = cursor++;
    while (text[cursor] !== '"') {
      if (text[cursor] === "\\") {
        ++cursor;
        if (text[cursor] === "u") cursor += 4;
      }
      ++cursor;
    }
    ++cursor;
    return JSON.parse(text.slice(start, cursor)) as string;
  };
  const value = (): void => {
    whitespace();
    if (text[cursor] === "{") object();
    else if (text[cursor] === "[") array();
    else if (text[cursor] === '"') void string();
    else {
      while (cursor < text.length && /[^\s,\]}]/u.test(text[cursor]!)) ++cursor;
    }
    whitespace();
  };
  const object = (): void => {
    ++cursor;
    whitespace();
    const names = new Set<string>();
    if (text[cursor] === "}") {
      ++cursor;
      return;
    }
    while (true) {
      const name = string();
      if (names.has(name))
        throw new Error(`duplicate member ${JSON.stringify(name)}`);
      names.add(name);
      whitespace();
      ++cursor;
      value();
      if (text[cursor] === "}") {
        ++cursor;
        return;
      }
      ++cursor;
      whitespace();
    }
  };
  const array = (): void => {
    ++cursor;
    whitespace();
    if (text[cursor] === "]") {
      ++cursor;
      return;
    }
    while (true) {
      value();
      if (text[cursor] === "]") {
        ++cursor;
        return;
      }
      ++cursor;
    }
  };
  value();
};

const object = (value: unknown, path: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${path} must be an object.`);
  return value as Record<string, unknown>;
};

const optionalObject = (
  value: unknown,
  path: string,
): Record<string, unknown> => (value === undefined ? {} : object(value, path));

const requiredArray = (value: unknown, path: string): unknown[] => {
  if (Array.isArray(value) === false)
    throw new Error(`${path} must be an array.`);
  return value;
};

const optionalArray = (value: unknown, path: string): unknown[] =>
  value === undefined ? [] : requiredArray(value, path);

const optionalStringArray = (value: unknown, path: string): string[] =>
  optionalArray(value, path).map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0)
      throw new Error(`${path}[${index}] must be a non-blank string.`);
    return entry;
  });

const integerIndex = (
  value: unknown,
  length: number,
  path: string,
  required = false,
): void => {
  if (value === undefined && required === false) return;
  if (
    typeof value !== "number" ||
    Number.isSafeInteger(value) === false ||
    value < 0 ||
    value >= length
  )
    throw new Error(`${path} does not resolve inside its declared inventory.`);
};

const integerIndices = (value: unknown, length: number, path: string): void => {
  if (value === undefined) return;
  requiredArray(value, path).forEach((entry, index) =>
    integerIndex(entry, length, `${path}[${index}]`, true),
  );
};

const positiveInteger = (value: unknown, path: string): void => {
  if (
    typeof value !== "number" ||
    Number.isSafeInteger(value) === false ||
    value <= 0
  )
    throw new Error(`${path} must be a positive safe integer.`);
};

const nonNegativeInteger = (value: unknown, path: string): void => {
  if (
    typeof value !== "number" ||
    Number.isSafeInteger(value) === false ||
    value < 0
  )
    throw new Error(`${path} must be a non-negative safe integer.`);
};

const externalUri = (value: unknown, path: string): string | null => {
  if (value === undefined) return null;
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${path} must be a non-empty URI string.`);
  return value.startsWith("data:") ? null : value;
};

const uniqueStrings = (values: string[]): string[] =>
  [...new Set(values)].sort(compareCodeUnits);

const compareCodeUnits = (left: string, right: string): number =>
  Number(left > right) - Number(left < right);

const fileExtension = (value: string): string => {
  const name = value.slice(value.lastIndexOf("/") + 1);
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index).toLowerCase();
};

const collectExternalResources = (
  buffers: unknown[],
  images: unknown[],
): IAutoMovieExternalModelResource[] => {
  const byUri = new Map<string, IAutoMovieExternalModelResource>();
  buffers.forEach((value, index) => {
    const buffer = object(value, `buffers[${index}]`);
    const uri = externalUri(buffer.uri, `buffers[${index}].uri`);
    if (uri === null) return;
    const byteLength = buffer.byteLength as number;
    const prior = byUri.get(uri);
    if (
      prior !== undefined &&
      (prior.kind !== "buffer" || prior.byteLength !== byteLength)
    )
      throw new Error(
        `External URI "${uri}" is declared with conflicting resource roles or lengths.`,
      );
    byUri.set(uri, { uri, kind: "buffer", byteLength });
  });
  images.forEach((value, index) => {
    const image = object(value, `images[${index}]`);
    const uri = externalUri(image.uri, `images[${index}].uri`);
    if (uri === null) return;
    const prior = byUri.get(uri);
    if (prior !== undefined && prior.kind !== "image")
      throw new Error(
        `External URI "${uri}" is declared as both a buffer and an image.`,
      );
    byUri.set(uri, { uri, kind: "image", byteLength: null });
  });
  return [...byUri.values()].sort((left, right) =>
    compareCodeUnits(left.uri, right.uri),
  );
};

const validatePayloadClosure = (props: {
  format: "gltf" | "glb" | "vrm";
  bin: Uint8Array | null;
  buffers: unknown[];
  bufferViews: unknown[];
  images: unknown[];
  resolveResource?: (uri: string) => Uint8Array | null;
}): Uint8Array[] => {
  const payloads = props.buffers.map((value, index) => {
    const buffer = object(value, `buffers[${index}]`);
    const length = buffer.byteLength as number;
    let bytes: Uint8Array | null;
    if (buffer.uri === undefined) {
      if (props.format === "gltf" || index !== 0)
        throw new Error(
          `buffers[${index}] cannot use the GLB BIN chunk in this container.`,
        );
      bytes = props.bin;
      if (bytes === null)
        throw new Error(
          `buffers[${index}] declares ${length} bytes but the GLB has no BIN chunk.`,
        );
      if (bytes.byteLength < length || bytes.byteLength > length + 3)
        throw new Error(
          `GLB BIN chunk length ${bytes.byteLength} does not cover buffers[${index}].byteLength ${length} with at most three padding bytes.`,
        );
    } else {
      const uri = buffer.uri as string;
      if (uri.startsWith("data:")) {
        bytes = decodeDataUri(uri, `buffers[${index}].uri`);
        if (bytes.byteLength !== length)
          throw new Error(
            `buffers[${index}] data URI has ${bytes.byteLength} bytes, not declared byteLength ${length}.`,
          );
      } else {
        bytes = props.resolveResource?.(uri) ?? null;
        if (bytes === null)
          throw new Error(
            `External buffer "${uri}" has no compiler-resolved resident bytes.`,
          );
        if (bytes.byteLength !== length)
          throw new Error(
            `External buffer "${uri}" has ${bytes.byteLength} bytes, not declared byteLength ${length}.`,
          );
      }
    }
    return bytes;
  });
  if (props.bin !== null && props.buffers.length === 0)
    throw new Error("GLB contains a BIN chunk but declares no buffer.");
  if (
    props.bin !== null &&
    object(props.buffers[0], "buffers[0]").uri !== undefined
  )
    throw new Error(
      "GLB BIN chunk is orphaned because buffers[0] declares an external URI.",
    );
  props.bufferViews.forEach((value, index) => {
    const view = object(value, `bufferViews[${index}]`);
    const bufferIndex = view.buffer as number;
    const offset = (view.byteOffset as number | undefined) ?? 0;
    const length = view.byteLength as number;
    const declared = object(
      props.buffers[bufferIndex],
      `buffers[${bufferIndex}]`,
    ).byteLength as number;
    if (
      offset + length > declared ||
      offset + length > payloads[bufferIndex]!.byteLength
    )
      throw new Error(
        `bufferViews[${index}] range ${offset}..${offset + length} exceeds buffers[${bufferIndex}].byteLength ${declared}.`,
      );
  });
  props.images.forEach((value, index) => {
    const image = object(value, `images[${index}]`);
    if (typeof image.uri !== "string") return;
    const bytes = image.uri.startsWith("data:")
      ? decodeDataUri(image.uri, `images[${index}].uri`)
      : (props.resolveResource?.(image.uri) ?? null);
    if (bytes === null || bytes.byteLength === 0)
      throw new Error(
        `External image "${image.uri}" has no non-empty compiler-resolved resident bytes.`,
      );
  });
  return payloads;
};

const decodeDataUri = (uri: string, path: string): Uint8Array => {
  const comma = uri.indexOf(",");
  if (comma < 5) throw new Error(`${path} is not a complete data URI.`);
  const metadata = uri.slice(5, comma);
  const payload = uri.slice(comma + 1);
  try {
    if (metadata.split(";").includes("base64")) {
      if (
        payload.length % 4 !== 0 ||
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(
          payload,
        ) === false
      )
        throw new Error("base64 payload is not canonical");
      return Uint8Array.from(atob(payload), (character) =>
        character.charCodeAt(0),
      );
    }
    const output: number[] = [];
    for (let index = 0; index < payload.length; ++index) {
      if (payload[index] === "%") {
        const hex = payload.slice(index + 1, index + 3);
        if (/^[0-9A-Fa-f]{2}$/u.test(hex) === false)
          throw new Error("percent escape is incomplete");
        output.push(Number.parseInt(hex, 16));
        index += 2;
      } else {
        const encoded = new TextEncoder().encode(payload[index]!);
        output.push(...encoded);
      }
    }
    return Uint8Array.from(output);
  } catch (error) {
    throw new Error(
      `${path} has an invalid data payload: ${(error as Error).message}.`,
    );
  }
};

const validateAccessorRange = (
  accessor: Record<string, unknown>,
  index: number,
  bufferViews: unknown[],
): void => {
  if (accessor.bufferView === undefined) {
    if (accessor.sparse === undefined)
      throw new Error(
        `accessors[${index}] needs a bufferView or a complete sparse payload.`,
      );
    return;
  }
  const view = object(
    bufferViews[accessor.bufferView as number],
    `bufferViews[${accessor.bufferView as number}]`,
  );
  const element = accessorElementByteLength(
    accessor.componentType as number,
    accessor.type as string,
  );
  const stride = (view.byteStride as number | undefined) ?? element;
  if (stride < element)
    throw new Error(
      `accessors[${index}] element size ${element} exceeds bufferView byteStride ${stride}.`,
    );
  const offset = (accessor.byteOffset as number | undefined) ?? 0;
  const count = accessor.count as number;
  const end = offset + (count - 1) * stride + element;
  if (end > (view.byteLength as number))
    throw new Error(
      `accessors[${index}] requires ${end} bytes inside a bufferView of ${String(view.byteLength)} bytes.`,
    );
};

const validateSparseAccessor = (
  accessor: Record<string, unknown>,
  index: number,
  bufferViews: unknown[],
): void => {
  if (accessor.sparse === undefined) return;
  const sparse = object(accessor.sparse, `accessors[${index}].sparse`);
  positiveInteger(sparse.count, `accessors[${index}].sparse.count`);
  if ((sparse.count as number) > (accessor.count as number))
    throw new Error(
      `accessors[${index}].sparse.count exceeds the accessor count.`,
    );
  const indices = object(sparse.indices, `accessors[${index}].sparse.indices`);
  const values = object(sparse.values, `accessors[${index}].sparse.values`);
  integerIndex(
    indices.bufferView,
    bufferViews.length,
    `accessors[${index}].sparse.indices.bufferView`,
    true,
  );
  integerIndex(
    values.bufferView,
    bufferViews.length,
    `accessors[${index}].sparse.values.bufferView`,
    true,
  );
  if (
    typeof indices.componentType !== "number" ||
    [5121, 5123, 5125].includes(indices.componentType) === false
  )
    throw new Error(
      `accessors[${index}].sparse.indices.componentType must be unsigned byte, short or int.`,
    );
  const count = sparse.count as number;
  validateSubViewRange(
    bufferViews,
    indices.bufferView as number,
    (indices.byteOffset as number | undefined) ?? 0,
    count * componentByteLength(indices.componentType),
    `accessors[${index}].sparse.indices`,
  );
  validateSubViewRange(
    bufferViews,
    values.bufferView as number,
    (values.byteOffset as number | undefined) ?? 0,
    count *
      accessorElementByteLength(
        accessor.componentType as number,
        accessor.type as string,
      ),
    `accessors[${index}].sparse.values`,
  );
};

const validateSubViewRange = (
  bufferViews: unknown[],
  viewIndex: number,
  offset: number,
  length: number,
  path: string,
): void => {
  nonNegativeInteger(offset, `${path}.byteOffset`);
  const view = object(bufferViews[viewIndex], `bufferViews[${viewIndex}]`);
  if (offset + length > (view.byteLength as number))
    throw new Error(`${path} exceeds its bufferView range.`);
};

const componentByteLength = (componentType: number): number =>
  componentType === 5120 || componentType === 5121
    ? 1
    : componentType === 5122 || componentType === 5123
      ? 2
      : 4;

const accessorElementByteLength = (
  componentType: number,
  shape: string,
): number => {
  const component = componentByteLength(componentType);
  const components: Record<string, number> = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT2: 4,
    MAT3: 9,
    MAT4: 16,
  };
  const raw = component * components[shape]!;
  if (shape === "MAT2" && component === 1) return 8;
  if (shape === "MAT3" && component === 1) return 12;
  if (shape === "MAT3" && component === 2) return 24;
  return raw;
};

const validateHumanoidSkinning = (props: {
  nodes: unknown[];
  meshes: unknown[];
  skins: unknown[];
  accessors: unknown[];
  bufferViews: unknown[];
  payloads: Uint8Array[];
}): Set<number> => {
  let skinnedPrimitiveCount = 0;
  const weightedNodes = new Set<number>();
  props.nodes.forEach((value, nodeIndex) => {
    const node = object(value, `nodes[${nodeIndex}]`);
    if (node.skin === undefined) return;
    if (node.mesh === undefined)
      throw new Error(
        `nodes[${nodeIndex}] binds a skin without a render mesh.`,
      );
    const skin = object(
      props.skins[node.skin as number],
      `skins[${node.skin as number}]`,
    );
    const joints = requiredArray(
      skin.joints,
      `skins[${node.skin as number}].joints`,
    );
    const mesh = object(
      props.meshes[node.mesh as number],
      `meshes[${node.mesh as number}]`,
    );
    requiredArray(
      mesh.primitives,
      `meshes[${node.mesh as number}].primitives`,
    ).forEach((value, primitiveIndex) => {
      const primitive = object(
        value,
        `meshes[${node.mesh as number}].primitives[${primitiveIndex}]`,
      );
      const attributes = object(
        primitive.attributes,
        `meshes[${node.mesh as number}].primitives[${primitiveIndex}].attributes`,
      );
      integerIndex(
        attributes.JOINTS_0,
        props.accessors.length,
        `meshes[${node.mesh as number}].primitives[${primitiveIndex}].attributes.JOINTS_0`,
        true,
      );
      integerIndex(
        attributes.WEIGHTS_0,
        props.accessors.length,
        `meshes[${node.mesh as number}].primitives[${primitiveIndex}].attributes.WEIGHTS_0`,
        true,
      );
      const position = object(
        props.accessors[attributes.POSITION as number],
        `accessors[${attributes.POSITION as number}]`,
      );
      const jointAccessor = object(
        props.accessors[attributes.JOINTS_0 as number],
        `accessors[${attributes.JOINTS_0 as number}]`,
      );
      const weightAccessor = object(
        props.accessors[attributes.WEIGHTS_0 as number],
        `accessors[${attributes.WEIGHTS_0 as number}]`,
      );
      if (
        jointAccessor.type !== "VEC4" ||
        (jointAccessor.componentType !== 5121 &&
          jointAccessor.componentType !== 5123) ||
        weightAccessor.type !== "VEC4" ||
        (weightAccessor.componentType !== 5126 &&
          weightAccessor.componentType !== 5121 &&
          weightAccessor.componentType !== 5123) ||
        (weightAccessor.componentType !== 5126 &&
          weightAccessor.normalized !== true) ||
        jointAccessor.count !== position.count ||
        weightAccessor.count !== position.count
      )
        throw new Error(
          `Skinned primitive ${String(node.mesh)}:${primitiveIndex} needs count-matched JOINTS_0 and normalized WEIGHTS_0 VEC4 accessors.`,
        );
      for (let vertex = 0; vertex < (position.count as number); ++vertex) {
        let weightSum = 0;
        for (let component = 0; component < 4; ++component) {
          const weight = readAccessorComponent(
            props,
            attributes.WEIGHTS_0 as number,
            vertex,
            component,
          );
          const joint = readAccessorComponent(
            props,
            attributes.JOINTS_0 as number,
            vertex,
            component,
          );
          weightSum += weight;
          if (
            weight > 0 &&
            (Number.isSafeInteger(joint) === false ||
              joint < 0 ||
              joint >= joints.length)
          )
            throw new Error(
              `Skinned primitive ${String(node.mesh)}:${primitiveIndex} vertex ${vertex} cites joint ${joint} outside skin ${String(node.skin)}.`,
            );
          if (weight > 0) weightedNodes.add(joints[joint] as number);
        }
        if (Number.isFinite(weightSum) === false || weightSum <= 0)
          throw new Error(
            `Skinned primitive ${String(node.mesh)}:${primitiveIndex} vertex ${vertex} has no positive skin weight.`,
          );
      }
      ++skinnedPrimitiveCount;
    });
  });
  if (skinnedPrimitiveCount === 0)
    throw new Error(
      "Humanoid profiles require at least one mesh node with a complete skin binding.",
    );
  return weightedNodes;
};

const readAccessorComponent = (
  props: {
    accessors: unknown[];
    bufferViews: unknown[];
    payloads: Uint8Array[];
  },
  accessorIndex: number,
  element: number,
  component: number,
): number => {
  const accessor = object(
    props.accessors[accessorIndex],
    `accessors[${accessorIndex}]`,
  );
  if (accessor.sparse !== undefined)
    throw new Error(
      `Skin accessor ${accessorIndex} may not use sparse overrides at the production ingest boundary.`,
    );
  const viewIndex = accessor.bufferView as number;
  const bufferView = object(
    props.bufferViews[viewIndex],
    `bufferViews[${viewIndex}]`,
  );
  const type = accessor.componentType as number;
  const size = componentByteLength(type);
  const stride =
    (bufferView.byteStride as number | undefined) ??
    accessorElementByteLength(type, accessor.type as string);
  const offset =
    ((bufferView.byteOffset as number | undefined) ?? 0) +
    ((accessor.byteOffset as number | undefined) ?? 0) +
    element * stride +
    component * size;
  const bytes = props.payloads[bufferView.buffer as number]!;
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const value =
    type === 5121
      ? data.getUint8(offset)
      : type === 5123
        ? data.getUint16(offset, true)
        : data.getFloat32(offset, true);
  return accessor.normalized === true
    ? type === 5121
      ? value / 255
      : type === 5123
        ? value / 65535
        : value
    : value;
};

const gltfHumanoidBones = (
  nodes: unknown[],
  skins: unknown[],
): Array<{ bone: AutoMovieHumanoidBone; node: number }> => {
  const joints = new Set(
    skins.flatMap((value, index) =>
      requiredArray(
        object(value, `skins[${index}]`).joints,
        `skins[${index}].joints`,
      ),
    ),
  );
  const used = new Set<AutoMovieHumanoidBone>();
  return nodes.flatMap((value, index) => {
    if (joints.has(index) === false) return [];
    const name = object(value, `nodes[${index}]`).name;
    if (typeof name !== "string") return [];
    const bone = HUMANOID_ALIASES[normalizeBoneName(name)];
    if (bone === undefined || used.has(bone)) return [];
    used.add(bone);
    return [{ bone, node: index }];
  });
};

const vrmHumanoidBones = (
  document: Record<string, unknown>,
  nodes: unknown[],
): Array<{ bone: AutoMovieHumanoidBone; node: number }> => {
  const extensions = optionalObject(document.extensions, "extensions");
  if (extensions.VRMC_vrm !== undefined) {
    const vrm = object(extensions.VRMC_vrm, "extensions.VRMC_vrm");
    const humanoid = object(vrm.humanoid, "extensions.VRMC_vrm.humanoid");
    const bones = object(
      humanoid.humanBones,
      "extensions.VRMC_vrm.humanoid.humanBones",
    );
    return Object.entries(bones)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([bone, value]) => {
        if (HUMANOID_BONES.has(bone as AutoMovieHumanoidBone) === false)
          throw new Error(`VRMC_vrm declares unknown humanoid bone "${bone}".`);
        const node = object(
          value,
          `extensions.VRMC_vrm.humanoid.humanBones.${bone}`,
        ).node;
        if (validNodeIndex(node, nodes.length) === false)
          throw new Error(
            `VRMC_vrm humanoid bone "${bone}" does not resolve to a node.`,
          );
        return { bone: bone as AutoMovieHumanoidBone, node: node as number };
      });
  }
  if (extensions.VRM !== undefined) {
    const vrm = object(extensions.VRM, "extensions.VRM");
    const humanoid = object(vrm.humanoid, "extensions.VRM.humanoid");
    const used = new Set<AutoMovieHumanoidBone>();
    return requiredArray(
      humanoid.humanBones,
      "extensions.VRM.humanoid.humanBones",
    ).map((value, index) => {
      const bone = object(
        value,
        `extensions.VRM.humanoid.humanBones[${index}]`,
      );
      if (
        typeof bone.bone !== "string" ||
        HUMANOID_BONES.has(bone.bone as AutoMovieHumanoidBone) === false ||
        validNodeIndex(bone.node, nodes.length) === false ||
        used.has(bone.bone as AutoMovieHumanoidBone)
      )
        throw new Error(
          `VRM humanoid entry ${index} has an unknown, duplicate or dangling bone mapping.`,
        );
      used.add(bone.bone as AutoMovieHumanoidBone);
      return {
        bone: bone.bone as AutoMovieHumanoidBone,
        node: bone.node as number,
      };
    });
  }
  return [];
};

const validNodeIndex = (value: unknown, length: number): boolean =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value < length;

const normalizeBoneName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/^mixamorig:?/u, "")
    .replace(/[\s_.:|-]/gu, "");

const HUMANOID_BONES = new Set<AutoMovieHumanoidBone>([
  "hips",
  "spine",
  "chest",
  "upperChest",
  "neck",
  "head",
  "leftEye",
  "rightEye",
  "jaw",
  "leftShoulder",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightShoulder",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "leftToes",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
  "rightToes",
  "leftThumbMetacarpal",
  "leftThumbProximal",
  "leftThumbDistal",
  "leftIndexProximal",
  "leftIndexIntermediate",
  "leftIndexDistal",
  "leftMiddleProximal",
  "leftMiddleIntermediate",
  "leftMiddleDistal",
  "leftRingProximal",
  "leftRingIntermediate",
  "leftRingDistal",
  "leftLittleProximal",
  "leftLittleIntermediate",
  "leftLittleDistal",
  "rightThumbMetacarpal",
  "rightThumbProximal",
  "rightThumbDistal",
  "rightIndexProximal",
  "rightIndexIntermediate",
  "rightIndexDistal",
  "rightMiddleProximal",
  "rightMiddleIntermediate",
  "rightMiddleDistal",
  "rightRingProximal",
  "rightRingIntermediate",
  "rightRingDistal",
  "rightLittleProximal",
  "rightLittleIntermediate",
  "rightLittleDistal",
]);

const HUMANOID_ALIASES: Readonly<Record<string, AutoMovieHumanoidBone>> = {
  hips: "hips",
  pelvis: "hips",
  spine: "spine",
  spine01: "spine",
  spine1: "chest",
  chest: "chest",
  spine02: "chest",
  spine2: "upperChest",
  spine03: "upperChest",
  upperchest: "upperChest",
  neck: "neck",
  head: "head",
  leftshoulder: "leftShoulder",
  leftclavicle: "leftShoulder",
  leftarm: "leftUpperArm",
  leftupperarm: "leftUpperArm",
  leftforearm: "leftLowerArm",
  leftlowerarm: "leftLowerArm",
  lefthand: "leftHand",
  rightshoulder: "rightShoulder",
  rightclavicle: "rightShoulder",
  rightarm: "rightUpperArm",
  rightupperarm: "rightUpperArm",
  rightforearm: "rightLowerArm",
  rightlowerarm: "rightLowerArm",
  righthand: "rightHand",
  leftupleg: "leftUpperLeg",
  leftupperleg: "leftUpperLeg",
  leftleg: "leftLowerLeg",
  leftlowerleg: "leftLowerLeg",
  leftfoot: "leftFoot",
  lefttoebase: "leftToes",
  lefttoes: "leftToes",
  rightupleg: "rightUpperLeg",
  rightupperleg: "rightUpperLeg",
  rightleg: "rightLowerLeg",
  rightlowerleg: "rightLowerLeg",
  rightfoot: "rightFoot",
  righttoebase: "rightToes",
  righttoes: "rightToes",
};
