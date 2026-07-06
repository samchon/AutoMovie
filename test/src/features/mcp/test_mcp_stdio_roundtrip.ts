import {
  IAutoMovieBlockedBeat,
  IAutoMovieCut,
  IAutoMovieForgedCast,
  IAutoMovieStagedSet,
} from "@automovie/engine";
import {
  IAutoMovieAssembleApplication,
  IAutoMovieGait,
  IAutoMovieVector3,
} from "@automovie/interface";
import {
  IAutoMovieMcpActorContext,
  IAutoMovieMcpPerformedShot,
} from "@automovie/mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { TestValidator } from "@nestia/e2e";

import {
  forgeEntry,
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const WALK: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

const call = async <T>(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<T> => {
  const result = await client.callTool({ name, arguments: args });
  if (result.structuredContent === undefined)
    throw new Error(`tool ${name} returned no structured content`);
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
 * 1. A real stdio client sees the AutoMovie stage and slate-query tools.
 * 2. The same client calls `stage -> getScene -> forge -> block -> perform ->
 *    cut`, feeding structured outputs forward and receiving a successful final
 *    sequence.
 */
export const test_mcp_stdio_roundtrip = async (): Promise<void> => {
  const client = new Client({ name: "automovie-test", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: "pnpm",
    args: ["--filter", "@automovie/mcp", "start"],
  });
  await client.connect(transport);
  try {
    const tools = await client.listTools();
    TestValidator.equals(
      "tool names",
      tools.tools.map((tool) => tool.name).sort((a, b) => a.localeCompare(b)),
      [
        "block",
        "cut",
        "forge",
        "getBeatEnd",
        "getNotes",
        "getScene",
        "getScript",
        "getShot",
        "perform",
        "stage",
      ],
    );

    const script = makeScriptWrite();
    const staged = (
      await call<{ staged: IAutoMovieStagedSet }>(client, "stage", {
        script,
        staging: makeStagingWrite(),
      })
    ).staged;
    TestValidator.equals("stage succeeds", staged.success, true);
    if (staged.success !== true) return;
    const queriedScene = (
      await call<{ scene: typeof staged.scene }>(client, "getScene", {
        slate: {
          script,
          scene: staged.scene,
          shots: [],
          beatEnds: [],
          notes: [],
        },
      })
    ).scene;
    TestValidator.equals(
      "getScene returns staged scene",
      queriedScene,
      staged.scene,
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
  } finally {
    await client.close();
  }
};
