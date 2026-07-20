import {
  IAutoMovieBlockedBeat,
  IAutoMovieCut,
  IAutoMovieForgedCast,
  IAutoMovieStagedSet,
  compareCodeUnits,
} from "@automovie/engine";
import {
  IAutoMovieAssembleApplication,
  IAutoMovieGait,
  IAutoMovieRenderSpec,
  IAutoMovieScript,
  IAutoMovieVector3,
} from "@automovie/interface";
import {
  IAutoMovieMcpActorContext,
  IAutoMovieMcpPerformedShot,
} from "@automovie/mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { TestValidator } from "@nestia/e2e";

import {
  forgeEntry,
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, makePose } from "../internal/fixtures";
import { MCP_REQUEST_TIMEOUT, openMcpStdio } from "../internal/mcpStdio";
import { nclose } from "../internal/predicates";

const WALK: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

const REQUEST_OPTIONS = { timeout: MCP_REQUEST_TIMEOUT };

interface IJsonSchema {
  $defs?: Record<string, IJsonSchema>;
  $ref?: string;
  additionalProperties?: boolean | IJsonSchema;
  properties?: Record<string, IJsonSchema>;
  required?: string[];
  type?: string;
}

const resolveSchema = (root: IJsonSchema, schema: IJsonSchema): IJsonSchema => {
  if (schema.$ref === undefined) return schema;
  const prefix = "#/$defs/";
  if (schema.$ref.startsWith(prefix) === false)
    throw new Error(`unsupported schema reference: ${schema.$ref}`);
  const resolved = root.$defs?.[schema.$ref.slice(prefix.length)];
  if (resolved === undefined)
    throw new Error(`unresolved schema reference: ${schema.$ref}`);
  return resolved;
};

const schemaProperty = (
  root: IJsonSchema,
  schema: IJsonSchema,
  property: string,
): IJsonSchema => {
  const found = resolveSchema(root, schema).properties?.[property];
  if (found === undefined)
    throw new Error(`schema property not found: ${property}`);
  return resolveSchema(root, found);
};

