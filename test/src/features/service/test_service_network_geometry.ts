import {
  serviceEnvelopeObstructions,
  serviceMaintenanceBounds,
  serviceSegmentBounds,
  serviceSegmentClashes,
  serviceSegmentSpanBounds,
  validateServiceNetwork,
} from "@automovie/engine";
import { IAutoMoviePropBox } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  hasViolation,
  namedFacts,
  throwsError,
  vclose,
  violationCount,
} from "../internal/predicates";
import {
  segment,
  serviceEnvironment,
  serviceNetwork,
  withNode,
  withPort,
  withSegment,
  withSleeve,
} from "../internal/serviceFixtures";

const box = (
  min: [number, number, number],
  max: [number, number, number],
): IAutoMoviePropBox => ({
  min: { x: min[0], y: min[1], z: min[2] },
  max: { x: max[0], y: max[1], z: max[2] },
});

/**
 * Interference is decided span by span, and that decision is the whole reason a
 * run carries a radius.
 *
 * One box around a whole polyline is not a pipe. A run that drops out of a
 * fixture, turns along a floor and crosses a building would claim the entire
 * cuboid those three legs span, so every other discipline in the room would
 * report as clashing with it and the finding that mattered would be buried.
 * This case pins the per-leg volume by hand arithmetic, then proves the two
 * things built on it: that runs meeting at a fitting are exempt while runs
 * merely sharing a lane are not, and that a maintenance envelope is a volume a
 * run may not cross even when nothing is physically joined.
 *
 * Scenarios:
 *
 * 1. A straight run's overall bound is its extremes grown by its own radius, and a
 *    run with no route has no bound to give rather than a silent empty one.
 * 2. A three-point run yields two per-leg boxes, each the extremes of that leg
 *    alone; a one-point route yields none.
 * 3. A maintenance envelope is the node-local box offset by the node's own
 *    position, and a node that declares none has none.
 * 4. Obstruction is interior overlap: a box inside an envelope intrudes, a box
 *    meeting it exactly on a face does not, a box spanning two envelopes names
 *    both in declaration order, and a distant box names nothing.
 * 5. The clean fixture has no clash, and a run moved into another discipline's
 *    lane produces exactly one — reported once, from the earlier-declared run.
 * 6. Runs that meet at a shared fitting never clash even where their volumes
 *    plainly overlap, which is what keeps a tee's three legs quiet.
 * 7. A run crossing an equipment access volume it is not joined to is refused, and
 *    the run feeding that equipment is not.
 */
