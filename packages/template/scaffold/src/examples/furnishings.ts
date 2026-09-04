import {
  arrangePlantingCluster,
  validatePlantingDomain,
  validateSoftBodyDomain,
} from "@automovie/engine";
import type {
  IAutoMoviePlantingCluster,
  IAutoMoviePlantingDomain,
  IAutoMovieSoftBodyDomain,
  IAutoMovieVector3,
} from "@automovie/interface";

/**
 * A curtain and a bed of plants, as laws rather than as meshes.
 *
 * ## The one rule this example exists to teach
 *
 * Neither record below is geometry, and neither is a keyframe. A curtain is a
 * particle lattice plus the boundary conditions its states move; a plant is a
 * branching law plus how far along it has grown. Both are solved
 * deterministically from the record alone, so the same panel folds and the same
 * fern branches identically on every machine and in every re-render, and
 * neither has to be modelled twice to be shown twice.
 *
 * That is why authoring stops at the law. Model a draped curtain and you have
 * one drape; state the lattice, the mass, the anchors and the wind, and `open`
 * and `closed` are two solves of one panel that cannot contradict each other's
 * physics. Model a fern and you have one fern; state the branching law, and a
 * cluster of nine is nine seeded evaluations of it rather than nine copies.
 *
 * ## There is no species catalogue, and there will not be one
 *
 * A fern, a ficus, a wall of ivy and an aquatic reed differ by angles, ratios,
 * growth direction and leaf density : not by a name the engine would have to
 * recognise. Shipping a preset would be shipping content dressed as capability.
 * The numbers below are one plant's worth of those parameters, exposed as
 * `props` so the whole habit changes when one of them is edited.
 *
 * ## The two records do not share a frame, and it matters
 *
 * A panel's rest mesh and its colliders are **world** coordinates: the curtain
 * hangs where you write it, and it drapes over the floor plane you name. A
 * planting recipe is grown in **its own** frame from the origin and placed
 * afterwards by a cluster, so its pruning envelope bounds the plant's reach
 * from its own base rather than a region of the room. Reading either one in the
 * other's frame is the mistake this pairing invites: a curtain authored at the
 * origin hangs through the floor, and a plant pruned to the room's coordinates
 * is cut away to nothing everywhere the bed actually put it.
 *
 * ## The step is derived, never typed
 *
 * A position-based step may not travel further than the shortest constraint, or
 * it tunnels through a collider and projects a constraint the wrong way. So the
 * step is computed from the lattice spacing it has to hold together rather than
 * typed beside it: refine the panel and the step follows, with no second number
 * to remember.
 */
