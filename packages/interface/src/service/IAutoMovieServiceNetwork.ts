import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { IAutoMoviePropBox } from "../harness/IAutoMoviePropSpec";
import { IAutoMovieWetZone } from "./IAutoMovieWetZone";

/**
 * The distribution networks a built environment is served by, as one graph.
 *
 * Water, drainage, power, data, air, fire suppression and control are the same
 * computational object: equipment that owns typed ports, segments that join two
 * ports, junctions where several meet, and sleeves where a run crosses a
 * boundary. Giving each discipline its own record would make "is this network
 * connected" seven different questions with seven different answers, so the
 * graph is shared and only the **rules** are per discipline: an engine
 * validator decides which media a discipline may carry and which unit each
 * medium is measured in, and a domain solver — flow, circuit load, duct
 * pressure — remains a separate analysis this record does not claim to
 * perform.
 *
 * Nothing here is a catalogue. There is no fixture library, no pipe schedule
 * and no equipment model: a basin, a sprinkler head and a distribution panel
 * are all authored by the production as nodes with the ports they actually
 * have. What the record owns is the part a rendering that merely _looks_
 * plumbed cannot prove — that every port is joined to something, that the
 * medium and unit agree end to end, that a run crossing a wall declares the
 * sleeve it passes through, that two disciplines do not occupy the same cubic
 * metre, and that the space a panel needs to be opened in stays clear.
 *
 * The record is **beside** the architecture record rather than inside it, and
 * cites it only by stable id, exactly as an independent fluid domain is bound
 * to a basin by `IAutoMovieWaterFeature`. A drainage network that ends in a
 * floor gully composes that same fluid domain instead of inventing a second
 * model of moving water.
 *
 * @author Samchon
 */
export interface IAutoMovieServiceNetwork {
  /** Schema version. */
  version: 1;

  /** Stable identity of this network within the production. */
  id: string;

  /** All authored lengths are measured in metres. */
  units: "meter";

  /** Id of the `IAutoMovieBuiltEnvironment` this network serves. */
  environment: string;

  /** Independently rooted distribution systems, each carrying one medium. */
  systems: IAutoMovieServiceSystem[];

  /** Every fixture, machine, junction, terminal and inline device. */
  nodes: IAutoMovieServiceNode[];

  /** Runs joining exactly two ports: a pipe, a duct, a conduit, a cable. */
  segments: IAutoMovieServiceSegment[];

  /** Sleeves where a run crosses a boundary of the served environment. */
  penetrations: IAutoMovieServicePenetration[];

  /** Wet and waterproofed regions bound to logical spaces of that environment. */
  zones: IAutoMovieWetZone[];
}

/**
 * One rooted distribution system: a medium, the unit it is measured in, and the
 * direction reachability is asked in.
 *
 * A system is the smallest thing that can be asked "is everything on it fed".
 * Cold water off one riser, the recirculating leg of the hot water, one
 * lighting circuit, one supply air trunk and the sprinkler main are five
 * systems, not one network with five colours, because each answers that
 * question separately.
 */
export interface IAutoMovieServiceSystem {
  /** Stable system identity within the network. */
  id: string;

  /** Which engineering discipline owns the system's rules. */
  discipline: AutoMovieServiceDiscipline;

  /** What the system carries. The discipline restricts which media are legal. */
  medium: AutoMovieServiceMedium;

  /** Unit every capacity and demand on the system is stated in. */
  unit: AutoMovieServiceUnit;

  /**
   * How reachability is traversed from {@link root}.
   *
   * - `from-root`: the root emits and everything else consumes — a supply main, a
   *   lighting circuit, a supply air trunk.
   * - `to-root`: the root receives and everything else discharges — a drainage
   *   stack, a return air path, an exhaust riser.
   * - `undirected`: a ring or bus where either end may feed the other.
   *
   * It never changes what a segment _means_: a segment always carries its
   * medium out of its `from` port and into its `to` port.
   */
  flow: AutoMovieServiceFlow;

