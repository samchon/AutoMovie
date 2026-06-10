import {
  IAutoFilmActorContext,
  compilePerformance,
  makeActorSynthesizer,
} from "@autofilm/engine";
import { IAutoFilmActionCall, IAutoFilmGait } from "@autofilm/interface";
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
  restPose: makePose([joint("spine", { flexion: 0 })]),
};

const contexts = new Map<string, IAutoFilmActorContext>([["hero", ctx]]);

const locomote = (
  gait: "walk" | "run" | "sprint" | "sneak" | "march",
): IAutoFilmActionCall => ({
  verb: "locomote",
  gait,
  to: { kind: "node", node: "door" },
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

/**
 * `makeActorSynthesizer` — the reference content seam that lets the action
 * compiler fatten verbs from declarative gait/profile data. Bridges
 * {@link compilePerformance} to {@link gaitMotion} / {@link holdMotion}.
 *
 * Scenarios:
 *
 * 1. `locomote` resolves to the actor's matching gait, baked into a looping step
 *    cycle; an unmatched gait name and every other verb (and an unknown actor)
 *    return null.
 * 2. `hold` resolves to the rest pose held for the duration.
 * 3. End to end: a locomote + a held beat compile into one arranged performance
 *    clip for the actor.
 */
export const test_perform_actor_synthesizer = (): void => {
  const synth = makeActorSynthesizer(contexts);

  // 1. locomote → gait, with the null branches
  const step = synth(locomote("walk"), "hero");
  TestValidator.predicate("locomote yields a clip", step !== null);
  TestValidator.equals("gait clip loops", step!.loop, true);
  TestValidator.predicate(
    "gait clip spans the period",
    nclose(step!.duration, 1),
  );
  TestValidator.equals("gait clip is actor+gait keyed", step!.id, "hero:walk");
  TestValidator.equals(
    "an unmatched gait name → null",
    synth(locomote("run"), "hero"),
    null,
  );
  TestValidator.equals(
    "a non-synthesised verb → null",
    synth(gesture, "hero"),
    null,
  );
  TestValidator.equals(
    "an unknown actor → null",
    synth(locomote("walk"), "ghost"),
    null,
  );

  // 2. hold → held rest pose
  const held = synth(hold(0), "hero");
  TestValidator.predicate("hold yields a clip", held !== null);
  TestValidator.predicate("hold spans its duration", nclose(held!.duration, 1));
  TestValidator.equals(
    "hold targets the actor's skeleton",
    held!.skeleton,
    "h",
  );

  // 3. end to end through the compiler
  const performances = compilePerformance([locomote("walk"), hold(2)], synth);
  TestValidator.equals("one actor performed", Object.keys(performances), [
    "hero",
  ]);
  TestValidator.predicate(
    "the performance runs to the held beat's end",
    nclose(performances.hero!.duration, 3),
  );
};
