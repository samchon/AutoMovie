import {
  AutoMovieArkitChannel,
  AutoMovieExpressionPreset,
  IAutoMovieExpression,
  IAutoMovieValidation,
} from "@automovie/interface";

import { ViolationCollector } from "./violation";

/**
 * Validate an {@link IAutoMovieExpression} — Tier-1 range checks the rough types
 * intentionally do not encode.
 *
 * Preset and ARKit channel names are runtime-checked against their closed
 * menus, and magnitudes still sit in `[0, 1]`: preset intensity and every
 * blendshape weight. ARKit channels also must not be set twice.
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

  if (!EXPRESSION_PRESETS.has(expression.preset))
    collector.push(
      "type",
      `${path}.preset`,
      `unknown expression preset "${String(expression.preset)}"`,
      expression.preset,
    );
  collector.range(`${path}.intensity`, expression.intensity, 0, 1, "intensity");

  const seen = new Set<string>();
  (expression.blendshapes ?? []).forEach((c, i) => {
    const cp = `${path}.blendshapes[${i}]`;
    if (!ARKIT_CHANNELS.has(c.channel))
      collector.push(
        "type",
        `${cp}.channel`,
        `unknown ARKit channel "${String(c.channel)}"`,
        c.channel,
      );
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

const EXPRESSION_PRESETS = new Set<AutoMovieExpressionPreset>([
  "neutral",
  "happy",
  "angry",
  "sad",
  "relaxed",
  "surprised",
  "aa",
  "ih",
  "ou",
  "ee",
  "oh",
  "blink",
  "blinkLeft",
  "blinkRight",
  "lookUp",
  "lookDown",
  "lookLeft",
  "lookRight",
]);

const ARKIT_CHANNELS = new Set<AutoMovieArkitChannel>([
  "eyeBlinkLeft",
  "eyeLookDownLeft",
  "eyeLookInLeft",
  "eyeLookOutLeft",
  "eyeLookUpLeft",
  "eyeSquintLeft",
  "eyeWideLeft",
  "eyeBlinkRight",
  "eyeLookDownRight",
  "eyeLookInRight",
  "eyeLookOutRight",
  "eyeLookUpRight",
  "eyeSquintRight",
  "eyeWideRight",
  "jawForward",
  "jawLeft",
  "jawRight",
  "jawOpen",
  "mouthClose",
  "mouthFunnel",
  "mouthPucker",
  "mouthLeft",
  "mouthRight",
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthFrownLeft",
  "mouthFrownRight",
  "mouthDimpleLeft",
  "mouthDimpleRight",
  "mouthStretchLeft",
  "mouthStretchRight",
  "mouthRollLower",
  "mouthRollUpper",
  "mouthShrugLower",
  "mouthShrugUpper",
  "mouthPressLeft",
  "mouthPressRight",
  "mouthLowerDownLeft",
  "mouthLowerDownRight",
  "mouthUpperUpLeft",
  "mouthUpperUpRight",
  "browDownLeft",
  "browDownRight",
  "browInnerUp",
  "browOuterUpLeft",
  "browOuterUpRight",
  "cheekPuff",
  "cheekSquintLeft",
  "cheekSquintRight",
  "noseSneerLeft",
  "noseSneerRight",
  "tongueOut",
]);
