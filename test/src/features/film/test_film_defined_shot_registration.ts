import {
  IAutoMovieCompiledDefinedShot,
  IAutoMovieShotRuntime,
  compileDefinedShot,
  defineShot,
} from "@automovie/engine";
import { IAutoMovieDefinedShot } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

/**
 * The host capabilities the boundary carries.
 *
 * Every case here fails before the runtime is read -- registration, a throwing
 * boundary, a throwing builder -- so the shape only has to exist.
 */
const runtime = (): IAutoMovieShotRuntime =>
  ({
    frameFormat: { width: 1920, height: 1080 },
    skeleton: () => null,
    synthesize: () => null,
  }) as unknown as IAutoMovieShotRuntime;

/** A registration the boundary accepts, so a case breaks one field only. */
const registered = (
  overrides: Record<string, unknown> = {},
): IAutoMovieDefinedShot<null> =>
  ({
    ...defineShot<null>("opening", {
      scene: "sc",
      contract: { beat: "b1" },
      build: () => ({}),
    } as never),
    ...overrides,
  }) as unknown as IAutoMovieDefinedShot<null>;

const compile = (
  shot: IAutoMovieDefinedShot<null>,
): IAutoMovieCompiledDefinedShot =>
  compileDefinedShot({ shot, context: null, runtime: runtime() });

const codes = (compiled: IAutoMovieCompiledDefinedShot): string[] =>
  compiled.success === true
    ? []
    : compiled.diagnostics.map((diagnostic) => diagnostic.code);

const paths = (compiled: IAutoMovieCompiledDefinedShot): string[] =>
  compiled.success === true
    ? []
    : compiled.diagnostics.map((diagnostic) => diagnostic.path);

/**
 * What the shot compilation boundary reports before it ever runs a builder.
 *
 * `compileDefinedShot` is the seam between author-written shot source and the
 * engine, and its contract is that an author mistake comes back as a structured
 * diagnostic rather than as a thrown stack: the pipeline itself is allowed to
 * fail, but only into `pipeline-failed`. Those paths had no test, because every
 * existing caller registers a well-formed shot and returns a valid program.
 *
 * Scenarios:
 *
 * 1. A blank id, scene, or contract beat is reported as `registration-invalid`
 *    against the exact field, and several blanks report several diagnostics.
 * 2. A registration whose contract is missing entirely throws inside the boundary,
 *    which is converted into one `pipeline-failed` diagnostic naming `$shot`
 *    rather than escaping to the author.
 * 3. A builder that throws is reported as `builder-failed` against `$shot.build`,
 *    with the thrown text carried into the fact.
 */
export const test_film_defined_shot_registration = (): void => {
  const thrown = compile(
    registered({
      build: () => {
        throw new Error("opening source failure");
      },
    }),
  );
  TestValidator.equals(
    "the shot boundary reports author mistakes as diagnostics, never as stacks",
    namedFacts([
      [
        "blankIdIsRegistrationInvalid",
        () => {
          const compiled = compile(registered({ id: "  " }));
          return (
            codes(compiled).join(",") === "registration-invalid" &&
            paths(compiled).join(",") === "$shot.id"
          );
        },
      ],
      [
        "blankSceneIsRegistrationInvalid",
        () =>
          paths(compile(registered({ scene: "" }))).join(",") === "$shot.scene",
      ],
      [
        "blankBeatIsRegistrationInvalid",
        () =>
          paths(compile(registered({ contract: { beat: " " } }))).join(",") ===
          "$shot.contract.beat",
      ],
      [
        "everyBlankFieldIsReported",
        () =>
          paths(
            compile(registered({ id: "", scene: "", contract: { beat: "" } })),
          ).length === 3,
      ],
      [
        "aThrowingBoundaryBecomesPipelineFailed",
        () => {
          const compiled = compile(
            registered({ contract: undefined }) as IAutoMovieDefinedShot<null>,
          );
          return (
            codes(compiled).join(",") === "pipeline-failed" &&
            paths(compiled).join(",") === "$shot"
          );
        },
      ],
      [
        "aThrowingBuilderBecomesBuilderFailed",
        () => codes(thrown).join(",") === "builder-failed",
      ],
      [
        "theBuilderFailureCarriesItsText",
        () =>
          thrown.success === false &&
          thrown.diagnostics[0]!.fact.includes("opening source failure"),
      ],
    ]),
    {
      blankIdIsRegistrationInvalid: true,
      blankSceneIsRegistrationInvalid: true,
      blankBeatIsRegistrationInvalid: true,
      everyBlankFieldIsReported: true,
      aThrowingBoundaryBecomesPipelineFailed: true,
      aThrowingBuilderBecomesBuilderFailed: true,
      theBuilderFailureCarriesItsText: true,
    },
  );
};
