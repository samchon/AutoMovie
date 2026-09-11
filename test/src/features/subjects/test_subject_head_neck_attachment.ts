import { TestValidator } from "@nestia/e2e";

import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import {
  appendPortraitCranium,
  appendPortraitNeck,
} from "../../subjects/generated-korean-girl-01/cranium";

/**
 * The cranial underside and neck owe one connected, consistently wound skin.
 * This pins attachment topology independently of a flattering render.
 *
 * Scenarios:
 * 1. Close the measured facial patch with the authored cranium. Its only free
 *    edges must be the returned collar, with the nape above the throat.
 * 2. Append the neck and check that every collar edge now has two oppositely
 *    wound incident faces. The only remaining free loop is the lower crop.
 * 3. Every triangle has positive area and every label has a corresponding face;
 *    no ring may collapse, invert its neighbour or create a third incident face.
 */
export const test_subject_head_neck_attachment = (): void => {
  const cage = {
    positions: referenceControlNet.positions
      .slice(0, 468)
      .map((point) => [...point]),
    indices: [...referenceControlNet.indices],
    groups: new Array<number>(referenceControlNet.indices.length / 3).fill(0),
  };
  const edges = (): Map<
    string,
    { count: number; direction: number; a: number; b: number }
  > => {
    const result = new Map<
      string,
      { count: number; direction: number; a: number; b: number }
    >();
    for (let i = 0; i < cage.indices.length; i += 3)
      for (let j = 0; j < 3; j++) {
        const a = cage.indices[i + j],
          b = cage.indices[i + ((j + 1) % 3)];
        const key = `${Math.min(a, b)}/${Math.max(a, b)}`;
        const edge = result.get(key) ?? { count: 0, direction: 0, a, b };
        edge.count++;
        edge.direction += a < b ? 1 : -1;
        result.set(key, edge);
      }
    return result;
  };
  const attachment = appendPortraitCranium(cage);
  const collar = attachment.boundary;
  const rootIds = new Set(collar);
  const opening = [...edges().values()].filter((edge) => edge.count === 1);
  TestValidator.equals(
    "one collar without repeated corners",
    rootIds.size,
    collar.length,
  );
  TestValidator.equals(
    "only the collar is open",
    opening.length,
    collar.length,
  );
  TestValidator.predicate(
    "every free edge belongs to the collar",
    opening.every((edge) => rootIds.has(edge.a) && rootIds.has(edge.b)),
  );
  const rootPoints = collar.map((id) => cage.positions[id]);
  const front = rootPoints.reduce((a, b) => (a[2] > b[2] ? a : b));
  const back = rootPoints.reduce((a, b) => (a[2] < b[2] ? a : b));
  TestValidator.predicate("nape attaches above throat", back[1] > front[1]);
  TestValidator.predicate(
    "throat starts below the measured chin",
    front[1] <= referenceControlNet.positions[152][1],
  );

  const firstNeckRow = cage.positions.length;
  appendPortraitNeck(cage, attachment);
  const frontIndex = rootPoints.indexOf(front);
  TestValidator.predicate(
    "first neck guide continues below the chin",
    cage.positions[firstNeckRow + frontIndex][1] <= front[1],
  );
  const joined = [...edges().values()];
  TestValidator.predicate(
    "opposite winding at every joined edge",
    joined.every(
      (edge) => edge.count === 1 || (edge.count === 2 && edge.direction === 0),
    ),
  );
  const free = joined.filter((edge) => edge.count === 1);
  TestValidator.equals("one lower loop", free.length, collar.length);
  TestValidator.predicate(
    "only lower crop remains open",
    free.every(
      (edge) =>
        cage.positions[edge.a][1] === -150 &&
        cage.positions[edge.b][1] === -150,
    ),
  );
  TestValidator.equals(
    "face labels stay aligned",
    cage.groups.length * 3,
    cage.indices.length,
  );
  let minimumAreaSquared = Infinity;
  for (let i = 0; i < cage.indices.length; i += 3) {
    const [a, b, c] = cage.indices
      .slice(i, i + 3)
      .map((id) => cage.positions[id]);
    const u = b.map((value, axis) => value - a[axis]);
    const v = c.map((value, axis) => value - a[axis]);
    minimumAreaSquared = Math.min(
      minimumAreaSquared,
      (u[1] * v[2] - u[2] * v[1]) ** 2 +
        (u[2] * v[0] - u[0] * v[2]) ** 2 +
        (u[0] * v[1] - u[1] * v[0]) ** 2,
    );
  }
  TestValidator.predicate("no collapsed triangles", minimumAreaSquared > 0);
};
