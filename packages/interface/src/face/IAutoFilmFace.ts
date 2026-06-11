import { IAutoFilmFaceBrows } from "./IAutoFilmFaceBrows";
import { IAutoFilmFaceCheeks } from "./IAutoFilmFaceCheeks";
import { IAutoFilmFaceEyes } from "./IAutoFilmFaceEyes";
import { IAutoFilmFaceJaw } from "./IAutoFilmFaceJaw";
import { IAutoFilmFaceMouth } from "./IAutoFilmFaceMouth";
import { IAutoFilmFaceNose } from "./IAutoFilmFaceNose";

/**
 * A face-shape specification — the document the face editor's tool calling
 * emits and the engine morphs deterministically.
 *
 * The document mirrors facial anatomy: overall head form at the top level, then
 * one named group per feature ({@link IAutoFilmFaceEyes eyes},
 * {@link IAutoFilmFaceNose nose}, {@link IAutoFilmFaceJaw jaw}…), each group an
 * interface of its own so an LLM reads the schema the way a person reads a
 * face. Every leaf is a signed morph weight in `[-2, 2]` over a face template
 * (the canonical neutral topology, or a character whose `identity` morph is
 * already baked): `0` is the template unchanged, the sign picks the direction,
 * `±1` is one nameable trait step, and beyond `±1` exaggerates toward
 * caricature. **Omitted fields and groups mean neutral** — emit only the traits
 * you intend to change. Magnitudes are enforced at runtime by the engine
 * validator; each leaf projects onto one glTF morph target
 * ({@link AutoFilmFaceParameterName}) the forge bakes into the template.
 *
 * Identity (whose face this is) and skin texture are asset concerns living in
 * the template, not here: this document stays a pure, portable trait vector, so
 * the same edit ("rounder cheeks, narrower jaw") applies to any character.
 *
 * @author Samchon
 */
export interface IAutoFilmFace {
  /**
   * Lateral width of the whole face: `+` wider, `-` narrower.
   *
   * @default 0
   */
  width?: number;

  /**
   * Vertical stretch about the eye line: `+` longer (lower jaw drops, brow
   * rises), `-` shorter and rounder — childlike faces sit negative.
   *
   * @default 0
   */
  length?: number;

  /** The cheeks — see {@link IAutoFilmFaceCheeks}. */
  cheeks?: IAutoFilmFaceCheeks;

  /** The jaw, with the chin nested at its tip — see {@link IAutoFilmFaceJaw}. */
  jaw?: IAutoFilmFaceJaw;

  /** The eyes (always both together) — see {@link IAutoFilmFaceEyes}. */
  eyes?: IAutoFilmFaceEyes;

  /** The eyebrows — see {@link IAutoFilmFaceBrows}. */
  brows?: IAutoFilmFaceBrows;

  /** The nose — see {@link IAutoFilmFaceNose}. */
  nose?: IAutoFilmFaceNose;

  /** The mouth, with the lips nested inside — see {@link IAutoFilmFaceMouth}. */
  mouth?: IAutoFilmFaceMouth;
}
