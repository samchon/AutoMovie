import {
  IAutoMoviePerformedShot,
  performShot,
  stageScene,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieBlockingApplication,
  IAutoMovieScene,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";

type ICoverage = IAutoMovieBlockingApplication.ICoverageIntent;

const script = makeScriptWrite();

/** The duel with two cameras, so the hero and a coverage angle are distinct. */
const staged = (() => {
  const result = stageScene(
    script,
    makeStagingWrite({
      cameras: [
        {
          node: "cam-main",
          position: { x: 2, y: 1.5, z: 0.35 },
          lookAt: { kind: "node", node: "knightA" },
          fovDeg: 40,
        },
        {
          node: "cam-alt",
          position: { x: -2, y: 1.5, z: 0.35 },
          lookAt: { kind: "node", node: "knightB" },
          fovDeg: 40,
        },
      ],
    }),
  );
  if (result.success !== true) throw new Error("staging fixture must succeed");
  return result;
})();

/**
 * The staged set with one camera's field of view or placement replaced. Staging
 * itself refuses these, which is the point: an EXPLICIT staged set never passes
 * through staging, so this is the shape a caller can hand `performShot`.
 */
const withCamera = (
  id: string,
  over: { fovY?: number; x?: number },
): typeof staged => ({
  ...staged,
  scene: {
    ...staged.scene,
    cameras: staged.scene.cameras.map((camera) =>
      camera.id !== id
        ? camera
        : {
            ...camera,
            fovY: over.fovY ?? camera.fovY,
            transform: {
              ...camera.transform,
              translation: {
                ...camera.transform.translation,
                x: over.x ?? camera.transform.translation.x,
              },
            },
          },
    ),
  } as IAutoMovieScene,
});

const frame = (actor: string): IAutoMovieActionCall => ({
  verb: "frame",
  actor,
  start: 0,
  duration: "auto",
  framing: "medium",
  move: "static",
  on: { kind: "node", node: "knightA" },
});

const coverageOn = (camera: string): ICoverage[] => [
  {
    camera,
    framing: "medium",
    move: "static",
    on: { kind: "node", node: "knightB" },
  },
];

const perform = (
  set: typeof staged,
  draft: IAutoMovieActionCall[],
  coverage?: ICoverage[],
): IAutoMoviePerformedShot =>
  performShot({
    script,
    staged: set,
    performance: makePerformanceWrite({
      draft,
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
    // `actors: []` drops the fixture's default timing anchors, which the draft
    // here (a lone frame action) would not cover: the coverage scenarios must
    // fail for the camera under test and nothing else.
    blocking:
      coverage === undefined
        ? undefined
        : makeBlockingWrite({ coverage, actors: [] }),
  });

/** True when the refusal at `path` states every fragment. */
const says = (
  result: IAutoMoviePerformedShot,
  path: string,
  ...fragments: string[]
): boolean =>
  result.success === false &&
  result.violations.some(
    (item) =>
      item.path === path &&
      fragments.every((fragment) => item.expected.includes(fragment)),
  );

/** Every numeric value across a compiled clip's tracks. */
const clipValues = (result: IAutoMoviePerformedShot): number[] =>
  result.success !== true || result.shot.cameraMotion === null
    ? []
    : result.shot.cameraMotion.tracks.flatMap((track) => track.values);

/**
 * A camera the shot compiles a move FROM must be one the framing grammar can
 * solve.
 *
 * `stageScene` bounds a camera's field of view to (0, 180)° and its placement
 * to a finite point, but an EXPLICIT staged set never passes through staging,
 * and the framing solve divides by `tan(fovY / 2)`. A zero or NaN field of view
 * makes the framed distance infinite or NaN, so every keyframe the solve emits
 * is non-finite and `performShot` returns `success: true` with a clip the MCP
 * artifact validator refuses at commit: the engine declaring a shot successful
 * that its own consumers cannot accept, the class #1224 and #1308 also belong
 * to.
 *
 * Both conditions (range, finiteness) are checked against both subjects (the
 * elected camera, each coverage camera), so each pairing carries its own case
 * rather than one combined probe.
 *
 * Scenarios:
 *
 * 1. The positive floor: a valid camera compiles, and every emitted clip value is
 *    finite. That finiteness assertion is the contradiction this closes, so it
 *    is stated directly rather than inferred from success.
 * 2. The elected camera, refused on each condition at its own staged path: a zero
 *    field of view, NaN, the exclusive upper bound 180, a negative value, and a
 *    non-finite placement.
 * 3. The exclusive bounds are open, not clamped: 1e-6 and 179.999 still compile,
 *    so legitimate extreme lenses are not swept up by the gate.
 * 4. The same two conditions against a COVERAGE camera, which is a separate
 *    subject reached through a separate path.
 * 5. The counter-case that keeps the gate narrow: a degenerate camera the shot
 *    never frames through is not checked. With no frame action at all the shot
 *    falls back to the first camera locked off, compiling no move, so even a
 *    degenerate elected camera is left alone.
 */
export const test_film_perform_shot_framing_camera = (): void => {
  // 1. the positive floor, and the invariant itself.
  const ok = perform(staged, [frame("cam-main")]);
  TestValidator.equals("a valid framing camera compiles", ok.success, true);
  TestValidator.predicate(
    "every compiled camera keyframe is finite",
    clipValues(ok).length > 0 && clipValues(ok).every(Number.isFinite),
  );

  // 2. the elected camera, one case per condition.
  const heroPath = "$staged.scene.cameras[0]";
  for (const [label, fovY] of [
    ["zero", 0],
    ["NaN", Number.NaN],
    ["the exclusive upper bound", 180],
    ["negative", -40],
  ] as const)
    TestValidator.predicate(
      `an elected camera with a ${label} field of view is refused`,
      says(
        perform(withCamera("cam-main", { fovY }), [frame("cam-main")]),
        `${heroPath}.fovY`,
        '"cam-main"',
        "(0, 180)",
      ),
    );
  TestValidator.predicate(
    "an elected camera at a non-finite placement is refused",
    says(
      perform(withCamera("cam-main", { x: Number.POSITIVE_INFINITY }), [
        frame("cam-main"),
      ]),
      `${heroPath}.transform.translation`,
      '"cam-main"',
      "finite point",
    ),
  );

  // 3. the bounds are open, so extreme but legal lenses still compile.
  for (const fovY of [1e-6, 179.999])
    TestValidator.equals(
      `a field of view of ${fovY} still compiles`,
      perform(withCamera("cam-main", { fovY }), [frame("cam-main")]).success,
      true,
    );

  // 4. the second subject: a coverage camera, at its own staged path.
  TestValidator.predicate(
    "a coverage camera with a zero field of view is refused",
    says(
      perform(
        withCamera("cam-alt", { fovY: 0 }),
        [frame("cam-main")],
        coverageOn("cam-alt"),
      ),
      "$staged.scene.cameras[1].fovY",
      '"cam-alt"',
    ),
  );
  TestValidator.predicate(
    "a coverage camera at a non-finite placement is refused",
    says(
      perform(
        withCamera("cam-alt", { x: Number.NaN }),
        [frame("cam-main")],
        coverageOn("cam-alt"),
      ),
      "$staged.scene.cameras[1].transform.translation",
      '"cam-alt"',
    ),
  );

  // 5. the counter-cases that keep the gate narrow.
  TestValidator.equals(
    "a degenerate camera the shot never frames through is not checked",
    perform(withCamera("cam-alt", { fovY: 0 }), [frame("cam-main")]).success,
    true,
  );
  TestValidator.equals(
    "with no frame action nothing is compiled, so nothing is gated",
    perform(withCamera("cam-main", { fovY: 0 }), []).success,
    true,
  );
};
