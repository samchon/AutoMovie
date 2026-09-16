import {
  type IControlMesh,
  type IPortraitRegionReplacement,
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
 * A deferred patch receives paired sampled geometry and material coordinates.
 *
 * Scenarios:
 * 1. A raised current patch and flat reference patch append matching IDs;
 *    colour samples the flat reference rather than the raised current centre.
 * 2. Different replacement counts/groups or appended topology refuse.
 * 3. A malformed appended face-label population is refused after pairing.
 */
export const test_subject_skin_colour_replacement = (): void => {
  const { host } = humanFaceFixture().basis;
  const patch = (rise: number, mutate: (mesh: IControlMesh) => void) =>
    skinColourComponent((cage, _source, region) => {
      const group = region("patch", "skin");
      cage.groups[0] = group;
      const append: IPortraitRegionReplacement["append"] = (mesh, boundary) => {
        const center = [0, 1, 2].map(
          (axis) =>
            boundary.reduce((s, id) => s + mesh.positions[id][axis], 0) /
            boundary.length,
        );
        center[2] += rise;
        const id = mesh.positions.push(center) - 1;
        for (let i = 0; i < boundary.length; i++) {
          mesh.indices.push(
            boundary[i],
            boundary[(i + 1) % boundary.length],
            id,
          );
          mesh.groups.push(group);
        }
        mutate(mesh);
      };
      return { ...skinColourFinisher(), replacements: [{ group, append }] };
    });
  const identity = (_: IControlMesh) => {};
  const original = patch(0, identity),
    current = patch(4, identity);
  const assemble = (a: typeof current, b: typeof current) =>
    buildPortraitHead(host, [a], 0, [], {
      appearance: {
        host,
        components: [b],
        sample: (p) => [0.5 + p[2] / 1000, 0.5, 0.5],
      },
    });
  const paired = assemble(current, original),
    last = paired.refined.positions.length - 1;
  TestValidator.predicate(
    "paired displaced patch",
    Math.abs(
      paired.refined.positions[last][2] -
        paired.refined.reference![last][2] -
        4,
    ) < 1e-10,
  );
  TestValidator.predicate(
    "samples reference",
    Math.abs(
      paired.refined.colors![last][0] -
        (0.5 + paired.refined.reference![last][2] / 1000),
    ) < 1e-10,
  );
  const noReplacement = skinColourComponent((cage, _s, region) => {
    cage.groups[0] = region("patch", "skin");
    return skinColourFinisher();
  });
  TestValidator.predicate(
    "replacement count",
    throwsError(
      () => assemble(current, noReplacement),
      "replacement identities",
    ),
  );
  const wrongRegion = {
    ...original,
    fit: (basis: typeof host) => {
      const plan = original.fit(basis);
      return {
        ...plan,
        attach: (...args: Parameters<typeof plan.attach>) => {
          const attached = plan.attach(...args);
          return {
            ...attached,
            replacements: attached.replacements!.map((r) => ({
              ...r,
              group: 0,
            })),
          };
        },
      };
    },
  };
  TestValidator.predicate(
    "replacement group",
    throwsError(() => assemble(current, wrongRegion), "replacement regions"),
  );
  const corruptions = [
    (mesh: IControlMesh) => {
      mesh.positions.push([0, 0, 0]);
    },
    (mesh: IControlMesh) => {
      mesh.indices.push(...mesh.indices.slice(-3));
      mesh.groups.push(mesh.groups[mesh.groups.length - 1]);
    },
    (mesh: IControlMesh) => {
      const i = mesh.indices.length - 3;
      [mesh.indices[i], mesh.indices[i + 1]] = [
        mesh.indices[i + 1],
        mesh.indices[i],
      ];
    },
    (mesh: IControlMesh) => {
      mesh.groups.pop();
    },
    (mesh: IControlMesh) => {
      mesh.groups[mesh.groups.length - 1] = 0;
    },
  ];
  for (const corrupt of corruptions)
    TestValidator.predicate(
      "paired appended topology",
      throwsError(
        () => assemble(current, patch(0, corrupt)),
        "share control topology",
      ),
    );
};
