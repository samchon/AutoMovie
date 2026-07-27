import { IAutoMovieDesignMutationOutput } from "../IAutoMovieProductionCompiler";
import { IAutoMovieDesignTarget } from "../IAutoMovieProductionDesign";

/** Result of erasing one unreferenced design artifact. */
export interface IAutoMovieEraseDesignArtifact extends IAutoMovieDesignMutationOutput {}

export namespace IAutoMovieEraseDesignArtifact {
  /** Exact target and non-empty audit reason for one erasure. */
  export interface IProps {
    /** Exact design target. */
    target: IAutoMovieDesignTarget;
    /** Non-empty audit reason. */
    reason: string;
  }
}
