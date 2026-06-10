import { IAutoFilmFace } from "./IAutoFilmFace";

/**
 * The closed set of **semantic face-shape parameters** — the sliders of the
 * face editor, derived from {@link IAutoFilmFace}'s own fields so the menu and
 * the document can never drift apart.
 *
 * Each name is also a glTF morph target baked into the canonical face template
 * (MediaPipe 468-vertex topology): the forge's recipes turn one nameable trait
 * per name, so identity stays put while a single trait moves. The set is
 * deliberately low-dimensional and human-readable — the same design bet as
 * {@link AutoFilmArkitChannel} for expression, applied to face _shape_.
 *
 * @author Samchon
 */
export type AutoFilmFaceParameterName = keyof IAutoFilmFace;
