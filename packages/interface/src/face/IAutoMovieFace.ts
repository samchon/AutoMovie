import { AutoMovieFaceWeight } from "./AutoMovieFaceWeight";
import { IAutoMovieFaceBrowSet } from "./IAutoMovieFaceBrowSet";
import { IAutoMovieFaceCheekSet } from "./IAutoMovieFaceCheekSet";
import { IAutoMovieFaceEyeSet } from "./IAutoMovieFaceEyeSet";
import { IAutoMovieFaceJaw } from "./IAutoMovieFaceJaw";
import { IAutoMovieFaceMouth } from "./IAutoMovieFaceMouth";
import { IAutoMovieFaceNose } from "./IAutoMovieFaceNose";

/**
 * A face-shape specification: the document the face editor's tool calling
 * emits and the engine morphs deterministically.
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
 * ({@link AutoMovieFaceParameterName}) the forge bakes into the template.
 *
 * Identity (whose face this is) and skin texture are asset concerns living in
 * the template, not here: this document stays a pure, portable trait vector, so
 * the same edit ("rounder cheeks, narrower jaw") applies to any character.
 *
 * @author Samchon
 */
export interface IAutoMovieFace {
  /** Lateral width of the whole face: `+` wider, `-` narrower. */
  width?: AutoMovieFaceWeight;

  /**
   * Vertical stretch about the eye line: `+` longer (lower jaw drops, brow
   * rises), `-` shorter and rounder; childlike faces sit negative.
   */
  length?: AutoMovieFaceWeight;

  /**
   * The cheeks (left/right asymmetry inside). See
   * {@link IAutoMovieFaceCheekSet}.
   */
  cheeks?: IAutoMovieFaceCheekSet;

  /** The jaw, with the chin nested at its tip. See {@link IAutoMovieFaceJaw}. */
  jaw?: IAutoMovieFaceJaw;

  /**
   * The eyes, shared fields + left/right asymmetry. See
   * {@link IAutoMovieFaceEyeSet}.
   */
  eyes?: IAutoMovieFaceEyeSet;

  /**
   * The eyebrows (left/right asymmetry inside). See
   * {@link IAutoMovieFaceBrowSet}.
   */
  brows?: IAutoMovieFaceBrowSet;

  /** The nose. See {@link IAutoMovieFaceNose}. */
  nose?: IAutoMovieFaceNose;

  /** The mouth, with the lips nested inside. See {@link IAutoMovieFaceMouth}. */
  mouth?: IAutoMovieFaceMouth;
}
