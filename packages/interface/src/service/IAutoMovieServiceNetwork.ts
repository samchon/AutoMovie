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
 * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `IAutoMovieServiceNetwork` as the portable data boundary for the interior service network validation requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `IAutoMovieServiceNetwork` for the interior space service network contract system contract.
 * @author Samchon
 */
export interface IAutoMovieServiceNetwork {
  /**
   * Schema version.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `version` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `version` for the interior space service network contract system contract.
   */
  version: 1;

  /**
   * Stable identity of this network within the production.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `id` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `id` for the interior space service network contract system contract.
   */
  id: string;

  /**
   * All authored lengths are measured in metres.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `units` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `units` for the interior space service network contract system contract.
   */
  units: "meter";

  /**
   * Id of the `IAutoMovieBuiltEnvironment` this network serves.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `environment` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `environment` for the interior space service network contract system contract.
   */
  environment: string;

  /**
   * Independently rooted distribution systems, each carrying one medium.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `systems` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `systems` for the interior space service network contract system contract.
   */
  systems: IAutoMovieServiceSystem[];

  /**
   * Every fixture, machine, junction, terminal and inline device.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `nodes` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `nodes` for the interior space service network contract system contract.
   */
  nodes: IAutoMovieServiceNode[];

  /**
   * Runs joining exactly two ports: a pipe, a duct, a conduit, a cable.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `segments` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `segments` for the interior space service network contract system contract.
   */
  segments: IAutoMovieServiceSegment[];

  /**
   * Sleeves where a run crosses a boundary of the served environment.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `penetrations` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `penetrations` for the interior space service network contract system contract.
   */
  penetrations: IAutoMovieServicePenetration[];

  /**
   * Wet and waterproofed regions bound to logical spaces of that environment.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `zones` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `zones` for the interior space service network contract system contract.
   */
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
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `IAutoMovieServiceSystem` as the portable data boundary for the interior service network validation requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `IAutoMovieServiceSystem` for the interior space service network contract system contract.
 */
export interface IAutoMovieServiceSystem {
  /**
   * Stable system identity within the network.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `id` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `id` for the interior space service network contract system contract.
   */
  id: string;

  /**
   * Which engineering discipline owns the system's rules.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `discipline` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `discipline` for the interior space service network contract system contract.
   */
  discipline: AutoMovieServiceDiscipline;

  /**
   * What the system carries. The discipline restricts which media are legal.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `medium` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `medium` for the interior space service network contract system contract.
   */
  medium: AutoMovieServiceMedium;

  /**
   * Unit every capacity and demand on the system is stated in.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `unit` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `unit` for the interior space service network contract system contract.
   */
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
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `flow` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `flow` for the interior space service network contract system contract.
   */
  flow: AutoMovieServiceFlow;

  /**
   * Node id the system is rooted at: the main, the panel, the stack base, the
   * riser head. Reachability is measured from here, so every node carrying a
   * port on this system is expected to be joined to it.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `root` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `root` for the interior space service network contract system contract.
   */
  root: string;

  /**
   * Design capacity in {@link unit}; a finite number greater than `0`.
   *
   * The engine sums the demand declared at the ports facing away from
   * {@link root} against it, which is the end a system is loaded from: what the
   * `in` ports of a `from-root` or `undirected` system draw, and what the `out`
   * ports of a `to-root` system discharge. A `bidirectional` port is counted at
   * neither end, so a ring tap states its draw on the port that draws it.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `capacity` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `capacity` for the interior space service network contract system contract.
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
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `IAutoMovieServiceNode` as the portable data boundary for the interior service network validation requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `IAutoMovieServiceNode` for the interior space service network contract system contract.
 */
export interface IAutoMovieServiceNode {
  /**
   * Stable node identity within the network.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `id` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `id` for the interior space service network contract system contract.
   */
  id: string;

  /**
   * Computational family; it selects which validations apply, not a catalogue.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `kind` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `kind` for the interior space service network contract system contract.
   */
  kind: AutoMovieServiceNodeKind;

  /**
   * Id of the logical space of the served environment the node stands in.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `space` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `space` for the interior space service network contract system contract.
   */
  space: string;

  /**
   * Id of the built element realizing it, or `null` for a bare junction.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `element` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `element` for the interior space service network contract system contract.
   */
  element: string | null;

  /**
   * World position in metres.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `position` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `position` for the interior space service network contract system contract.
   */
  position: IAutoMovieVector3;

  /**
   * Typed connection points this node offers, one per system it touches.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `ports` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `ports` for the interior space service network contract system contract.
   */
  ports: IAutoMovieServicePort[];

  /**
   * Named operating state of an inline device, or `null` when the node has no
   * moving part. A valve, a damper and a switch are the same object here.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `state` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `state` for the interior space service network contract system contract.
   */
  state: IAutoMovieServiceState | null;

