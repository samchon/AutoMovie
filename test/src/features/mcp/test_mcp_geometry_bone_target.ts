import { compareCodeUnits } from "@automovie/engine";
import {
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieVector3,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpGeometryContext,
  IAutoMovieMcpMotion,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  IDENTITY_TRANSFORM,
  createSkeleton,
  makePose,
} from "../internal/fixtures";
import { openMcpStdio } from "../internal/mcpStdio";
import { vclose } from "../internal/predicates";

interface ISchema {
  $ref?: string;
  const?: unknown;
  enum?: unknown[];
  anyOf?: ISchema[];
  oneOf?: ISchema[];
  allOf?: ISchema[];
  properties?: Record<string, ISchema>;
  $defs?: Record<string, ISchema>;
}

/** Follow a local `$defs` reference in one advertised tool schema. */
const dereference = (root: ISchema, schema: ISchema): ISchema => {
  if (schema.$ref === undefined) return schema;
  const name = schema.$ref.split("/").at(-1)!;
  return root.$defs?.[name] ?? schema;
};

/** Collect every literal `kind` arm below one target property. */
const targetKinds = (root: ISchema, property: string): string[] => {
  const seen = new Set<ISchema>();
  const kinds = new Set<string>();
  const visit = (input: ISchema | undefined): void => {
    if (input === undefined) return;
    const schema = dereference(root, input);
    if (seen.has(schema)) return;
    seen.add(schema);
    const kind = schema.properties?.kind;
    if (kind !== undefined) {
      const discriminator = dereference(root, kind);
      if (typeof discriminator.const === "string")
        kinds.add(discriminator.const);
      for (const value of discriminator.enum ?? [])
        if (typeof value === "string") kinds.add(value);
    }
    for (const branch of [
      ...(schema.anyOf ?? []),
      ...(schema.oneOf ?? []),
      ...(schema.allOf ?? []),
    ])
      visit(branch);
  };
  const request = dereference(root, root);
  visit(request.properties?.[property]);
  return [...kinds].sort(compareCodeUnits);
};

const translation = (point: IAutoMovieVector3) => ({
  ...IDENTITY_TRANSFORM,
  translation: point,
});

/**
 * Each geometry tool advertises exactly the target arms it can resolve (#1380):
 * getReach adds live bones, while scene-only measureDistance excludes bones and
 * relative directions.
 */
export const test_mcp_geometry_bone_target = async (): Promise<void> => {
  const skeleton = createSkeleton();
  const scene: IAutoMovieScene = {
    id: "geometry-bones",
    name: null,
    nodes: [
      {
        id: "reacher",
        model: "person",
        transform: IDENTITY_TRANSFORM,
        motion: null,
        pose: null,
      },
      {
        id: "mover",
        model: "person",
        transform: translation({ x: -0.1, y: 0, z: 0 }),
        motion: null,
        pose: null,
      },
    ],
    cameras: [],
    lights: [],
  };
  const motion: IAutoMovieMcpMotion = {
    id: "move-target",
    skeleton: skeleton.id,
    duration: 1,
    loop: false,
    keyframes: [
      {
        time: 0,
        pose: makePose([]),
        expression: null,
        easing: "linear",
        bezier: null,
      },
      {
        time: 1,
        pose: makePose([], translation({ x: 0, y: 0, z: 0.2 })),
        expression: null,
        easing: "linear",
        bezier: null,
      },
    ],
  };
  const shot: IAutoMovieShot = {
    id: "shot:beat-1",
    name: null,
    scene: scene.id,
    camera: "camera",
    cameraMotion: null,
    performances: [{ node: "mover", motion: motion.id, startOffset: 0 }],
    objectMotions: [],
    duration: 1,
  };
  const context: IAutoMovieMcpGeometryContext = {
    scene,
    models: [{ id: "person", skeleton }],
    motions: { mover: motion },
    shot,
  };
  const app = new AutoMovieApplication();
  const boneTarget = {
    kind: "bone" as const,
    node: "mover",
    bone: "leftHand" as const,
  };

  for (const t of [0, 0.5, 1]) {
    const resolved = app.getResolvedPose({
      context,
      actor: "mover",
      t,
    }).resolvedPose!;
    const hand = resolved.bones.find((bone) => bone.bone === "leftHand")!;
    const reach = app.getReach({
      context,
      actor: "reacher",
      target: boneTarget,
      t,
    }).reach!;
    TestValidator.predicate(
      `moving bone target matches getResolvedPose at t=${t}`,
      vclose(reach.target, hand.worldPosition),
    );
  }

  const restContext = { ...context, motions: {}, shot: null };
  const restHand = app
    .getResolvedPose({ context: restContext, actor: "mover" })
    .resolvedPose!.bones.find((bone) => bone.bone === "leftHand")!;
  TestValidator.predicate(
    "a rest bone target resolves without a shot",
    vclose(
      app.getReach({
        context: restContext,
        actor: "reacher",
        target: boneTarget,
      }).reach!.target,
      restHand.worldPosition,
    ),
  );
  TestValidator.predicate(
    "a missing target actor returns a referential reason",
    app
      .getReach({
        context,
        actor: "reacher",
        target: { ...boneTarget, node: "ghost" },
      })
      .reason?.includes("not a scene node") === true,
  );
  TestValidator.predicate(
    "a missing target bone returns a referential reason",
    app
      .getReach({
        context,
        actor: "reacher",
        target: { ...boneTarget, bone: "rightHand" },
      })
      .reason?.includes("does not resolve") === true,
  );

  const { client, tools } = await openMcpStdio("automovie-test", {
    surface: "granular",
  });
  try {
    const getReach = tools.find((tool) => tool.name === "getReach")
      ?.inputSchema as ISchema | undefined;
    const measure = tools.find((tool) => tool.name === "measureDistance")
      ?.inputSchema as ISchema | undefined;
    if (getReach === undefined || measure === undefined)
      throw new Error("geometry tool schemas must be advertised");
    TestValidator.equals(
      "getReach advertises every and only resolvable target kind",
      targetKinds(getReach, "target"),
      ["bone", "group", "node", "point"],
    );
    TestValidator.equals(
      "measureDistance advertises every and only scene-resolvable target kind",
      targetKinds(measure, "from"),
      ["group", "node", "point"],
    );
    TestValidator.equals(
      "distance endpoints share the same exact union",
      targetKinds(measure, "to"),
      ["group", "node", "point"],
    );
  } finally {
    await client.close();
  }
};
