import {
  AutoMovieSubject,
  type IAutoMovieSubjectContribution,
  lowerBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltBoundary,
  IAutoMovieBuiltConnector,
  IAutoMovieBuiltElement,
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltOpening,
  IAutoMovieBuiltSpace,
  IAutoMovieModel,
  IAutoMovieQuaternion,
  IAutoMovieShotBuildContext,
  IAutoMovieSurface,
  IAutoMovieTransform,
} from "@automovie/interface";

const NO_ROTATION: IAutoMovieQuaternion = { x: 0, y: 0, z: 0, w: 1 };

const place = (
  translation: { x: number; y: number; z: number },
  rotation: IAutoMovieQuaternion = NO_ROTATION,
  scale: { x: number; y: number; z: number } = { x: 1, y: 1, z: 1 },
): IAutoMovieTransform => ({ translation, rotation, scale });

/** A yaw about the world up axis, as the unit quaternion a transform wants. */
const yaw = (radians: number): IAutoMovieQuaternion => ({
  x: 0,
  y: Math.sin(radians / 2),
  z: 0,
  w: Math.cos(radians / 2),
});

/** An axis-aligned convex cell, the shape a logical volume is built from. */
const boxCell = (
  id: string,
  min: { x: number; y: number; z: number },
  max: { x: number; y: number; z: number },
) => ({
  id,
  planes: [
    { normal: { x: 1, y: 0, z: 0 }, offset: max.x },
    { normal: { x: -1, y: 0, z: 0 }, offset: -min.x },
    { normal: { x: 0, y: 1, z: 0 }, offset: max.y },
    { normal: { x: 0, y: -1, z: 0 }, offset: -min.y },
    { normal: { x: 0, y: 0, z: 1 }, offset: max.z },
    { normal: { x: 0, y: 0, z: -1 }, offset: -min.z },
  ],
});

/** One reusable unit box, scaled per member instead of remodelled per member. */
const boxModel = (): IAutoMovieModel => ({
  id: "building-box",
  name: "Reusable unit box for architectural members",
  origin: "generated",
  skeleton: null,
  materials: [],
  parts: [
    {
      id: "box",
      name: null,
      geometry: {
        type: "primitive",
        shape: { type: "box", width: 1, height: 1, depth: 1 },
      },
      material: null,
      attachedBone: null,
      transform: null,
    },
  ],
  asset: null,
  body: null,
});

/**
 * A floor patch in world plan coordinates, stated once per storey.
 *
 * Support surfaces are world-space, so a turned unit turns its floors with the
 * same angle its root carries rather than leaving axis-aligned rectangles under
 * a rotated building.
 */
const floorSurface = (props: {
  id: string;
  elevation: number;
  half: { x: number; z: number };
  origin: { x: number; z: number };
  heading: number;
}): IAutoMovieSurface => {
  const cos = Math.cos(props.heading);
  const sin = Math.sin(props.heading);
  const corner = (sx: number, sz: number) => {
    const x = sx * props.half.x;
    const z = sz * props.half.z;
    return {
      x: props.origin.x + x * cos + z * sin,
      y: 0,
      z: props.origin.z - x * sin + z * cos,
    };
  };
  const polygon = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
  return {
    id: props.id,
    kind: "floor",
    polygon,
    anchor: { x: polygon[0]!.x, y: props.elevation, z: polygon[0]!.z },
    rampTo: null,
  };
};

