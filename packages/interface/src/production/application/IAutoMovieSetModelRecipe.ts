import { IAutoMovieDesignMutationOutput } from "../IAutoMovieProductionCompiler";
import { IAutoMovieModelRecipe } from "../IAutoMovieProductionDesign";

/** Result of upserting one bounded primitive model recipe. */
export interface IAutoMovieSetModelRecipe extends IAutoMovieDesignMutationOutput {}

export namespace IAutoMovieSetModelRecipe {
  /** One complete primitive model recipe. */
  export interface IProps extends IAutoMovieModelRecipe {}
}