export const test_service_network_geometry = (): void => {
  const environment = serviceEnvironment();
  const network = serviceNetwork();
  const coldRun = network.segments[0]!;
  const coldBranch = network.segments[1]!;

  const overall = serviceSegmentBounds(coldRun);
  TestValidator.predicate(
    "a run's overall bound is its extremes grown by its radius",
    vclose(overall.min, { x: 3.475, y: 2.475, z: 0.975 }, 1e-12) &&
      vclose(overall.max, { x: 8.025, y: 2.525, z: 1.025 }, 1e-12),
  );
  TestValidator.predicate(
    "a run with no route has no bound to give",
    throwsError(
      () => serviceSegmentBounds(segment({ id: "ghost", route: [] })),
      ['"ghost" has no route'],
    ),
  );

  const spans = serviceSegmentSpanBounds(coldBranch);
  TestValidator.predicate(
    "each leg of a turning run carries its own volume",
    spans.length === 2 &&
      vclose(spans[0]!.min, { x: 0.98, y: 2.48, z: 0.98 }, 1e-12) &&
      vclose(spans[0]!.max, { x: 3.52, y: 2.52, z: 1.02 }, 1e-12) &&
      vclose(spans[1]!.min, { x: 0.98, y: 0.88, z: 0.98 }, 1e-12) &&
      vclose(spans[1]!.max, { x: 1.02, y: 2.52, z: 1.02 }, 1e-12) &&
      serviceSegmentSpanBounds(segment({ route: [{ x: 1, y: 2, z: 3 }] }))
        .length === 0,
  );

  const ahu = serviceMaintenanceBounds(network.nodes[5]!);
  TestValidator.predicate(
    "an access volume travels with the equipment that needs it",
    ahu !== null &&
      vclose(ahu.min, { x: 7.5, y: 0.2, z: 4 }, 1e-12) &&
      vclose(ahu.max, { x: 8.5, y: 3, z: 5 }, 1e-12) &&
      serviceMaintenanceBounds(network.nodes[9]!) === null,
  );

  TestValidator.equals(
    "obstruction is interior overlap, not contact",
    namedFacts([
      [
        "inside",
        () =>
          serviceEnvelopeObstructions({
            network,
            bounds: box([8, 1, 4.2], [8.2, 2, 4.4]),
          }).join() === "ahu",
      ],
      [
        "panel",
        () =>
          serviceEnvelopeObstructions({
            network,
            bounds: box([8.2, 1, 2.5], [8.4, 2, 2.8]),
          }).join() === "panel",
      ],
      [
        "face",
        () =>
          serviceEnvelopeObstructions({
            network,
            bounds: box([8.5, 1, 4.2], [9, 2, 4.4]),
          }).length === 0,
      ],
      [
        "both",
        () =>
          serviceEnvelopeObstructions({
            network,
            bounds: box([8.2, 1, 2.5], [8.6, 2, 4.2]),
          }).join() === "panel,ahu",
      ],
      [
        "away",
        () =>
          serviceEnvelopeObstructions({
            network,
            bounds: box([0, 0, 0], [0.5, 0.5, 0.5]),
          }).length === 0,
      ],
    ]),
    { inside: true, panel: true, face: true, both: true, away: true },
  );

  const lane = { x: 8, y: 2.5, z: 1 };
  const crossed = withSleeve(
    withSleeve(
      withSegment(
        withPort(
          withPort(network, "hot-main-out", (port) => ({
            ...port,
            position: lane,
          })),
          "basin-hot",
          (port) => ({ ...port, position: { x: 1, y: 0.9, z: 1 } }),
        ),
        "hot-run",
        (run) => ({
          ...run,
          route: [
            { x: 8, y: 2.5, z: 1 },
            { x: 1, y: 2.5, z: 1 },
            { x: 1, y: 0.9, z: 1 },
          ],
        }),
      ),
      "hot-plant-hall",
      (sleeve) => ({ ...sleeve, position: { x: 7, y: 2.5, z: 1 } }),
    ),
    "hot-bath-hall",
    (sleeve) => ({ ...sleeve, position: { x: 4, y: 2.5, z: 1 } }),
  );
  const clashed = validateServiceNetwork({ network: crossed, environment });
  TestValidator.equals(
    "sharing a lane clashes, sharing a fitting does not",
    namedFacts([
      ["clean", () => serviceSegmentClashes(network).length === 0],
      [
        "onePair",
        () =>
          serviceSegmentClashes(crossed)
            .map((clash) => `${clash.left}/${clash.right}`)
            .join() === "cold-run/hot-run",
      ],
      [
        "reported",
        () => hasViolation(clashed, "physics", "$input.segments[0].route"),
      ],
      ["onlyDefect", () => violationCount(clashed) === 1],
      [
        "degenerateRouteIgnored",
        () =>
          serviceSegmentClashes({
            ...network,
            segments: [
              ...network.segments,
              segment({ id: "stub", route: [{ x: 1, y: 2.5, z: 1 }] }),
            ],
          }).length === 0,
      ],
    ]),
    {
      clean: true,
      onePair: true,
      reported: true,
      onlyDefect: true,
      degenerateRouteIgnored: true,
    },
  );

  const blocked = withNode(network, "ahu", (node) => ({
    ...node,
    maintenance: {
      min: { x: -0.5, y: -2.5, z: -2 },
      max: { x: 0.5, y: 0.3, z: 0.5 },
    },
  }));
  const obstruction = validateServiceNetwork({ network: blocked, environment });
  TestValidator.equals(
    "a run crossing an access volume it does not feed is refused",
    namedFacts([
      [
        "reported",
        () =>
          hasViolation(obstruction, "physics", "$input.nodes[5].maintenance"),
      ],
      ["onlyDefect", () => violationCount(obstruction) === 1],
      [
        "ownFeedExempt",
        () =>
          obstruction.success === false &&
          obstruction.violations.every((item) => item.value !== "air-run"),
      ],
    ]),
    { reported: true, onlyDefect: true, ownFeedExempt: true },
  );
};
