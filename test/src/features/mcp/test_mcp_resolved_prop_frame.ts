import { IAutoMovieScript, IAutoMovieShot } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { throwsError } from "../internal/predicates";
import { mcpDoorSpec } from "./test_mcp_forge_prop";

const scriptWrite = makeScriptWrite();
const script: IAutoMovieScript = {
  logline: scriptWrite.logline,
  theme: scriptWrite.theme,
  cast: scriptWrite.cast,
  beats: scriptWrite.beats,
};

/**
 * The committed door motion intentionally exceeds the forged hinge's 55-degree
 * limit.
 */
const doorShot = (scene: string, camera: string): IAutoMovieShot => ({
  id: "shot:beat-1",
  name: null,
  scene,
  camera,
  cameraMotion: null,
  performances: [],
  objectMotions: [
    {
      id: "door-open",
      name: null,
      duration: 2,
      loop: false,
      tracks: [
        {
          channel: { kind: "node", node: "doorWest/hinge", path: "rotation" },
          times: [0, 2],
          values: [0, 0, 0, 1, 0, 1, 0, 0],
          interpolation: "linear",
        },
      ],
    },
  ],
  duration: 2,
});

/**
 * A forged articulation becomes addressable through MCP's committed artifacts:
 * object motion names its lowered `<placement>/<joint>` node, the declared
 * profile clamps the authored hinge swing, and the copy driver propagates the
 * sampled swing to its dependent joint (#1367).
 */
export const test_mcp_resolved_prop_frame = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-prop-frame-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });
    TestValidator.predicate(
      "a malformed prop-frame request names its input root",
      throwsError(
        () => app.getResolvedPropFrame(null as never),
        ["getResolvedPropFrame request", "$input"],
      ),
    );
    TestValidator.equals(
      "a blank beat has an actionable reason",
      app.getResolvedPropFrame({ beat: " " }).frame,
      null,
    );
    TestValidator.equals(
      "an invalid frame time has an actionable reason",
      app.getResolvedPropFrame({ beat: "beat-1", t: -1 }).frame,
      null,
    );
    TestValidator.equals(
      "a frame before commitScene has an actionable reason",
      app.getResolvedPropFrame({ beat: "beat-1" }).frame,
      null,
    );
    const door = mcpDoorSpec();
    // `mcpDoorSpec` also carries the conversion-only pointer example; a frame
    // resolver has no document for that pointer, so this scenario keeps the
    // door's executable copy driver and hinge limit only.
    door.articulation!.profile.drivers =
      door.articulation!.profile.drivers.filter(
        (driver) => driver.type !== "driven",
      );
    const forged = app.forgeProp({ spec: door });
    TestValidator.equals("the articulated door is stored", forged.stored, true);
    const crate = {
      ...door,
      node: "crate",
      model: { ...door.model, id: "crate", name: "crate" },
      articulation: null,
    };
    TestValidator.equals(
      "a rigid stored prop has no profile to apply",
      app.forgeProp({ spec: crate }).stored,
      true,
    );
    app.commitScript({ script });
    const staged = app.stage({
      script: scriptWrite,
      staging: makeStagingWrite(),
    }).staged;
    if (staged.success !== true)
      throw new Error("staging fixture must succeed");
    const scene = {
      ...staged.scene,
      nodes: [
        ...staged.scene.nodes,
        {
          ...staged.scene.nodes[0]!,
          id: "doorWest",
          model: "door",
          motion: null,
          pose: null,
        },
      ],
    };
    const models = [...new Set(scene.nodes.map((node) => node.model))].map(
      (id) => ({ id, skeleton: null }),
    );
    TestValidator.equals(
      "the scene placing the forged door commits",
      app.commitScene({ scene, models }).committed,
      true,
    );
    TestValidator.equals(
      "a scene with no committed beat reports that absence",
      app.getResolvedPropFrame({ beat: "beat-1" }).frame,
      null,
    );
    TestValidator.equals(
      "the lowered joint track commits as an object motion",
      app.commitShot({
        shot: doorShot(scene.id, scene.cameras[0]!.id),
      }).committed,
      true,
    );

    const resolved = app.getResolvedPropFrame({ beat: "beat-1", t: 2 });
    TestValidator.predicate(
      "the hinge limit clamps and its copy driver resolves onto the dependent joint",
      resolved.reason === null &&
        resolved.frame !== null &&
        resolved.frame.clamps.some(
          (clamp) =>
            clamp.channel === "node:doorWest/hinge:rotation" &&
            clamp.profile === "door-profile",
        ) &&
        resolved.frame.world["doorWest/hinge"] !== undefined &&
        (resolved.frame.world["doorWest/handleMirror"]?.[0] ?? 1) < 0,
    );

    const missing = app.getResolvedPropFrame({ beat: "missing" });
    TestValidator.equals(
      "an absent committed beat returns its actionable reason",
      missing.frame,
      null,
    );
    TestValidator.equals(
      "a time beyond the shot has an actionable reason",
      app.getResolvedPropFrame({ beat: "beat-1", t: 2.01 }).frame,
      null,
    );

    TestValidator.equals(
      "an empty object-motion set still resolves the articulated rest frame",
      app.commitShot({
        shot: {
          ...doorShot(scene.id, scene.cameras[0]!.id),
          objectMotions: [],
        },
      }).committed,
      true,
    );
    TestValidator.predicate(
      "a rest-frame query returns no false clamp",
      app.getResolvedPropFrame({ beat: "beat-1" }).frame?.clamps.length === 0,
    );

    const broken = mcpDoorSpec();
    broken.node = "brokenDoor";
    broken.model = { ...broken.model, id: "brokenDoor", name: "broken door" };
    const brokenScene = {
      ...scene,
      nodes: [
        ...scene.nodes,
        {
          ...scene.nodes[0]!,
          id: "brokenDoor",
          model: "brokenDoor",
          motion: null,
          pose: null,
        },
      ],
    };
    const brokenModels = [
      ...new Set(brokenScene.nodes.map((node) => node.model)),
    ].map((id) => ({ id, skeleton: null }));
    TestValidator.equals(
      "a newly forged placed prop writes through before its next scene commit",
      app.forgeProp({ spec: broken }).stored,
      true,
    );
    TestValidator.equals(
      "the scene carrying the malformed executable profile commits as data",
      app.commitScene({ scene: brokenScene, models: brokenModels }).committed,
      true,
    );
    TestValidator.equals(
      "a shot over the malformed profile scene commits structurally",
      app.commitShot({
        shot: {
          ...doorShot(brokenScene.id, brokenScene.cameras[0]!.id),
          objectMotions: [],
        },
      }).committed,
      true,
    );
    TestValidator.equals(
      "the profile-frame resolver surfaces a runtime profile fault as data",
      app.getResolvedPropFrame({ beat: "beat-1" }).frame,
      null,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
