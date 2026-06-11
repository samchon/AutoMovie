import { tags } from "typia";

/**
 * A signed face-shape morph weight — the leaf value type of every
 * {@link IAutoFilmFace} trait.
 *
 * The range AND the neutral default are part of the TYPE, not just prose:
 * `tags.Minimum<-2>` / `tags.Maximum<2>` / `tags.Default<0>` make
 * `typia.llm.application` emit `minimum`/`maximum`/`default` in the JSON
 * schema, so a tool-calling model is bound to `[-2, 2]` and told the neutral
 * value is `0` at the structured-output layer — the engine validator never has
 * to reject an out-of-range weight. `0` is the neutral template (the balanced
 * average face); `±1` is one nameable trait step away from it; `±2` is the
 * believable-human edge, beyond which would be caricature.
 *
 * @author Samchon
 */
export type AutoFilmFaceWeight = number &
  tags.Minimum<-2> &
  tags.Maximum<2> &
  tags.Default<0>;
