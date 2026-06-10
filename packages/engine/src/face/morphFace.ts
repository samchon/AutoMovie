import { IAutoFilmFace } from "@autofilm/interface";

/**
 * A face template in render-ready flat-array form — the geometry side of the
 * face editor that an {@link IAutoFilmFace} morphs.
 *
 * `positions` is the template's resting face (the canonical neutral, or a
 * character with its `identity` morph already baked in), and `targets` maps
 * each morph-target name to per-vertex xyz deltas of the same length. This
 * matches what a glTF face asset carries (POSITION + named morph targets), so
 * an importer can fill it straight from the file.
 */
export interface IAutoFilmFaceTemplate {
  /** Resting vertex positions, xyz triples. */
  positions: number[];

  /** Morph-target deltas by parameter name, each `positions.length` long. */
  targets: Record<string, number[]>;
}

/**
 * Apply an {@link IAutoFilmFace}'s parameter weights to a face template — the
 * deterministic core of the face editor.
 *
 * Plain linear blendshape math, `positions + Σ weight·delta`, evaluated by the
 * engine so every renderer and every run produces identical vertices from the
 * same document. The face is assumed validated (`validateFace`); structural
 * mismatches against the _template_ are not a validation concern but a broken
 * asset, so they throw: a parameter without a matching target, or a target
 * whose delta length disagrees with the template.
 *
 * @author Samchon
 */
export const morphFace = (props: {
  template: IAutoFilmFaceTemplate;
  face: IAutoFilmFace;
}): number[] => {
  const { template, face } = props;
  const out = template.positions.slice();
  for (const { parameter, weight } of face.parameters) {
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
