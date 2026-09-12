import {
  productionSoftBodyUsesMovingBoundary,
  readProductionLiveWearableSoftBodies,
  selectProductionLiveWearableSoftBodies,
} from "@automovie/engine";
import type { IAutoMovieSoftBodyDomain } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

type Boundary = Pick<IAutoMovieSoftBodyDomain, "id" | "anchors" | "colliders">;

const staticAnchor: IAutoMovieSoftBodyDomain["anchors"][number] = {
  id: "rail",
  particle: 0,
  position: { x: 0, y: 1, z: 0 },
};

const bound = (id: string): Boundary => ({
  id,
  anchors: [
    {
      id: "shoulder",
      particle: 0,
      position: null,
      binding: {
        kind: "actor-bone",
        actor: "actor",
        bone: "leftShoulder",
        offset: { x: 0, y: 0, z: 0 },
      },
    },
  ],
  colliders: [],
});

const capsule = (id: string): Boundary => ({
  id,
  anchors: [staticAnchor],
  colliders: [
    {
      kind: "body-capsule",
      id: "torso",
      actor: "actor",
      capsule: { from: "hips", to: "head", radius: 0.25 },
    },
  ],
});

const still = (id: string): Boundary => ({
  id,
  anchors: [staticAnchor],
  colliders: [],
});

/**
 * Live wearable solving happens exactly where the author selected it.
 *
 * The browser shot runtime and the Node builder both resolve a shot's live
 * soft bodies from the same authored list, so this selection may neither
 * repair the list nor switch a domain between live and static behind the
 * author. Expectations are the selection rules: a bound anchor or a body
 * capsule is a moving boundary, the authored order assigns budget slots, and
 * an id absent from a shot keeps its slot.
 *
 * Scenarios:
 *
 * 1. A bound anchor and a body capsule are moving boundaries; a static anchor
 *    with no collider is not.
 * 2. The authored list is returned in its own order, and an empty list is
 *    accepted; a non-array, a non-string, blank, or untrimmed entry, and a
 *    repeated id are refused with their exact messages.
 * 3. A shot receives its selected moving domains with their authored slot and
 *    the production ceiling, skipping a selected id the shot does not carry;
 *    an empty selection over static domains yields nothing.
 * 4. A blank, untrimmed, or repeated domain id, an unselected moving domain,
 *    and a selected static domain are refused.
 */
export const test_soft_body_live_wearable_selection = (): void => {
  TestValidator.equals(
    "bound anchors and body capsules are moving boundaries",
    [
      bound("cape"),
      capsule("coat"),
      still("flag"),
      {
        ...still("ball"),
        colliders: [
          {
            kind: "sphere" as const,
            id: "ball",
            center: { x: 0, y: 0, z: 0 },
            radius: 0.5,
          },
        ],
      },
    ].map(productionSoftBodyUsesMovingBoundary),
    [true, true, false, false],
  );

  TestValidator.equals(
    "the authored list is read in order and refused when malformed",
    {
      ordered: readProductionLiveWearableSoftBodies(["coat", "cape"]),
      empty: readProductionLiveWearableSoftBodies([]),
      notArray: throwsError(
        () => readProductionLiveWearableSoftBodies("coat"),
        "simulation.liveWearableSoftBodies must be an array of domain ids.",
      ),
      notString: throwsError(
        () => readProductionLiveWearableSoftBodies(["coat", 1]),
        "simulation.liveWearableSoftBodies[1] must be a non-blank trimmed string.",
      ),
      blank: throwsError(
        () => readProductionLiveWearableSoftBodies([" "]),
        "simulation.liveWearableSoftBodies[0] must be a non-blank trimmed string.",
      ),
      untrimmed: throwsError(
        () => readProductionLiveWearableSoftBodies([" coat"]),
        "simulation.liveWearableSoftBodies[0] must be a non-blank trimmed string.",
      ),
      repeated: throwsError(
        () => readProductionLiveWearableSoftBodies(["coat", "coat"]),
        'simulation.liveWearableSoftBodies repeats domain id "coat".',
      ),
    },
    {
      ordered: ["coat", "cape"],
      empty: [],
      notArray: true,
      notString: true,
      blank: true,
      untrimmed: true,
      repeated: true,
    },
  );

  const domains = [bound("cape"), capsule("coat"), still("flag")];
  TestValidator.equals(
    "a shot receives its selected moving domains with authored slots",
    {
      selected: selectProductionLiveWearableSoftBodies(domains, [
        "coat",
        "ghost",
        "cape",
      ]).map((item) => [item.domain.id, item.subjectIndex, item.maxSubjects]),
      none: selectProductionLiveWearableSoftBodies([still("flag")], []),
    },
    {
      selected: [
        ["coat", 0, 3],
        ["cape", 2, 3],
      ],
      none: [],
    },
  );
  TestValidator.equals(
    "ambiguous domains and live or static contradictions are refused",
    {
      blank: throwsError(
        () => selectProductionLiveWearableSoftBodies([still(" ")], []),
        "Compiled soft-body domain ids must be non-blank, trimmed, and unique.",
      ),
      untrimmed: throwsError(
        () => selectProductionLiveWearableSoftBodies([still("flag ")], []),
        "Compiled soft-body domain ids must be non-blank, trimmed, and unique.",
      ),
      repeated: throwsError(
        () =>
          selectProductionLiveWearableSoftBodies(
            [still("flag"), still("flag")],
            [],
          ),
        "Compiled soft-body domain ids must be non-blank, trimmed, and unique.",
      ),
      unselectedMoving: throwsError(
        () => selectProductionLiveWearableSoftBodies(domains, ["coat"]),
        'Live wearable soft body "cape" declares a moving boundary but simulation.liveWearableSoftBodies does not select it.',
      ),
      selectedStatic: throwsError(
        () =>
          selectProductionLiveWearableSoftBodies(domains, [
            "coat",
            "cape",
            "flag",
          ]),
        'Live wearable soft body "flag" is selected for a live solve but declares no moving boundary.',
      ),
    },
    {
      blank: true,
      untrimmed: true,
      repeated: true,
      unselectedMoving: true,
      selectedStatic: true,
    },
  );
};
