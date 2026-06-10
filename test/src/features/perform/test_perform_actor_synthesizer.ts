import {
  IAutoFilmActorContext,
  compilePerformance,
  makeActorSynthesizer,
} from "@autofilm/engine";
import {
  IAutoFilmActionCall,
  IAutoFilmActionTarget,
  IAutoFilmGait,
  IAutoFilmVector3,
} from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import { joint, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const WALK: IAutoFilmGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

const ctx: IAutoFilmActorContext = {
  skeleton: "h",
  gaits: [WALK],
  position: { x: 0, y: 0, z: 0 },
  speed: 1,
  restPose: makePose([joint("spine", { flexion: 0 })]),
};

const contexts = new Map<string, IAutoFilmActorContext>([["hero", ctx]]);

const nodes = new Map<string, IAutoFilmVector3>([
  ["door", { x: 0, y: 0, z: 5 }],
  ["here", { x: 0, y: 0, z: 0 }],
]);

const locomote = (
  gait: "walk" | "run" | "sprint" | "sneak" | "march",
  to: IAutoFilmActionTarget,
): IAutoFilmActionCall => ({
  verb: "locomote",
  gait,
  to,
  actor: "hero",
  start: 0,
  duration: "auto",
});

const hold = (start: number): IAutoFilmActionCall => ({
  verb: "hold",
  actor: "hero",
  start,
  duration: 1,
});

const gesture: IAutoFilmActionCall = {
  verb: "gesture",
  kind: "wave",
  actor: "hero",
  start: 0,
  duration: "auto",
};

const door: IAutoFilmActionTarget = { kind: "node", node: "door" };

/**
 * `makeActorSynthesizer` — the reference content seam that lets the action
 * compiler fatten verbs from declarative gait/profile data.
 *
 * Scenarios:
 *
 * 1. `locomote` to a resolvable point travels the gait that far at the actor's
 *    speed (a non-looping clip whose length is the covered cycles).
 * 2. `locomote` to a relative target (no positional point) — or to its own spot —
 *    steps in place: the looping one-cycle gait.
 * 3. An unmatched gait, a non-synthesised verb, and an unknown actor → null.
 * 4. `hold` holds the rest pose; and a locomote+hold beat compiles end to end.
 */
export const test_perform_actor_synthesizer = (): void => {
  const synth = makeActorSynthesizer(contexts, nodes);

  // 1. travel toward a resolvable destination
  const trip = synth(locomote("walk", door), "hero");
  TestValidator.predicate("locomote to a point travels", trip !== null);
  TestValidator.equals(
    "travel clip is travel-keyed",
    trip!.id,
    "hero:walk:travel",
  );
  TestValidator.predicate(
    "travel length covers the 5m at 1 m/s (5 cycles of period 1)",
    nclose(trip!.duration, 5),
  );

  // 2a. relative target → step in place (looping one-cycle gait)
  const inPlace = synth(
    locomote("walk", { kind: "direction", headingDeg: 90 }),
    "hero",
  );
  TestValidator.equals("in-place clip loops", inPlace!.loop, true);
  TestValidator.predicate(
    "in-place spans one period",
    nclose(inPlace!.duration, 1),
  );
  TestValidator.equals("in-place is gait-keyed", inPlace!.id, "hero:walk");

  // 2b. destination at the actor's own spot → also steps in place
  const here = synth(locomote("walk", { kind: "node", node: "here" }), "hero");
  TestValidator.equals("already-there steps in place", here!.id, "hero:walk");

  // 3. null branches
  TestValidator.equals(
    "an unmatched gait → null",
    synth(locomote("run", door), "hero"),
    null,
  );
  TestValidator.equals(
    "a non-synthesised verb → null",
    synth(gesture, "hero"),
    null,
  );
  TestValidator.equals(
    "an unknown actor → null",
    synth(locomote("walk", door), "ghost"),
    null,
  );

  // 4. hold + end-to-end compile
  const held = synth(hold(0), "hero");
  TestValidator.predicate("hold spans its duration", nclose(held!.duration, 1));
  TestValidator.equals("hold targets the skeleton", held!.skeleton, "h");

  const performances = compilePerformance(
    [locomote("walk", door), hold(6)],
    synth,
  );
  TestValidator.equals("one actor performed", Object.keys(performances), [
    "hero",
  ]);
  TestValidator.predicate(
    "the performance runs through the travel and the held beat",
    nclose(performances.hero!.duration, 7),
  );
};
