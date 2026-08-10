import {
  designLineagePhaseOrder,
  designLineagePhaseSnapshot,
  designLineageProject,
  validateDesignLineage,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { emptyLineage, renovationLineage } from "../internal/lineageFixtures";
import { throwsError } from "../internal/predicates";

/**
 * Pin retained, demolished, temporary, and new to one per-phase answer that a
 * scene, a drawing, a schedule, and a render all read.
 *
 * The two facts a renovation has to keep apart are the role a thing plays in
 * the whole work and whether it is standing right now. A wall marked for
 * demolition is `demolished` for the entire job and still `present` while the
 * shoring goes up; collapsing those into one field is how a demolition plan and
 * a demolition render start disagreeing. Expectations here are read off the
 * authored plan by hand, never off the implementation's own output.
 *
 * The plan is also deliberately a graph. `shore` and `strip` are siblings, so
 * the shoring being absent during demolition is a statement about incomparable
 * branches, not about an invented order between them.
 *
 * Scenarios:
 *
 * 1. The construction plan orders by prerequisite and then by ascending id, so
 *    reshuffling the authored array cannot reorder a schedule.
 * 2. At `strip` the demolished wall is gone, the retained fabric stands, and
 *    everything the work has yet to install reads `pending`.
 * 3. At `shore` the same demolished wall is still standing, which separates the
 *    work-level role from the per-phase presence.
 * 4. At `shore` the temporary shoring is `present`; at `structure` it is `removed`
 *    while keeping the role `temporary`, and the sibling `strip` leaves it
 *    `pending` because neither branch precedes the other.
 * 5. A null phase answers for the completed work: everything ever removed is gone
 *    and everything else stands.
 * 6. Four differently shaped consumer collections project to exactly the same ids
 *    at one phase and to a different same set at another, and an id the lineage
 *    never declared survives both.
 * 7. A lineage with no phases still orders and still answers for the completed
 *    work.
 * 8. A phase the plan does not contain is refused rather than answered.
 */
export const test_architecture_design_lineage_phase_states = (): void => {
  const lineage = renovationLineage();
  TestValidator.equals(
    "the authored renovation lineage is self-consistent",
    validateDesignLineage({ lineage }).success,
    true,
  );

  TestValidator.equals(
    "the construction plan orders by prerequisite then by ascending id",
    designLineagePhaseOrder(lineage),
    ["survey", "shore", "strip", "structure", "services", "finishes"],
  );

  TestValidator.equals(
    "the demolition phase reports every subject's role and presence",
    designLineagePhaseSnapshot(lineage, "strip"),
    {
      phase: "strip",
      states: [
        {
          subject: "door-leaf",
          graph: "element",
          role: "new",
          presence: "pending",
        },
        {
          subject: "floor-oak",
          graph: "material-layer",
          role: "new",
          presence: "pending",
        },
        {
          subject: "oak-texture",
          graph: "asset",
          role: "retained",
          presence: "present",
        },
        {
          subject: "opening-door",
          graph: "opening",
          role: "new",
          presence: "pending",
        },
        {
          subject: "pendant-lamp",
          graph: "fixture",
          role: "new",
          presence: "pending",
        },
        {
          subject: "room-main",
          graph: "space",
          role: "retained",
          presence: "present",
        },
        {
          subject: "shoring-frame",
          graph: "element",
          role: "temporary",
          presence: "pending",
        },
        {
          subject: "wall-north",
          graph: "element",
          role: "retained",
          presence: "present",
        },
        {
          subject: "wall-south",
          graph: "element",
          role: "demolished",
          presence: "removed",
        },
        {
          subject: "wall-west",
          graph: "element",
          role: "retained",
          presence: "present",
        },
        {
          subject: "window-north",
          graph: "opening",
          role: "new",
          presence: "pending",
        },
      ],
    },
  );

  const shoring = designLineagePhaseSnapshot(lineage, "shore").states;
  TestValidator.equals(
    "a wall marked for demolition is still standing before its phase",
    shoring.find((state) => state.subject === "wall-south"),
    {
      subject: "wall-south",
      graph: "element",
      role: "demolished",
      presence: "present",
    },
  );
  TestValidator.equals(
    "the temporary shoring is up in its own phase",
    shoring.find((state) => state.subject === "shoring-frame"),
    {
      subject: "shoring-frame",
      graph: "element",
      role: "temporary",
      presence: "present",
    },
  );
  TestValidator.equals(
    "the shoring is taken out again once the structure phase completes",
    designLineagePhaseSnapshot(lineage, "structure").states.find(
      (state) => state.subject === "shoring-frame",
    ),
    {
      subject: "shoring-frame",
      graph: "element",
      role: "temporary",
      presence: "removed",
    },
  );

  TestValidator.equals(
    "the completed work keeps everything the plan never removes",
    designLineagePhaseSnapshot(lineage, null).states.map(
      (state) => `${state.subject}:${state.role}:${state.presence}`,
    ),
    [
      "door-leaf:new:present",
      "floor-oak:new:present",
      "oak-texture:retained:present",
      "opening-door:new:present",
      "pendant-lamp:new:present",
      "room-main:retained:present",
      "shoring-frame:temporary:removed",
      "wall-north:retained:present",
      "wall-south:demolished:removed",
      "wall-west:retained:present",
      "window-north:new:present",
    ],
  );

  // Four consumers of four different shapes, carrying the same identities plus
  // one the lineage never declared.
  const ids = ["wall-north", "wall-south", "shoring-frame", "stage-camera"];
  const sceneNodes = ids.map((id) => ({ id, model: `${id}-model` }));
  const drawingRows = ids.map((id) => ({ id, sheet: "A-101" }));
  const quantityLines = ids.map((id) => ({ id, unit: "m2", amount: 1 }));
  const renderDraws = ids.map((id) => ({ id, pass: "beauty" }));
  const projected = (phase: string | null): string[][] => [
    designLineageProject(lineage, phase, sceneNodes).map((row) => row.id),
    designLineageProject(lineage, phase, drawingRows).map((row) => row.id),
    designLineageProject(lineage, phase, quantityLines).map((row) => row.id),
    designLineageProject(lineage, phase, renderDraws).map((row) => row.id),
  ];
  TestValidator.equals(
    "scene, drawing, quantity, and render agree on what stands at demolition",
    projected("strip"),
    [
      ["wall-north", "stage-camera"],
      ["wall-north", "stage-camera"],
      ["wall-north", "stage-camera"],
      ["wall-north", "stage-camera"],
    ],
  );
  TestValidator.equals(
    "the same four consumers agree on the different set standing at shoring",
    projected("shore"),
    [
      ["wall-north", "wall-south", "shoring-frame", "stage-camera"],
      ["wall-north", "wall-south", "shoring-frame", "stage-camera"],
      ["wall-north", "wall-south", "shoring-frame", "stage-camera"],
      ["wall-north", "wall-south", "shoring-frame", "stage-camera"],
    ],
  );

  const bare = emptyLineage();
  TestValidator.equals(
    "a lineage with no construction sequence still orders and still answers",
    [
      designLineagePhaseOrder(bare),
      designLineagePhaseSnapshot(bare, null).states,
      designLineageProject(bare, null, sceneNodes).map((row) => row.id),
    ],
    [[], [], ids],
  );

  TestValidator.predicate(
    "a phase the plan does not contain is refused, not answered",
    throwsError(
      () => designLineagePhaseSnapshot(lineage, "topping-out"),
      'has no construction phase "topping-out"',
    ),
  );
};
