import { automovieFaceWeight } from "./AutomovieFaceWeight";
import { IautomovieFaceBrowSet } from "./IautomovieFaceBrowSet";
import { IautomovieFaceCheekSet } from "./IautomovieFaceCheekSet";
import { IautomovieFaceEyeSet } from "./IautomovieFaceEyeSet";
import { IautomovieFaceJaw } from "./IautomovieFaceJaw";
import { IautomovieFaceMouth } from "./IautomovieFaceMouth";
import { IautomovieFaceNose } from "./IautomovieFaceNose";

/**
 * A face-shape specification ??the document the face editor's tool calling
 * emits and the engine morphs deterministically.
 *
 * The document mirrors facial anatomy: overall head form at the top level, then
 * one named group per feature ({@link IautomovieFaceEyeSet eyes},
 * {@link IautomovieFaceNose nose}, {@link IautomovieFaceJaw jaw}??, each group an
 * interface of its own so an LLM reads the schema the way a person reads a
 * face. Every leaf is a signed morph weight in `[-2, 2]` over a face template
 * (the canonical neutral topology, or a character whose `identity` morph is
 * already baked): `0` is the template unchanged, the sign picks the direction,
 * `짹1` is one nameable trait step, and beyond `짹1` exaggerates toward
 * caricature. **Omitted fields and groups mean neutral** ??emit only the traits
 * you intend to change. Magnitudes are enforced at runtime by the engine
 * validator; each leaf projects onto one glTF morph target
 * ({@link automovieFaceParameterName}) the forge bakes into the template.
 *
 * Identity (whose face this is) and skin texture are asset concerns living in
 * the template, not here: this document stays a pure, portable trait vector, so
 * the same edit ("rounder cheeks, narrower jaw") applies to any character.
 *
 * @author Samchon
 */
export interface IautomovieFace {
  /** Lateral width of the whole face: `+` wider, `-` narrower. */
  width?: automovieFaceWeight;

  /**
   * Vertical stretch about the eye line: `+` longer (lower jaw drops, brow
   * rises), `-` shorter and rounder ??childlike faces sit negative.
   */
  length?: automovieFaceWeight;

  /**
   * The cheeks (left/right asymmetry inside) ??see
   * {@link IautomovieFaceCheekSet}.
   */
  cheeks?: IautomovieFaceCheekSet;

  /** The jaw, with the chin nested at its tip ??see {@link IautomovieFaceJaw}. */
  jaw?: IautomovieFaceJaw;

  /**
   * The eyes, shared fields + left/right asymmetry ??see
   * {@link IautomovieFaceEyeSet}.
   */
  eyes?: IautomovieFaceEyeSet;

  /**
   * The eyebrows (left/right asymmetry inside) ??see
   * {@link IautomovieFaceBrowSet}.
   */
  brows?: IautomovieFaceBrowSet;

  /** The nose ??see {@link IautomovieFaceNose}. */
  nose?: IautomovieFaceNose;

  /** The mouth, with the lips nested inside ??see {@link IautomovieFaceMouth}. */
  mouth?: IautomovieFaceMouth;
}
