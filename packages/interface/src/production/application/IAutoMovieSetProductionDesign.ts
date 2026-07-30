import { IAutoMovieDesignMutationOutput } from "../IAutoMovieProductionCompiler";
import { IAutoMovieProductionDesign } from "../IAutoMovieProductionDesign";

/** Result of setting the active production design. */
export interface IAutoMovieSetProductionDesign extends IAutoMovieDesignMutationOutput {}

export namespace IAutoMovieSetProductionDesign {
  /** Complete replacement for the active production design. */
  export interface IProps extends IAutoMovieProductionDesign {}
}
