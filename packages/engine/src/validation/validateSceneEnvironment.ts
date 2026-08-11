import {
  IAutoMovieSceneEnvironment,
  IAutoMovieValidation,
} from "@automovie/interface";

import { isRecord } from "./artifactShape";
import { ViolationCollector } from "./violation";

const TONE_MAPPINGS = new Set(["none", "acesFilmic"]);
const SHADOW_TYPES = new Set(["pcf", "pcfSoft", "vsm"]);
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/**
 * Validate image lighting and renderer policy without requiring a renderer.
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `validateSceneEnvironment` locates invalid image, color-space, intensity, exposure, rotation, and background values at their environment fields.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `validateSceneEnvironment` preserves each observed renderer-policy scalar or discriminator beside the constraint for that exact member.
 */
export const validateSceneEnvironment = (props: {
  environment: IAutoMovieSceneEnvironment;
}): IAutoMovieValidation => {
  const out = new ViolationCollector();
  const value: unknown = props.environment;
  if (!isRecord(value)) {
    out.push(
      "type",
      "$input",
      "scene environment must be a JSON object",
      value,
    );
    return out.toValidation();
  }
  if (
    value.image !== null &&
    (typeof value.image !== "string" || value.image.trim().length === 0)
  )
    out.push(
      "type",
      "$input.image",
      "environment image must be a non-empty asset id or null",
      value.image,
    );
  if (value.image !== null && value.background !== null)
    out.push(
      "type",
      "$input.background",
      "environment background must be null when an image supplies the background",
      value.background,
    );
  if (value.background !== null) validateColor(value.background, out);
  finiteRange(value.intensity, 0, false, "$input.intensity", "intensity", out);
  if (
    typeof value.rotationDeg !== "number" ||
    !Number.isFinite(value.rotationDeg)
  )
    out.push(
      "range",
      "$input.rotationDeg",
      "environment rotation must be finite degrees",
      value.rotationDeg,
    );
  finiteRange(value.exposure, 0, true, "$input.exposure", "exposure", out);
  if (!TONE_MAPPINGS.has(value.toneMapping as string))
    out.push(
      "type",
      "$input.toneMapping",
      'toneMapping must be "none" or "acesFilmic"',
      value.toneMapping,
    );
  if (!isRecord(value.shadows))
    out.push(
      "type",
      "$input.shadows",
      "shadow policy must be a JSON object",
      value.shadows,
    );
  else {
    if (typeof value.shadows.enabled !== "boolean")
      out.push(
        "type",
        "$input.shadows.enabled",
        "shadow enabled must be boolean",
        value.shadows.enabled,
      );
    if (!SHADOW_TYPES.has(value.shadows.type as string))
      out.push(
        "type",
        "$input.shadows.type",
        'shadow type must be "pcf", "pcfSoft", or "vsm"',
        value.shadows.type,
      );
  }
  return out.toValidation();
};

const validateColor = (value: unknown, out: ViolationCollector): void => {
  if (!isRecord(value)) {
    out.push(
      "type",
      "$input.background",
      "environment background must be a color object or null",
      value,
    );
    return;
  }
  for (const key of ["r", "g", "b"] as const)
    finiteUnit(value[key], `$input.background.${key}`, key, out);
  if (value.a !== null)
    finiteUnit(value.a, "$input.background.a", "alpha", out);
  if (
    value.hex !== null &&
    (typeof value.hex !== "string" || !HEX_COLOR_PATTERN.test(value.hex))
  )
    out.push(
      "type",
      "$input.background.hex",
      "background hex must be null or a #RRGGBB color label",
      value.hex,
    );
};

const finiteUnit = (
  value: unknown,
  path: string,
  label: string,
  out: ViolationCollector,
): void => finiteRange(value, 0, false, path, label, out, 1);

const finiteRange = (
  value: unknown,
  min: number,
  exclusive: boolean,
  path: string,
  label: string,
  out: ViolationCollector,
  max: number = Infinity,
): void => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (exclusive ? value <= min : value < min) ||
    value > max
  )
    out.push(
      "range",
      path,
      `${label} must be finite and within ${exclusive ? "(" : "["}${min}, ${max === Infinity ? "Infinity" : max}]`,
      value,
    );
};
