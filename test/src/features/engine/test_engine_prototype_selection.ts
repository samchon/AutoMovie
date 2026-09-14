import { selectInstancePrototype } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";

const SLOTS = 2_000;

interface IChoice {
  id: string;
  modelRecipe: string;
  weight: number;
}

const choice = (id: string, weight: number): IChoice => ({
  id,
  modelRecipe: `${id}-recipe`,
  weight,
});

/** A grove drawing from `prototypes`, or from its base recipe without them. */
const grove = (prototypes?: IChoice[], seed = 31) => ({
  id: "grove",
  seed,
  modelRecipe: "oak",
  prototypes,
});

/** The choice each of the first `count` slots draws by weight. */
const draws = (source: ReturnType<typeof grove>, count = SLOTS): IChoice[] =>
  Array.from({ length: count }, (_, slot) =>
    selectInstancePrototype(source, slot, undefined),
  );

const share = (drawn: readonly IChoice[], id: string): number =>
  drawn.filter((value) => value.id === id).length / drawn.length;

/**
 * One instance slot draws its prototype by the weights its table declares, or
 * takes the one an explicit member names.
 *
 * Every expectation is a property of the declared weights rather than a draw
 * read off an implementation: a lone choice is always drawn, a zero weight is
 * never drawn by weight, shares follow the weights, and scaling every weight by
 * the same power of two changes no slot's choice. A table with no weight at all
 * has nothing to spend, so its slots take the last choice, which is the choice
 * that remains once every earlier one has been passed.
 *
 * Scenarios:
 *
 * 1. A set without a table draws its base recipe as `default` on every slot, and
 *    a one-entry table draws that entry, the table's own object, on every slot.
 * 2. Weights 1:2:1 are drawn in about those shares. A zero-weight choice between
 *    two others is never drawn while its twin of weight one takes about a third;
 *    a zero-weight first choice is never drawn; a table whose weights are all zero
 *    draws its last choice on every slot; and quadrupling every weight changes no
 *    slot's choice.
 * 3. The same seed draws the same choice on every slot again, and another seed
 *    draws a different choice on most slots.
 * 4. An explicit member takes the entry it names, even one of weight zero, and a
 *    set without a table answers `default`. A name the table lacks refuses that
 *    slot by name, while the twin naming a present entry is answered.
 */
export const test_engine_prototype_selection = (): void => {
  const lone = choice("lone", 3);
  const base = draws(grove());
  TestValidator.equals(
    "a set with one choice draws it on every slot",
    namedFacts([
      [
        "baseRecipe",
        () =>
          base.every(
            (value) =>
              value.id === "default" &&
              value.modelRecipe === "oak" &&
              value.weight === 1,
          ),
      ],
      [
        "loneEntry",
        () => draws(grove([lone])).every((value) => value === lone),
      ],
    ]),
    { baseRecipe: true, loneEntry: true },
  );

  const weighted = draws(
    grove([choice("a", 1), choice("b", 2), choice("c", 1)]),
  );
  const skipped = draws(
    grove([choice("a", 1), choice("z", 0), choice("c", 1)]),
  );
  const twin = draws(grove([choice("a", 1), choice("z", 1), choice("c", 1)]));
  const leadingZero = draws(grove([choice("z", 0), choice("b", 1)]));
  const allZero = draws(
    grove([choice("x", 0), choice("y", 0), choice("z", 0)]),
  );
  const quadrupled = draws(
    grove([choice("a", 4), choice("b", 8), choice("c", 4)]),
  );
  TestValidator.equals(
    "a slot draws by the declared weights and never by a zero weight",
    namedFacts([
      ["shareA", () => Math.abs(share(weighted, "a") - 0.25) < 0.04],
      ["shareB", () => Math.abs(share(weighted, "b") - 0.5) < 0.04],
      ["shareC", () => Math.abs(share(weighted, "c") - 0.25) < 0.04],
      ["zeroNeverDrawn", () => share(skipped, "z") === 0],
      ["zeroTwinDrawn", () => Math.abs(share(twin, "z") - 1 / 3) < 0.04],
      ["leadingZeroNeverDrawn", () => share(leadingZero, "z") === 0],
      ["allZeroTakesLast", () => share(allZero, "z") === 1],
      [
        "scaleInvariant",
        () =>
          quadrupled.every((value, slot) => value.id === weighted[slot]!.id),
      ],
    ]),
    {
      shareA: true,
      shareB: true,
      shareC: true,
      zeroNeverDrawn: true,
      zeroTwinDrawn: true,
      leadingZeroNeverDrawn: true,
      allZeroTakesLast: true,
      scaleInvariant: true,
    },
  );

  const table = [choice("a", 1), choice("b", 2), choice("c", 1)];
  const again = draws(grove(table));
  const reseeded = draws(grove(table, 32));
  TestValidator.equals(
    "a slot's draw is its seed's",
    namedFacts([
      [
        "repeatable",
        () => again.every((value, slot) => value.id === weighted[slot]!.id),
      ],
      [
        "seedMatters",
        () =>
          reseeded.filter((value, slot) => value.id !== again[slot]!.id)
            .length >
          SLOTS / 2,
      ],
    ]),
    { repeatable: true, seedMatters: true },
  );

  const sleeper = choice("sleeper", 0);
  const named = grove([choice("a", 1), sleeper]);
  TestValidator.equals(
    "an explicit member takes the entry it names or refuses a missing one",
    namedFacts([
      [
        "namedZeroWeight",
        () => selectInstancePrototype(named, 3, "sleeper") === sleeper,
      ],
      [
        "namedDefault",
        () => selectInstancePrototype(grove(), 3, "default").id === "default",
      ],
      [
        "missingRefuses",
        () =>
          throwsError(
            () => selectInstancePrototype(named, 3, "ghost"),
            'Instance set "grove" slot 3 references missing prototype "ghost".',
          ),
      ],
      [
        "presentTwinAnswered",
        () => selectInstancePrototype(named, 3, "a").id === "a",
      ],
    ]),
    {
      namedZeroWeight: true,
      namedDefault: true,
      missingRefuses: true,
      presentTwinAnswered: true,
    },
  );
};
