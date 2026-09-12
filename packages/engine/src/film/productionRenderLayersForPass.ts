import { AutoMovieGuidePass } from "@automovie/interface";

import { IAutoMovieProductionRenderFrame } from "./IAutoMovieProductionRenderFrame";
import { IAutoMovieProductionRenderLayer } from "./IAutoMovieProductionRenderLayer";

/**
 * Resolve pass-specific transition inputs.
 *
 * Beauty is alpha composited. Structural guide passes are classifications or
 * geometric fields, so linearly blending their pixels invents invalid values;
 * they select the dominant shot layer instead (incoming wins an exact tie).
 * Every result is a fresh copy, so a caller mutating it cannot alter the frame
 * another pass reads.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-beauty-structural-distinction Composites weighted layers only for beauty and gives every structural pass one unblended dominant layer so beauty blending never contaminates structural truth.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Keeps the beauty appearance input and a structural product's declared fact separate at a transition.
 */
export const productionRenderLayersForPass = (
  frame: IAutoMovieProductionRenderFrame,
  pass: AutoMovieGuidePass,
): IAutoMovieProductionRenderLayer[] => {
  if (pass === "beauty") return structuredClone(frame.layers);
  const selected = frame.layers.reduce((selected, candidate) =>
    candidate.weight >= selected.weight ? candidate : selected,
  );
  return [
    {
      ...structuredClone(selected),
      weight: 1,
    },
  ];
};
