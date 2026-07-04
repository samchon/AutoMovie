import {
  IAutoMovieExpression,
  IAutoMovieValidation,
} from "@automovie/interface";

import { ViolationCollector } from "./violation";

/**
 * Validate an {@link IAutoMovieExpression} — Tier-1 range checks the rough types
 * intentionally do not encode.
 *
 * Preset and channel _names_ are already constrained by their closed unions, so
 * the only thing left to enforce at runtime is the magnitudes: preset intensity
 * and every blendshape weight must sit in `[0, 1]`, and no ARKit channel should
 * be set twice.
 *
 * @author Samchon
 */
export const validateExpression = (props: {
  expression: IAutoMovieExpression;
  path?: string;
  collector?: ViolationCollector;
}): ViolationCollector => {
  const path = props.path ?? "$input";
  const collector = props.collector ?? new ViolationCollector();
  const { expression } = props;

  collector.range(`${path}.intensity`, expression.intensity, 0, 1, "intensity");

  const seen = new Set<string>();
  (expression.blendshapes ?? []).forEach((c, i) => {
    const cp = `${path}.blendshapes[${i}]`;
    collector.range(`${cp}.weight`, c.weight, 0, 1, "weight");
    if (seen.has(c.channel))
      collector.push(
        "type",
        `${cp}.channel`,
        `ARKit channel "${c.channel}" is set more than once`,
        c.channel,
      );
    seen.add(c.channel);
  });

  return collector;
};

/** Convenience wrapper returning a finished {@link IAutoMovieValidation}. */
export const validateExpressionResult = (
  expression: IAutoMovieExpression,
): IAutoMovieValidation => validateExpression({ expression }).toValidation();