export const exampleCurtainDomain = (
  props: {
    /** Stable identity of the panel. */
    id?: string;
    /** Particles across the panel's width. */
    columns?: number;
    /** Particles down its drop. */
    rows?: number;
    /** Horizontal particle spacing, in metres. */
    spacingX?: number;
    /** Vertical particle spacing, in metres. */
    spacingY?: number;
    /** World position of the track's first ring. */
    track?: IAutoMovieVector3;
    /** Mass of one ordinary particle, in kilograms. */
    particleMass?: number;
    /**
     * Mass of one hem particle, in kilograms. Heavier than the rest on purpose:
     * a weighted hem is the physical way to make a curtain hang straight, and
     * it beats a decorative parameter that fakes the same look.
     */
    hemMass?: number;
    /** Fastest particle motion the panel is designed for, in m/s. */
    referenceSpeed?: number;
    /** Ring spacing when the curtain is gathered open, in metres. */
    gather?: number;
    /**
     * Fraction of the travel limit the derived step takes. Below `1` by design,
     * so an author can nudge one number without the panel becoming unsolvable.
     */
    travel?: number;
  } = {},
): IAutoMovieSoftBodyDomain => {
  const columns = props.columns ?? 12;
  const rows = props.rows ?? 9;
  const spacingX = props.spacingX ?? 0.18;
  const spacingY = props.spacingY ?? 0.28;
  const track = props.track ?? { x: -1, y: 2.6, z: -1.2 };
  const particleMass = props.particleMass ?? 0.05;
  const hemMass = props.hemMass ?? 0.14;
  const referenceSpeed = props.referenceSpeed ?? 3;
  const gather = props.gather ?? 0.05;
  const travel = props.travel ?? 0.25;

  const count = columns * rows;
  // Row-major, `row * columns + column`, and the rest mesh is simultaneously
  // the panel's authored shape and the definition of every constraint's rest
  // length. A pre-folded curtain is stated here; the solver never invents one.
  const rest: number[] = [];
  for (let row = 0; row < rows; ++row)
    for (let column = 0; column < columns; ++column)
      rest.push(track.x + column * spacingX, track.y - row * spacingY, track.z);
  const mass = Array.from({ length: count }, (_unused, particle) =>
    particle >= count - columns ? hemMass : particleMass,
  );

  // The rings on the track, one per column of the top row. An anchored particle
  // is a hard boundary condition: it holds its position exactly and carries no
  // velocity, so no constraint and no collider can drag it away.
  const rings = Array.from({ length: columns }, (_unused, column) => ({
    id: `ring-${String(column).padStart(2, "0")}`,
    particle: column,
    // `null` holds the ring at its own rest position. Restating the coordinate
    // the rest mesh already carries is how a typo silently pre-stretches a
    // panel that nothing then reports.
    position: null,
  }));

  return {
    version: 1,
    id: props.id ?? "example-curtain",
    units: "meter",
    lattice: { columns, rows },
    solver: {
      fixedStepSeconds:
        (travel * Math.min(spacingX, spacingY)) / referenceSpeed,
      // A vector rather than a magnitude, so a panel can be solved in a tilted
      // frame without its rest mesh being rewritten.
      gravity: { x: 0, y: -9.81, z: 0 },
      drag: 0.9,
      // More sweeps make the panel less stretchy at a linear cost, which is the
      // honest trade a position-based solver offers instead of a spring
      // constant nobody can price.
      iterations: 8,
      stiffness: { structural: 0.9, shear: 0.6, bend: 0.25 },
      referenceSpeed,
      maxSteps: 6_000,
    },
    rest,
    mass,
    anchors: rings,
    states: [
      // Anchors absent from a state keep their declared position, so the drawn
      // state is the empty one and only the gathered state has to say anything.
      { id: "drawn", anchors: [] },
      {
        id: "gathered",
        anchors: rings.map((ring, column) => ({
          anchor: ring.id,
          position: {
            x: track.x + column * gather,
            y: track.y,
            z: track.z,
          },
        })),
      },
    ],
    // Stated in world space beside the rest mesh rather than pulled out of a
    // building graph, so the same panel drapes over the same floor whether or
    // not a building owns the frame. A binding may of course place both.
    colliders: [
      {
        kind: "plane",
        id: "floor",
        normal: { x: 0, y: 1, z: 0 },
        offset: 0,
      },
    ],
    // A triangular gust rather than a sine wave, because only `+ − × ÷`,
    // `abs`, `floor` and `sqrt` are exactly specified by IEEE-754 and
    // ECMAScript alike. A curtain whose folds depend on which engine built the
    // frame is not a deterministic curtain.
    wind: {
      direction: { x: 0, y: 0, z: 1 },
      acceleration: 0.4,
      gustAcceleration: 1.2,
      gustHz: 0.35,
    },
    // Declaring `true` here would be legitimate; it states what the panel
    // actually needs; and this tier answers `unsupported` rather than quietly
    // solving a panel that passes through itself. The answer comes from the
    // binding's lowering, not from the validator below: a domain on its own
    // validates either way, and it is `lowerSoftFurnishing` that hands back the
    // rest configuration with the status attached. This panel does not ask for
    // contact, so it says so.
    selfCollision: false,
  };
};

