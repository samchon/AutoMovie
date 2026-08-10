import { forgeProp, placementChildNode, sceneToNodes } from "@automovie/engine";
import { IAutoMovieNode, IAutoMoviePropSpec } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation } from "../internal/predicates";
import { createDoorPropSpec } from "./test_film_forge_prop";

/** The door spec with `mutate` applied to its articulation node list. */
const withNodes = (
  mutate: (nodes: IAutoMovieNode[]) => IAutoMovieNode[],
): IAutoMoviePropSpec => {
  const spec = createDoorPropSpec();
  return {
    ...spec,
    articulation: {
      ...spec.articulation!,
      nodes: mutate([...spec.articulation!.nodes]),
    },
  };
};

/** Give the joint at `index` the mesh `part`. */
const drives = (index: number, part: string): IAutoMoviePropSpec =>
  withNodes((nodes) =>
    nodes.map((node, i) => (i === index ? { ...node, mesh: part } : node)),
  );

/**
 * A prop joint may name the part it drives, and `forgeProp` holds that name to
 * the prop's own model.
 *
 * The reference is what makes a declared joint visible: a hinge that names no
 * part turns an empty frame while the leaf stands still, so a shot renders a
 * door that validated clean and never opened. The gate therefore has to catch
 * the two ways the name can be wrong before the frame does, and it has to leave
 * the lowered id alone, because the id is what a shot's `objectMotions` channel
 * and the viewer's lookup both spell.
 *
 * Scenarios:
 *
 * 1. The hinge driving the model's own `panel` part forges, and the lowered scene
 *    id of that joint is the placement child `sceneToNodes` writes.
 * 2. A joint naming a part the model does not declare is a `type` violation at
 *    that joint's own `mesh` path, and no other joint is blamed.
 * 3. Two joints claiming one part violate at the SECOND claim, naming the first; a
 *    part rides one frame.
 * 4. Every joint leaving `mesh` null still forges, which is the contract every
 *    prop authored before the reference existed was written against.
 */
export const test_film_forge_prop_articulation_mesh = (): void => {
  const driven = drives(1, "panel");
  const forged = forgeProp(driven);
  TestValidator.equals(
    "a hinge driving a declared part forges",
    forged.success,
    true,
  );
  const lowered = sceneToNodes({
    scene: {
      id: "hall",
      name: null,
      nodes: [
        {
          id: "frontDoor",
          model: "door",
          transform: {
            translation: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
          motion: null,
          pose: null,
        },
      ],
      cameras: [],
      lights: [],
    },
    props: { door: driven },
  });
  TestValidator.equals(
    "the driving joint lowers under the placement, carrying its part",
    lowered
      .filter((node) => node.mesh !== null)
      .map((node) => [node.id, node.mesh]),
    [[placementChildNode("frontDoor", "hinge"), "panel"]],
  );

  const unknown = forgeProp(drives(1, "sash"));
  TestValidator.predicate(
    "a joint driving a part the model does not declare violates",
    hasViolation(unknown, "type", "$input.articulation.nodes[1].mesh"),
  );
  TestValidator.equals(
    "only the joint that named it is blamed",
    unknown.success === false
      ? unknown.violations.filter((violation) =>
          violation.path.endsWith(".mesh"),
        ).length
      : 0,
    1,
  );

  const twice = forgeProp(
    withNodes((nodes) =>
      nodes.map((node, i) =>
        i === 1 || i === 2 ? { ...node, mesh: "panel" } : node,
      ),
    ),
  );
  TestValidator.predicate(
    "a part claimed by two joints violates at the second claim",
    hasViolation(twice, "type", "$input.articulation.nodes[2].mesh"),
  );
  TestValidator.predicate(
    "the refusal names the joint that claimed it first",
    twice.success === false &&
      twice.violations.some((violation) =>
        violation.expected.includes("$input.articulation.nodes[1]"),
      ),
  );

  TestValidator.equals(
    "a prop whose joints drive nothing still forges",
    forgeProp(createDoorPropSpec()).success,
    true,
  );
};
