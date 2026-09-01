import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieDiagnostic,
  IAutoMovieLibraryRequiredObservation,
  IAutoMovieLibraryReviewWaiver,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { rectangularBuilding } from "../internal/envelopeFixtures";
import { namedFacts } from "../internal/predicates";
import { requireSourceModule } from "../internal/requireSourceModule";

/** Load the closure gate from source; the library review consumer calls it. */
const unit = requireSourceModule<{
  autoMovieLibraryObservationRequirements: (
    environments: readonly IAutoMovieBuiltEnvironment[],
  ) => IAutoMovieLibraryRequiredObservation[];
  libraryObservationClosureDiagnostics: (props: {
    target: string;
    path: string | null;
    required: readonly IAutoMovieLibraryRequiredObservation[];
    declared: readonly string[];
    waivers: readonly IAutoMovieLibraryReviewWaiver[];
  }) => IAutoMovieDiagnostic[];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/libraryObservationRequirements.ts",
  ),
  [
    "autoMovieLibraryObservationRequirements",
    "libraryObservationClosureDiagnostics",
  ],
);

/**
 * A plan may add questions to the derived population and may never remove one.
 *
 * That single rule is what a completeness claim rests on. Without it a reviewer
 * covers a building with the three elevations that photograph well, records a
 * receipt for each, and reads complete, while the side the defect is on was
 * never opened by anybody. The gate here is therefore an exact-set comparison
 * rather than a count: every derived id is declared, waived, or refused by name.
 *
 * A waiver is the one legitimate way a canonical view goes unopened, and it is
 * modelled as an addressed record precisely so it can be reviewed. The six
 * refusals below are the six ways an excuse degrades into a deletion with a
 * sentence in front of it: waiving something nothing asked for, waiving twice,
 * pointing at yourself, pointing at an observation the topology does not charge
 * for, pointing at one the plan never opens, and stating no fact at all.
 *
 * The wrong-room refusal is separate and stronger. An interior observation whose
 * eye could not be placed inside its own space is refused even when the plan
 * declares it, because the picture such a plan would produce is of the far side
 * of that room's walls while carrying the id of a view from inside it.
 *
 * Scenarios:
 *
 * 1. A plan declaring every derived observation is silent.
 * 2. Dropping one derived observation is refused at that observation's own
 *    address, naming the topology it came from.
 * 3. A well-formed waiver over that observation restores silence.
 * 4. A waiver over an id the topology does not require is refused.
 * 5. Two waivers over one observation are refused.
 * 6. A waiver naming itself as its own discloser is refused.
 * 7. A waiver whose discloser the topology does not require is refused.
 * 8. A waiver whose discloser the plan does not declare is refused.
 * 9. A waiver stating a blank reason is refused.
 * 10. A declared interior observation with no place to stand inside its own
 *     space is refused as a wrong-room camera.
 * 11. An empty derived population refuses nothing, whatever the plan declares.
 */
