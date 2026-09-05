import {
  type IAutoMovieSubjectContribution,
  lowerServiceNetwork,
  validateServiceNetwork,
  validateWetZones,
} from "@automovie/engine";
import type {
  IAutoMovieServiceNetwork,
  IAutoMovieVector3,
} from "@automovie/interface";

import { ExampleBuilding } from "./buildings";

/**
 * A building service, as a graph of ports rather than a picture of pipes.
 *
 * ## The one rule this example exists to teach
 *
 * Nothing in a frame distinguishes a gully joined to a stack from a gully
 * joined to nothing. Both render as a grating in a floor. So the fact worth
 * authoring is not the pipe, it is the **graph**: equipment that owns typed
 * ports, runs that join exactly two of them, and a system that says which end
 * the medium is measured from. Model a pipe and you have a prop; declare the
 * graph and the engine can tell you the fitting is fed, the medium and unit
 * agree end to end, the run crosses no wall it did not declare a sleeve
 * through, and nothing occupies the space an engineer needs to open a panel.
 *
 * One graph carries every discipline on purpose. Water, drainage, power, data,
 * air, fire and control are the same computational object, and giving each its
 * own record would make "is this network whole" seven questions with seven
 * answers. What differs per discipline is only the rules : which media it may
 * carry, and which unit each medium is measured in : and the engine owns
 * those.
 *
 * ## What is deliberately small here
 *
 * One system, two fittings, one run, one wet zone. That is the smallest network
 * that still exercises every relation: a root the medium is measured from, a
 * terminal that loads it, a run that has to leave an emitter and arrive at a
 * consumer, and a region whose waterproofing obligations follow from the grade
 * it claims. There is no fixture library and no pipe schedule below, and there
 * is not meant to be one: a basin, a sprinkler head and a distribution panel
 * are all nodes with the ports they actually have, authored by the production.
 *
 * The room, the wall and the environment id below are borrowed from
 * `examples/buildings.ts` so the citations resolve against something real.
 * Replace them with your own space and boundary; the shape of the graph is what
 * this file is for.
 *
 * ## Direction is stated relative to the node
 *
 * `in` means the medium arrives from the network and `out` means the node puts
 * it into the network, whatever the medium is. A tap has an `in` cold-water
 * port; a floor gully has an `out` waste port. A run therefore always leaves an
 * `out` port and arrives at an `in` one, and the same sentence reads correctly
 * for a duct, a cable and a drain.
 */
