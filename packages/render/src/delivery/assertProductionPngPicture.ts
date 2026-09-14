import type { IAutoMovieProductionPngPicture } from "@automovie/interface";

import type { IAutoMovieProductionPngProfile } from "./IAutoMovieProductionPngProfile";

/**
 * Refuse every difference between a role profile and parser-observed PNG facts.
 *
 * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-refusal Rejects unknown, contradictory, or role-incompatible picture facts even when the byte digest is current.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Implements the shared fieldwise PNG profile verdict used by publication and reopen paths.
 */
export const assertProductionPngPicture = (props: {
  profile: IAutoMovieProductionPngProfile;
  actual: IAutoMovieProductionPngPicture;
}): void => {
  const expected = props.profile;
  const actual = props.actual;
  const entries: Array<[string, unknown, unknown]> = [
    ["width", expected.width, actual.width],
    ["height", expected.height, actual.height],
    ["bitDepth", expected.bitDepth, actual.bitDepth],
    ["color", expected.color, actual.color],
    ["alpha", expected.alpha, actual.alpha],
    ["interlace", expected.interlace, actual.interlace],
    ["colorSpace", expected.colorSpace, actual.colorSpace],
    ["orientation", expected.orientation, actual.orientation],
  ];
  if (
    actual.pixelAspect.kind === "explicit" &&
    actual.pixelAspect.x !== actual.pixelAspect.y
  )
    entries.push([
      "pixelAspect",
      expected.pixelAspect,
      `${actual.pixelAspect.x}:${actual.pixelAspect.y}`,
    ]);
  const mismatch = entries.find(([, wanted, observed]) => wanted !== observed);
  if (mismatch !== undefined)
    throw new Error(
      `PNG ${expected.role} profile mismatch at ${mismatch[0]}: expected ${String(mismatch[1])}, observed ${String(mismatch[2])}.`,
    );
};
