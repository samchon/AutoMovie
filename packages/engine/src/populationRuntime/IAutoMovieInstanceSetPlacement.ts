import {
  IAutoMovieCompiledInstancePrototype,
  IAutoMovieCompiledInstanceSet,
} from "@automovie/interface";

/**
 * What an instance set needs to regenerate one of its members.
 *
 * A compiled instance set is already one, which is what lets every consumer
 * regenerate a member from the record the builder wrote. A design record is
 * not: its route is a name the world resolves, and its prototype table leaves
 * out the default its base recipe stands for. A caller holding a design
 * resolves both before asking, so there is one member law rather than one per
 * record shape, and the default is counted once.
 *
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance Separates the shared prototype choices and base recipe from the one occurrence a slot regenerates.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance Carries the prototype table, placement law, and variation law that one instance occurrence is resolved against.
 */
export type IAutoMovieInstanceSetPlacement = Pick<
  IAutoMovieCompiledInstanceSet,
  | "id"
  | "count"
  | "modelRecipe"
  | "layout"
  | "route"
  | "anchor"
  | "facingDeg"
  | "seed"
  | "variation"
> & {
  /**
   * Complete weighted prototype choices with the default first, or absent when
   * the base recipe is the only choice.
   *
   * This is the compiled convention rather than the design one. A design's
   * table omits the default and a compiled set's includes it, so a caller
   * holding a design prepends `{ id: "default", modelRecipe, weight: 1 }`
   * before asking.
   */
  prototypes?: readonly Pick<
    IAutoMovieCompiledInstancePrototype,
    "id" | "modelRecipe" | "weight"
  >[];
};
