import {
  AutoMovieSubject,
  AutoMovieSubjectGroup,
  type IAutoMovieSubjectContribution,
  lowerBuiltEnvironment,
  mergeAutoMovieSubjectContributions,
  propAnchorFrame,
} from "@automovie/engine";
import type {
  IAutoMovieAffordance,
  IAutoMovieBuiltEnvironment,
  IAutoMovieClearanceBox,
  IAutoMovieModel,
  IAutoMovieNode,
  IAutoMoviePropBox,
  IAutoMoviePropRelation,
  IAutoMoviePropSpec,
  IAutoMovieShotBuildContext,
  IAutoMovieStageSetPiece,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

/**
 * How a prop states where it sits, as running code.
 *
 * Nothing in this file is a piece of furniture you are meant to use. Every
 * model below is one axis-aligned box, deliberately, because the box is the
 * placeholder you replace with your own geometry and the _relations_ are what
 * the file is for: which logical space a prop occupies, what supports it, what
 * it is fixed to, what it hangs from, which opening it fills, and how much room
 * it needs around itself. Those relations are checked by the engine, so a prop
 * standing in a doorway or a drawer that cannot open is a compile-time refusal
 * naming the field that authored it.
 *
 * Read it as six techniques rather than six objects. The class names say which
 * relation each one demonstrates; what the box happens to look like is the part
 * you throw away.
 */

const identity = (x = 0, y = 0, z = 0): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const placed = (
  x: number,
  y: number,
  z: number,
  scale: IAutoMovieVector3,
): IAutoMovieTransform => ({ ...identity(x, y, z), scale });

/** One placeholder box. Replace the geometry; keep the relations. */
const placeholderModel = (
  id: string,
  size: IAutoMovieVector3,
  affordances: IAutoMovieAffordance[] = [],
): IAutoMovieModel => ({
  id,
  name: null,
  origin: "generated",
  skeleton: null,
  affordances,
  materials: [],
  parts: [
    {
      id: "proxy",
      name: null,
      geometry: {
        type: "primitive",
        shape: { type: "box", width: size.x, height: size.y, depth: size.z },
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
 * One articulation joint; a prop declares its own root, so a parent may be
 * null.
 */
const joint = (id: string, parent: string | null = null): IAutoMovieNode => ({
  id,
  name: null,
  parent,
  kind: "group",
  transform: identity(),
  mesh: null,
  camera: null,
  light: null,
  skin: null,
});

/** Half-angle quaternion components for a swing of `deg` about +Y. */
const swingY = (deg: number): { sin: number; cos: number } => {
  const half = (deg * Math.PI) / 360;
  return { sin: Math.sin(half), cos: Math.cos(half) };
};

/**
 * A piece of this example: the host building, or a prop placed inside it.
 *
 * What a piece contributes does not depend on the shot it appears in, so it
 * states that once through {@link contribute} and hands the same answer to
 * whichever shot asks, exactly as a production-owned space or system does.
 */
export abstract class ExamplePiece<TDesign> extends AutoMovieSubject<TDesign> {
  /** What this piece puts into a shot, independent of any shot. */
  public abstract contribute(): IAutoMovieSubjectContribution;

  public render(
    _context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return this.contribute();
  }
}

/**
 * The minimum building a placement relation needs something to point at.
 *
 * A relation cites stable ids, so a room has to exist before a prop can claim
 * to be inside it: one logical space with a convex extent, one boundary, one
 * opening cut through that boundary, one floor patch, and the visible slabs
 * that realize them. Everything is derived from the three interior dimensions,
 * so a wider room cannot leave a stale door reveal or floor patch behind.
 */
export class ExampleRoomShell extends ExamplePiece<IAutoMovieBuiltEnvironment> {
  public readonly id = "example-room";

  /** Interior width, in metres. */
  public readonly width = 6;

  /** Interior depth, in metres. */
  public readonly depth = 5;

  /** Interior height, in metres. */
  public readonly height = 3;

  /** Stable id of the logical partition a prop claims to occupy. */
  public readonly space = "room";

  /** Stable id of the floor patch a standing prop rests on. */
  public readonly floor = "room-floor";

  /** Stable id of the boundary a prop can stand against. */
  public readonly boundary = "north-partition";

  /** Stable id of the ceiling element a prop can hang from. */
  public readonly ceiling = "ceiling-slab";

  /** Stable id of the wall element a prop can be fixed to. */
  public readonly wall = "north-wall";

  /** Stable id of the opening a leaf prop is expected to fill. */
  public readonly opening = "north-doorway";

  /** Clear width of that opening, in metres. */
  public readonly openingWidth = 0.9;

  /** Clear height of that opening, in metres. */
  public readonly openingHeight = 2.1;

  /** Offset of the opening's centre from the room centre line, in metres. */
  public readonly openingOffset = 1.5;

  /** Outward face of the north wall, in metres along `z`. */
  public wallZ(): number {
    return -this.depth / 2 - 0.1;
  }

  public design(): IAutoMovieBuiltEnvironment {
    const halfWidth = this.width / 2;
    const halfDepth = this.depth / 2;
    const wall = this.wallZ();
    return {
      version: 1,
      id: this.id,
      units: "meter",
      buildings: [{ id: "unit", element: "shell", space: this.space }],
      models: [placeholderModel("room-box", { x: 1, y: 1, z: 1 })],
      modelReferences: [],
      elements: [
        {
          id: "shell",
          kind: "building",
          parent: null,
          transform: identity(),
          model: null,
          space: this.space,
        },
        {
          id: "floor-slab",
          kind: "floor-slab",
          parent: "shell",
          transform: placed(0, -0.1, 0, {
            x: this.width,
            y: 0.2,
            z: this.depth,
          }),
          model: "room-box",
          space: this.space,
        },
        {
          id: this.ceiling,
          kind: "ceiling-slab",
          parent: "shell",
          transform: placed(0, this.height + 0.1, 0, {
            x: this.width,
            y: 0.2,
            z: this.depth,
          }),
          model: "room-box",
          space: this.space,
        },
        {
          id: this.wall,
          kind: "wall",
          parent: "shell",
          transform: placed(0, this.height / 2, wall, {
            x: this.width,
            y: this.height,
            z: 0.2,
          }),
          model: "room-box",
          space: this.space,
        },
        {
          id: "door-reveal",
          kind: "opening-reveal",
          parent: "shell",
          transform: placed(this.openingOffset, this.openingHeight / 2, wall, {
            x: this.openingWidth,
            y: this.openingHeight,
            z: 0.08,
          }),
          model: "room-box",
          space: this.space,
        },
      ],
      spaces: [
        {
          id: this.space,
          kind: "room",
          parent: null,
          cells: [
            {
              id: "room-cell",
              planes: [
                { normal: { x: 1, y: 0, z: 0 }, offset: halfWidth },
                { normal: { x: -1, y: 0, z: 0 }, offset: halfWidth },
                { normal: { x: 0, y: 1, z: 0 }, offset: this.height },
                { normal: { x: 0, y: -1, z: 0 }, offset: 0.05 },
                { normal: { x: 0, y: 0, z: 1 }, offset: halfDepth },
                { normal: { x: 0, y: 0, z: -1 }, offset: halfDepth + 0.2 },
              ],
            },
          ],
        },
      ],
      boundaries: [
        {
          id: this.boundary,
          kind: "wall",
          spaces: [this.space],
          elements: [this.wall],
        },
      ],
      openings: [
        {
          id: this.opening,
          kind: "door",
          boundary: this.boundary,
          fill: "door-reveal",
        },
      ],
      connectors: [],
      surfaces: [
        {
          space: this.space,
          surface: {
            id: this.floor,
            kind: "floor",
            polygon: [
              { x: -halfWidth, y: 0, z: -halfDepth },
              { x: halfWidth, y: 0, z: -halfDepth },
              { x: halfWidth, y: 0, z: halfDepth },
              { x: -halfWidth, y: 0, z: halfDepth },
            ],
            anchor: { x: 0, y: 0, z: 0 },
            rampTo: null,
          },
        },
      ],
      walkable: [this.floor],
    };
  }

  public contribute(): IAutoMovieSubjectContribution {
    return lowerBuiltEnvironment(this.design());
  }

  /** The `in-space` relation every prop in this room declares. */
  public occupies(): IAutoMoviePropRelation {
    return {
      kind: "in-space",
      target: { kind: "space", environment: this.id, space: this.space },
    };
  }
}

/**
 * A prop that owns its spec, its staged transform, and the relations tying the
 * two together.
 *
 * Spec and staging are one decision, not two. The relations a prop declares are
 * only true at the transform it is staged with, and splitting them across a
 * subject and a shot is how a prop comes to claim it rests on a floor it is a
 * metre above.
 */
export abstract class ExamplePlacedProp extends ExamplePiece<IAutoMoviePropSpec> {
  protected constructor(
    protected readonly room: ExampleRoomShell,
    /** Stable node id: the staged scene and the prop registry join on it. */
    public readonly id: string,
    /** Placeholder box extent, in metres. */
    public readonly size: IAutoMovieVector3,
  ) {
    super();
  }

  /** Where this prop stands, in world metres. */
  public abstract position(): IAutoMovieVector3;

  /** What this prop claims beyond occupying the room. */
  protected abstract relations(): readonly IAutoMoviePropRelation[];

  /** Contact points other props may cite; none by default. */
  protected affordances(): IAutoMovieAffordance[] {
    return [];
  }

  /** Volumes nothing else may occupy; none by default. */
  protected clearance(): IAutoMovieClearanceBox[] {
    return [];
  }

  /**
   * The volume this prop takes up, or `null` to derive it from the geometry.
   *
   * Declaring one is how a prop states a truth its proxy box does not show: a
   * handle that projects, a skirt that flares, a seat that needs the room it
   * slides back into. What is declared is what other props must stay out of.
   */
  protected footprint(): IAutoMoviePropBox | null {
    return null;
  }

  /** Declared moving parts; rigid by default. */
  protected articulation(): IAutoMoviePropSpec["articulation"] {
    return null;
  }

  /** Facing about +Y, in degrees. */
  protected facingDeg(): number {
    return 0;
  }

  public design(): IAutoMoviePropSpec {
    return {
      node: this.id,
      model: placeholderModel(this.id, this.size, this.affordances()),
      articulation: this.articulation(),
      placement: {
        relations: [this.room.occupies(), ...this.relations()],
        footprint: this.footprint(),
        clearance: this.clearance(),
      },
    };
  }

  public stage(): IAutoMovieStageSetPiece {
    return {
      node: this.id,
      model: this.id,
      position: this.position(),
      facingDeg: this.facingDeg(),
    };
  }

  public contribute(): IAutoMovieSubjectContribution {
    return { props: [this.design()], set: [this.stage()] };
  }
}

/**
 * Technique: rest a prop on a support patch the building already declares.
 *
 * The prop cites the floor's stable id rather than a height, so a floor that
 * moves carries whatever stands on it, and a prop placed off the patch is a
 * refusal rather than something hovering in a frame nobody checked.
 */
export class ExampleOnSupportSurface extends ExamplePlacedProp {
  public constructor(
    room: ExampleRoomShell,
    id: string,
    size: IAutoMovieVector3,
    /** Distance from the room centre, in metres. */
    public readonly offset: IAutoMovieVector3,
    /** Facing about +Y, in degrees. */
    public readonly facing = 0,
    private readonly contacts: IAutoMovieAffordance[] = [],
  ) {
    super(room, id, size);
  }

  public position(): IAutoMovieVector3 {
    const anchor = propAnchorFrame({
      target: {
        kind: "surface",
        environment: this.room.id,
        surface: this.room.floor,
      },
      environments: [this.room.design()],
    })!;
    return {
      x: anchor.translation.x + this.offset.x,
      y: anchor.translation.y + this.size.y / 2 + this.offset.y,
      z: anchor.translation.z + this.offset.z,
    };
  }

  protected relations(): readonly IAutoMoviePropRelation[] {
    return [
      {
        kind: "on-support",
        target: {
          kind: "surface",
          environment: this.room.id,
          surface: this.room.floor,
        },
      },
    ];
  }

  protected affordances(): IAutoMovieAffordance[] {
    return this.contacts;
  }

  protected facingDeg(): number {
    return this.facing;
  }
}

/**
 * Technique: rest one prop on another prop's declared contact point.
 *
 * The support is an affordance id on the other prop's model, so the relation
 * survives the host moving and refuses the moment the host stops declaring that
 * contact. The keep-out volume is the service room the prop needs above it,
 * which is a claim about use rather than about geometry.
 */
export class ExampleOnPropAffordance extends ExamplePlacedProp {
  public constructor(
    room: ExampleRoomShell,
    id: string,
    size: IAutoMovieVector3,
    private readonly host: ExamplePlacedProp,
    /** Affordance id on the host this prop rests on. */
    public readonly affordance: string,
    /** Height of the host's contact face above the floor, in metres. */
    public readonly hostTop: number,
    /** Service volume kept clear above the prop, in metres. */
    public readonly service = 0.5,
  ) {
    super(room, id, size);
  }

  public position(): IAutoMovieVector3 {
    return { x: 0, y: this.hostTop + this.size.y / 2, z: 0 };
  }

  protected relations(): readonly IAutoMoviePropRelation[] {
    return [
      {
        kind: "on-support",
        target: {
          kind: "prop-affordance",
          prop: this.host.id,
          affordance: this.affordance,
        },
      },
    ];
  }

  protected clearance(): IAutoMovieClearanceBox[] {
    return [
      {
        id: "service",
        min: { x: -this.size.x, y: this.size.y / 2, z: -this.size.z },
        max: {
          x: this.size.x,
          y: this.size.y / 2 + this.service,
          z: this.size.z,
        },
      },
    ];
  }
}

/**
 * Technique: plug a prop into another prop's socket.
 *
 * `attached` differs from `on-support` in what the engine will accept: a socket
 * carries no supporting face, so citing a `stack-top` here is refused by kind
 * rather than by geometry. That distinction is the whole reason the affordance
 * kinds are a closed set.
 */
export class ExampleSocketedIntoProp extends ExamplePlacedProp {
  public constructor(
    room: ExampleRoomShell,
    id: string,
    size: IAutoMovieVector3,
    private readonly host: ExamplePlacedProp,
    /** Socket affordance id on the host. */
    public readonly affordance: string,
    /** Where the socketed prop sits, in world metres. */
    public readonly at: IAutoMovieVector3,
  ) {
    super(room, id, size);
  }

  public position(): IAutoMovieVector3 {
    return this.at;
  }

  protected relations(): readonly IAutoMoviePropRelation[] {
    return [
      {
        kind: "attached",
        target: {
          kind: "prop-affordance",
          prop: this.host.id,
          affordance: this.affordance,
        },
      },
    ];
  }
}

/**
 * Technique: fix a prop to a building element.
 *
 * The element is cited by id, so the prop travels with the wall it is on rather
 * than with a world coordinate somebody copied once.
 */
export class ExampleFixedToElement extends ExamplePlacedProp {
  public constructor(
    room: ExampleRoomShell,
    id: string,
    size: IAutoMovieVector3,
    /** Building element id this prop is fixed to. */
    public readonly element: string,
    /** Where the prop sits, in world metres. */
    public readonly at: IAutoMovieVector3,
  ) {
    super(room, id, size);
  }

  public position(): IAutoMovieVector3 {
    return this.at;
  }

  protected relations(): readonly IAutoMoviePropRelation[] {
    return [
      {
        kind: "attached",
        target: {
          kind: "element",
          environment: this.room.id,
          element: this.element,
        },
      },
    ];
  }
}

/**
 * Technique: hang a prop from a building element.
 *
 * `suspended` reads the same as `attached` in the graph and differently in
 * meaning, which is what lets a later pass ask what is overhead without
 * inspecting geometry.
 */
export class ExampleSuspendedFromElement extends ExamplePlacedProp {
  public constructor(
    room: ExampleRoomShell,
    id: string,
    size: IAutoMovieVector3,
    /** Building element id this prop hangs from. */
    public readonly element: string,
    /** How far below the ceiling the prop hangs, in metres. */
    public readonly drop: number,
    /** Where the prop hangs, in the room's horizontal plane. */
    public readonly at: { x: number; z: number },
  ) {
    super(room, id, size);
  }

  public position(): IAutoMovieVector3 {
    return {
      x: this.at.x,
      y: this.room.height - this.drop - this.size.y / 2,
      z: this.at.z,
    };
  }

  protected relations(): readonly IAutoMoviePropRelation[] {
    return [
      {
        kind: "suspended",
        target: {
          kind: "element",
          environment: this.room.id,
          element: this.element,
        },
      },
    ];
  }
}

/**
 * Technique: stand a prop against a boundary and declare the travel of its
 * moving part.
 *
 * The sliding part is an articulation joint with a channel limit, so how far it
 * can come out is data the engine clamps and reports against, and the volume it
 * sweeps is a keep-out box. A prop parked in that box is named by the compiler
 * instead of discovered by someone watching a drawer clip through a chair.
 */
export class ExampleAgainstBoundary extends ExamplePlacedProp {
  public constructor(
    room: ExampleRoomShell,
    id: string,
    size: IAutoMovieVector3,
    /** How far the sliding part travels out of the body, in metres. */
    public readonly travel: number,
    /** Where the prop stands, in world metres. */
    public readonly at: IAutoMovieVector3,
    /** How far handles and trim project past the proxy box, in metres. */
    public readonly projection = 0.05,
  ) {
    super(room, id, size);
  }

  public position(): IAutoMovieVector3 {
    return this.at;
  }

  protected relations(): readonly IAutoMoviePropRelation[] {
    return [
      {
        kind: "on-support",
        target: {
          kind: "surface",
          environment: this.room.id,
          surface: this.room.floor,
        },
      },
      {
        kind: "against-boundary",
        target: {
          kind: "boundary",
          environment: this.room.id,
          boundary: this.room.boundary,
        },
      },
    ];
  }

  protected articulation(): IAutoMoviePropSpec["articulation"] {
    return {
      nodes: [joint("body"), joint("slider", "body")],
      profile: {
        id: `${this.id}-slide`,
        name: "slide",
        controls: [],
        drivers: [],
        limits: [
          {
            channel: { kind: "node", node: "slide", path: "translation" },
            min: [0, 0, 0],
            max: [0, 0, this.travel],
          },
        ],
      },
      binding: {
        profile: `${this.id}-slide`,
        root: "body",
        instanceName: null,
        boneMap: { slide: "slider" },
      },
    };
  }

  protected footprint(): IAutoMoviePropBox {
    return {
      min: {
        x: -this.size.x / 2 - this.projection,
        y: -this.size.y / 2,
        z: -this.size.z / 2 - this.projection,
      },
      max: {
        x: this.size.x / 2 + this.projection,
        y: this.size.y / 2,
        z: this.size.z / 2 + this.projection,
      },
    };
  }

  protected clearance(): IAutoMovieClearanceBox[] {
    return [
      {
        id: "travel",
        min: { x: -this.size.x / 2, y: -this.size.y / 2, z: this.size.z / 2 },
        max: {
          x: this.size.x / 2,
          y: this.size.y / 2,
          z: this.size.z / 2 + this.travel + 0.2,
        },
      },
    ];
  }
}

/**
 * Technique: fill an opening, and declare the arc the leaf swings through.
 *
 * The leaf is cut from the opening's own dimensions, so it fits the reveal by
 * construction; the engine still checks it, because a source that computes the
 * size from somewhere else is exactly the case worth refusing. The swing is a
 * channel limit on the hinge joint, which `resolveFrame` clamps and reports
 * against, and the volume the leaf sweeps is a keep-out box.
 */
export class ExampleOpeningLeaf extends ExamplePlacedProp {
  public constructor(
    room: ExampleRoomShell,
    id: string,
    /** Gap left around the leaf inside its reveal, in metres. */
    public readonly gap = 0.025,
    /** Widest swing the hinge permits, in degrees. */
    public readonly maxSwingDeg = 100,
  ) {
    super(room, id, {
      x: room.openingWidth - gap * 2,
      y: room.openingHeight - gap * 2,
      z: 0.05,
    });
  }

  public position(): IAutoMovieVector3 {
    return {
      x: this.room.openingOffset,
      y: this.room.openingHeight / 2,
      z: this.room.wallZ(),
    };
  }

  protected relations(): readonly IAutoMoviePropRelation[] {
    return [
      {
        kind: "fill-opening",
        target: {
          kind: "opening",
          environment: this.room.id,
          opening: this.room.opening,
        },
      },
    ];
  }

  protected articulation(): IAutoMoviePropSpec["articulation"] {
    const swing = swingY(this.maxSwingDeg);
    return {
      nodes: [joint("frame"), joint("hinge", "frame")],
      profile: {
        id: `${this.id}-hinge`,
        name: "hinge",
        controls: [],
        drivers: [],
        limits: [
          {
            channel: { kind: "node", node: "pivot", path: "rotation" },
            min: [0, 0, 0, swing.cos],
            max: [0, swing.sin, 0, 1],
          },
        ],
      },
      binding: {
        profile: `${this.id}-hinge`,
        root: "frame",
        instanceName: null,
        boneMap: { pivot: "hinge" },
      },
    };
  }

  protected clearance(): IAutoMovieClearanceBox[] {
    return [
      {
        id: "swing",
        min: { x: -this.size.x, y: -this.size.y / 2, z: 0 },
        max: { x: this.size.x, y: this.size.y / 2, z: this.size.x },
      },
    ];
  }
}

/**
 * The whole example, and the technique the file exists to show at scale.
 *
 * Six props around the host are a count and a radius, not six records: each one
 * derives its own angle from the declared seed and its own slot, so the ring
 * reproduces byte for byte every run and adding a seventh is a changed number.
 * Past a few dozen rigid repeats this is the wrong tool and an instance set is
 * the right one; the point here is that repetition is a loop either way.
 *
 * The room is listed first so its lowered elements reach the staged set before
 * the props that cite them, which keeps the merged contribution stable.
 */
export class ExamplePlacementSuite extends AutoMovieSubjectGroup<
  IAutoMovieSubjectContribution,
  ExamplePiece<unknown>
> {
  public readonly id = "example-placement-suite";

  /** How many props stand in the ring. */
  public readonly ringCount = 6;

  /** Radius of the ring, in metres. */
  public readonly ringRadius = 1.3;

  /** Declared seed the ring's angular jitter is drawn from. */
  public readonly seed = 4127;

  /** Height of the host's contact face above the floor, in metres. */
  public readonly hostHeight = 0.75;

  public readonly room = new ExampleRoomShell();

  /** The prop other props rest on and plug into, with the contacts they cite. */
  public readonly host = new ExampleOnSupportSurface(
    this.room,
    "example-host-prop",
    { x: 1.6, y: this.hostHeight, z: 0.9 },
    { x: 0, y: 0, z: 0 },
    0,
    [
      {
        id: "top",
        kind: "stack-top",
        frame: identity(0, this.hostHeight / 2, 0),
        extent: [
          { x: -0.8, y: 0, z: -0.45 },
          { x: 0.8, y: 0, z: -0.45 },
          { x: 0.8, y: 0, z: 0.45 },
          { x: -0.8, y: 0, z: 0.45 },
        ],
      },
      {
        id: "outlet",
        kind: "socket",
        frame: identity(0, this.hostHeight / 2, 0.45),
        extent: null,
      },
    ],
  );

  public readonly stacked = new ExampleOnPropAffordance(
    this.room,
    "example-stacked-prop",
    { x: 0.3, y: 0.5, z: 0.3 },
    this.host,
    "top",
    this.hostHeight,
  );

  public readonly socketed = new ExampleSocketedIntoProp(
    this.room,
    "example-socketed-prop",
    { x: 0.2, y: 0.2, z: 0.2 },
    this.host,
    "outlet",
    { x: 0, y: 0.85, z: 0.55 },
  );

  public readonly fixed = new ExampleFixedToElement(
    this.room,
    "example-fixed-prop",
    { x: 0.4, y: 0.3, z: 0.2 },
    this.room.wall,
    { x: -1.5, y: 1.8, z: -2.45 },
  );

  public readonly hanging = new ExampleSuspendedFromElement(
    this.room,
    "example-hanging-prop",
    { x: 0.3, y: 0.4, z: 0.3 },
    this.room.ceiling,
    0.4,
    { x: -2, z: 0 },
  );

  public readonly standing = new ExampleAgainstBoundary(
    this.room,
    "example-boundary-prop",
    { x: 1, y: 0.8, z: 0.5 },
    0.4,
    { x: -2.4, y: 0.4, z: -2.25 },
  );

  public readonly leaf = new ExampleOpeningLeaf(this.room, "example-leaf-prop");

  /**
   * The ring, built as a loop over slots.
   *
   * The jitter is a small integer hash of the seed and the slot rather than a
   * draw from a shared generator, so a member does not move because the member
   * before it was built first.
   */
  public ring(): readonly ExampleOnSupportSurface[] {
    return Array.from({ length: this.ringCount }, (_unused, slot) => {
      const jitter = ((this.seed * 2654435761 + slot * 40503) % 360) / 90000;
      const angle = ((slot / this.ringCount) * 2 + jitter) * Math.PI;
      return new ExampleOnSupportSurface(
        this.room,
        `example-ring-prop-${slot}`,
        { x: 0.45, y: 0.9, z: 0.45 },
        {
          x: Math.cos(angle) * this.ringRadius,
          y: 0,
          z: Math.sin(angle) * this.ringRadius,
        },
        (-angle * 180) / Math.PI,
      );
    });
  }

  public members(): readonly ExamplePiece<unknown>[] {
    return [
      this.room,
      this.host,
      ...this.ring(),
      this.stacked,
      this.socketed,
      this.fixed,
      this.hanging,
      this.standing,
      this.leaf,
    ];
  }

  public design(): IAutoMovieSubjectContribution {
    return mergeAutoMovieSubjectContributions(
      this.members().map((member) => member.contribute()),
    );
  }
}
