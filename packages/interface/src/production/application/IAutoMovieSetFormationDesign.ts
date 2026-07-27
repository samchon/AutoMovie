import { IAutoMovieDesignMutationOutput } from "../IAutoMovieProductionCompiler";
import { IAutoMovieFormationDesign } from "../IAutoMovieProductionDesign";

/** Result of upserting one deterministic formation. */
export interface IAutoMovieSetFormationDesign extends IAutoMovieDesignMutationOutput {}

export namespace IAutoMovieSetFormationDesign {
  /** One complete formation design. */
  export interface IProps extends IAutoMovieFormationDesign {}
}
