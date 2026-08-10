import { validateAutoMovieMaterialAssembly } from "@automovie/engine";
import type {
  IAutoMovieMaterialAssembly,
  IAutoMovieValidation,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { assembly, layer, substance } from "../internal/materialFixtures";
import {
  hasViolation,
  namedFacts,
  violationCount,
} from "../internal/predicates";

const judge = (
  one: IAutoMovieMaterialAssembly,
  host?: { thickness: number },
): IAutoMovieValidation =>
  validateAutoMovieMaterialAssembly({ assembly: one, host });

const twoLayer = (
  overrides: Partial<IAutoMovieMaterialAssembly> = {},
): IAutoMovieMaterialAssembly =>
  assembly([layer("core", 0.1), layer("skin", 0.01, { finish: true })], {
    faces: { first: "concealed", last: "exposed" },
    ...overrides,
  });

/**
 * Every contradiction a layered build-up can carry, each beside a twin that
 * differs by one property and must stay clean.
 *
 * The three groups the requirement names are checked apart. A layer conflict is
 * a contradiction inside one layer. A finish defect is a contradiction between
 * the stack and the faces it presents. A dimension conflict is a contradiction
 * with the host the stack was drawn into. Every case pins the path as well as
 * the kind, because a validator that fires on the right defect at the wrong
 * path sends the author to the wrong layer.
 *
 * Scenarios:
 *
 * 1. A clean two-layer stack with one exposed face produces no violation: the
 *    baseline every case below is one property away from.
 * 2. Envelope fields are refused one at a time: blank id, unknown axis, unknown
 *    sense, non-finite offset, unknown face exposure, and an empty stack, whose
 *    single violation proves the finish rules stay silent with nothing to say.
 * 3. Layer identity is refused: a blank id, a duplicate id, and a blank role.
 * 4. Layer substance conflicts are refused: an unknown substance word, a negative
 *    thickness, a non-finite thickness, a zero-thickness solid, a
 *    zero-thickness cavity, a cavity carrying a substance, a cavity flagged as
 *    a finish, and a solid with no substance. A zero-thickness membrane stays
 *    clean, which is what the "only a membrane may measure nothing" rule
 *    means.
 * 5. An unresolved substance id fires only when a table is supplied; the same
 *    stack without a table and with a complete table both stay clean.
 * 6. Finish defects are told apart: a finish laid over the finish beside it, a
 *    finish buried between layers, an exposed face nothing finishes, and a
 *    finish spent on a concealed face. A stack finished at both exposed ends is
 *    clean.
 * 7. A one-layer stack presents both faces with the same layer, so its finish
 *    answers for whichever of them is exposed instead of being demanded twice
 *    or refused as waste.
 * 8. A wrapping layer behind a layer that stops at the jamb is refused; a run
 *    anchored at either face, at both, and at neither is not.
 * 9. A host thickness that is not a positive finite number is refused before the
 *    sum is compared with it.
 */
export const test_architecture_material_assembly_defects = (): void => {
  TestValidator.equals(
    "the baseline stack carries no violation",
    judge(twoLayer()),
    {
      success: true,
    },
  );

  TestValidator.equals(
    "each envelope field is refused on its own path",
    namedFacts([
      [
        "id",
        () => hasViolation(judge(twoLayer({ id: "  " })), "type", "$input.id"),
      ],
      [
        "axis",
        () =>
          hasViolation(
            judge(
              twoLayer({ axis: "w" as IAutoMovieMaterialAssembly["axis"] }),
            ),
            "type",
            "$input.axis",
          ),
      ],
      [
        "sense",
        () =>
          hasViolation(
            judge(
              twoLayer({
                sense: "inward" as IAutoMovieMaterialAssembly["sense"],
              }),
            ),
            "type",
            "$input.sense",
          ),
      ],
      [
        "offset",
        () =>
          hasViolation(
            judge(twoLayer({ offset: Number.NaN })),
            "range",
            "$input.offset",
          ),
      ],
      [
        "faceFirst",
        () =>
          hasViolation(
            judge(
              twoLayer({
                faces: {
                  first:
                    "hidden" as IAutoMovieMaterialAssembly["faces"]["first"],
                  last: "exposed",
                },
              }),
            ),
            "type",
            "$input.faces.first",
          ),
      ],
      [
        "faceLast",
        () =>
          hasViolation(
            judge(
              twoLayer({
                faces: {
                  first: "concealed",
                  last: "shown" as IAutoMovieMaterialAssembly["faces"]["last"],
                },
              }),
            ),
            "type",
            "$input.faces.last",
          ),
      ],
      [
        "empty",
        () => hasViolation(judge(assembly([])), "range", "$input.layers"),
      ],
      ["emptyIsAlone", () => violationCount(judge(assembly([]))) === 1],
    ]),
    {
      id: true,
      axis: true,
      sense: true,
      offset: true,
      faceFirst: true,
      faceLast: true,
      empty: true,
      emptyIsAlone: true,
    },
  );

  TestValidator.equals(
    "layer identity is refused on its own path",
    namedFacts([
      [
        "blankId",
        () =>
          hasViolation(
            judge(
              assembly(
                [layer(" ", 0.1), layer("skin", 0.01, { finish: true })],
                { faces: { first: "concealed", last: "exposed" } },
              ),
            ),
            "type",
            "$input.layers[0].id",
          ),
      ],
      [
        "duplicateId",
        () =>
          hasViolation(
            judge(
              assembly(
                [
                  layer("core", 0.1),
                  layer("core", 0.01, { finish: true, role: "skin" }),
                ],
                { faces: { first: "concealed", last: "exposed" } },
              ),
            ),
            "type",
            "$input.layers[1].id",
          ),
      ],
      [
        "blankRole",
        () =>
          hasViolation(
            judge(
              assembly(
                [
                  layer("core", 0.1, { role: "" }),
                  layer("skin", 0.01, { finish: true }),
                ],
                { faces: { first: "concealed", last: "exposed" } },
              ),
            ),
            "type",
            "$input.layers[0].role",
          ),
      ],
    ]),
    { blankId: true, duplicateId: true, blankRole: true },
  );

  const withCore = (
    core: Partial<IAutoMovieMaterialAssembly["layers"][number]>,
    thickness = 0.1,
  ): IAutoMovieMaterialAssembly =>
    assembly(
      [layer("core", thickness, core), layer("skin", 0.01, { finish: true })],
      { faces: { first: "concealed", last: "exposed" } },
    );
  TestValidator.equals(
    "layer substance conflicts are refused, and a zero-thickness membrane is not",
    namedFacts([
      [
        "unknownSubstance",
        () =>
          hasViolation(
            judge(
              withCore({
                substance:
                  "foam" as IAutoMovieMaterialAssembly["layers"][number]["substance"],
              }),
            ),
            "type",
            "$input.layers[0].substance",
          ),
      ],
      [
        "negativeThickness",
        () =>
          hasViolation(
            judge(withCore({}, -0.1)),
            "range",
            "$input.layers[0].thickness",
          ),
      ],
      [
        "nonFiniteThickness",
        () =>
          hasViolation(
            judge(withCore({}, Number.POSITIVE_INFINITY)),
            "range",
            "$input.layers[0].thickness",
          ),
      ],
      [
        "zeroSolid",
        () =>
          hasViolation(
            judge(withCore({}, 0)),
            "range",
            "$input.layers[0].thickness",
          ),
      ],
      [
        "zeroCavity",
        () =>
          hasViolation(
            judge(withCore({ substance: "cavity", material: null }, 0)),
            "range",
            "$input.layers[0].thickness",
          ),
      ],
      [
        "cavityWithSubstance",
        () =>
          hasViolation(
            judge(withCore({ substance: "cavity" })),
            "type",
            "$input.layers[0].material",
          ),
      ],
      [
        "cavityAsFinish",
        () =>
          hasViolation(
            judge(
              withCore({ substance: "cavity", material: null, finish: true }),
            ),
            "type",
            "$input.layers[0].finish",
          ),
      ],
      [
        "solidWithoutSubstance",
        () =>
          hasViolation(
            judge(withCore({ material: null })),
            "type",
            "$input.layers[0].material",
          ),
      ],
      [
        "membraneMayMeasureNothing",
        () => judge(withCore({ substance: "membrane" }, 0)).success === true,
      ],
    ]),
    {
      unknownSubstance: true,
      negativeThickness: true,
      nonFiniteThickness: true,
      zeroSolid: true,
      zeroCavity: true,
      cavityWithSubstance: true,
      cavityAsFinish: true,
      solidWithoutSubstance: true,
      membraneMayMeasureNothing: true,
    },
  );

  TestValidator.equals(
    "an unresolved substance fires only when a table is supplied",
    namedFacts([
      ["withoutTable", () => judge(twoLayer()).success === true],
      [
        "missingFromTable",
        () =>
          hasViolation(
            validateAutoMovieMaterialAssembly({
              assembly: twoLayer(),
              substances: [substance("skin-substance")],
            }),
            "type",
            "$input.layers[0].material",
          ),
      ],
      [
        "completeTable",
        () =>
          validateAutoMovieMaterialAssembly({
            assembly: twoLayer(),
            substances: [
              substance("core-substance"),
              substance("skin-substance"),
            ],
          }).success === true,
      ],
    ]),
    { withoutTable: true, missingFromTable: true, completeTable: true },
  );

  const three = (
    finishes: readonly boolean[],
    faces: IAutoMovieMaterialAssembly["faces"],
  ): IAutoMovieMaterialAssembly =>
    assembly(
      ["outer", "middle", "inner"].map((id, index) =>
        layer(id, 0.05, { finish: finishes[index] }),
      ),
      { faces },
    );
  const solitary = (
    one: IAutoMovieValidation,
    path: string,
    fragment: string,
  ): boolean =>
    one.success === false &&
    one.violations.length === 1 &&
    one.violations[0]!.path === path &&
    one.violations[0]!.expected.includes(fragment);
  TestValidator.equals(
    "finish defects are told apart from one another",
    namedFacts([
      [
        "doubled",
        () =>
          solitary(
            judge(
              three([true, true, false], {
                first: "exposed",
                last: "concealed",
              }),
            ),
            "$input.layers[1].finish",
            "lays a finish over the finish beside it",
          ),
      ],
      [
        "buried",
        () =>
          solitary(
            judge(
              three([false, true, false], {
                first: "concealed",
                last: "concealed",
              }),
            ),
            "$input.layers[1].finish",
            "buried between layers",
          ),
      ],
      [
        "missing",
        () =>
          solitary(
            judge(
              three([false, false, false], {
                first: "exposed",
                last: "concealed",
              }),
            ),
            "$input.layers[0].finish",
            "no finish presents the exposed first face",
          ),
      ],
      [
        "wasted",
        () =>
          solitary(
            judge(
              three([false, false, true], {
                first: "concealed",
                last: "concealed",
              }),
            ),
            "$input.layers[2].finish",
            "spends a finish on the concealed last face",
          ),
      ],
      [
        "bothEndsFinished",
        () =>
          judge(
            three([true, false, true], { first: "exposed", last: "exposed" }),
          ).success === true,
      ],
    ]),
    {
      doubled: true,
      buried: true,
      missing: true,
      wasted: true,
      bothEndsFinished: true,
    },
  );

  const single = (
    finish: boolean,
    faces: IAutoMovieMaterialAssembly["faces"],
  ): IAutoMovieMaterialAssembly =>
    assembly([layer("slab", 0.2, { finish })], { faces });
  TestValidator.equals(
    "one layer answers for both faces at once",
    namedFacts([
      [
        "oneExposedSideFinished",
        () =>
          judge(single(true, { first: "exposed", last: "concealed" }))
            .success === true,
      ],
      [
        "bothExposedFinished",
        () =>
          judge(single(true, { first: "exposed", last: "exposed" })).success ===
          true,
      ],
      [
        "bothExposedUnfinished",
        () =>
          solitary(
            judge(single(false, { first: "exposed", last: "exposed" })),
            "$input.layers[0].finish",
            "the exposed first and last face",
          ),
      ],
      [
        "bothConcealedFinished",
        () =>
          solitary(
            judge(single(true, { first: "concealed", last: "concealed" })),
            "$input.layers[0].finish",
            "the concealed first and last face",
          ),
      ],
      [
        "bothConcealedUnfinished",
        () =>
          judge(single(false, { first: "concealed", last: "concealed" }))
            .success === true,
      ],
    ]),
    {
      oneExposedSideFinished: true,
      bothExposedFinished: true,
      bothExposedUnfinished: true,
      bothConcealedFinished: true,
      bothConcealedUnfinished: true,
    },
  );

  const wrapped = (wraps: readonly boolean[]): IAutoMovieMaterialAssembly =>
    assembly(
      ["outer", "middle", "inner"].map((id, index) =>
        layer(id, 0.05, { wrapsOpening: wraps[index] }),
      ),
      { faces: { first: "concealed", last: "concealed" } },
    );
  TestValidator.equals(
    "a wrapping run must start at a face",
    namedFacts([
      [
        "buriedWrap",
        () =>
          hasViolation(
            judge(wrapped([false, true, false])),
            "type",
            "$input.layers[1].wrapsOpening",
          ),
      ],
      [
        "leadingRun",
        () => judge(wrapped([true, true, false])).success === true,
      ],
      [
        "trailingRun",
        () => judge(wrapped([false, true, true])).success === true,
      ],
      ["bothEnds", () => judge(wrapped([true, false, true])).success === true],
      [
        "nothingWraps",
        () => judge(wrapped([false, false, false])).success === true,
      ],
      [
        "everythingWraps",
        () => judge(wrapped([true, true, true])).success === true,
      ],
    ]),
    {
      buriedWrap: true,
      leadingRun: true,
      trailingRun: true,
      bothEnds: true,
      nothingWraps: true,
      everythingWraps: true,
    },
  );

  TestValidator.equals(
    "a host thickness must itself be a positive finite number",
    namedFacts([
      [
        "zero",
        () =>
          hasViolation(
            judge(twoLayer(), { thickness: 0 }),
            "range",
            "$input.layers",
          ),
      ],
      [
        "nonFinite",
        () =>
          hasViolation(
            judge(twoLayer(), { thickness: Number.NaN }),
            "range",
            "$input.layers",
          ),
      ],
      [
        "matching",
        () => judge(twoLayer(), { thickness: 0.11 }).success === true,
      ],
    ]),
    { zero: true, nonFinite: true, matching: true },
  );
};
