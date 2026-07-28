import { IAutoMovieDesignMutationOutput } from "../IAutoMovieProductionCompiler";
import { IAutoMovieAcceptanceScenario } from "../IAutoMovieProductionDesign";

/** Result of upserting one observable acceptance scenario. */
export interface IAutoMovieSetAcceptanceScenario extends IAutoMovieDesignMutationOutput {}

export namespace IAutoMovieSetAcceptanceScenario {
  /** One complete acceptance scenario. */
  export interface IProps extends IAutoMovieAcceptanceScenario {}
}
