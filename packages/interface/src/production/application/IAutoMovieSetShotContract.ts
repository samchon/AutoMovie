import { IAutoMovieDesignMutationOutput } from "../IAutoMovieProductionCompiler";
import { IAutoMovieShotContract } from "../IAutoMovieProductionDesign";

/** Result of upserting one source-bound shot contract. */
export interface IAutoMovieSetShotContract extends IAutoMovieDesignMutationOutput {}

export namespace IAutoMovieSetShotContract {
  /** One complete source-bound shot contract. */
  export interface IProps extends IAutoMovieShotContract {}
}