/**
 * A plant kept inside the volume its own habit is allowed, as a pruned law.
 *
 * Pruning is not clipping in the renderer. A branch whose base already stands
 * outside the envelope is never grown, and one that crosses it is cut exactly
 * at the crossing with only the children that emerged before the cut surviving.
 * So the derived structure is what a quantity take-off and a collision check
 * both read, rather than a shape that only looks trimmed from one camera.
 *
 * Read the envelope in the **recipe's own frame**, not in the room. Growth
 * starts the trunk at the origin, and a cluster placement moves the finished
 * structure afterwards, so this box states how far the plant may reach from its
 * own base; a clipped hedge profile, a trained wall, the inside of a planter;
 * and never where the bed stands. Writing the room's world coordinates here
 * would prune every member the cluster placed anywhere else down to nothing.
 *
 * Growth is a state and not an animation: `stage` is a scalar and the derived
 * structure is a pure function of the whole record, so the same plant at the
 * same stage is the same plant everywhere.
 */
export const examplePlantingDomain = (
  props: {
    /** Stable identity of the recipe. */
    id?: string;
    /** Recursion depth; level `0` is the trunk. */
    levels?: number;
    /** Trunk length at full growth, in metres. */
    length?: number;
    /** Trunk radius at its base, in metres. */
    radius?: number;
    /** Minimum corner of the pruning envelope, in the recipe's own frame. */
    envelopeMin?: IAutoMovieVector3;
    /** Maximum corner of that envelope, in the same frame. */
    envelopeMax?: IAutoMovieVector3;
    /** How far along its law this plant has grown, in `[0, 1]`. */
    stage?: number;
    /** Deterministic seed; any safe integer. */
    seed?: number;
  } = {},
): IAutoMoviePlantingDomain => ({
  version: 1,
  id: props.id ?? "example-planting",
  units: "meter",
  seed: props.seed ?? 5_101,
  structure: {
    levels: props.levels ?? 4,
    axis: { x: 0, y: 1, z: 0 },
    length: props.length ?? 0.55,
    radius: props.radius ?? 0.02,
    lengthRatio: 0.72,
    radiusRatio: 0.62,
    // The branching pattern of the whole plant is this short list applied at
    // every level. Directions are authored as vectors rather than angles so no
    // transcendental function ever touches a coordinate, which is what makes a
    // leaf land in the same place on Windows and on POSIX.
    children: [
      { id: "a", direction: { x: 0.8, y: 1, z: 0 }, offset: 0.55 },
      { id: "b", direction: { x: -0.5, y: 1, z: 0.7 }, offset: 0.75 },
      { id: "c", direction: { x: -0.4, y: 1, z: -0.75 }, offset: 0.95 },
    ],
    directionJitter: 0.25,
    lengthJitter: 0.15,
    // Positive droops toward `-y`: the weeping habit of something in a raised
    // planter. Negative would lift the habit columnar instead.
    gravitropism: 0.35,
  },
  growth: {
    stage: props.stage ?? 0.85,
    // Level `l` starts extending at `stage = onset * l`, so a young plant is a
    // trunk with stubs. `onset * (levels − 1)` stays below `1` or the deepest
    // level could never emerge at all.
    onset: 0.22,
  },
  pruning: {
    kind: "box",
    min: props.envelopeMin ?? { x: -0.5, y: 0, z: -0.5 },
    max: props.envelopeMax ?? { x: 0.5, y: 1.6, z: 0.5 },
  },
  foliage: {
    density: 26,
    minLevel: 1,
    // Leaves are emitted as full-TRS instance occurrences, which is exactly
    // what GPU instancing consumes: never a degraded yaw or one uniform scale.
    size: { x: 0.09, y: 0.004, z: 0.05 },
    scaleJitter: 0.2,
    rollJitter: 0.6,
  },
  // A promise the recipe makes about itself, checked against the complete tree
  // its own law describes; not against the pruned result, because pruning only
  // ever shortens. A budget the law overruns is refused at authorship rather
  // than discovered as a frame that will not finish, so keep the headroom
  // deliberate: a cap twenty times the worst case is a number, not a promise,
  // and deepening `levels` past what these allow is meant to be refused.
  budget: { maxBranches: 64, maxLeaves: 512 },
});

