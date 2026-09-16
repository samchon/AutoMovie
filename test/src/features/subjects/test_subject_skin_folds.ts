import { createPortraitSkinLayer } from "@automovie/human/components/skin";
import { TestValidator } from "@nestia/e2e";

import { portraitSkinFixture } from "../internal/portraitSkinFixture";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Resting folds and unilateral performance use distinct anatomical drivers.
 *
 * Scenarios:
 * 1. The middle forehead fold sample is at (0,37,18.5) mm on z=y/2,
 *    with a 0.65 mm valley; every named static family emits negative relief.
 * 2. Taut neutral skin has no dynamic folds. A left blink creases only the
 *    left outer canthus; elevated/furrowed brows, smile and pucker add folds.
 * 3. Off-silhouette samples clip; malformed, absent or degenerate bindings refuse.
 */
export const test_subject_skin_folds = (): void => {
  const f = portraitSkinFixture();
  const forehead = createPortraitSkinLayer(f.bindings, {
    ...f.zero,
    forehead: 1,
  }).fields(f.host);
  const mid = forehead.find(
    (c) => nclose(c.center.x, 0) && nclose(c.center.y, 0.037),
  );
  TestValidator.predicate(
    "independent forehead centre",
    mid !== undefined &&
      nclose(mid.center.z, 0.0185) &&
      nclose(mid.displacement.z, -0.00065),
  );
  for (const region of [
    "glabella",
    "crowFeet",
    "lowerLid",
    "nasolabial",
    "marionette",
    "perioral",
  ] as const) {
    const fields = createPortraitSkinLayer(f.bindings, {
      ...f.zero,
      [region]: 1,
    }).fields(f.host);
    TestValidator.predicate(
      "resting family has negative relief",
      fields.length > 0 && fields.every((c) => c.displacement.z < 0),
    );
  }
  const dynamic = { ...f.zero, laxity: 0, expressionCreasing: 1 };
  TestValidator.equals(
    "taut neutral has no folds",
    createPortraitSkinLayer(f.bindings, dynamic).fields(f.host),
    [],
  );
  const blink = createPortraitSkinLayer(f.bindings, dynamic, {
    blink: { left: 1, right: 0 },
  }).fields(f.host);
  TestValidator.predicate(
    "left blink outside left eye",
    blink.length > 0 &&
      blink.every((c) => c.center.x > 0.04 && c.displacement.z < 0),
  );
  const performed = createPortraitSkinLayer(f.bindings, dynamic, {
    browRaise: { left: 4, right: -2 },
    smile: { left: 4, right: -1 },
    pucker: 2,
  }).fields(f.host);
  TestValidator.predicate(
    "performance drives several regions",
    performed.some((c) => c.center.y > 0.03) &&
      performed.some((c) => c.center.x < 0) &&
      performed.some((c) => c.center.y < -0.01),
  );
  const clipped = {
    ...f.host,
    positions: f.host.positions.map((p, i) =>
      i < 4 ? [p[0] * 0.05, p[1] * 0.01, p[2] * 0.01] : p,
    ),
  };
  TestValidator.equals(
    "outside actual skin clips",
    createPortraitSkinLayer(f.bindings, { ...f.zero, underEyeBag: 1 }).fields(
      clipped,
    ),
    [],
  );
  for (const id of [-1, 0.5, 1000]) {
    const bad = structuredClone(f.bindings);
    bad.mouth.upper[0] = id;
    TestValidator.predicate(
      "invalid attachment refuses",
      throwsError(() => createPortraitSkinLayer(bad, dynamic).fields(f.host)),
    );
  }
  for (const datum of [
    [1, 2],
    [NaN, 2, 3],
  ]) {
    const host = structuredClone(f.host);
    host.positions[f.bindings.mouth.upper[0]] = datum;
    TestValidator.predicate(
      "invalid coordinate refuses",
      throwsError(() =>
        createPortraitSkinLayer(f.bindings, dynamic).fields(host),
      ),
    );
  }
  const empty = structuredClone(f.bindings);
  empty.eyes.left.bottom = [0];
  TestValidator.predicate(
    "short boundary refuses",
    throwsError(() => createPortraitSkinLayer(empty, dynamic).fields(f.host)),
  );
  const collapsed = structuredClone(f.bindings);
  collapsed.eyes.right.top = [0, 0];
  TestValidator.predicate(
    "collapsed eye refuses",
    throwsError(() =>
      createPortraitSkinLayer(collapsed, dynamic).fields(f.host),
    ),
  );
};