  /**
   * Node id the system is rooted at: the main, the panel, the stack base, the
   * riser head. Reachability is measured from here, so every node carrying a
   * port on this system is expected to be joined to it.
   */
  root: string;

  /**
   * Design capacity in {@link unit}; a finite number greater than `0`. The
   * engine sums the demand every consuming port declares against it.
   */
  capacity: number;
}

/**
 * One fixture, machine, junction, terminal or inline device on the network.
 *
 * A basin, a sprinkler head, a socket outlet, a diffuser, an air handling unit,
 * a tee in a chase and a shut-off valve are all this record. What separates
 * them is the ports they carry and the volume they need to be serviced in, not
 * a class hierarchy: a media wall that is simultaneously a wall, a powered
 * device and a light source declares the ports for each and stays one node.
 */
export interface IAutoMovieServiceNode {
  /** Stable node identity within the network. */
  id: string;

  /** Computational family; it selects which validations apply, not a catalogue. */
  kind: AutoMovieServiceNodeKind;

  /** Id of the logical space of the served environment the node stands in. */
  space: string;

  /** Id of the built element realizing it, or `null` for a bare junction. */
  element: string | null;

  /** World position in metres. */
  position: IAutoMovieVector3;

  /** Typed connection points this node offers, one per system it touches. */
  ports: IAutoMovieServicePort[];

  /**
   * Named operating state of an inline device, or `null` when the node has no
   * moving part. A valve, a damper and a switch are the same object here.
   */
  state: IAutoMovieServiceState | null;

  /**
   * Volume in **node-local** metres that must stay clear for the node to be
   * serviced — the door swing of a panel, the pull space of a filter, the reach
   * in front of a valve — or `null` when the node needs none. The world volume
   * is this box offset by {@link position}, which is the same axis-aligned
   * keep-out a prop declares, so one collision rule covers both.
   */
  maintenance: IAutoMoviePropBox | null;
}

/**
 * One typed connection point on a node.
 *
 * Direction is stated **relative to the node**: `in` means the medium arrives
 * from the network, `out` means the node puts it into the network. A tap has an
 * `in` cold water port and a floor gully has an `out` waste port, so the same
 * word means the same thing whether the medium is water, air, power or signal,
 * and a segment always runs from an `out` port to an `in` one.
 */
export interface IAutoMovieServicePort {
  /** Stable port identity, unique across the whole network. */
  id: string;

  /** Id of the system this port belongs to. */
  system: string;

  /** What the port carries. It must equal its system's medium. */
  medium: AutoMovieServiceMedium;

  /** Which way the port faces, relative to the node that owns it. */
  direction: AutoMovieServicePortDirection;

  /** Unit {@link demand} is stated in. It must equal its system's unit. */
  unit: AutoMovieServiceUnit;

  /**
   * Design flow, load or bandwidth through this port in {@link unit}; a finite
   * number `>= 0`. A junction that merely passes the medium on declares `0`.
   */
  demand: number;

  /**
   * Internal cross-section in square metres a joining segment must match; a
   * finite number greater than `0`, or `null` when the port imposes none.
   */
  section: number | null;

  /** World position of the connection point, in metres. */
  position: IAutoMovieVector3;
}

/**
 * One run joining exactly two ports: a pipe, a duct, a conduit, a cable tray.
 *
 * The centre line is authored in world metres because that is what a clash is
 * measured in, and the radius is what turns that line into the volume the run
 * actually occupies. A run that leaves the space it started in is expected to
 * name the sleeve it went through, which is the only way a wall can be shown to
 * have been drilled on purpose.
 */
export interface IAutoMovieServiceSegment {
  /** Stable segment identity within the network. */
  id: string;

  /** Id of the system this run belongs to. */
  system: string;

  /** Id of the port the medium leaves from; it must be `out` or `bidirectional`. */
  from: string;

  /** Id of the port the medium arrives at; it must be `in` or `bidirectional`. */
  to: string;

  /**
   * World centre line in metres, including both endpoints. The first point must
   * coincide with the `from` port and the last with the `to` port.
   */
  route: IAutoMovieVector3[];

