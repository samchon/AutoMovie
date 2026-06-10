import { IAutoFilmBrows } from "./IAutoFilmBrows";
import { IAutoFilmCheeks } from "./IAutoFilmCheeks";
import { IAutoFilmEyes } from "./IAutoFilmEyes";
import { IAutoFilmJaw } from "./IAutoFilmJaw";
import { IAutoFilmMouth } from "./IAutoFilmMouth";
import { IAutoFilmNose } from "./IAutoFilmNose";

/**
 * A face-shape specification — the document the face editor's tool calling
 * emits and the engine morphs deterministically.
 *
 * The document mirrors facial anatomy: overall head form at the top level, then
 * one named group per feature ({@link IAutoFilmEyes eyes},
 * {@link IAutoFilmNose nose}, {@link IAutoFilmJaw jaw}…), each group an interface
 * of its own so an LLM reads the schema the way a person reads a face. Every
 * leaf is a signed morph weight in `[-2, 2]` over a face template (the
 * canonical neutral topology, or a character whose `identity` morph is already
 * baked): `0` is the template unchanged, the sign picks the direction, `±1` is
 * one nameable trait step, and beyond `±1` exaggerates toward caricature.
 * **Omitted fields and groups mean neutral** — emit only the traits you intend
 * to change. Magnitudes are enforced at runtime by the engine validator; each
 * leaf projects onto one glTF morph target ({@link AutoFilmFaceParameterName})
 * the forge bakes into the template.
 *
 * Identity (whose face this is) and skin texture are asset concerns living in
 * the template, not here: this document stays a pure, portable trait vector, so
 * the same edit ("rounder cheeks, narrower jaw") applies to any character.
 *
 * @author Samchon
 */
export interface IAutoFilmFace {
  /** Lateral width of the whole face: `+` wider, `-` narrower. */
  width?: number;

  /**
   * Vertical stretch about the eye line: `+` longer (lower jaw drops, brow
   * rises), `-` shorter and rounder — childlike faces sit negative.
   */
  length?: number;

  /** The cheeks — see {@link IAutoFilmCheeks}. */
  cheeks?: IAutoFilmCheeks;

  /** The jaw, with the chin nested at its tip — see {@link IAutoFilmJaw}. */
  jaw?: IAutoFilmJaw;

  /** The eyes (always both together) — see {@link IAutoFilmEyes}. */
  eyes?: IAutoFilmEyes;

  /** The eyebrows — see {@link IAutoFilmBrows}. */
  brows?: IAutoFilmBrows;

  /** The nose — see {@link IAutoFilmNose}. */
  nose?: IAutoFilmNose;

  /** The mouth, with the lips nested inside — see {@link IAutoFilmMouth}. */
  mouth?: IAutoFilmMouth;
}