/**
 * A code-first building technique, deliberately not part of any production.
 *
 * The work owns two independent building units : a tower and a yawed annex :
 * plus the sky-bridge that couples them at two different heights. Everything
 * repeated is written once: a storey's slab, its logical space, its room, its
 * door, and the stair up to it are all derived from one index, so raising
 * `storeys` cannot leave a copied record behind. A storey is one `kind` string
 * beside `mezzanine` and `attic` rather than the root of the hierarchy, which
 * is what lets the same graph describe ancient, medieval, modern, or
 * speculative work through different code and models.
 *
 * The building's own envelope, facade ladder, and helipad are inside its scope.
 * Surrounding ground, sky, sun, and natural water are not: they stay with the
 * production world and are read as context, never copied in here.
 *
 * Each storey's partition carries a located face, and the door in it carries
 * the void it cuts in that face plus one hinged panel with named `closed` and
 * `open` states. The engine holds the leaf inside its own hole and stages
 * whichever state the record stands in, so "the door is open" cannot become a
 * fact the render contradicts.
 *
 * The lift is the same technique applied to a run rather than to a hole, and it
 * is why a shaft passing four floors is one relation and not four. The stops
 * between its two ends are `landings`, so an adjacency query answers with every
 * floor the car reaches instead of only the two the record happens to name; the
 * car and its counterweight are `carriages` travelling on one degree of freedom
 * each, and a named state places both at once and says which space the car is
 * standing at. That last field is what turns "the car is at level three" into a
 * fact the engine settles : it places the car and refuses a state whose car
 * lands outside the space it claims : while the counterweight, travelling the
 * other way, serves nothing and says so.
 *
 * The geometry is deliberately crude: one unit box scaled per member. What this
 * file demonstrates is the authoring technique : how a subject class composes
 * elements, spaces, boundaries, openings, connectors and surfaces and returns a
 * typed contribution from one `render()` : not a library of parts to call. A
 * production models its own slabs, walls, and fittings; nothing here is meant
 * to be reused as content, and `kind` stays an open string so any period or
 * idiom is expressible without a catalogue shipped from here.
 */
export class ExampleBuilding extends AutoMovieSubject<IAutoMovieBuiltEnvironment> {
  public readonly id = "example-building";

  /** Tower storeys, including the mezzanine at index 1 and the attic on top. */
  public readonly storeys = 4;
  public readonly storeyHeight = 3.2;
  public readonly towerHalf = { x: 6, z: 4 };

  /** The second unit: its own root, its own storey height, its own heading. */
  public readonly annexStoreys = 2;
  public readonly annexStoreyHeight = 4.2;
  public readonly annexYaw = Math.PI / 9;
  public readonly annexOrigin = { x: 22, z: 5 };
  public readonly annexHalf = { x: 5, z: 4 };

  /** Which tower storey the sky-bridge leaves from. */
  public readonly bridgeStorey = 2;

  /**
   * The lift shaft, stated once for the same reason the door is.
   *
   * The plan position decides three separate things: where the route runs,
   * where the car stands on it, and where the counterweight rides beside it. A
   * car authored at a coordinate the route does not pass through is a car the
   * shaft only appears to contain, so the number is written here and read three
   * times rather than typed three times. The cabin's own size is separate on
   * purpose: it belongs to the visible shell, never to the frame that travels.
   */
  public readonly liftAxis = { x: 4, z: 0 };
  public readonly liftCar = { width: 1.4, depth: 1.6, height: 2.3 };
  public readonly counterweightOffset = 0.9;

  /**
   * The door repeated on every storey, stated once.
   *
   * The hinge position and the leaf size decide four separate things: where the
   * hinge element stands, where the leaf hangs off it, where the void is cut in
   * the partition's face, and how wide the doorway connector is. Writing them
   * once is what keeps the engine's fit check from turning into a puzzle the
   * first time one of them is nudged.
   */
  public readonly doorHinge = 0.75;
  public readonly doorWidth = 0.9;
  public readonly doorHeight = 2.1;

  /** The storey a floor index belongs to, as a classification not a level. */
  public storeyKind(index: number): string {
    if (index === 1) return "mezzanine";
    if (index === this.storeys - 1) return "attic";
    return "storey";
  }

  /** Where a tower storey's slab sits, in metres above the tower's own root. */
  public storeyElevation(index: number): number {
    return index * this.storeyHeight;
  }

