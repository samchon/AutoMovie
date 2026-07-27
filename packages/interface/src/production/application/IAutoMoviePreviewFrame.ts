import {
  IAutoMoviePreviewFrameInput,
  IAutoMoviePreviewFrameOutput,
} from "../IAutoMovieProductionOracle";

/** Result of capturing one current actual PNG frame. */
export interface IAutoMoviePreviewFrame extends IAutoMoviePreviewFrameOutput {}

export namespace IAutoMoviePreviewFrame {
  /** One actual-frame capture request. */
  export interface IProps extends IAutoMoviePreviewFrameInput {}
}
