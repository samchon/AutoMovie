import { compileLaunch, projectileAt } from "@autofilm/engine";
import { IAutoFilmLaunchAction, IAutoFilmVector3 } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose } from "../internal/predicates";

/** A launch action carrying the fields `compileLaunch` reads. */
const launch = (
  over: Partial<IAutoFilmLaunchAction> = {},
): IAutoFilmLaunchAction => ({
  verb: "launch",
  actor: "archer",
  projectile: "arrow",
  at: { kind: "node", node: "foe" },
  speed: 20,
  start: 0.5,
  duration: "auto",
  ...over,
});

/**
 * `compileLaunch` — compose the `launch` verb's primitives into a projectile
 * flight plus the target's scheduled reaction. The contract: the baked flight
 * lands on the target, the reaction is scheduled at the computed contact (not a
 * hand-timed one), and its `from` recoils the body along the shot's travel.
 *
 * Scenarios:
 *
 * 1. A direct shot at a downrange target compiles: the clip is the projectile
 *    node's flight, its last position sits on the target, and the solved launch
 *    speed matches the request.
 * 2. With `onHit`, the emitted `react` targets the struck node, starts at
 *    `action.start + hitTime` (the computed contact, offset by the launch's own
 *    start), and carries the force/unbalance through.
 * 3. The react's `from` sits upstream of the incoming velocity, so `target − from`
 *    points down the arrow's travel — the body is knocked the way the arrow
 *    flew, not toward the shooter.
 * 4. Without `onHit`, no reaction is scheduled (`react` is null).
 * 5. The lobbed `high` arc reaches the same target with a longer flight than the
 *    flat `direct` arc.
 * 6. A target out of range at the given speed → null (nothing to fly).
 * 7. A vertical lob to exactly its apex (under a custom gravity) arrives with zero
 *    speed — the degenerate case where the incoming direction falls back to the
 *    sightline, so the reaction still has a well-formed `from`.
 * 8. With `targetAt`, the aim **leads a moving target**: against a foe sliding
 *    downrange, the baked flight lands where the target will be — past its start
 *    point — and the react is still timed to the computed contact.
 */