export const test_production_library_observation_closure = (): void => {
  const required = unit.autoMovieLibraryObservationRequirements([
    rectangularBuilding(),
  ]);
  const every = required.map((entry) => entry.id);
  const waived = "building:hall-house/house/facade/wall-north";
  const discloser = "building:hall-house/house/facade/wall-south";
  const close = (props: {
    declared: readonly string[];
    waivers?: readonly IAutoMovieLibraryReviewWaiver[];
    required?: readonly IAutoMovieLibraryRequiredObservation[];
  }): IAutoMovieDiagnostic[] =>
    unit.libraryObservationClosureDiagnostics({
      target: "library:spaces:docs/spaces/hall.md#hall",
      path: "docs/spaces/hall.review.json",
      required: props.required ?? required,
      declared: props.declared,
      waivers: props.waivers ?? [],
    });
  const mirror = (
    overrides: Partial<IAutoMovieLibraryReviewWaiver> = {},
  ): IAutoMovieLibraryReviewWaiver => ({
    observation: waived,
    ground: "symmetry",
    disclosedBy: discloser,
    reason:
      "The north and south elevations are the same authored panel mirrored about the hall's own centre line.",
    ...overrides,
  });

  TestValidator.equals(
    "a plan that opens the whole derived population is silent",
    close({ declared: every }),
    [],
  );

  const shrunk = close({
    declared: every.filter((id) => id !== waived),
  });

  TestValidator.equals(
    "dropping one derived observation is refused at its own address",
    {
      count: shrunk.length,
      target: shrunk[0]?.target ?? null,
      path: shrunk[0]?.path ?? null,
      namesItsOrigin: shrunk[0]?.message.includes('"wall-north"') ?? false,
      namesItsSubject:
        shrunk[0]?.message.includes("building:hall-house/house") ?? false,
    },
    {
      count: 1,
      target: `library:spaces:docs/spaces/hall.md#hall:${waived}`,
      path: "docs/spaces/hall.review.json",
      namesItsOrigin: true,
      namesItsSubject: true,
    },
  );

  TestValidator.equals(
    "an addressed waiver excuses it and a malformed one never does",
    namedFacts([
      [
        "a well-formed mirror waiver restores silence",
        () =>
          close({
            declared: every.filter((id) => id !== waived),
            waivers: [mirror()],
          }).length === 0,
      ],
      [
        "waiving something the topology does not require is refused",
        () =>
          close({
            declared: every,
            waivers: [
              mirror({
                observation: "building:hall-house/house/facade/wall-nowhere",
              }),
            ],
          })
            .at(0)
            ?.message.includes("does not require") === true,
      ],
      [
        "two waivers over one observation are refused",
        () =>
          close({
            declared: every.filter((id) => id !== waived),
            waivers: [mirror(), mirror({ ground: "identity" })],
          }).filter((diagnostic) => diagnostic.message.includes("2 waivers"))
            .length === 2,
      ],
      [
        "a waiver naming itself as its own discloser is refused",
        () =>
          close({
            declared: every.filter((id) => id !== waived),
            waivers: [mirror({ disclosedBy: waived })],
          })
            .at(0)
            ?.message.includes("names itself") === true,
      ],
      [
        "a discloser the topology does not require is refused",
        () =>
          close({
            declared: every.filter((id) => id !== waived),
            waivers: [
              mirror({
                disclosedBy: "building:hall-house/house/facade/wall-nowhere",
              }),
            ],
          })
            .at(0)
            ?.message.includes("does not require") === true,
      ],
      [
        "a discloser the plan never opens is refused",
        () =>
          close({
            declared: every.filter((id) => id !== waived && id !== discloser),
            waivers: [mirror()],
          })
            .at(0)
            ?.message.includes("does not declare") === true,
      ],
      [
        "and a waiver stating no fact is refused",
        () =>
          close({
            declared: every.filter((id) => id !== waived),
            waivers: [mirror({ reason: "   " })],
          })
            .at(0)
            ?.message.includes("states no reason") === true,
      ],
    ]),
    {
      "a well-formed mirror waiver restores silence": true,
      "waiving something the topology does not require is refused": true,
      "two waivers over one observation are refused": true,
      "a waiver naming itself as its own discloser is refused": true,
      "a discloser the topology does not require is refused": true,
      "a discloser the plan never opens is refused": true,
      "and a waiver stating no fact is refused": true,
    },
  );

  const unplaceable: IAutoMovieLibraryRequiredObservation = {
    id: "space:hall-house/sealed/center-x-plus",
    role: "interior-center",
    subject: "space:hall-house/sealed",
    building: "house",
    origin: "sealed",
    pose: null,
  };

  TestValidator.equals(
    "an interior view with nowhere inside to stand is refused, not counted",
    close({
      declared: [unplaceable.id],
      required: [unplaceable],
    }).map((diagnostic) => [
      diagnostic.target,
      diagnostic.message.includes("no eye could be placed inside"),
    ]),
    [[`library:spaces:docs/spaces/hall.md#hall:${unplaceable.id}`, true]],
  );

  TestValidator.equals(
    "an empty derived population refuses nothing at all",
    close({ declared: [], required: [] }),
    [],
  );
};