  /** Outer radius in metres used for clash and clearance; greater than `0`. */
  radius: number;

  /** Internal cross-section in square metres; greater than `0`. */
  section: number;

  /** Ids of the penetrations this run passes through, in no particular order. */
  penetrations: string[];
}

/**
 * One sleeve where a run crosses a boundary of the served environment.
 *
 * A penetration is a first-class record rather than a property of the run
 * because a boundary owns it: a fire compartment wall, a waterproof tanking
 * layer and an acoustic separation each care that the hole exists, how big it
 * is, and whether it was made good.
 */
export interface IAutoMovieServicePenetration {
  /** Stable penetration identity within the network. */
  id: string;

  /** Id of the boundary of the served environment this sleeve is cut through. */
  boundary: string;

  /**
   * Id of the declared opening of that boundary the sleeve passes through, or
   * `null` when the sleeve is a bare cored hole.
   *
   * Citing one is a stronger claim than citing the boundary alone: where that
   * opening states a profile, the sleeve is held inside the void it names
   * rather than merely somewhere on the same wall.
   */
  opening: string | null;

  /**
   * World position of the sleeve centre, in metres.
   *
   * Where the pierced boundary declares a face, this is read in that boundary's
   * own frame and held inside its outline and its thickness. Where it declares
   * none, the position is only held against the runs that cite the sleeve, and
   * `serviceAnalysisSupport` reports the difference by name.
   */
  position: IAutoMovieVector3;

  /** Clear radius of the sleeve in metres; greater than `0`. */
  radius: number;

  /**
   * Whether the annulus around the run was made good — fire-stopped, tanked or
   * gasketed. A sleeve through a waterproof membrane that is not sealed is a
   * leak the render cannot show.
   */
  sealed: boolean;
}

/** Named operating state of a valve, a damper, a switch or a similar device. */
export interface IAutoMovieServiceState {
  /** Author-named state such as `open`, `closed`, or `throttled`. */
  name: string;

  /**
   * Fraction of nominal capacity the state passes, within the closed range `[0,
   * 1]`. Exactly `0` isolates everything downstream of the device.
   */
  opening: number;
}

/** Which engineering discipline owns a system's rules. */
export type AutoMovieServiceDiscipline =
  | "plumbing"
  | "drainage"
  | "electrical"
  | "data"
  | "hvac"
  | "fire"
  | "control";

/**
 * What a system carries.
 *
 * `other` is the deliberate escape hatch: a production carrying medical gas,
 * compressed air or vacuum states `other` and takes the unit check with it,
 * rather than waiting for this union to grow.
 */
export type AutoMovieServiceMedium =
  | "cold-water"
  | "hot-water"
  | "waste-water"
  | "vent-air"
  | "supply-air"
  | "return-air"
  | "exhaust-air"
  | "electric-power"
  | "data-signal"
  | "control-signal"
  | "fire-water"
  | "other";

/** The unit a capacity or a demand is stated in. */
export type AutoMovieServiceUnit =
  | "cubic-meter-per-second"
  | "watt"
  | "ampere"
  | "bit-per-second"
  | "dimensionless";

/** How reachability is traversed from a system's root. */
export type AutoMovieServiceFlow = "from-root" | "to-root" | "undirected";

/** Which way a port faces, stated relative to the node that owns it. */
export type AutoMovieServicePortDirection = "in" | "out" | "bidirectional";

/** Computational family of a node. */
export type AutoMovieServiceNodeKind =
  /** Where the medium enters or leaves the building: a main, a panel, a stack. */
  | "source"
  /** Something a person uses: a basin, a tap, an outlet, a sprinkler head. */
  | "fixture"
  /** Plant: an air handling unit, a pump, a boiler, a switchboard. */
  | "equipment"
  /** Where the medium meets the room: a diffuser, a grille, a luminaire. */
  | "terminal"
  /** A tee, an elbow, a manifold, a junction box. */
  | "junction"
  /** An inline device with a state: a valve, a damper, a switch. */
  | "valve";