export const test_film_launch = (): void => {
  const origin: IAutoFilmVector3 = { x: 0, y: 1.6, z: 0 };
  const target: IAutoFilmVector3 = { x: 12, y: 1.4, z: 0 };

  const hit = compileLaunch({
    action: launch({ onHit: { force: 0.7, unbalance: true } }),
    origin,
    target,
    targetNode: "foe",
  })!;

  // 1. the flight lands on the target, at the requested speed
  TestValidator.equals(
    "the flight is the projectile node's clip",
    hit.clip.id,
    "trajectory:arrow",
  );
  const values = hit.clip.tracks[0]!.values;
  TestValidator.predicate(
    "the baked flight ends on the target",
    vclose(
      {
        x: values[values.length - 3]!,
        y: values[values.length - 2]!,
        z: values[values.length - 1]!,
      },
      target,
      2e-3,
    ),
  );
  TestValidator.predicate(
    "the hit point is the target",
    vclose(hit.hitPoint, target, 2e-3),
  );
  TestValidator.predicate(
    "launch speed matches the request",
    nclose(
      Math.hypot(hit.velocity.x, hit.velocity.y, hit.velocity.z),
      20,
      1e-9,
    ),
  );
  TestValidator.predicate("a positive flight time", hit.hitTime > 0);

  // 2. the reaction is scheduled at the computed contact
  const react = hit.react!;
  TestValidator.equals("the struck node reacts", react.actor, "foe");
  TestValidator.equals("react verb", react.verb, "react");
  TestValidator.predicate(
    "react starts at launch.start + hitTime",
    nclose(react.start, 0.5 + hit.hitTime),
  );
  TestValidator.equals("force carried through", react.force, 0.7);
  TestValidator.equals("unbalance carried through", react.unbalance, true);

  // 3. `from` sits upstream of the incoming velocity — the body is knocked the
  // way the arrow flew, not toward the shooter. `hitPoint − from` reconstructs
  // the incoming direction exactly (from = hitPoint − normalize(v(hit))), and
  // it runs downrange (+x, no lateral drift for this in-plane shot).
  const from = react.from.kind === "point" ? react.from.point : null;
  TestValidator.predicate("react.from is a world point", from !== null);
  const knock: IAutoFilmVector3 = {
    x: hit.hitPoint.x - from!.x,
    y: hit.hitPoint.y - from!.y,
    z: hit.hitPoint.z - from!.z,
  };
  TestValidator.predicate(
    "the recoil runs downrange (+x), no lateral drift",
    knock.x > 0 && Math.abs(knock.z) < 1e-9,
  );
  const vHit = projectileAt(
    { origin, velocity: hit.velocity, gravity: { x: 0, y: -9.81, z: 0 } },
    hit.hitTime,
  ).velocity;
  const vLen = Math.hypot(vHit.x, vHit.y, vHit.z);
  TestValidator.predicate(
    "the recoil direction is exactly the incoming velocity's",
    vclose(
      knock,
      { x: vHit.x / vLen, y: vHit.y / vLen, z: vHit.z / vLen },
      1e-9,
    ),
  );
  TestValidator.predicate(
    "and it noses downward (a lobbed hit comes down)",
    knock.y < 0,
  );

  // 4. no onHit → no scheduled reaction
  const quiet = compileLaunch({
    action: launch(),
    origin,
    target,
    targetNode: "foe",
  })!;
  TestValidator.equals("no onHit → no react", quiet.react, null);

  // 4b. an onHit aimed at a point (no single actor) still flies, but schedules
  // no reaction — there is no node to recoil.
  const pointed = compileLaunch({
    action: launch({ onHit: { force: 0.9 } }),
    origin,
    target,
    targetNode: null,
  })!;
  TestValidator.equals("a nodeless target → no react", pointed.react, null);
  TestValidator.predicate(
    "but the flight still bakes",
    pointed.clip.id === "trajectory:arrow" &&
      vclose(pointed.hitPoint, target, 2e-3),
  );

  // 5. the high arc flies longer than the direct arc to the same target
  const direct = compileLaunch({
    action: launch(),
    origin,
    target,
    targetNode: "foe",
  })!;
  const high = compileLaunch({
    action: launch(),
    origin,
    target,
    targetNode: "foe",
    arc: "high",
  })!;
  TestValidator.predicate(
    "the high arc flies longer than the direct arc",
    high.hitTime > direct.hitTime,
  );
  TestValidator.predicate(
    "the high arc also lands on the target",
    vclose(high.hitPoint, target, 2e-3),
  );

  // 6. out of range → null
  TestValidator.equals(
    "a target out of range → null",
    compileLaunch({
      action: launch({ speed: 4 }),
      origin,
      target: { x: 200, y: 1.4, z: 0 },
      targetNode: "foe",
    }),
    null,
  );

  // 7. a vertical lob to exactly its apex under a custom gravity: speed 10,
  // g = 8 → apex 100/16 = 6.25 m (all exact in float), where the projectile
  // arrives with zero velocity. The incoming direction degenerates, so `from`
  // falls back to the sightline (straight up), one meter below the target.
  const apex = compileLaunch({
    action: launch({ speed: 10, onHit: { force: 0.5 } }),
    origin: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 6.25, z: 0 },
    targetNode: "foe",
    gravity: { x: 0, y: -8, z: 0 },
  })!;
  TestValidator.predicate(
    "the apex lob lands on the target",
    vclose(apex.hitPoint, { x: 0, y: 6.25, z: 0 }, 1e-6),
  );
  TestValidator.predicate(
    "the apex-lob react.from falls back to the sightline",
    apex.react!.from.kind === "point" &&
      vclose(apex.react!.from.point, { x: 0, y: 5.25, z: 0 }, 1e-6),
  );
  TestValidator.equals(
    "onHit without unbalance carries undefined through",
    apex.react!.unbalance,
    undefined,
  );

  // 8. leading a MOVING target: with `targetAt` sampling a foe sliding downrange
  // (+x at 4 m/s from x = 10), the aim leads it — the baked flight lands where
  // the target WILL be (targetAt(hitTime)), past its start point, and the react
  // is still timed to the computed contact.
  const startAt: IAutoFilmVector3 = { x: 10, y: 1.4, z: 0 };
  const slide = (t: number): IAutoFilmVector3 => ({
    x: startAt.x + 4 * t,
    y: startAt.y,
    z: startAt.z,
  });
  const led = compileLaunch({
    action: launch({ speed: 24, onHit: { force: 0.6 } }),
    origin,
    target: startAt,
    targetNode: "foe",
    targetAt: slide,
  })!;
  TestValidator.predicate(
    "the led flight lands where the moving target will be",
    vclose(led.hitPoint, slide(led.hitTime), 2e-3),
  );
  TestValidator.predicate(
    "leading a +x mover aims past its start point",
    led.hitPoint.x > startAt.x + 1e-3,
  );
  TestValidator.predicate(
    "the moving-target react is timed to the computed contact",
    led.react !== null && nclose(led.react.start, 0.5 + led.hitTime),
  );
};
