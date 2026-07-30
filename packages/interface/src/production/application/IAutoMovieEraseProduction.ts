/** Result of erasing one complete production namespace. */
export interface IAutoMovieEraseProduction {
  /** Whether the active production was registered and erased. */
  erased: boolean;
  /** Exact erased production id. */
  productionId: string;
  /** Registered sibling productions left in the project. */
  remaining: string[];
}

export namespace IAutoMovieEraseProduction {
  /** Erase the active production and its production-owned outputs. */
  export interface IProps {
    /** Non-empty audit reason explaining the deliberate removal. */
    reason: string;
  }
}
