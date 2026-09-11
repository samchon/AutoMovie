import { TestValidator } from "@nestia/e2e";

import {
  portraitNoseShape,
  portraitNoseSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import {
  type IPortraitNoseShape,
  createPortraitNoseComponent,
} from "../../subjects/generated-korean-girl-01/nose";
import { subdivideControlMesh } from "../../subjects/subdivideControlMesh";
import { throwsError } from "../internal/predicates";

/**
 * Nasal aperture refinement keeps the fitted skin/lining boundary as one curve.
 * A hand-built square rim has asymmetric exterior and cavity support.
 *
 * Scenarios:
 * 1. Curve refinement moves (2,0,0) to (1.5,0,0) and retains the aperture
 *    plane. Surface refinement differs; omitted and explicit surface agree.
 * 2. The remote exterior pole and all face labels remain identical. Owned
 *    sockets/rules survive caller mutation; an invalid rule refuses early.
 */
export const test_subject_nasal_rim_curve = (): void => {
  const host = {
    positions: [
      [2, 0, 0],
      [0, 2, 0],
      [-2, 0, 0],
      [0, -2, 0],
      [0, 0, 3],
      [0, 0, -3],
    ],
    indices: [
      4, 0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 5, 1, 0, 5, 2, 1, 5, 3, 2, 5, 0, 3,
    ],
    viewRay: [0, 0, 1],
  };
  const socket = {
    ...portraitNoseSocket,
    surface: [0, 1, 2, 3],
    nostrils: [[4, 5, 6, 7]],
  };
  const shape = {
    ...portraitNoseShape,
    depthScale: 1,
    // Isolate curve refinement from the subject preset's paired alar relief;
    // this fixture's square rim oracle measures only the shared curve rule.
    tipProjection: 0,
    alarProjection: 0,
    rimSection: undefined,
    lobules: undefined,
    nostrilWidthScale: 1,
    nostrilHeightScale: 1,
    nostrilTilt: 0,
    rimRoundness: 0,
    cavityOffset: [0, 0, -2],
  };
  const build = (component: ReturnType<typeof createPortraitNoseComponent>) => {
    const plan = component.fit(host);
    const positions = host.positions.map((p) => [...p]);
    for (const c of plan.constraints) positions[c.vertex] = [...c.target];
    const cage = {
      positions,
      indices: host.indices.slice(0, 12),
      groups: [0, 0, 0, 0],
    };
    const attached = plan.attach(cage, positions, () => 1);
    return subdivideControlMesh(cage, 1, attached.curves);
  };
  const forRule = (rimRefinement: IPortraitNoseShape["rimRefinement"]) =>
    build(createPortraitNoseComponent(socket, { ...shape, rimRefinement }));
  const basic = forRule(undefined),
    explicit = forRule("surface"),
    curve = forRule("curve");
  TestValidator.equals("neutral refinement", basic, explicit);
  TestValidator.equals("hand curve position", curve.positions[0], [1.5, 0, 0]);
  TestValidator.predicate("surface differs", basic.positions[0][2] !== 0);
  TestValidator.equals("remote pole", curve.positions[4], basic.positions[4]);
  TestValidator.equals(
    "shared material population",
    curve.groups,
    basic.groups,
  );
  const ownedShape = { ...shape, rimRefinement: "curve" as const };
  const component = createPortraitNoseComponent(socket, ownedShape);
  socket.nostrils[0].reverse();
  ownedShape.rimRefinement = "surface" as "curve";
  TestValidator.equals("owned fitted curve", build(component), curve);
  TestValidator.predicate(
    "invalid rule",
    throwsError(() =>
      createPortraitNoseComponent(socket, {
        ...shape,
        rimRefinement: "unknown" as "curve",
      }),
    ),
  );
};
