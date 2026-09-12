import type { AutoMovieProductionPngRole } from "./AutoMovieProductionPngRole";
import type { IAutoMovieProductionPngProfile } from "./IAutoMovieProductionPngProfile";

/**
 * Resolve one output role to the exact PNG profile its writer must emit.
 *
 * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-alpha-channels Keeps channel population and alpha relation explicit for every delivered PNG role.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Implements the versioned planned picture profile compared with decoded bytes.
 * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-dimensions-window Declares stored dimensions, pixel aspect and orientation for each PNG role so a reader never has to guess a window.
 */
export const resolveProductionPngProfile = (props: {
  role: AutoMovieProductionPngRole;
  width?: number;
  height?: number;
}): IAutoMovieProductionPngProfile => {
  const fixed =
    props.role === "waveform"
      ? { width: 960, height: 240 }
      : props.role === "spectrogram"
        ? { width: 512, height: 192 }
        : { width: props.width, height: props.height };
  if (
    Number.isSafeInteger(fixed.width) === false ||
    fixed.width! <= 0 ||
    Number.isSafeInteger(fixed.height) === false ||
    fixed.height! <= 0
  )
    throw new Error(
      `PNG role "${props.role}" requires a positive safe-integer raster.`,
    );
  return {
    version: 1,
    role: props.role,
    width: fixed.width!,
    height: fixed.height!,
    bitDepth: 8,
    color: "rgba",
    alpha: "straight",
    interlace: "none",
    colorSpace: "srgb",
    pixelAspect: "square",
    orientation: "upright",
  };
};
