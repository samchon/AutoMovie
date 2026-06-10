import { IAutoFilmFaceParameter } from "./IAutoFilmFaceParameter";

/**
 * A face-shape specification — the document the face editor's tool calling
 * emits and the engine morphs deterministically.
 *
 * A face is expressed as semantic edits over a face template (the canonical
 * neutral topology, or a character asset whose `identity` morph is already
 * applied — see the engine's face template). The LLM never authors geometry; it
 * picks parameters from the closed menu and the engine turns them into vertices
 * via the template's baked morph targets. Each parameter should appear at most
 * once.
 *
 * Identity (whose face this is) and skin texture are asset concerns living in
 * the template, not here: this document stays a pure, portable parameter
 * vector, so the same edit ("rounder cheeks, narrower jaw") applies to any
 * character.
 *
 * @author Samchon
 */
export interface IAutoFilmFace {
  /**
   * Semantic shape edits, each parameter at most once. An empty list is the
   * template's face unchanged.
   */
  parameters: IAutoFilmFaceParameter[];
}