  /**
   * Volume in **node-local** metres that must stay clear for the node to be
   * serviced — the door swing of a panel, the pull space of a filter, the reach
   * in front of a valve — or `null` when the node needs none. The world volume
   * is this box offset by {@link position}, which is the same axis-aligned
   * keep-out a prop declares, so one collision rule covers both.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `maintenance` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `maintenance` for the interior space service network contract system contract.
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
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `IAutoMovieServicePort` as the portable data boundary for the interior service network validation requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `IAutoMovieServicePort` for the interior space service network contract system contract.
 */
export interface IAutoMovieServicePort {
  /**
   * Stable port identity, unique across the whole network.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `id` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `id` for the interior space service network contract system contract.
   */
  id: string;

  /**
   * Id of the system this port belongs to.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `system` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `system` for the interior space service network contract system contract.
   */
  system: string;

  /**
   * What the port carries. It must equal its system's medium.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `medium` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `medium` for the interior space service network contract system contract.
   */
  medium: AutoMovieServiceMedium;

  /**
   * Which way the port faces, relative to the node that owns it.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `direction` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `direction` for the interior space service network contract system contract.
   */
  direction: AutoMovieServicePortDirection;

  /**
   * Unit {@link demand} is stated in. It must equal its system's unit.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `unit` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `unit` for the interior space service network contract system contract.
   */
  unit: AutoMovieServiceUnit;

  /**
   * Design flow, load or bandwidth through this port in {@link unit}; a finite
   * number `>= 0`. A fitting that merely passes the medium on — a tee, a valve,
   * a damper, a switch — declares `0`, because the demand beyond it is already
   * stated where it is actually drawn.
   *
   * It is the port's own terminal that states it: a basin states what it draws
   * on its `in` supply port and what it discharges on its `out` waste port, so
   * a supply system and a drainage system are each loaded by the end that
   * actually loads them.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `demand` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `demand` for the interior space service network contract system contract.
   */
  demand: number;

  /**
   * Internal cross-section in square metres a joining segment must match; a
   * finite number greater than `0`, or `null` when the port imposes none.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `section` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `section` for the interior space service network contract system contract.
   */
  section: number | null;

  /**
   * World position of the connection point, in metres.
   *
   * It stands inside the same logical space its node stands in. A run is
   * anchored to this point at both ends, and a wall crossing is read between
   * consecutive route points, so a port allowed to sit in another room would
   * let a run terminate where its fitting is not and never appear to cross
   * anything.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `position` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `position` for the interior space service network contract system contract.
   */
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
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `IAutoMovieServiceSegment` as the portable data boundary for the interior service network validation requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `IAutoMovieServiceSegment` for the interior space service network contract system contract.
 */
export interface IAutoMovieServiceSegment {
  /**
   * Stable segment identity within the network.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `id` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `id` for the interior space service network contract system contract.
   */
  id: string;

  /**
   * Id of the system this run belongs to.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `system` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `system` for the interior space service network contract system contract.
   */
  system: string;

  /**
   * Id of the port the medium leaves from; it must be `out` or `bidirectional`.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `from` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `from` for the interior space service network contract system contract.
   */
  from: string;

  /**
   * Id of the port the medium arrives at; it must be `in` or `bidirectional`.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `to` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `to` for the interior space service network contract system contract.
   */
  to: string;

  /**
   * World centre line in metres, including both endpoints. The first point must
   * coincide with the `from` port and the last with the `to` port.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `route` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `route` for the interior space service network contract system contract.
   */
  route: IAutoMovieVector3[];

  /**
   * Outer radius in metres used for clash and clearance; greater than `0`.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `radius` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `radius` for the interior space service network contract system contract.
   */
  radius: number;

  /**
   * Internal cross-section in square metres; greater than `0`.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `section` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `section` for the interior space service network contract system contract.
   */
  section: number;

  /**
   * Ids of the penetrations this run passes through, in no particular order.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `penetrations` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `penetrations` for the interior space service network contract system contract.
   */
  penetrations: string[];
}

/**
 * One sleeve where a run crosses a boundary of the served environment.
 *
 * A penetration is a first-class record rather than a property of the run
 * because a boundary owns it: a fire compartment wall, a waterproof tanking
 * layer and an acoustic separation each care that the hole exists, how big it
 * is, and whether it was made good.
 *
 * @evidence requirements/building-exterior/services-and-envelope-interfaces.md#building-service-envelope-penetration Exposes `IAutoMovieServicePenetration` as the portable data boundary for the building service envelope penetration requirement.
 * @evidence specifications/building-envelope/services-water-weather-and-site.md#building-envelope-service-penetration-equipment-invariant Types `IAutoMovieServicePenetration` for the building envelope service penetration equipment invariant system contract.
 */
export interface IAutoMovieServicePenetration {
  /**
   * Stable penetration identity within the network.
   *
   * @evidence requirements/building-exterior/services-and-envelope-interfaces.md#building-service-envelope-penetration Exposes `id` as the portable data boundary for the building service envelope penetration requirement.
   * @evidence specifications/building-envelope/services-water-weather-and-site.md#building-envelope-service-penetration-equipment-invariant Types `id` for the building envelope service penetration equipment invariant system contract.
   */
  id: string;

