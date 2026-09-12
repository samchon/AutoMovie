import type {
  IAutoMovieProductionFrameRate,
  IAutoMovieProductionVideoProbe,
} from "@automovie/interface";

/** Exact current H.264/MP4 delivery profile resolved from authored inputs. */
export interface IAutoMovieProductionVideoProfile {
  /** Coded picture width in pixels. */
  width: number;
  /** Coded picture height in pixels. */
  height: number;
  /** Exact rational picture rate of the track. */
  frameRate: IAutoMovieProductionFrameRate;
  /** Major brand and the compatible brands the file must declare. */
  brands: { major: "isom"; requiredCompatible: readonly string[] };
  /** Identity track matrix the writer emits. */
  trackMatrix: IAutoMovieProductionVideoProbe["trackMatrix"];
  /** Pixel aspect; the profile admits square pixels only. */
  pixelAspect: "square";
  /** Color primaries, transfer, matrix and range the track declares. */
  color: { primaries: 1; transfer: 13; matrix: 1; fullRange: true };
}
