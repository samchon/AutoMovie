import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieModel,
  IAutoMovieServiceNetwork,
  IAutoMovieStageSetPiece,
  IAutoMovieValidation,
} from "@automovie/interface";

import {
  IAutoMovieProfilePoint,
  sweepAutoMovieProfile,
} from "../geometry/proceduralMesh";
import { IAutoMovieSubjectContribution } from "../subject";
import { validateServiceNetwork } from "./validateServiceNetwork";
import { validateWetZones } from "./wetZone";

/** Default number of sides a swept run is drawn with. */
const DEFAULT_SIDES = 8;

/**
 * Lower one service network to the models and staged pieces that draw it.
 *
 * A run is authored as a centre line and a radius, which is the description a
 * clash and a sleeve are measured against; drawing it is the deterministic
 * derivation of that description and nothing more. Sweeping a regular section
 * along the authored line is therefore the whole of it: no fitting library, no
 * elbow catalogue, no per-discipline appearance. A production that wants a
 * modelled valve body authors that prop and places it on the node, exactly as
 * it would author any other asset.
 *
 * The geometry is baked in world coordinates, matching how a connector's route
 * and a support surface are already authored, so the staged piece carries no
 * rotation and no scale of its own and a run cannot drift from the line the
 * validator measured.
 *
 * Refuses to draw an invalid network. Lowering a graph with a dangling port or
 * a clash would put a picture of a working installation in front of the reason
 * it does not work, which is the one thing this record exists to prevent.
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-routing `lowerServiceNetwork` turns each validated service centre line and radius into the deterministic swept geometry that makes the routed installation visible.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract `lowerServiceNetwork` refuses invalid networks before emitting one world-space model and stage piece for every declared run.
 * @author Samchon
 */
export const lowerServiceNetwork = (props: {
  network: IAutoMovieServiceNetwork;
  environment: IAutoMovieBuiltEnvironment;
  /** Sides the swept section is drawn with; an integer `>= 3`. Defaults to 8. */
  sides?: number;
}): IAutoMovieSubjectContribution => {
  const { network, environment } = props;
  const sides = props.sides ?? DEFAULT_SIDES;
  if (!Number.isInteger(sides) || sides < 3)
    throw new Error(
      `a swept service run needs at least 3 sides, but ${sides} was requested`,
    );
  refuse(network, validateServiceNetwork({ network, environment }));
  refuse(network, validateWetZones({ network, environment }));

  const models: IAutoMovieModel[] = [];
  const set: IAutoMovieStageSetPiece[] = [];
  for (const segment of network.segments) {
    const id = `${network.id}/${segment.id}`;
    models.push({
      id,
      name: `service run ${segment.id}`,
      origin: "generated",
      skeleton: null,
      body: null,
      asset: null,
      materials: [],
      parts: [
        {
          id: "run",
          name: null,
          geometry: {
            type: "mesh",
            mesh: sweepAutoMovieProfile({
              profile: section(segment.radius, sides),
              path: segment.route,
            }),
          },
          material: null,
          attachedBone: null,
          transform: null,
        },
      ],
    });
    // The swept mesh is already world-space, so the piece states no rotation
    // and no scale at all: an identity written out is a transform a later
    // consumer could compose against, and there is nothing here to compose.
    set.push({ node: id, model: id, position: { x: 0, y: 0, z: 0 } });
  }
  return { models, set };
};

/** A regular section of the given radius, in the sweep's own profile plane. */
const section = (radius: number, sides: number): IAutoMovieProfilePoint[] =>
  Array.from({ length: sides }, (_unused, index) => {
    const angle = (2 * Math.PI * index) / sides;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });

const refuse = (
  network: IAutoMovieServiceNetwork,
  validation: IAutoMovieValidation,
): void => {
  if (validation.success === true) return;
  const first = validation.violations[0]!;
  throw new Error(
    `service network "${network.id}" is invalid at ${first.path}: ${first.expected}`,
  );
};
