import {
  IAutoMovieCompiledShotSource,
  IAutoMovieLight,
  IAutoMovieProductionLighting,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts, nclose } from "../internal/predicates";
import {
  productionCompileSucceeded,
  productionDesign,
  productionFixture,
  setProductionFixtureShotContract,
  shotContract,
} from "./productionFixtures";

/** The story span the production's one source travels across, in seconds. */
const SPAN = 1_800;

/** Where the source starts and ends, so a moment between them is a reading. */
const OPENING_INTENSITY = 4;
const CLOSING_INTENSITY = 1;

/** The production's declared source, carried on the STORY clock. */
const sun = (): IAutoMovieLight => ({
  id: "production-sun",
  type: "directional",
  transform: {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  color: { r: 1, g: 1, b: 1, a: null, hex: null },
  intensity: OPENING_INTENSITY,
});

const lighting = (): IAutoMovieProductionLighting => ({
  id: "day",
  name: null,
  lights: [sun()],
  motions: [
    {
      id: "sunFalls",
      name: null,
      duration: SPAN,
      loop: false,
      tracks: [
        {
          channel: {
            kind: "pointer",
            pointer: "/lights/production-sun/intensity",
            valueType: "scalar",
          },
          times: [0, SPAN],
          values: [OPENING_INTENSITY, CLOSING_INTENSITY],
          interpolation: "linear",
        },
      ],
    },
  ],
});

/** The compiled shot the project just wrote, read back from disk. */
const compiledShot = (root: string): IAutoMovieCompiledShotSource =>
  JSON.parse(
    fs.readFileSync(
      path.join(root, "generated/fixture-film/shots/opening.json"),
      "utf8",
    ),
  ) as IAutoMovieCompiledShotSource;

class ProductionLightingInheritanceCleanupError extends AggregateError {}

/** Dispose the fixture without replacing the failure that reached it. */
const preserveProductionLightingInheritanceCleanup = (
  failure: { error: unknown } | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProductionLightingInheritanceCleanupError(
      [failure.error, cleanupFailure],
      "Production-lighting inheritance fixture teardown failed after the test failed.",
    );
  }
};

/**
 * A film states its light once, and every pinned shot stands under it.
 *
 * The engine already knew how to answer "what is the production's light at this
 * story moment" and nothing called it: a design record carried no lighting, and
 * the pass sat behind an export no compile reached. So the longest statement a
 * film could make about its light was one shot long, which is the wrong size
 * for a film whose story runs across a stretch of hours.
 *
 * What the compile inherits is STATE, not motion: where the source is at the
 * story moment the shot's own pin places its opening frame. Carrying the
 * source's curve in as well would mean resampling a story-clock track onto a
 * shot-local one, exact for some interpolations and an approximation for
 * others; a shot states its own light-over-time through `lightMotions`, and
 * that runs on top of what is inherited here.
 *
 * Scenarios:
 *
 * 1. A shot pinned late in the story compiles with the source's LATE value, not
 *    the value the source was declared with, and the arithmetic is the pin's
 *    own: the fraction of the span the pin lands at, read off a source whose
 *    two ends are different numbers so a reader cannot land on the right answer
 *    by returning either end.
 * 2. The same production compiled with its shot pinned at story zero carries the
 *    source's opening value instead, so what decides the reading is the pin and
 *    not the mere presence of a source.
 * 3. A production that declares no lighting compiles a scene whose lights are the
 *    staged ones, element for element -- the additivity promise a film that
 *    says nothing about production light depends on.
 */
export const test_mcp_production_lighting_inheritance = (): void => {
  const fixture = productionFixture();
  let failure: { error: unknown } | undefined;
  try {
    const project = AutoMovieProductionProject.open(fixture.root);

    const compileWith = (props: {
      lighting?: IAutoMovieProductionLighting;
      originSeconds?: number;
    }): IAutoMovieCompiledShotSource => {
      const design = productionDesign();
      TestValidator.equals(
        "the production and its shot are registered",
        namedFacts([
          [
            "production",
            () =>
              project.setProductionDesign({
                ...design,
                // A pin is legal only once the production keeps a clock, so
                // the clock is what makes the story moment below a moment
                // rather than a number nobody agreed to read.
                storyClock: {
                  units: "second",
                  epoch: "the first frame of the film",
                },
                ...(props.lighting === undefined
                  ? {}
                  : { lighting: props.lighting }),
              }).accepted,
          ],
          [
            "shot",
            () =>
              setProductionFixtureShotContract(project, {
                ...shotContract(),
                ...(props.originSeconds === undefined
                  ? {}
                  : {
                      storyTime: {
                        originSeconds: props.originSeconds,
                        rate: 1,
                      },
                    }),
              }).accepted,
          ],
        ]),
        { production: true, shot: true },
      );
      const compile = new AutoMovieProductionCompiler(project).compile({
        scope: "source",
      });
      productionCompileSucceeded("lighting inheritance", compile);
      return compiledShot(fixture.root);
    };

    // Two thirds of the way down the source's fall, which is neither of its
    // ends: a reader that returned the declared value, or the value at the end
    // of the span, lands on 4 or on 1 and not on 2.
    const origin = (SPAN * 2) / 3;
    const late = compileWith({ lighting: lighting(), originSeconds: origin });
    const opening = compileWith({ lighting: lighting(), originSeconds: 0 });
    const silent = compileWith({});

    const inheritedOf = (
      shot: IAutoMovieCompiledShotSource,
    ): IAutoMovieLight | undefined =>
      shot.scene.lights.find((light) => light.id === sun().id);
    const expected =
      OPENING_INTENSITY +
      (CLOSING_INTENSITY - OPENING_INTENSITY) * (origin / SPAN);

    TestValidator.equals(
      "a pinned shot compiles under the production's light at its own story moment",
      namedFacts([
        ["theSourceReachedTheScene", () => inheritedOf(late) !== undefined],
        [
          "itCarriesTheValueThePinLandsOn",
          () => nclose(inheritedOf(late)!.intensity, expected),
        ],
        // The same source, the same film, a different pin. This is what makes
        // the reading above a reading of the story clock rather than of the
        // source's declaration.
        [
          "aShotPinnedAtZeroCarriesTheOpeningValue",
          () => nclose(inheritedOf(opening)!.intensity, OPENING_INTENSITY),
        ],
        [
          "andTheTwoAreNotTheSameNumber",
          () =>
            nclose(inheritedOf(late)!.intensity, OPENING_INTENSITY) === false,
        ],
        // A film that says nothing about production light renders the lights it
        // staged, and nothing is appended to its scene.
        [
          "aFilmThatSaysNothingIsUntouched",
          () =>
            inheritedOf(silent) === undefined &&
            silent.scene.lights.length === opening.scene.lights.length - 1,
        ],
      ]),
      {
        theSourceReachedTheScene: true,
        itCarriesTheValueThePinLandsOn: true,
        aShotPinnedAtZeroCarriesTheOpeningValue: true,
        andTheTwoAreNotTheSameNumber: true,
        aFilmThatSaysNothingIsUntouched: true,
      },
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveProductionLightingInheritanceCleanup(failure, () =>
      fixture.dispose(),
    );
  }
};
