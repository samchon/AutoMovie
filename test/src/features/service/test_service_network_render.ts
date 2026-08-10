import { lowerServiceNetwork } from "@automovie/engine";
import { IAutoMovieMeshGeometry } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  namedFacts,
  nclose,
  throwsError,
  vclose,
} from "../internal/predicates";
import {
  serviceEnvironment,
  serviceNetwork,
  withSegment,
  withZone,
} from "../internal/serviceFixtures";

/** Extremes of a lowered run's baked triangle mesh, in world metres. */
const extents = (mesh: number[]) => {
  const axis = (offset: number) => {
    const values = mesh.filter((_unused, index) => index % 3 === offset);
    return { min: Math.min(...values), max: Math.max(...values) };
  };
  return { x: axis(0), y: axis(1), z: axis(2) };
};

/**
 * A run is drawn from the same centre line the validator measured, and from
 * nothing else.
 *
 * The description a clash, a sleeve and a length were all decided on is a
 * polyline and a radius, so sweeping a regular section along that polyline is
 * the whole of drawing it. There is no fitting library and no per-discipline
 * appearance here on purpose: a production that wants a modelled valve body
 * authors that asset and places it on the node, exactly as it would author any
 * other prop. What this lowering owes is that the tube it emits sits on the
 * line the graph was checked against, in world coordinates, with an identity
 * placement that cannot drift from it.
 *
 * It also refuses to draw a network that does not work. Putting a picture of a
 * working installation in front of the reason it does not work is the single
 * failure this whole record exists to prevent, so both validators run first and
 * the first violation is raised by path.
 *
 * Scenarios:
 *
 * 1. Every run becomes exactly one generated model and one staged piece, named for
 *    the network and the run, in declaration order.
 * 2. The swept tube stands on its own centre line: a straight run along `-x` at
 *    2.5 m carries a section in the `y`/`z` plane of its own radius, and its
 *    extremes are the hand-computed ones.
 * 3. A turning run rings every one of its route points, so the vertex count is the
 *    section's own size times the points it was swept through.
 * 4. The section's resolution is the caller's, and a section too coarse to close
 *    is refused rather than drawn.
 * 5. A graph defect and a wet-zone defect each refuse the drawing, quoting the
 *    path the violation stands at.
 */
export const test_service_network_render = (): void => {
  const environment = serviceEnvironment();
  const network = serviceNetwork();
  const lowered = lowerServiceNetwork({ network, environment });

  TestValidator.equals(
    "every run becomes one generated model and one staged piece",
    namedFacts([
      ["models", () => (lowered.models ?? []).length === 10],
      ["pieces", () => (lowered.set ?? []).length === 10],
      [
        "names",
        () =>
          (lowered.models ?? [])[0]!.id === "bathhouse-services/cold-run" &&
          (lowered.models ?? [])[9]!.id === "bathhouse-services/air-run",
      ],
      [
        "generated",
        () =>
          (lowered.models ?? []).every(
            (model) =>
              model.origin === "generated" &&
              model.skeleton === null &&
              model.asset === null &&
              model.parts.length === 1 &&
              model.parts[0]!.geometry.type === "mesh",
          ),
      ],
      [
        "identityPlacement",
        () =>
          (lowered.set ?? []).every(
            (piece) =>
              piece.model === piece.node &&
              vclose(piece.position, { x: 0, y: 0, z: 0 }, 0) &&
              piece.rotation === undefined &&
              piece.scale === undefined &&
              piece.facingDeg === undefined,
          ),
      ],
    ]),
    {
      models: true,
      pieces: true,
      names: true,
      generated: true,
      identityPlacement: true,
    },
  );

  const coldRun = (
    (lowered.models ?? [])[0]!.parts[0]!.geometry as IAutoMovieMeshGeometry
  ).mesh;
  const bounds = extents(coldRun.positions);
  TestValidator.equals(
    "the swept tube stands on the centre line the graph was checked against",
    namedFacts([
      ["vertices", () => coldRun.positions.length === 2 * 8 * 3],
      ["indexed", () => coldRun.indices !== null],
      [
        "xSpan",
        () =>
          nclose(bounds.x.min, 3.5, 1e-12) && nclose(bounds.x.max, 8, 1e-12),
      ],
      [
        "ySpan",
        () =>
          nclose(bounds.y.min, 2.475, 1e-12) &&
          nclose(bounds.y.max, 2.525, 1e-12),
      ],
      [
        "zSpan",
        () =>
          nclose(bounds.z.min, 0.975, 1e-12) &&
          nclose(bounds.z.max, 1.025, 1e-12),
      ],
    ]),
    { vertices: true, indexed: true, xSpan: true, ySpan: true, zSpan: true },
  );

  const coldBranch = (
    (lowered.models ?? [])[1]!.parts[0]!.geometry as IAutoMovieMeshGeometry
  ).mesh;
  const coarse = lowerServiceNetwork({ network, environment, sides: 3 });
  const coarseRun = (
    (coarse.models ?? [])[0]!.parts[0]!.geometry as IAutoMovieMeshGeometry
  ).mesh;
  TestValidator.equals(
    "the section rings every route point, at the resolution the caller asked for",
    namedFacts([
      ["turning", () => coldBranch.positions.length === 3 * 8 * 3],
      ["coarse", () => coarseRun.positions.length === 2 * 3 * 3],
      [
        "tooCoarse",
        () =>
          throwsError(
            () => lowerServiceNetwork({ network, environment, sides: 2 }),
            ["needs at least 3 sides"],
          ),
      ],
      [
        "fractional",
        () =>
          throwsError(
            () => lowerServiceNetwork({ network, environment, sides: 4.5 }),
            ["needs at least 3 sides"],
          ),
      ],
    ]),
    { turning: true, coarse: true, tooCoarse: true, fractional: true },
  );

  TestValidator.equals(
    "a network that does not work is not drawn",
    namedFacts([
      [
        "graphDefect",
        () =>
          throwsError(
            () =>
              lowerServiceNetwork({
                network: withSegment(network, "cold-run", (run) => ({
                  ...run,
                  penetrations: [],
                })),
                environment,
              }),
            ["is invalid at $input.segments[0].penetrations"],
          ),
      ],
      [
        "zoneDefect",
        () =>
          throwsError(
            () =>
              lowerServiceNetwork({
                network: withZone(network, "bath-zone", (zone) => ({
                  ...zone,
                  drains: [],
                  slope: 0,
                })),
                environment,
              }),
            ["is invalid at $input.zones[0].drains"],
          ),
      ],
    ]),
    { graphDefect: true, zoneDefect: true },
  );
};
