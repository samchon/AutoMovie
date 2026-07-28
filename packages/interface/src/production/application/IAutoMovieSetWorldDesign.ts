import { IAutoMovieDesignMutationOutput } from "../IAutoMovieProductionCompiler";
import { IAutoMovieWorldDesign } from "../IAutoMovieProductionDesign";

/** Result of setting the singleton production world. */
export interface IAutoMovieSetWorldDesign extends IAutoMovieDesignMutationOutput {}

export namespace IAutoMovieSetWorldDesign {
  /** Complete replacement for the singleton world design. */
  export interface IProps extends IAutoMovieWorldDesign {}
}