export const exampleServiceNetwork = (
  props: {
    /** Stable network identity. */
    id?: string;
    /** Id of the built environment this network serves. */
    environment?: string;
    /** Logical space the two fittings stand in. */
    space?: string;
    /** Boundary of that space the membrane covers and hands over at. */
    boundary?: string;
    /** Where the floor gully stands, in world metres. */
    gully?: IAutoMovieVector3;
    /** Where the stack base stands, in world metres. */
    stack?: IAutoMovieVector3;
    /** Internal cross-section of the run and both ports, in square metres. */
    section?: number;
    /** Outer radius of the run used for clash and clearance, in metres. */
    radius?: number;
    /** Design discharge of the gully, in cubic metres per second. */
    discharge?: number;
  } = {},
): IAutoMovieServiceNetwork => {
  const space = props.space ?? "tower-room-0";
  const boundary = props.boundary ?? "tower-partition-boundary-0";
  const gully = props.gully ?? { x: 2, y: 0.05, z: 1 };
  const stack = props.stack ?? { x: 5.2, y: 0.05, z: 3.2 };
  const section = props.section ?? 0.008;
  const radius = props.radius ?? 0.06;
  const discharge = props.discharge ?? 0.0008;
  const unit = "cubic-meter-per-second";
  const medium = "waste-water";

  return {
    version: 1,
    id: props.id ?? "example-drainage",
    units: "meter",
    environment: props.environment ?? "example-building",
    systems: [
      {
        id: "waste-stack",
        discipline: "drainage",
        medium,
        unit,
        // A stack is rooted where the medium *arrives*, so reachability is
        // walked backwards into it and the load is read at the ports that
        // discharge. Spell it `from-root` and the same graph would report a
        // stack carrying nothing while every fixture on it drained.
        flow: "to-root",
        root: "stack-base",
        capacity: 0.01,
      },
    ],
    nodes: [
      {
        id: "floor-gully",
        // The family selects which validations apply; it is not a catalogue
        // entry. A gully, a basin and a sprinkler head are all `fixture`.
        kind: "fixture",
        space,
        // `null` is a fitting with no modelled body yet. Naming a built element
        // here is what ties the graph to the thing a camera sees.
        element: null,
        position: { ...gully },
        ports: [
          {
            id: "gully-outlet",
            system: "waste-stack",
            medium,
            direction: "out",
            unit,
            // The terminal that actually loads the system states the load. A
            // fitting that merely passes the medium on declares `0`, because
            // the demand beyond it is already stated where it is drawn.
            demand: discharge,
            section,
            // A port is the point a run is anchored to, so it stands in the
            // same room its node does. A port allowed to drift next door is
            // the hole the wall-crossing rule gets evaded through.
            position: { ...gully },
          },
        ],
        state: null,
        maintenance: null,
      },
      {
        id: "stack-base",
        kind: "source",
        space,
        element: null,
        position: { ...stack },
        ports: [
          {
            id: "stack-inlet",
            system: "waste-stack",
            medium,
            direction: "in",
            unit,
            demand: 0,
            section,
            position: { ...stack },
          },
        ],
        state: null,
        // The rodding space in front of the access cover, in node-local metres,
        // offset by the node's own position to give the world volume. What it
        // is checked against today is every run that does not terminate on this
        // node: a duct threaded through the space somebody has to kneel in is
        // named rather than discovered on site. It is the same axis-aligned box
        // a prop declares as its keep-out, but a prop parked here is not yet
        // checked against it, so state the envelope and do not read the pass as
        // covering furniture.
        maintenance: {
          min: { x: -0.4, y: 0, z: -0.4 },
          max: { x: 0.4, y: 1.2, z: 0.4 },
        },
      },
    ],
    segments: [
      {
        id: "gully-to-stack",
        system: "waste-stack",
        from: "gully-outlet",
        to: "stack-inlet",
        // A centre line, because that is what a clash is measured against. The
        // ends have to coincide with the ports they join, and the corner in the
        // middle is an ordinary route point rather than a fitting: an elbow
        // catalogue is content, and the sweep is a derivation.
        route: [
          { ...gully },
          { x: gully.x, y: gully.y, z: stack.z },
          { ...stack },
        ],
        radius,
        // Matched to both ports. A run whose bore disagrees with the fitting it
        // is screwed into is refused rather than drawn.
        section,
        // Empty because this run never leaves the room it started in. A riser
        // that did would name the sleeve it went through here, and a crossing
        // with no sleeve is reported at the route point where it happened.
        penetrations: [],
      },
    ],
    penetrations: [],
    zones: [
      {
        id: "example-wet-room",
        space,
        // The grade is the claim, and the obligations follow from it. `damp`
        // owes only its handovers; `wet` and `immersed` additionally owe a
        // membrane over every boundary of the room, a fall, and a drain for
        // the fall to reach.
        grade: "wet",
        membrane: [boundary],
        upturn: 1.8,
        slope: 0.015,
        drains: ["floor-gully"],
        // Where the wet region hands over to a drier one. The same wall can be
        // both membrane and threshold: it is waterproofed, and it is the line
        // the water must not cross.
        thresholds: [boundary],
      },
    ],
  };
};

/**
 * Draw the run, once the graph has been proven whole.
 *
 * The lowering is a derivation and nothing more: a regular section swept along
 * the authored centre line, in world coordinates, with no fitting library and
 * no per-discipline appearance. It refuses an invalid network outright, because
 * a picture of a working installation placed in front of the reason it does not
 * work is the one outcome this record exists to prevent.
 */
export const exampleServiceGeometry = (): IAutoMovieSubjectContribution =>
  lowerServiceNetwork({
    network: exampleServiceNetwork(),
    environment: new ExampleBuilding().design(),
  });

/**
 * Check the graph, the wet region, and the geometry the two produce.
 *
 * The three answer different questions and none implies another. The first
 * refuses a dangling port, an unreachable fitting, a mismatched unit, a run
 * anchored where its fitting is not, and an undeclared wall crossing. The
 * second refuses a wet room whose membrane leaves a surface uncovered, whose
 * floor does not fall, or whose fall reaches a node that discharges nothing.
 * The third proves the record can actually be drawn: one swept run per segment,
 * and nothing invented on the way out.
 */
export const checkExampleServiceNetwork = (): void => {
  const environment = new ExampleBuilding().design();
  const network = exampleServiceNetwork();

  const graph = validateServiceNetwork({ network, environment });
  if (graph.success === false)
    throw new Error(
      `the example service network is not whole: ${graph.violations[0]!.path}`,
    );

  const zones = validateWetZones({ network, environment });
  if (zones.success === false)
    throw new Error(
      `the example wet zone is not waterproofed: ${zones.violations[0]!.path}`,
    );

  const drawn = exampleServiceGeometry();
  if ((drawn.set ?? []).length !== network.segments.length)
    throw new Error(
      `${network.segments.length} run(s) owe ${network.segments.length} staged piece(s), but the lowering produced ${(drawn.set ?? []).length}`,
    );
};
