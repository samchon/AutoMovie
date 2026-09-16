import {
  type IPortraitComponentHost,
  buildPortraitHead,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";
import {
  skinColourComponent,
  skinColourFinisher,
} from "../internal/skinColourComponent";

/**
 * Two independently admissible cages must still retain exact vertex/face IDs.
 *
 * Scenarios:
 * 1. An extra unused coordinate, equivalent rotated winding, and a fan using
 *    an existing unused coordinate each form valid skin but refuse transport.
 * 2. A different registered triangle label refuses even with equal geometry.
 */
export const test_subject_skin_colour_topology = (): void => {
  const { host } = humanFaceFixture().basis;
  const references: IPortraitComponentHost[] = [];
  const extra = structuredClone(host);
  extra.positions.push([0, 0, 0]);
  references.push(extra);
  const rotate = structuredClone(host),
    [a, b, c] = rotate.indices.slice(0, 3);
  rotate.indices.splice(0, 3, b, c, a);
  references.push(rotate);
  const fan = structuredClone(host),
    used = new Set(host.indices);
  const center = host.positions.findIndex((_, i) => !used.has(i));
  TestValidator.predicate("unused fan centre arranged", center >= 0);
  fan.positions[center] = [0, 1, 2].map(
    (axis) =>
      (host.positions[a][axis] +
        host.positions[b][axis] +
        host.positions[c][axis]) /
      3,
  );
  fan.indices.splice(0, 3, a, b, center, b, c, center, c, a, center);
  references.push(fan);
  for (const reference of references) {
    TestValidator.predicate(
      "independently admissible",
      buildPortraitHead(reference, [], 0).parts.length > 0,
    );
    TestValidator.predicate(
      "different correspondence refuses",
      throwsError(
        () =>
          buildPortraitHead(host, [], 0, [], {
            appearance: {
              host: reference,
              components: [],
              sample: () => [1, 1, 1],
            },
          }),
        "share control topology",
      ),
    );
  }
  const labelled = (change: boolean) =>
    skinColourComponent((cage, _s, register) => {
      const group = register("region", "skin");
      if (change) cage.groups[0] = group;
      return skinColourFinisher();
    });
  TestValidator.predicate(
    "changed region label",
    throwsError(
      () =>
        buildPortraitHead(host, [labelled(false)], 0, [], {
          appearance: {
            host,
            components: [labelled(true)],
            sample: () => [1, 1, 1],
          },
        }),
      "share control topology",
    ),
  );
};