/**
 * The arrangement: one recipe, many seeded placements, one collision rule.
 *
 * Repetition is generated rather than hand-duplicated, and a member that cannot
 * honour the spacing within its attempts is refused and counted instead of
 * squeezed in. That refusal is the point: a cluster that quietly overlapped
 * would be a cluster whose author was told nothing and whose frames changed
 * anyway.
 */
export const examplePlantingCluster = (
  props: {
    /** Stable cluster identity. */
    id?: string;
    /** Recipe every member grows from. */
    domain?: string;
    /** Members to place. */
    count?: number;
    /** World centre of the placement rectangle. */
    anchor?: IAutoMovieVector3;
    /** Half-extent of that rectangle, in metres. */
    extent?: { x: number; z: number };
    /** Centre-to-centre distance members must keep, in metres. */
    minSpacing?: number;
    /** Seeded placement attempts per member. */
    attempts?: number;
    /** Deterministic seed; any safe integer. */
    seed?: number;
  } = {},
): IAutoMoviePlantingCluster => ({
  id: props.id ?? "example-planting-bed",
  domain: props.domain ?? "example-planting",
  count: props.count ?? 9,
  anchor: props.anchor ?? { x: 2.4, y: 0.4, z: -2.2 },
  extent: props.extent ?? { x: 1.2, z: 0.5 },
  seed: props.seed ?? 5_137,
  minSpacing: props.minSpacing ?? 0.34,
  attempts: props.attempts ?? 24,
  scale: {
    min: { x: 0.85, y: 0.8, z: 0.85 },
    max: { x: 1.15, y: 1.25, z: 1.15 },
  },
  // Blended toward identity as a normalized quaternion interpolation, so a
  // partial jitter is a partial rotation rather than a scaled angle no
  // trigonometry-free derivation could reproduce exactly.
  yawJitter: 0.8,
});

/**
 * Check each law against itself, and the bed against the rule it declared.
 *
 * The two validators answer different questions. The panel's refuses a lattice
 * whose arrays are the wrong length, a zero mass, two rest particles with no
 * direction between them, a particle starting inside furniture, a state naming
 * an anchor nobody declared, and a step that would travel further than the
 * shortest constraint. The recipe's refuses a ratio that does not contract, a
 * growth span whose deepest level could never emerge, a zero direction, and a
 * complete tree that overruns the cap the recipe set for itself.
 *
 * The third check is the one neither validator can make: a bed is only as
 * arranged as its own spacing allows, so the arrangement has to place every
 * member it was asked for. Tighten the spacing or narrow the rectangle and this
 * is what tells you, instead of a frame quietly holding fewer plants.
 */
export const checkExampleFurnishings = (): void => {
  const curtain = validateSoftBodyDomain({ domain: exampleCurtainDomain() });
  if (curtain.success === false)
    throw new Error(
      `the example curtain cannot be solved: ${curtain.violations[0]!.path}`,
    );

  const recipe = examplePlantingDomain();
  const planting = validatePlantingDomain({ domain: recipe });
  if (planting.success === false)
    throw new Error(
      `the example planting recipe cannot be grown: ${planting.violations[0]!.path}`,
    );

  const cluster = examplePlantingCluster();
  // A cluster cites its recipe by id and no validator resolves that citation,
  // so a renamed recipe leaves a bed quietly growing nothing. Holding the two
  // together is the author's job, exactly as it is for a lineage's subjects.
  if (cluster.domain !== recipe.id)
    throw new Error(
      `the bed grows recipe "${cluster.domain}", which this example does not declare; it declares "${recipe.id}"`,
    );
  const arrangement = arrangePlantingCluster(cluster);
  if (arrangement.placements.length !== cluster.count)
    throw new Error(
      `the bed asked for ${cluster.count} member(s) and placed ${arrangement.placements.length}; ${arrangement.rejected} could not honour the ${cluster.minSpacing} m spacing`,
    );
};
