import { IAutoMovieCompiledInstancePrototype } from "@automovie/interface";

import { seededValue } from "../math/random";

/**
 * The prototype one instance slot draws, or the explicit one it names.
 *
 * A set with a prototype table draws from it, and a compiled table already
 * starts with the base recipe's default, counted once. A set without a table
 * draws its base recipe under the id `default`. An explicit member names its
 * choice outright, and naming one the table lacks refuses. Otherwise the slot's
 * seeded sample, drawn under the prototype salt, is spent across the weights in
 * table order: every choice but the last is tested, and the last is what
 * remains, which is both the weighted answer and the answer when a float
 * residue leaves the sample a hair above the final weight.
 *
 * The instance member regenerator and the structural subject diff both draw
 * through here, so a diff counts a prototype change exactly where a
 * regenerated member changes prototype. The choice returned is the table's own
 * entry, so a caller holding a compiled table reads that entry's tiers.
 *
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance Chooses which shared prototype, the base recipe's default counted once, one slot occurrence refers to.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance Resolves an occurrence against the prototype table by explicit name or by weight and returns the table's own entry.
 * @evidence requirements/asset-authoring/patterns-and-procedural-composition.md#asset-pattern-local-stability Draws the prototype from the set's own seed and slot key alone, so a change elsewhere in the scene cannot reshuffle it.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-deterministic-instance-generation Determines a rule-generated occurrence's prototype from its stable slot key, set seed, and explicit exception.
 */
export const selectInstancePrototype = <
  Choice extends Pick<
    IAutoMovieCompiledInstancePrototype,
    "id" | "modelRecipe" | "weight"
  >,
>(
  instanceSet: {
    id: string;
    seed: number;
    modelRecipe: string;
    prototypes?: readonly Choice[];
  },
  slot: number,
  explicit: string | undefined,
):
  | Choice
  | Pick<
      IAutoMovieCompiledInstancePrototype,
      "id" | "modelRecipe" | "weight"
    > => {
  const choices: readonly (
    | Choice
    | Pick<IAutoMovieCompiledInstancePrototype, "id" | "modelRecipe" | "weight">
  )[] = instanceSet.prototypes ?? [
    { id: "default", modelRecipe: instanceSet.modelRecipe, weight: 1 },
  ];
  if (explicit !== undefined) {
    const selected = choices.find((choice) => choice.id === explicit);
    if (selected === undefined)
      throw new Error(
        `Instance set "${instanceSet.id}" slot ${slot} references missing prototype "${explicit}".`,
      );
    return selected;
  }
  const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let sample = seededValue(instanceSet.seed, slot, 0x70726f74) * total;
  for (const choice of choices.slice(0, -1)) {
    if (sample < choice.weight) return choice;
    sample -= choice.weight;
  }
  return choices.at(-1)!;
};
