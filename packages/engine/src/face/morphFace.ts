import { IautomovieFace, IautomovieFaceTemplate } from "@automovie/interface";

import { flattenFace } from "./FlattenFace";

// The template type moved to @automovie/interface (ingest produces it, the
// engine consumes it); re-exported here so engine consumers keep working.
export type { IautomovieFaceTemplate };

/**
 * Apply an {@link IautomovieFace}'s parameter weights to a face template ??the
 * deterministic core of the face editor.
 *
 * Plain linear blendshape math, `positions + 誇 weight쨌delta`, evaluated by the
 * engine so every renderer and every run produces identical vertices from the
 * same document. The face is assumed validated (`validateFace`); structural
 * mismatches against the _template_ are not a validation concern but a broken
 * asset, so they throw: a present trait without a matching target, or a target
 * whose delta length disagrees with the template.
 *
 * @author Samchon
 */
export const morphFace = (props: {
  template: IautomovieFaceTemplate;
  face: IautomovieFace;
}): number[] => {
  const { template, face } = props;
  const out = template.positions.slice();
  for (const { parameter, weight } of flattenFace(face)) {
    const delta = template.targets[parameter];
    if (delta === undefined)
      throw new Error(`face template has no morph target "${parameter}"`);
    if (delta.length !== out.length)
      throw new Error(
        `morph target "${parameter}" has ${delta.length} components, expected ${out.length}`,
      );
    for (let i = 0; i < out.length; i++) out[i] += weight * delta[i];
  }
  return out;
};