  /**
   * Id of the boundary of the served environment this sleeve is cut through.
   *
   * @evidence requirements/building-exterior/services-and-envelope-interfaces.md#building-service-envelope-penetration Exposes `boundary` as the portable data boundary for the building service envelope penetration requirement.
   * @evidence specifications/building-envelope/services-water-weather-and-site.md#building-envelope-service-penetration-equipment-invariant Types `boundary` for the building envelope service penetration equipment invariant system contract.
   */
  boundary: string;

  /**
   * Id of the declared opening of that boundary the sleeve passes through, or
   * `null` when the sleeve is a bare cored hole.
   *
   * Citing one is a stronger claim than citing the boundary alone: where that
   * opening states a profile, the sleeve is held inside the void it names
   * rather than merely somewhere on the same wall.
   *
   * @evidence requirements/building-exterior/services-and-envelope-interfaces.md#building-service-envelope-penetration Exposes `opening` as the portable data boundary for the building service envelope penetration requirement.
   * @evidence specifications/building-envelope/services-water-weather-and-site.md#building-envelope-service-penetration-equipment-invariant Types `opening` for the building envelope service penetration equipment invariant system contract.
   */
  opening: string | null;

  /**
   * World position of the sleeve centre, in metres.
   *
   * Where the pierced boundary declares a face, this is read in that boundary's
   * own frame and held inside its outline and its thickness. Where it declares
   * none, the position is only held against the runs that cite the sleeve, and
   * `serviceAnalysisSupport` reports the difference by name.
   *
   * @evidence requirements/building-exterior/services-and-envelope-interfaces.md#building-service-envelope-penetration Exposes `position` as the portable data boundary for the building service envelope penetration requirement.
   * @evidence specifications/building-envelope/services-water-weather-and-site.md#building-envelope-service-penetration-equipment-invariant Types `position` for the building envelope service penetration equipment invariant system contract.
   */
  position: IAutoMovieVector3;

  /**
   * Clear radius of the sleeve in metres; greater than `0`.
   *
   * @evidence requirements/building-exterior/services-and-envelope-interfaces.md#building-service-envelope-penetration Exposes `radius` as the portable data boundary for the building service envelope penetration requirement.
   * @evidence specifications/building-envelope/services-water-weather-and-site.md#building-envelope-service-penetration-equipment-invariant Types `radius` for the building envelope service penetration equipment invariant system contract.
   */
  radius: number;

  /**
   * Whether the annulus around the run was made good — fire-stopped, tanked or
   * gasketed. A sleeve through a waterproof membrane that is not sealed is a
   * leak the render cannot show.
   *
   * @evidence requirements/building-exterior/services-and-envelope-interfaces.md#building-service-envelope-penetration Exposes `sealed` as the portable data boundary for the building service envelope penetration requirement.
   * @evidence specifications/building-envelope/services-water-weather-and-site.md#building-envelope-service-penetration-equipment-invariant Types `sealed` for the building envelope service penetration equipment invariant system contract.
   */
  sealed: boolean;
}

/**
 * Named operating state of a valve, a damper, a switch or a similar device.
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `IAutoMovieServiceState` as the portable data boundary for the interior service network validation requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `IAutoMovieServiceState` for the interior space service network contract system contract.
 */
export interface IAutoMovieServiceState {
  /**
   * Author-named state such as `open`, `closed`, or `throttled`.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `name` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `name` for the interior space service network contract system contract.
   */
  name: string;

  /**
   * Fraction of nominal capacity the state passes, within the closed range `[0,
   * 1]`. Exactly `0` isolates everything downstream of the device.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `opening` as the portable data boundary for the interior service network validation requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `opening` for the interior space service network contract system contract.
   */
  opening: number;
}

/**
 * Which engineering discipline owns a system's rules.
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `AutoMovieServiceDiscipline` as the portable data boundary for the interior service network validation requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `AutoMovieServiceDiscipline` for the interior space service network contract system contract.
 */
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
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `AutoMovieServiceMedium` as the portable data boundary for the interior service network validation requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `AutoMovieServiceMedium` for the interior space service network contract system contract.
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

/**
 * The unit a capacity or a demand is stated in.
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment Exposes `AutoMovieServiceUnit` as the portable data boundary for the interior service capacity environment requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `AutoMovieServiceUnit` for the interior space service network contract system contract.
 */
export type AutoMovieServiceUnit =
  | "cubic-meter-per-second"
  | "watt"
  | "ampere"
  | "bit-per-second"
  | "dimensionless";

/**
 * How reachability is traversed from a system's root.
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `AutoMovieServiceFlow` as the portable data boundary for the interior service network validation requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `AutoMovieServiceFlow` for the interior space service network contract system contract.
 */
export type AutoMovieServiceFlow = "from-root" | "to-root" | "undirected";

/**
 * Which way a port faces, stated relative to the node that owns it.
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `AutoMovieServicePortDirection` as the portable data boundary for the interior service network validation requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `AutoMovieServicePortDirection` for the interior space service network contract system contract.
 */
export type AutoMovieServicePortDirection = "in" | "out" | "bidirectional";

/**
 * Computational family of a node.
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Exposes `AutoMovieServiceNodeKind` as the portable data boundary for the interior service network validation requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Types `AutoMovieServiceNodeKind` for the interior space service network contract system contract.
 */
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
