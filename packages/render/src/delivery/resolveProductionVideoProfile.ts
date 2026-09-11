import type { IAutoMovieProductionFrameRate } from "@automovie/interface";

import { AUTOMOVIE_MP4_SRGB_COLOUR } from "../node/AUTOMOVIE_MP4_SRGB_COLOUR";
import { AUTOMOVIE_MP4_UNITY_MATRIX } from "../node/AUTOMOVIE_MP4_UNITY_MATRIX";
import type { IAutoMovieProductionVideoProfile } from "./IAutoMovieProductionVideoProfile";

/**
 * Resolve authored raster and exact clock to the current MP4 picture profile.
 *
 * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-container-metadata Keeps expected delivery facts separate from parser-observed bytes.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Defines the current neutral presentation and explicit sRGB container tuple.
 * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-supported-combinations Fixes the supported container, codec, raster and color combination of each tier as one profile instead of accepting whatever a muxer produced.
 */
export const resolveProductionVideoProfile = (props: {
  width: number;
  height: number;
  frameRate: IAutoMovieProductionFrameRate;
}): IAutoMovieProductionVideoProfile => ({
  width: props.width,
  height: props.height,
  frameRate: props.frameRate,
  brands: { major: "isom", requiredCompatible: ["isom"] },
  trackMatrix: [
    ...AUTOMOVIE_MP4_UNITY_MATRIX,
  ] as IAutoMovieProductionVideoProfile["trackMatrix"],
  pixelAspect: "square",
  color: AUTOMOVIE_MP4_SRGB_COLOUR,
});