  /**
   * How high a carriage's own origin rests above the storey it stands at.
   *
   * Half a storey, deliberately. The engine settles a `serves` claim against
   * the driven element's world origin, so a car resting exactly on the slab
   * line it shares with the floor below would be a coin toss between two
   * storeys; the middle of the volume is the only place the claim is
   * decidable.
   */
  public carriageRise(): number {
    return this.storeyHeight / 2;
  }

  public design(): IAutoMovieBuiltEnvironment {
    const towers = Array.from({ length: this.storeys }, (_, index) => index);
    const annexes = Array.from(
      { length: this.annexStoreys },
      (_, index) => index,
    );
    const towerTop = this.storeyElevation(this.storeys - 1);

    const spaces: IAutoMovieBuiltSpace[] = [
      { id: "tower", kind: "building", parent: null, cells: [] },
      ...towers.flatMap((index) => {
        const bottom = this.storeyElevation(index);
        const top = bottom + this.storeyHeight;
        return [
          {
            id: `tower-storey-${index}`,
            kind: this.storeyKind(index),
            parent: "tower",
            cells: [
              boxCell(
                `tower-storey-${index}-cell`,
                { x: -this.towerHalf.x, y: bottom, z: -this.towerHalf.z },
                { x: this.towerHalf.x, y: top, z: this.towerHalf.z },
              ),
            ],
          },
          {
            id: `tower-room-${index}`,
            kind: "room",
            parent: `tower-storey-${index}`,
            cells: [
              boxCell(
                `tower-room-${index}-cell`,
                { x: 0, y: bottom, z: -this.towerHalf.z },
                { x: this.towerHalf.x, y: top, z: this.towerHalf.z },
              ),
            ],
          },
        ];
      }),
      {
        id: "tower-roof",
        kind: "roof-deck",
        parent: "tower",
        cells: [
          boxCell(
            "tower-roof-cell",
            {
              x: -this.towerHalf.x,
              y: towerTop + this.storeyHeight,
              z: -this.towerHalf.z,
            },
            {
              x: this.towerHalf.x,
              y: towerTop + this.storeyHeight + 2,
              z: this.towerHalf.z,
            },
          ),
        ],
      },
      { id: "annex", kind: "building", parent: null, cells: [] },
      ...annexes.map((index) => ({
        id: `annex-storey-${index}`,
        kind: "storey",
        parent: "annex",
        cells: [],
      })),
    ];

    const elements: IAutoMovieBuiltElement[] = [
      {
        id: "tower-root",
        kind: "building",
        parent: null,
        transform: place({ x: 0, y: 0, z: 0 }),
        model: null,
        space: "tower",
      },
      ...towers.flatMap((index): IAutoMovieBuiltElement[] => [
        {
          id: `tower-slab-${index}`,
          kind: index === 1 ? "mezzanine-slab" : "floor-slab",
          parent: "tower-root",
          transform: place(
            { x: 0, y: this.storeyElevation(index), z: 0 },
            NO_ROTATION,
            { x: this.towerHalf.x * 2, y: 0.2, z: this.towerHalf.z * 2 },
          ),
          model: "building-box",
          space: `tower-storey-${index}`,
        },
        {
          id: `tower-partition-${index}`,
          kind: "partition-wall",
          parent: "tower-root",
          transform: place(
            {
              x: 0,
              y: this.storeyElevation(index) + this.storeyHeight / 2,
              z: 0,
            },
            NO_ROTATION,
            { x: 0.2, y: this.storeyHeight, z: this.towerHalf.z * 2 },
          ),
          model: "building-box",
          space: `tower-storey-${index}`,
        },
        {
          // The hinge, not the leaf, is the frame the door turns in: it shares
          // the partition's own face frame, so the leaf spans local +X by its
          // width and local +Y by its height from the pivot at its origin.
          id: `tower-door-hinge-${index}`,
          kind: "door",
          parent: "tower-root",
          transform: place(
            { x: 0, y: this.storeyElevation(index), z: this.doorHinge },
            yaw(-Math.PI / 2),
          ),
          model: null,
          space: `tower-room-${index}`,
        },
        {
          id: `tower-door-leaf-${index}`,
          kind: "door-leaf",
          parent: `tower-door-hinge-${index}`,
          transform: place(
            { x: this.doorWidth / 2, y: this.doorHeight / 2, z: 0 },
            NO_ROTATION,
            { x: this.doorWidth, y: this.doorHeight, z: 0.1 },
          ),
          model: "building-box",
          space: `tower-room-${index}`,
        },
      ]),
      // The envelope belongs to the unit rather than to any one room, which is
      // why these four elements name no logical space at all.
      ...[0, 1, 2, 3].map((quarter): IAutoMovieBuiltElement => {
        const alongX = quarter % 2 === 0;
        const sign = quarter < 2 ? 1 : -1;
        return {
          id: `tower-curtain-${quarter}`,
          kind: "envelope",
          parent: "tower-root",
          transform: place(
            {
              x: alongX ? 0 : sign * (this.towerHalf.x + 0.1),
              y: towerTop / 2,
              z: alongX ? sign * (this.towerHalf.z + 0.1) : 0,
            },
            NO_ROTATION,
            {
              x: alongX ? this.towerHalf.x * 2 : 0.2,
              y: towerTop + this.storeyHeight,
              z: alongX ? 0.2 : this.towerHalf.z * 2,
            },
          ),
          model: "building-box",
          space: null,
        };
      }),
      {
        id: "tower-facade-ladder",
        kind: "facade-ladder",
        parent: "tower-root",
        transform: place(
          { x: this.towerHalf.x + 0.3, y: towerTop / 2, z: 0 },
          NO_ROTATION,
          { x: 0.15, y: towerTop, z: 0.5 },
        ),
        model: "building-box",
        space: null,
      },
      {
        id: "tower-helipad",
        kind: "helipad",
        parent: "tower-root",
        transform: place(
          { x: 0, y: towerTop + this.storeyHeight, z: 0 },
          NO_ROTATION,
          { x: 8, y: 0.2, z: 8 },
        ),
        model: "building-box",
        space: "tower-roof",
      },
      {
        // The frame the shaft drives, and deliberately unscaled. A travel value
        // is a displacement in the driven element's OWN local frame, so a
        // carriage bolted straight onto a box stretched to cabin height would
        // rise that height for every metre it was asked for. It is the same
        // reason the door's panel drives the hinge rather than the leaf: the
        // moving frame carries no size, and the size hangs off it.
        id: "tower-lift-car",
        kind: "lift-car",
        parent: "tower-root",
        transform: place({
          x: this.liftAxis.x,
          y: this.carriageRise(),
          z: this.liftAxis.z,
        }),
        model: null,
        // The car belongs to the shaft rather than to any one storey, which is
        // exactly why it names no logical space: which room it is in is a
        // question its operating state answers, not its declaration.
        space: null,
      },
      {
        // The visible cabin, at its own size, hung off that frame.
        id: "tower-lift-car-shell",
        kind: "lift-car-shell",
        parent: "tower-lift-car",
        transform: place({ x: 0, y: 0, z: 0 }, NO_ROTATION, {
          x: this.liftCar.width,
          y: this.liftCar.height,
          z: this.liftCar.depth,
        }),
        model: "building-box",
        space: null,
      },
      {
        // Rest is the top of its travel, because a counterweight starts where
        // the car does not. Stating the rest pose at the far end is what lets
        // every state below be a plain negative displacement.
        id: "tower-lift-counterweight",
        kind: "counterweight",
        parent: "tower-root",
        transform: place({
          x: this.liftAxis.x + this.counterweightOffset,
          y: this.carriageRise() + towerTop,
          z: this.liftAxis.z,
        }),
        model: null,
        space: null,
      },
      {
        id: "tower-lift-counterweight-block",
        kind: "counterweight-block",
        parent: "tower-lift-counterweight",
        transform: place({ x: 0, y: 0, z: 0 }, NO_ROTATION, {
          x: 0.3,
          y: 1.2,
          z: 0.6,
        }),
        model: "building-box",
        space: null,
      },
      {
        // A second unit with its own coordinate root: moved and turned as a
        // whole, without a single child transform being rewritten.
        id: "annex-root",
        kind: "building",
        parent: null,
        transform: place(
          { x: this.annexOrigin.x, y: 0, z: this.annexOrigin.z },
          yaw(this.annexYaw),
        ),
        model: null,
        space: "annex",
      },
      ...annexes.map((index): IAutoMovieBuiltElement => {
        return {
          id: `annex-slab-${index}`,
          kind: "floor-slab",
          parent: "annex-root",
          transform: place(
            { x: 0, y: index * this.annexStoreyHeight, z: 0 },
            NO_ROTATION,
            { x: this.annexHalf.x * 2, y: 0.2, z: this.annexHalf.z * 2 },
          ),
          model: "building-box",
          space: `annex-storey-${index}`,
        };
      }),
    ];

    const boundaries: IAutoMovieBuiltBoundary[] = [
      ...towers.slice(1).map((index) => ({
        id: `tower-slab-boundary-${index}`,
        kind: "floor-ceiling",
        spaces: [`tower-storey-${index - 1}`, `tower-storey-${index}`],
        elements: [`tower-slab-${index}`],
      })),
      ...towers.map((index) => ({
        id: `tower-partition-boundary-${index}`,
        kind: "wall",
        spaces: [`tower-storey-${index}`, `tower-room-${index}`],
        elements: [`tower-partition-${index}`],
        // The separation is somewhere, and saying where is what lets the door
        // below be held inside it instead of merely declared next to it.
        face: {
          origin: {
            x: 0,
            y: this.storeyElevation(index),
            z: -this.towerHalf.z,
          },
          rotation: yaw(-Math.PI / 2),
          outline: [
            { x: 0, y: 0 },
            { x: this.towerHalf.z * 2, y: 0 },
            { x: this.towerHalf.z * 2, y: this.storeyHeight },
            { x: 0, y: this.storeyHeight },
          ],
          thickness: 0.2,
        },
      })),
    ];

    const openings: IAutoMovieBuiltOpening[] = towers.map((index) => ({
      id: `tower-door-${index}`,
      kind: "door",
      boundary: `tower-partition-boundary-${index}`,
      fill: `tower-door-hinge-${index}`,
      // The void is written in the host boundary's own frame, so the leaf and
      // the hole it fills are measured in one coordinate system. A rectangle is
      // the simplest outline; an arched head would be the same four corners
      // with one bulged edge.
      profile: {
        outline: [
          { x: this.towerHalf.z + this.doorHinge, y: 0 },
          { x: this.towerHalf.z + this.doorHinge + this.doorWidth, y: 0 },
          {
            x: this.towerHalf.z + this.doorHinge + this.doorWidth,
            y: this.doorHeight,
          },
          { x: this.towerHalf.z + this.doorHinge, y: this.doorHeight },
        ],
      },
      operation: {
        panels: [
          {
            id: "leaf",
            element: `tower-door-hinge-${index}`,
            width: this.doorWidth,
            height: this.doorHeight,
            motion: {
              kind: "revolute",
              axis: { x: 0, y: 1, z: 0 },
              pivot: { x: 0, y: 0, z: 0 },
              min: 0,
              max: Math.PI / 2,
            },
          },
        ],
        // The names are this production's to choose; the engine only checks
        // that each state drives every panel inside its own travel.
        states: [
          { id: "closed", panels: [{ panel: "leaf", value: 0 }] },
          { id: "open", panels: [{ panel: "leaf", value: Math.PI / 2 }] },
        ],
        state: "closed",
        hardware: [{ id: "frame", kind: "door-frame", element: null }],
      },
    }));

    const connectors: IAutoMovieBuiltConnector[] = [
      ...towers.slice(1).map((index) => ({
        id: `tower-stair-${index}`,
        kind: "stair" as const,
        from: `tower-storey-${index - 1}`,
        to: `tower-storey-${index}`,
        bidirectional: true,
        route: [
          { x: -4, y: this.storeyElevation(index - 1), z: 0 },
          { x: -2, y: this.storeyElevation(index), z: 0 },
        ],
        // A straight flight faces one way the whole climb; a turning or
        // helical one would vary this station by station, which is the only
        // way its treads could be told apart at all.
        orientations: [yaw(Math.PI / 2), yaw(Math.PI / 2)],
        width: 1.4,
        clearHeight: 2.2,
        // Derived from the storey it climbs rather than typed beside it, so
        // the risers still add up when `storeyHeight` changes.
        steps: {
          count: 16,
          rise: this.storeyHeight / 16,
          run: 2 / 16,
        },
        elements: [],
      })),
      ...towers.map((index) => ({
        id: `tower-doorway-${index}`,
        kind: "passage" as const,
        from: `tower-storey-${index}`,
        to: `tower-room-${index}`,
        bidirectional: true,
        // The passage runs through the middle of the very void the door fills,
        // at the size of that void: the connector and the opening are two
        // statements about one hole, so they read from one set of numbers.
        route: [
          {
            x: -0.6,
            y: this.storeyElevation(index),
            z: this.doorHinge + this.doorWidth / 2,
          },
          {
            x: 0.6,
            y: this.storeyElevation(index),
            z: this.doorHinge + this.doorWidth / 2,
          },
        ],
        width: this.doorWidth,
        clearHeight: this.doorHeight,
        elements: [`tower-door-leaf-${index}`],
      })),
      {
        id: "tower-lift",
        kind: "lift",
        from: "tower-storey-0",
        to: `tower-storey-${this.storeys - 1}`,
        bidirectional: true,
        // The floors between the two ends. Omitting them would leave the shaft
        // the two-ended relation a corridor is, and every storey it actually
        // stops at would be a floor only its geometry knew about. Each stop is
        // an arc-length fraction of the route, derived from the storey it
        // serves so the list still lands on the slabs when `storeyHeight`
        // changes.
        landings: towers.slice(1, -1).map((index) => ({
          space: `tower-storey-${index}`,
          at: this.storeyElevation(index) / towerTop,
        })),
        route: [
          { x: this.liftAxis.x, y: 0, z: this.liftAxis.z },
          { x: this.liftAxis.x, y: towerTop, z: this.liftAxis.z },
        ],
        width: 1.6,
        clearHeight: 2.4,
        // What a stair answers by standing still, a lift cannot. Two bodies,
        // one degree of freedom each, and named states that place both at once
        //; the same shape the door's operation has, plus the two things only a
        // run needs: where the travel leaves somebody, and which way it is
        // driven.
        operation: {
          carriages: [
            {
              id: "car",
              element: "tower-lift-car",
              motion: {
                kind: "prismatic",
                axis: { x: 0, y: 1, z: 0 },
                min: 0,
                max: towerTop,
              },
            },
            {
              id: "counterweight",
              element: "tower-lift-counterweight",
              // Mirror travel: rest is the top, so its whole range is negative
              // and it is at the bottom exactly when the car is at the top.
              motion: {
                kind: "prismatic",
                axis: { x: 0, y: 1, z: 0 },
                min: -towerTop,
                max: 0,
              },
            },
          ],
          states: [
            ...towers.map((index) => ({
              id: `level-${index}`,
              carriages: [
                {
                  carriage: "car",
                  value: this.storeyElevation(index),
                  // The claim the engine settles against geometry: it applies
                  // the state, places the car, and refuses a level whose car
                  // does not stand inside the storey it names.
                  serves: `tower-storey-${index}`,
                },
                {
                  carriage: "counterweight",
                  value: -this.storeyElevation(index),
                  // A counterweight carries nobody anywhere. Naming a storey
                  // here would be a stop no passenger can use, so it names
                  // none and the record says as much.
                  serves: null,
                },
              ],
              // A car standing at a floor is not being driven at all, which is
              // what a stopped lift and a switched-off escalator have in
              // common.
              drive: "still" as const,
            })),
            {
              id: "ascending",
              carriages: [
                { carriage: "car", value: towerTop / 2, serves: null },
                {
                  carriage: "counterweight",
                  value: -towerTop / 2,
                  serves: null,
                },
              ],
              // Mid-shaft the car serves nothing, and `forward` runs from the
              // connector's own `from` toward its `to`. A one-way run may not
              // declare a state driven against its own direction.
              drive: "forward" as const,
            },
          ],
          state: "level-0",
        },
        // The two driven frames, not the boxes hung off them. A carriage must
        // drive an element this list names or one below it, so naming the
        // shells instead would leave the frames outside the run they belong to
        // and be refused; naming the frames covers both by descent.
        elements: ["tower-lift-car", "tower-lift-counterweight"],
      },
      {
        id: "tower-roof-ladder",
        kind: "ladder",
        from: `tower-storey-${this.storeys - 1}`,
        to: "tower-roof",
        bidirectional: true,
        route: [
          { x: this.towerHalf.x + 0.3, y: towerTop, z: 0 },
          {
            x: this.towerHalf.x + 0.3,
            y: towerTop + this.storeyHeight,
            z: 0,
          },
        ],
        width: 0.5,
        clearHeight: 2,
        elements: ["tower-facade-ladder"],
      },
      {
        // The one relation the work owns rather than either unit: it lands on
        // two different units, at two different heights.
        id: "skybridge",
        kind: "bridge",
        from: `tower-storey-${this.bridgeStorey}`,
        to: `annex-storey-${this.annexStoreys - 1}`,
        bidirectional: true,
        route: [
          {
            x: this.towerHalf.x,
            y: this.storeyElevation(this.bridgeStorey),
            z: 0,
          },
          {
            x: this.annexOrigin.x,
            y: (this.annexStoreys - 1) * this.annexStoreyHeight,
            z: this.annexOrigin.z,
          },
        ],
        // A bridge that widens into a landing at each end states a section
        // along its route instead of one scalar. The constant pair and this
        // varying spelling are mutually exclusive: two spellings of one fact
        // are two facts that can disagree.
        sections: [
          { at: 0, width: 3, clearHeight: 2.6 },
          { at: 0.5, width: 2.4, clearHeight: 2.6 },
          { at: 1, width: 3, clearHeight: 2.6 },
        ],
        elements: [],
      },
    ];

    const surfaces = [
      ...towers.map((index) => ({
        space: `tower-storey-${index}`,
        surface: floorSurface({
          id: `tower-floor-${index}`,
          elevation: this.storeyElevation(index),
          half: this.towerHalf,
          origin: { x: 0, z: 0 },
          heading: 0,
        }),
      })),
      ...annexes.map((index) => ({
        space: `annex-storey-${index}`,
        surface: floorSurface({
          id: `annex-floor-${index}`,
          elevation: index * this.annexStoreyHeight,
          half: this.annexHalf,
          origin: this.annexOrigin,
          heading: this.annexYaw,
        }),
      })),
    ];

    return {
      version: 1,
      id: this.id,
      units: "meter",
      buildings: [
        { id: "tower", element: "tower-root", space: "tower" },
        { id: "annex", element: "annex-root", space: "annex" },
      ],
      models: [boxModel()],
      modelReferences: [],
      elements,
      spaces,
      boundaries,
      openings,
      connectors,
      surfaces,
      walkable: surfaces.map((entry) => entry.surface.id),
    };
  }

  public render(
    _context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return lowerBuiltEnvironment(this.design());
  }
}
