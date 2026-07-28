import { IAutoMovieDesignMutationOutput } from "../IAutoMovieProductionCompiler";
import { IAutoMovieDesignTarget } from "../IAutoMovieProductionDesign";

/** Result of erasing one unreferenced design artifact. */
export interface IAutoMovieEraseDesignArtifact extends IAutoMovieDesignMutationOutput {}

export namespace IAutoMovieEraseDesignArtifact {
  /** Exact target and non-empty audit reason for one erasure. */
  export interface IProps {
    /**
     * Exact current design artifact to remove. It must exist and have no active
     * references; the server never cascades to dependants.
     */
    target: IAutoMovieDesignTarget;
    /** Non-blank reason stored in the tracked mutation audit record. */
    reason: string;
  }
}
