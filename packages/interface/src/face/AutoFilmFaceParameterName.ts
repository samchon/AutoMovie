/**
 * The closed set of **semantic face-shape parameters** — the sliders of the
 * face editor.
 *
 * Each name is a glTF morph target baked into the canonical face template
 * (MediaPipe 468-vertex topology), deforming one nameable facial trait with a
 * smooth falloff: identity stays put while a single trait moves. The set is
 * deliberately low-dimensional and human-readable so an LLM can emit edits
 * directly ("bigger eyes, slimmer jaw" → two weights) — the same design bet as
 * {@link AutoFilmArkitChannel} for expression, applied to face _shape_.
 *
 * Weights are documented to `[-2, 2]` (0 = neutral, sign = direction, |1| =
 * nominal trait step) and enforced at runtime by the engine validator; a
 * character's likeness itself is not in this menu — it ships as a separate
 * `identity` morph on the asset, so these parameters always express _edits on
 * top of_ a face, never the face itself.
 *
 * @author Samchon
 */
export type AutoFilmFaceParameterName =
  // ── overall ──
  | "faceWidth"
  | "faceLength"
  // ── jaw / chin / cheeks ──
  | "jawWidth"
  | "chinLength"
  | "chinProtrusion"
  | "cheekFullness"
  // ── eyes / brows ──
  | "eyeSize"
  | "eyeSpacing"
  | "eyeHeight"
  | "eyeTilt"
  | "browHeight"
  // ── nose ──
  | "noseLength"
  | "noseWidth"
  | "noseProjection"
  // ── mouth ──
  | "mouthWidth"
  | "lipFullness"
  | "mouthHeight";
