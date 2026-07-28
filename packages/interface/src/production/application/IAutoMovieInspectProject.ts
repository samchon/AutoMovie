import {
  IAutoMovieDiagnostic,
  IAutoMovieProductionDesignInventory,
  IAutoMovieProductionNextAction,
  IAutoMovieReviewQueue,
} from "../IAutoMovieProductionCompiler";

/** One discovered render bundle. */
export interface IAutoMovieProductionRenderStatus {
  /** Project-relative bundle manifest. */
  path: string;
  /**
   * Whether the owned bundle matches the current target-local generated and
   * declared render inputs. An unrelated source edit does not retire it.
   */
  current: boolean;
}

/** Compact resident production status without large design or source bytes. */
export interface IAutoMovieInspectProject {
  /** Current project revision. */
  revision: number;
  /** Typed design inventory. */
  design: IAutoMovieProductionDesignInventory;
  /** Coding-agent and compiler ownership status. */
  source: {
    /** Bound source modules that currently exist. */
    bound: string[];
    /** Bound source modules that are missing or unsafe. */
    missing: string[];
    /** Files under generated absent from its manifest. */
    unownedGenerated: string[];
  };
  /** Current structural and ownership diagnostics. */
  diagnostics: IAutoMovieDiagnostic[];
  /** Missing, stale, incomplete, revise and complete reviews. */
  reviews: IAutoMovieReviewQueue;
  /** Discovered render manifests. */
  renders: IAutoMovieProductionRenderStatus[];
  /** Ordered concrete corrections. */
  nextActions: IAutoMovieProductionNextAction[];
}

export namespace IAutoMovieInspectProject {
  /** Request the complete compact inspection of the active project. */
  export interface IProps {}
}
