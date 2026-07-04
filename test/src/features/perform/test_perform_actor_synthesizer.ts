import {
  IautomovieActorContext,
  Quaternion,
  compilePerformance,
  makeActorSynthesizer,
  sampleMotion,
} from "@automovie/engine";
import {
  IautomovieActionCall,
  IautomovieActionTarget,
  IautomovieGait,
  IautomovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { joint, makePose } from "../internal/fixtures";
import { nclose, vclose } from "../internal/predicates";

const WALK: IautomovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

const ctx: IautomovieActorContext = {
  skeleton: "h",
  gaits: [WALK],
  position: { x: 0, y: 0, z: 0 },
  speed: 1,
  facingDeg: 0,
  eyeHeight: 1.6,
  restPose: makePose([joint("spine", { flexion: 0 })]),
};

const contexts = new Map<string, IautomovieActorContext>([["hero", ctx]]);

const nodes = new Map<string, IautomovieVector3>([
  ["door", { x: 0, y: 0, z: 5 }],
  ["here", { x: 0, y: 0, z: 0 }],
]);

const locomote = (
  gait: "walk" | "run" | "sprint" | "sneak" | "march",
  to: IautomovieActionTarget,
): IautomovieActionCall => ({
  verb: "locomote",
  gait,
  to,
  actor: "hero",
  start: 0,
  duration: "auto",
});

const hold = (start: number): IautomovieActionCall => ({
  verb: "hold",
  actor: "hero",
  start,
  duration: 1,
});

const gesture: IautomovieActionCall = {
  verb: "gesture",
  kind: "strike",
  actor: "hero",
  start: 0,
  duration: "auto",
};

const emote = (duration: number | "auto"): IautomovieActionCall => ({
  verb: "emote",
  preset: "happy",
  intensity: 0.8,
  actor: "hero",
  start: 0,
  duration,
});

const lookAt = (
  to: IautomovieActionTarget,
  duration: number | "auto",
): IautomovieActionCall => ({
  verb: "lookAt",
  to,
  actor: "hero",
  start: 0,
  duration,
});

const door: IautomovieActionTarget = { kind: "node", node: "door" };

/**
 * `makeActorSynthesizer` ??the reference content seam that lets the action
 * compiler fatten verbs from declarative gait/profile data.
 *
 * Scenarios:
 *
 * 1. `locomote` to a resolvable point travels the gait that far at the actor's
 *    speed (a non-looping clip whose length is the covered cycles); a turned
 *    actor's travel is baked in model space so it reaches the world destination
 *    once the renderer applies its staged facing.
 * 2. `locomote` to a relative target (no positional point) ??or to its own spot ?? *    steps in place: the looping one-cycle gait.
 * 3. An unmatched gait, a non-synthesised verb, and an unknown actor ??null.
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

  // 1b. a turned actor's travel is baked in *model* space: the renderer applies
  // the pose root under the node's staged facing, so composing that facing with
  // the baked root must reach the world destination ??not a path rotated off
  // the heading. Facing +90째, walking to a point 5 m along world +X.
  const turned = makeActorSynthesizer(
    new Map<string, IautomovieActorContext>([
      ["hero", { ...ctx, facingDeg: 90 }],
    ]),
    nodes,
  );
  const worldDest: IautomovieVector3 = { x: 5, y: 0, z: 0 };
  const turnedTrip = turned(
    locomote("walk", { kind: "point", point: worldDest }),
    "hero",
  )!;
  const finalRoot = sampleMotion(turnedTrip, turnedTrip.duration).pose.root!
    .translation;
  const rendered = Quaternion.rotateVector(
    Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 90),
    finalRoot,
  );
  TestValidator.predicate(
    "a turned actor's baked travel, under its facing, reaches the world destination",
    vclose(rendered, worldDest, 1e-9),
  );

  // 2a. relative target ??step in place (looping one-cycle gait)
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

  // 2b. destination at the actor's own spot ??also steps in place
  const here = synth(locomote("walk", { kind: "node", node: "here" }), "hero");
  TestValidator.equals("already-there steps in place", here!.id, "hero:walk");

  // 3. null branches
  TestValidator.equals(
    "an unmatched gait ??null",
    synth(locomote("run", door), "hero"),
    null,
  );
  TestValidator.equals(
    "an arm/combat gesture ??null (left to a richer synthesiser)",
    synth(gesture, "hero"),
    null,
  );
  const bow = synth(
    { verb: "gesture", kind: "bow", actor: "hero", start: 0, duration: "auto" },
    "hero",
  );
  TestValidator.predicate(
    "a postural gesture (bow, auto duration) synthesises a 1 s clip",
    bow !== null && nclose(bow.duration, 1),
  );
  const nod = synth(
    { verb: "gesture", kind: "nod", actor: "hero", start: 0, duration: 2 },
    "hero",
  );
  TestValidator.predicate(
    "an explicit gesture duration is honoured (a 2 s nod)",
    nod !== null && nclose(nod.duration, 2),
  );
  TestValidator.equals(
    "a verb with no reference synthesis (attachTo) ??null",
    synth(
      {
        verb: "attachTo",
        actor: "hero",
        start: 0,
        duration: 1,
        parent: "cart",
        bone: "hips",
      },
      "hero",
    ),
    null,
  );
  TestValidator.equals(
    "an unknown actor ??null",
    synth(locomote("walk", door), "ghost"),
    null,
  );

  // 4. hold + end-to-end compile
  const held = synth(hold(0), "hero");
  TestValidator.predicate("hold spans its duration", nclose(held!.duration, 1));
  TestValidator.equals("hold targets the skeleton", held!.skeleton, "h");

  // 5. emote ??an expression-only face clip (explicit duration and "auto")
  const face = synth(emote(2), "hero")!;
  TestValidator.predicate("emote spans its duration", nclose(face.duration, 2));
  TestValidator.equals(
    "emote carries no body joints",
    face.keyframes[0]!.pose.joints.length,
    0,
  );
  TestValidator.predicate(
    "emote carries the expression",
    face.keyframes[0]!.expression !== null &&
      face.keyframes[0]!.expression.preset === "happy",
  );
  TestValidator.predicate(
    "emote auto-duration falls back to 1s",
    nclose(synth(emote("auto"), "hero")!.duration, 1),
  );

  // 6. lookAt ??the head turned toward the target
  const look = synth(lookAt(door, 1), "hero")!;
  const headJoint = look.keyframes[0]!.pose.joints.find(
    (j) => j.bone === "head",
  )!;
  const expectedFlex = (-Math.atan2(-1.6, 5) * 180) / Math.PI;
  TestValidator.predicate(
    "lookAt tilts the head down toward the lower target",
    nclose(headJoint.flexion!, expectedFlex),
  );
  TestValidator.predicate(
    "a target dead ahead needs no head yaw",
    nclose(headJoint.twist!, 0),
  );
  TestValidator.equals(
    "a relative lookAt target ??null",
    synth(lookAt({ kind: "direction", headingDeg: 90 }, 1), "hero"),
    null,
  );
  TestValidator.predicate(
    "lookAt auto-duration falls back to 1s",
    nclose(synth(lookAt(door, "auto"), "hero")!.duration, 1),
  );

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