const call = async <T>(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<T> => {
  const result = await client.callTool(
    { name, arguments: args },
    undefined,
    REQUEST_OPTIONS,
  );
  if (result.structuredContent === undefined)
    throw new Error(`tool ${name} returned no structured content`);
  // The server ships the serialized text block beside structuredContent
  // (textFallback: true, #1228): a client that reads `content` text and ignores
  // outputSchema must still see the result. @typia/mcp 13.1.x defaults this off,
  // so pin the wire contract here: a silent flip back to structured-only
  // would leave every text-fallback client with an empty successful result.
  const content = result.content as Array<{ type: string; text?: string }>;
  TestValidator.predicate(
    `tool ${name} ships a text fallback beside structuredContent`,
    Array.isArray(content) &&
      content.some((part) => part.type === "text" && (part.text ?? "") !== ""),
  );
  return result.structuredContent as T;
};

const actorContext = (
  position: IAutoMovieVector3,
  facingDeg: number,
  skeleton = createSkeleton(),
): IAutoMovieMcpActorContext => ({
  skeleton: skeleton.id,
  gaits: [WALK],
  position,
  speed: 1,
  facingDeg,
  eyeHeight: 1.6,
  restPose: makePose([]),
  rig: skeleton,
});

const assemble = (shot: string): IAutoMovieAssembleApplication.IWrite => ({
  type: "write",
  sequence: { id: "seq-duel", name: "the duel" },
  fps: 24,
  entries: [{ shot, trim: null, transition: null }],
  pacing: "hold the charge in one continuous shot.",
  continuity: "single-shot assembly, no continuity handoff.",
});

/**
 * The published MCP stdio surface supports the full stage ladder.
 *
 * Scenarios:
 *
 * 1. A real stdio client sees the AutoMovie stage, slate-query, geometry-query,
 *    and validation tools.
 * 2. The render, caption, and pose-keypoint tools expose one identical nested
 *    frame-format contract, with no legacy top-level dimension fields.
 * 3. The same client calls `stage -> getScene/measureDistance/validateScene ->
 *    forge -> block -> perform -> cut`, feeding structured outputs forward and
 *    receiving a successful final sequence.
 */
export const test_mcp_stdio_roundtrip = async (): Promise<void> => {
  const { client, tools } = await openMcpStdio("automovie-test");
  try {
    TestValidator.equals(
      "tool names",
      tools.map((tool) => tool.name).sort(compareCodeUnits),
      [
        "block",
        "commitBeatEnd",
        "commitFilm",
        "commitNotes",
        "commitScene",
        "commitScript",
        "commitShot",
        "cut",
        "eraseActor",
        "eraseNotes",
        "eraseProp",
        "eraseShot",
        "forge",
        "forgeProp",
        "getBeatEnd",
        "getGuideDocument",
        "getNotes",
        "getReach",
        "getResolvedPose",
        "getScene",
        "getScript",
        "getShot",
        "getShotEndState",
        "getSlate",
        "lintContinuity",
        "measureDistance",
        "nextSteps",
        "openProject",
        "perform",
        "planCaptions",
        "planChunkedRender",
        "planPoseKeypoints",
        "planRender",
        "registerAsset",
        "seeFrame",
        "setActorPerformance",
        "setPlacement",
        "stage",
        "validateModel",
        "validateMotion",
        "validatePose",
        "validateScene",
        "validateSequence",
        "validateShot",
      ],
    );

    const toolSchema = (name: string): IJsonSchema => {
      const schema = tools.find((tool) => tool.name === name)?.inputSchema;
      if (schema === undefined)
        throw new Error(`tool schema not found: ${name}`);
      return schema as IJsonSchema;
    };
    const renderRoot = toolSchema("planRender");
    const captionRoot = toolSchema("planCaptions");
    const poseRoot = toolSchema("planPoseKeypoints");
    const renderSpecSchema = schemaProperty(renderRoot, renderRoot, "spec");
    const formats = [
      schemaProperty(renderRoot, renderSpecSchema, "frameFormat"),
      schemaProperty(captionRoot, captionRoot, "frameFormat"),
      schemaProperty(poseRoot, poseRoot, "frameFormat"),
    ];
    for (const [index, format] of formats.entries()) {
      TestValidator.equals(
        `frame format ${index} property names`,
        Object.keys(format.properties ?? {}).sort(compareCodeUnits),
        ["fps", "height", "width"],
      );
      TestValidator.equals(
        `frame format ${index} required fields`,
        [...(format.required ?? [])].sort(compareCodeUnits),
        ["fps", "height", "width"],
      );
      TestValidator.equals(
        `frame format ${index} property types`,
        Object.fromEntries(
          Object.entries(format.properties ?? {}).map(([key, value]) => [
            key,
            value.type,
          ]),
        ),
        { fps: "number", width: "number", height: "number" },
      );
      TestValidator.equals(
        `frame format ${index} rejects extra fields`,
        format.additionalProperties,
        false,
      );
    }
    for (const [label, schema] of [
      ["render spec", renderSpecSchema],
      ["caption input", captionRoot],
      ["pose input", poseRoot],
    ] as const)
      TestValidator.equals(
        `${label} has no legacy frame fields`,
        ["fps", "width", "height"].filter(
          (field) =>
            resolveSchema(schema, schema).properties?.[field] !== undefined,
        ),
        [],
      );

    const script = makeScriptWrite();
    const scriptArtifact: IAutoMovieScript = {
      logline: script.logline,
      theme: script.theme,
      cast: script.cast,
      beats: script.beats,
    };
    const staged = (
      await call<{ staged: IAutoMovieStagedSet }>(client, "stage", {
        script,
        staging: makeStagingWrite(),
      })
    ).staged;
    TestValidator.equals("stage succeeds", staged.success, true);
    if (staged.success !== true) return;
    const scriptCommit = await call<{
      committed: boolean;
      slate: {
        script: IAutoMovieScript | null;
        scene: typeof staged.scene | null;
        shots: [];
        beatEnds: [];
        notes: [];
        film: null;
      };
    }>(client, "commitScript", {
      slate: {
        script: null,
        scene: null,
        shots: [],
        beatEnds: [],
        notes: [],
        film: null,
      },
      script: scriptArtifact,
    });
    TestValidator.equals("commitScript succeeds", scriptCommit.committed, true);
    const modelRefs = [
      ...new Set(staged.scene.nodes.map((node) => node.model)),
    ].map((id) => ({ id, skeleton: null }));
    const sceneCommit = await call<{
      committed: boolean;
      slate: typeof scriptCommit.slate;
    }>(client, "commitScene", {
      slate: scriptCommit.slate,
      scene: staged.scene,
      models: modelRefs,
    });
    TestValidator.equals("commitScene succeeds", sceneCommit.committed, true);
    const queriedScene = (
      await call<{ scene: typeof staged.scene }>(client, "getScene", {
        slate: sceneCommit.slate,
      })
    ).scene;
    TestValidator.equals(
      "getScene returns staged scene",
      queriedScene,
      staged.scene,
    );
    const measured = (
      await call<{ measurement: { distance: number } | null }>(
        client,
        "measureDistance",
        {
          scene: staged.scene,
          from: { kind: "node", node: "knightA" },
          to: { kind: "node", node: "knightB" },
        },
      )
    ).measurement;
    TestValidator.predicate(
      "measureDistance resolves staged nodes",
      measured !== null && measured.distance > 0,
    );
    const sceneValidation = (
      await call<{ validation: { success: boolean } }>(
        client,
        "validateScene",
        {
          scene: staged.scene,
          models: modelRefs,
        },
      )
    ).validation;
    TestValidator.equals(
      "validateScene succeeds",
      sceneValidation.success,
      true,
    );

    const forged = (
      await call<{ forged: IAutoMovieForgedCast }>(client, "forge", {
        script,
        forge: { type: "write", entries: [forgeEntry("knightB")] },
      })
    ).forged;
    TestValidator.equals("forge succeeds", forged.success, true);
    if (forged.success !== true) return;

    const blocked = (
      await call<{ blocked: IAutoMovieBlockedBeat }>(client, "block", {
        script,
        staged,
        blocking: makeBlockingWrite({
          duration: 1,
          actors: [
            {
              node: "knightA",
              beats: "advances into the beat",
              anchors: [{ t: 0.5, cue: "mid-step" }],
            },
          ],
        }),
      })
    ).blocked;
    TestValidator.equals("block succeeds", blocked.success, true);
    if (blocked.success !== true) return;

    const nodePosition = (id: string): IAutoMovieVector3 => {
      const node = staged.scene.nodes.find((entry) => entry.id === id);
      if (node === undefined) throw new Error(`missing staged node ${id}`);
      return node.transform.translation;
    };
    const knightBRig = forged.models.knightB.skeleton;
    if (knightBRig === null) throw new Error("forged knightB must be rigged");

    const performed = (
      await call<{ performed: IAutoMovieMcpPerformedShot }>(client, "perform", {
        script,
        staged,
        performance: makePerformanceWrite({
          draft: [
            {
              verb: "locomote",
              actor: ["knightA", "knightB"],
              start: 0,
              duration: 1,
              gait: "walk",
              to: { kind: "point", point: { x: 0, y: 0, z: 0.35 } },
            },
            {
              verb: "frame",
              actor: "cam-main",
              start: 0,
              duration: "auto",
              framing: "medium",
              move: "static",
              on: { kind: "node", node: "knightA" },
            },
          ],
          duration: 1,
          revise: { review: "unchanged.", final: null },
        }),
        actors: {
          knightA: actorContext(nodePosition("knightA"), 0),
          knightB: actorContext(nodePosition("knightB"), 180, knightBRig),
        },
        blocking: blocked.blocking,
      })
    ).performed;
    TestValidator.equals("perform succeeds", performed.success, true);
    if (performed.success !== true) return;

    const cut = (
      await call<{ cut: IAutoMovieCut }>(client, "cut", {
        assemble: assemble(performed.shot.id),
        shots: [performed.shot],
      })
    ).cut;
    TestValidator.equals("cut succeeds", cut.success, true);
    if (cut.success !== true) return;
    TestValidator.equals("sequence id", cut.sequence.id, "seq-duel");
    TestValidator.predicate("runtime", nclose(cut.runtime, 1));

    const renderSpec: IAutoMovieRenderSpec = {
      target: cut.sequence.id,
      frameFormat: { fps: 12, width: 640, height: 360 },
      toneMapping: "none",
      codec: "h264",
      pixelFormat: "yuv420p",
      crf: 20,
    };
    const renderSlate = {
      script: scriptArtifact,
      scene: staged.scene,
      shots: [performed.shot],
      beatEnds: [],
      notes: [],
      film: cut.sequence,
    };
    const renderPlan = (
      await call<{ plan: { frameCount: number } | null }>(
        client,
        "planRender",
        { slate: renderSlate, spec: renderSpec },
      )
    ).plan;
    TestValidator.equals("planRender frame count", renderPlan?.frameCount, 12);
    const preview = (
      await call<{ preview: { frame: number } | null }>(client, "seeFrame", {
        slate: renderSlate,
        spec: renderSpec,
        frame: 1,
      })
    ).preview;
    TestValidator.equals("seeFrame frame", preview?.frame, 1);
  } finally {
    await client.close();
  }
};
