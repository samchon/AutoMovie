import { IAutoMovieDesignMutationOutput } from "../IAutoMovieProductionCompiler";
import { IAutoMovieWorldDesign } from "../IAutoMovieProductionDesign";

/** Result of setting the project-shared production world. */
export interface IAutoMovieSetWorldDesign extends IAutoMovieDesignMutationOutput {}

export namespace IAutoMovieSetWorldDesign {
  /** Complete replacement for the project-shared world design. */
  export interface IProps extends IAutoMovieWorldDesign {}
}
