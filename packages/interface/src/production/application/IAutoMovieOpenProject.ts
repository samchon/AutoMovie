/** Opened production repository identity. */
export interface IAutoMovieOpenProject {
  /** Active project. */
  project: {
    /** Absolute active root. */
    root: string;
    /** Exact active production inside the project. */
    productionId: string;
    /** Every registered production available at this root. */
    productions: string[];
    /** Production manifest format. */
    formatVersion: number;
    /** Current monotonic revision. */
    revision: number;
    /** Whether this call initialized the production manifest. */
    initialized: boolean;
  };
}

export namespace IAutoMovieOpenProject {
  /** Activate one resident production repository. */
  export interface IProps {
    /**
     * Repository directory used as durable resident memory, initialized when
     * its production manifest is absent. A host-fixed server refuses another
     * root instead of switching projects.
     */
    root: string;
    /**
     * Stable production to activate. Omit only while the project has one
     * registered production; opening a new id registers its namespace.
     */
    productionId?: string;
  }
}
