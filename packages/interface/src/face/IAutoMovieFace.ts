import { AutoMovieFaceWeight } from "./AutoMovieFaceWeight";
import { IAutoMovieFaceBrowSet } from "./IAutoMovieFaceBrowSet";
import { IAutoMovieFaceCheekSet } from "./IAutoMovieFaceCheekSet";
import { IAutoMovieFaceEyeSet } from "./IAutoMovieFaceEyeSet";
import { IAutoMovieFaceJaw } from "./IAutoMovieFaceJaw";
import { IAutoMovieFaceMouth } from "./IAutoMovieFaceMouth";
import { IAutoMovieFaceNose } from "./IAutoMovieFaceNose";

/**
 * A face-shape specification: the document the face editor's tool calling emits
 * and the engine morphs deterministically.
 *
 * The document mirrors facial anatomy: overall head form at the top level, then
 * one named group per feature ({@link IAutoMovieFaceEyeSet eyes},
 * {@link IAutoMovieFaceNose nose}, {@link IAutoMovieFaceJaw jaw}…), each group an
 * interface of its own so an LLM reads the schema the way a person reads a
 * face. Every leaf is a signed morph weight in `[-2, 2]` over a face template
 * (the canonical neutral topology, or a character whose `identity` morph is
 * already baked): `0` is the template unchanged, the sign picks the direction,
 * `±1` is one nameable trait step, and beyond `±1` exaggerates toward
 * caricature. **Omitted fields and groups mean neutral**: emit only the traits
 * you intend to change. Magnitudes are enforced at runtime by the engine
 * validator; each leaf projects onto one glTF morph target
 * ({@link AutoMovieFaceParameterName}) the face package bakes into the
 * template.
 *
 * Identity (whose face this is) and skin texture are asset concerns living in
 * the template, not here: this document stays a pure, portable trait vector, so
 * the same edit ("rounder cheeks, narrower jaw") applies to any character.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieFace` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieFace` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieFace {
  /**
   * Lateral width of the whole face: `+` wider, `-` narrower.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `width` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `width` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  width?: AutoMovieFaceWeight;

  /**
   * Vertical stretch about the eye line: `+` longer (lower jaw drops, brow
   * rises), `-` shorter and rounder; childlike faces sit negative.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `length` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `length` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  length?: AutoMovieFaceWeight;

  /**
   * The cheeks (left/right asymmetry inside). See
   * {@link IAutoMovieFaceCheekSet}.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `cheeks` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `cheeks` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  cheeks?: IAutoMovieFaceCheekSet;

  /**
   * The jaw, with the chin nested at its tip. See {@link IAutoMovieFaceJaw}.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `jaw` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `jaw` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  jaw?: IAutoMovieFaceJaw;

  /**
   * The eyes, shared fields + left/right asymmetry. See
   * {@link IAutoMovieFaceEyeSet}.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `eyes` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `eyes` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  eyes?: IAutoMovieFaceEyeSet;

  /**
   * The eyebrows (left/right asymmetry inside). See
   * {@link IAutoMovieFaceBrowSet}.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `brows` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `brows` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  brows?: IAutoMovieFaceBrowSet;

  /**
   * The nose. See {@link IAutoMovieFaceNose}.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `nose` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `nose` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  nose?: IAutoMovieFaceNose;

  /**
   * The mouth, with the lips nested inside. See {@link IAutoMovieFaceMouth}.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `mouth` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `mouth` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  mouth?: IAutoMovieFaceMouth;
}
