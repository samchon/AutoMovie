import type { AutoMoviePopulationTransitionReceipt } from "./AutoMoviePopulationTransition";

/**
 * Selects the exact authored population being written and reviewed.
 *
 * A first pilot narrows only a branch with a real partition selector. For a
 * film, treatments remain flat and contain only the events the pilot can
 * realize, while scripts and screenplays select one delivery group. A library
 * pilot has no invented group selector: it starts before sibling owners exist
 * and takes the first real design/source branch through review. The
 * complete-production reset is an explicit transition state that selects the
 * complete population while preserving reviewed pilot files as inactive draft
 * source material for the rebuild.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes complete, pilot, and post-pilot reset populations visible in the generated project's sole declaration.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines the closed population-scope union and its exact pilot group identity.
 */
export type AutoMoviePopulationScope =
  | {
      mode: "complete-production";
    }
  | {
      mode: "complete-production-reset";
      /** Current owner accepting responsibility for the reset transition. */
      owner: string;
      /** Exact passed-pilot predecessor that authorizes this reset. */
      transition: AutoMoviePopulationTransitionReceipt;
    }
  | {
      mode: "first-pilot";

      /** The one group selected only where an active branch owns a partition. */
      partitionGroup?: `001-${string}`;
    };
