/**
 * A face-shape specification — the document the face editor's tool calling
 * emits and the engine morphs deterministically.
 *
 * Every field is one semantic slider over a face template (the canonical
 * neutral topology, or a character whose `identity` morph is already baked): a
 * signed morph weight in `[-2, 2]` where `0` is the template unchanged, the
 * sign picks the direction, `±1` is one nameable trait step, and beyond `±1`
 * exaggerates toward caricature. **Omitted fields mean neutral** — the LLM
 * emits only the traits it intends to change. Magnitudes are enforced at
 * runtime by the engine validator; the geometry behind each field is the
 * matching glTF morph target the forge bakes into the template.
 *
 * Identity (whose face this is) and skin texture are asset concerns living in
 * the template, not here: this document stays a pure, portable trait vector, so
 * the same edit ("rounder cheeks, narrower jaw") applies to any character.
 *
 * @author Samchon
 */
export interface IAutoFilmFace {
  // ── overall ──

  /** Lateral width of the whole face: `+` wider, `-` narrower. */
  faceWidth?: number;

  /**
   * Vertical stretch about the eye line: `+` longer (lower jaw drops, brow
   * rises), `-` shorter and rounder — childlike faces sit negative.
   */
  faceLength?: number;

  // ── jaw / chin / cheeks ──

  /** Width of the jaw below the cheekbones: `+` square, `-` a slim V-line. */
  jawWidth?: number;

  /** Vertical reach of the chin tip: `+` longer chin, `-` a short chin. */
  chinLength?: number;

  /** Forward projection of the chin: `+` protrudes, `-` recedes. */
  chinProtrusion?: number;

  /** Cheek volume around the cheekbones: `+` full and round, `-` gaunt. */
  cheekFullness?: number;

  // ── eyes / brows ──

  /** Uniform scale of each eye about its own center: `+` larger eyes. */
  eyeSize?: number;

  /** Horizontal-only eye scale: widens the fissure without lifting lids. */
  eyeWidth?: number;

  /** Distance between the eyes: `+` wide-set, `-` close-set. */
  eyeSpacing?: number;

  /** Vertical position of the eyes on the face: `+` higher. */
  eyeHeight?: number;

  /** Outer-corner slant: `+` lifts the outer corners (upturned eyes). */
  eyeTilt?: number;

  /** Vertical position of the brows: `+` raises them off the eyes. */
  browHeight?: number;

  // ── nose ──

  /** Vertical length of the nose: `+` longer (tip drops). */
  noseLength?: number;

  /** Width of the nostrils / alar base: `+` broader. */
  noseWidth?: number;

  /** Forward projection of the nose tip: `+` more prominent. */
  noseProjection?: number;

  // ── mouth ──

  /** Width of the mouth: `+` wider smile line. */
  mouthWidth?: number;

  /** Vertical thickness of the lips about the lip seam: `+` fuller. */
  lipFullness?: number;

  /** Vertical position of the whole mouth: `+` higher toward the nose. */
  mouthHeight?: number;
}
