import { type IPortraitComponent, buildPortraitHead } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";
import {
  skinColourComponent,
  skinColourFinisher,
} from "../internal/skinColourComponent";

/**
 * Colour transport refuses a different component, region or refinement basis.
 *
 * Scenarios:
 * 1. Same identities and white sampling retain one ordinary skin part.
 * 2. A different component count/order, region count/name/material or closed
 *    curve population refuses instead of borrowing unrelated reference points.
 * 3. Malformed/out-of-range sampler output cannot enter a rendered buffer.
 */
export const test_subject_skin_colour_assembly = (): void => {
  const { host } = humanFaceFixture().basis;
  const part = skinColourComponent(skinColourFinisher);
  const build = (
    current: IPortraitComponent[],
    reference: IPortraitComponent[],
    sample = (_: readonly number[]) => [1, 1, 1],
  ) =>
    buildPortraitHead(host, current, 0, [], {
      appearance: { host, components: reference, sample },
    });
  TestValidator.predicate(
    "white reference builds",
    build([part], [part]).parts.length > 0,
  );
  TestValidator.predicate(
    "component count",
    throwsError(() => build([part], []), "component identities"),
  );
  const second = { ...part, id: "second" };
  TestValidator.predicate(
    "component order",
    throwsError(
      () => build([part, second], [second, part]),
      "component identities",
    ),
  );
  const region = (name: string, material: string) =>
    skinColourComponent((_c, _s, register) => {
      register(name, material);
      return skinColourFinisher();
    });
  TestValidator.predicate(
    "region count",
    throwsError(
      () => build([part], [region("spare", "skin")]),
      "region identities",
    ),
  );
  TestValidator.predicate(
    "region identity",
    throwsError(
      () => build([region("a", "skin")], [region("b", "skin")]),
      "region identities",
    ),
  );
  TestValidator.predicate(
    "region material",
    throwsError(
      () => build([region("a", "skin")], [region("a", "lip")]),
      "region identities",
    ),
  );
  const triangle = host.indices.slice(0, 3);
  const curved = (curves: number[][]) =>
    skinColourComponent(() => ({ ...skinColourFinisher(), curves }));
  TestValidator.predicate(
    "same closed curve builds",
    build([curved([triangle])], [curved([triangle])]).parts.length > 0,
  );
  for (const curves of [
    [],
    [triangle.slice(0, 2)],
    [[triangle[1], triangle[2], triangle[0]]],
  ])
    TestValidator.predicate(
      "curve correspondence",
      throwsError(
        () => build([curved([triangle])], [curved(curves)]),
        "subdivision curves",
      ),
    );
  for (const rgb of [
    [1, 1],
    [NaN, 1, 1],
    [-0.1, 1, 1],
    [1.1, 1, 1],
  ])
    TestValidator.predicate(
      "sampler RGB admission",
      throwsError(() => build([], [], () => rgb), "finite linear RGB"),
    );
};
