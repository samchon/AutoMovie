import { renderScaffold, scaffoldAssetDirectory } from "@automovie/cli";
import {
  forgeProp,
  placementChildNode,
  resolveFrame,
  sceneToNodes,
  validatePropPlacements,
} from "@automovie/engine";
import {
  IAutoMovieClip,
  IAutoMoviePropSpec,
  IAutoMovieScene,
  IAutoMovieStageSetPiece,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import { createRequire } from "node:module";
import * as path from "node:path";

/** The shipped object, loaded from the scaffold source the CLI publishes. */
interface IScaffoldGate {
  id: string;
  hinge: string;
  openDeg: number;
  design(): IAutoMoviePropSpec;
  stage(context: IGroundContext): IAutoMovieStageSetPiece;
  hingeNode(): string;
}

/**
 * The one compiler-owned fact the object is allowed to read.
 *
 * Deliberately narrower than `IAutoMovieShotBuildContext`: naming the whole
 * context here would mean inventing a contract, a model registry and a
 * formation runtime the object never touches, and a fixture that invents them
 * is a fixture asserting against a shot nobody staged. Narrowing is also the
 * claim itself, because the placement has to come from the staged world rather
 * than from anything else the context happens to carry.
 */
interface IGroundContext {
  world: IAutoMovieWorldDesign;
}

const groundContext = (halfExtent: number | null): IGroundContext => ({
  world: {
    id: "demo-world",
    units: "meter",
    landmarks: [],
    surfaces:
      halfExtent === null
        ? []
        : [
            {
              id: "ground",
              polygon: [
                { x: -halfExtent, z: -halfExtent },
                { x: halfExtent, z: -halfExtent },
                { x: halfExtent, z: halfExtent },
                { x: -halfExtent, z: halfExtent },
              ],
              height: { kind: "constant", value: 0 },
              walkable: true,
            },
          ],
    routes: [],
    effectRecipes: [],
    effectZones: [],
  },
});

/** A rotation of `deg` about +Y, as the clip value the hinge channel carries. */
const swingY = (deg: number): number[] => {
  const half = (deg * Math.PI) / 360;
  return [0, Math.sin(half), 0, Math.cos(half)];
};

/** A one-key clip turning the staged hinge by `deg`. */
const swing = (node: string, deg: number): IAutoMovieClip => ({
  id: "swing",
  name: null,
  duration: 1,
  loop: false,
  tracks: [
    {
      channel: { kind: "node", node, path: "rotation" },
      times: [0],
      values: swingY(deg),
      interpolation: "linear",
    },
  ],
});

/**
 * The scaffold's `docs/objects` ↔ `src/objects` rung, proved from the shipped
 * source rather than from a copy of it.
 *
 * The prop slot shipped empty for as long as the starter existed, so the ladder
 * every generated project is told to climb had no inhabitant on the one rung
 * that owns things: a reader could satisfy `src/units` and `src/world` by
 * example and had to invent `src/objects` from prose. What makes the rung real
 * is not that two files exist; it is that the specification is cited by an
 * implementation the engine accepts, staged where the specification says, and
 * bounded by a travel the engine enforces. This case reads the published
 * scaffold, so a change that breaks any of those breaks here rather than in
 * somebody's generated project.
 *
 * Scenarios:
 *
 * 1. The rendered starter carries both halves of the rung, the specification cites
 *    the scene that calls for the object, and that scene's prose actually names
 *    it: a citation whose scene never asks for the thing is a claim nobody can
 *    check.
 * 2. The shipped class forges: `forgeProp` accepts its model and articulation,
 *    including the part its one joint drives.
 * 3. Specification and placement join: `validatePropPlacements` accepts the
 *    class's own `design()` against its own `stage()`, which is the compiler
 *    gate a generated project meets on its first compile. The placement is the
 *    far edge of the staged ground, and a world carrying no ground at all is
 *    refused rather than putting the gate on top of the soloist.
 * 4. The hinge id the class publishes is the id `sceneToNodes` lowers it under, so
 *    a shot addressing `hingeNode()` addresses the node the scene carries.
 * 5. The declared travel is a bound, not a comment: a swing inside it resolves
 *    with no violation, and one past it is clamped and reported against the
 *    gate's own profile.
 */
export const test_cli_scaffold_object_ladder = (): void => {
  const files = renderScaffold({ name: "demo-film" });
  const specification = files["docs/objects/gate.md"];
  const scene = files["docs/demo-film/04-scenes/SCN-002.md"];
  TestValidator.equals(
    "the object rung ships both halves, cited and called for",
    {
      specification: specification !== undefined,
      implementation: files["src/objects/gate.ts"] !== undefined,
      cites:
        specification?.includes(
          "@evidence docs/demo-film/04-scenes/SCN-002.md",
        ) === true,
      calledFor: scene?.includes("GATE") === true,
    },
    {
      specification: true,
      implementation: true,
      cites: true,
      calledFor: true,
    },
  );

  const gate = (
    createRequire(__filename)(
      path.join(scaffoldAssetDirectory(), "src", "objects", "gate.ts"),
    ) as { gate: IScaffoldGate }
  ).gate;
  const design = gate.design();
  const forged = forgeProp(design);
  TestValidator.equals(
    "the shipped object forges",
    forged.success === true
      ? []
      : forged.violations.map((violation) => violation.path),
    [],
  );

  const staged = gate.stage(groundContext(12));
  TestValidator.equals(
    "it stands at the far edge of the ground the shot staged",
    staged.position,
    { x: 0, y: 0, z: -12 },
  );
  const placed = validatePropPlacements({
    props: [design],
    set: [staged],
    builtEnvironments: [],
  });
  TestValidator.equals(
    "its specification and its placement join on one node",
    placed.success === true
      ? []
      : placed.violations.map((violation) => violation.path),
    [],
  );

  TestValidator.predicate(
    "a world with no ground under it is refused, not defaulted",
    ((): boolean => {
      try {
        gate.stage(groundContext(null));
        return false;
      } catch (error) {
        return (
          error instanceof Error && error.message.includes("staged ground")
        );
      }
    })(),
  );

  const composed: IAutoMovieScene = {
    id: "demo",
    name: null,
    nodes: [
      {
        id: staged.node,
        model: staged.model,
        transform: {
          translation: staged.position,
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        motion: null,
        pose: null,
      },
    ],
    cameras: [],
    lights: [],
  };
  const nodes = sceneToNodes({
    scene: composed,
    props: { [design.node]: design },
  });
  TestValidator.equals(
    "the published hinge id is the id the scene lowers it under",
    {
      published: gate.hingeNode(),
      lowered: nodes.map((node) => node.id).includes(gate.hingeNode()),
      law: placementChildNode(gate.id, gate.hinge),
    },
    {
      published: gate.hingeNode(),
      lowered: true,
      law: gate.hingeNode(),
    },
  );

  const articulation = design.articulation!;
  const profiles = [
    {
      profile: articulation.profile,
      binding: articulation.binding,
      nodePrefix: `${design.node}/`,
    },
  ];
  const inside = resolveFrame({
    nodes,
    clip: swing(gate.hingeNode(), gate.openDeg - 10),
    limits: [],
    profiles,
    seconds: 0,
  });
  const beyond = resolveFrame({
    nodes,
    clip: swing(gate.hingeNode(), gate.openDeg + 30),
    limits: [],
    profiles,
    seconds: 0,
  });
  TestValidator.equals(
    "the declared travel accepts a swing inside it and refuses one past it",
    {
      inside: inside.violations.length,
      beyondRefused: beyond.violations.length > 0,
      beyondProfiles: [
        ...new Set(beyond.violations.map((violation) => violation.profile)),
      ],
      beyondChannels: [
        ...new Set(beyond.violations.map((violation) => violation.channel)),
      ],
    },
    {
      inside: 0,
      beyondRefused: true,
      beyondProfiles: [articulation.profile.id],
      beyondChannels: [`node:${gate.hingeNode()}:rotation`],
    },
  );
};
