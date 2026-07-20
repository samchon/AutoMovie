import {
  IAutoMoviePerformedShot,
  compareCodeUnits,
  performShot,
  stageScene,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieActionTarget,
  IAutoMovieOnHitReaction,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";

const script = makeScriptWrite();

/** The duel plus a throwable set piece, so a launch has something to fly. */
const staging = makeStagingWrite({
  set: [{ node: "pebble", model: "sphere", position: { x: 0, y: 1.2, z: 0 } }],
});

const performing = (): ((
  draft: IAutoMovieActionCall[],
) => IAutoMoviePerformedShot) => {
  const staged = stageScene(script, staging);
  if (staged.success !== true) throw new Error("staging fixture must succeed");
  return (draft) =>
    performShot({
      script,
      staged,
      performance: makePerformanceWrite({
        draft,
        revise: { review: "unchanged.", final: null },
      }),
      synthesize: validSynthesizer,
      skeleton: () => createSkeleton(),
    });
};

/** One launch draft, so each scenario differs only in the aim and the onHit. */
const throwAt = (
  at: IAutoMovieActionTarget,
  onHit?: IAutoMovieOnHitReaction,
): IAutoMovieActionCall => ({
  verb: "launch",
  actor: "knightA",
  start: 0,
  duration: 1,
  projectile: "pebble",
  speed: 20,
  at,
  onHit,
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

/**
 * A camera is a place to shoot at, never something that recoils.
 *
 * `launch`'s aim resolves against every staged placement, cameras included
 * (#1294), and that is right: a projectile thrown at the lens is ordinary film
 * grammar. But `onHit` schedules a RECOIL on the id it strikes, and the `react`
 * the engine injects is appended to the action list AFTER the input gate has
 * run, so it slipped past the very rule that refuses a camera as the actor of
 * any verb but `frame`. Left open, the shot compiles with a camera in
 * `shot.performances`, which the MCP artifact validator then refuses at commit:
 * the engine declaring a shot successful that its own consumers cannot accept.
 *
 * Scenarios:
 *
 * 1. A launch at a staged camera with no `onHit` still performs, and no camera
 *    appears in `shot.performances`: aiming at the lens was never the problem.
 * 2. The same launch carrying `onHit` is refused at its own `.at` path, and the
 *    refusal names the camera rather than the target kind.
 * 3. The counter-case one property away: the same `onHit` aimed at a staged scene
 *    node performs, and the struck actor carries a performance, so the refusal
 *    is about the camera and not about `onHit`.
 * 4. `unbalance: true` is refused identically, before any `fall` event could be
 *    built for a camera.
 * 5. A `point` aim carrying `onHit` still performs: there is no single actor to
 *    recoil, the engine already withholds the react, and nothing changed
 *    there.
 * 6. Across every performing scenario, `shot.performances` never names a camera,
 *    the invariant the MCP shot validator independently enforces.
 */
export const test_film_perform_shot_launch_camera = (): void => {
  const perform = performing();
  const performers = (result: IAutoMoviePerformedShot): string[] =>
    result.success === true
      ? result.shot.performances
          .map((entry) => entry.node)
          .sort(compareCodeUnits)
      : [];

  // 1. shooting at the lens is legal.
  const atLens = perform([throwAt({ kind: "node", node: "cam-main" })]);
  TestValidator.equals(
    "a launch at a staged camera performs",
    atLens.success,
    true,
  );
  TestValidator.equals(
    "no camera performs the shot it was aimed at",
    performers(atLens),
    ["knightA"],
  );

  // 2. knocking the lens back is not.
  TestValidator.predicate(
    "an onHit aimed at a camera is refused at the aim, naming the camera",
    says(
      perform([throwAt({ kind: "node", node: "cam-main" }, { force: 0.5 })]),
      "$input.draft[0].at",
      '"cam-main"',
      "is a camera",
    ),
  );

  // 3. the counter-case one property away: the same onHit at an actor.
  const atActor = perform([
    throwAt({ kind: "node", node: "knightB" }, { force: 0.5 }),
  ]);
  TestValidator.equals(
    "the same onHit aimed at a staged scene node performs",
    atActor.success,
    true,
  );
  TestValidator.equals(
    "the struck actor carries the injected recoil",
    performers(atActor),
    ["knightA", "knightB"],
  );

  // 4. the unbalance boundary is refused before a fall event exists.
  TestValidator.predicate(
    "an unbalancing onHit at a camera is refused the same way",
    says(
      perform([
        throwAt(
          { kind: "node", node: "cam-main" },
          { force: 1, unbalance: true },
        ),
      ]),
      "$input.draft[0].at",
      "is a camera",
    ),
  );

  // 5. a point aim with onHit recoils nobody and always did.
  const atPoint = perform([
    throwAt({ kind: "point", point: { x: 0, y: 0, z: 0.7 } }, { force: 0.5 }),
  ]);
  TestValidator.equals(
    "a point aim carrying onHit still performs",
    atPoint.success,
    true,
  );
  TestValidator.equals("a point aim recoils no one", performers(atPoint), [
    "knightA",
  ]);
};
