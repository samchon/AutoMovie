import { IAutoMovieScript } from "@automovie/interface";
import { AutoMovieApplication, IAutoMovieMcpPropSpec } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation, throwsError } from "../internal/predicates";
import { mcpDoorSpec } from "./test_mcp_forge_prop";

/** A minimal rigid prop — no body, no affordances, no articulation. */
const crateSpec = (): IAutoMovieMcpPropSpec => ({
  node: "crate",
  model: {
    id: "crate",
    name: "crate",
    origin: "generated",
    skeleton: null,
    body: null,
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
  },
  articulation: null,
});

/**
 * The props slice (#671): a resident `forgeProp` success writes through as
 * `props/<node>.json` — the reserved directory's promise finally kept — and
 * `eraseProp` is its targeted removal mirror. Pure (no-project) calls stay
 * byte-compatible.
 *
 * Scenarios:
 *
 * 1. A resident forge stores the accepted spec: `stored: true`, the file's parse
 *    equals the spec, and `nextSteps` status lists the prop node.
 * 2. A failed forge stores nothing and omits `stored`.
 * 3. Re-forging one prop replaces exactly its own file; the sibling prop's file
 *    stays byte-identical (the #617 upsert below the slate).
 * 4. `eraseProp` removes the named spec's file; erasing a prop with no stored
 *    spec, or with a blank reason, is refused on the ledger.
 * 5. A prop the committed scene still places is refused at `$slate.scene` and its
 *    file survives — unstaging is `commitScene`'s job.
 * 6. A pure (no-project) forge output carries no `stored` key, and `eraseProp`
 *    without a project throws the actionable openProject prompt.
 */
export const test_mcp_prop_slice = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-props-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });

    const door = app.forgeProp({ spec: mcpDoorSpec() });
    TestValidator.equals("resident forge succeeds", door.forged.success, true);
    TestValidator.equals("resident forge stores", door.stored, true);
    const doorFile = path.join(root, "props", "door.json");
    TestValidator.equals(
      "props/door.json parse equals the spec",
      JSON.parse(fs.readFileSync(doorFile, "utf8")),
      mcpDoorSpec(),
    );
    TestValidator.equals(
      "nextSteps status lists the stored prop",
      app.nextSteps().status.props,
      ["door"],
    );

    const ghost = mcpDoorSpec();
    const broken = app.forgeProp({
      spec: { ...ghost, node: "ghost" },
    });
    TestValidator.equals(
      "failed forge refused (model id mismatch)",
      broken.forged.success,
      false,
    );
    TestValidator.equals("failed forge omits stored", broken.stored, undefined);
    TestValidator.equals(
      "failed forge writes no file",
      fs.existsSync(path.join(root, "props", "ghost.json")),
      false,
    );

    app.forgeProp({ spec: crateSpec() });
    const crateFile = path.join(root, "props", "crate.json");
    const crateBytes = fs.readFileSync(crateFile, "utf8");
    const tweaked = mcpDoorSpec();
    const reforged = app.forgeProp({
      spec: {
        ...tweaked,
        model: {
          ...tweaked.model,
          body: { ...tweaked.model.body!, mass: 30 },
        },
      },
    });
    TestValidator.equals("re-forge stores again", reforged.stored, true);
    TestValidator.equals(
      "re-forge replaced exactly its own file",
      (JSON.parse(fs.readFileSync(doorFile, "utf8")) as IAutoMovieMcpPropSpec)
        .model.body!.mass,
      30,
    );
    TestValidator.equals(
      "sibling prop file stays byte-identical",
      fs.readFileSync(crateFile, "utf8"),
      crateBytes,
    );

    const erased = app.eraseProp({
      node: "crate",
      reason: "the crate scene was cut from the script",
    });
    TestValidator.equals("erase succeeds", erased.erased, true);
    TestValidator.equals(
      "erased file is gone",
      fs.existsSync(crateFile),
      false,
    );
    TestValidator.equals("props after the erase", erased.props, ["door"]);

    const absent = app.eraseProp({ node: "crate", reason: "already gone" });
    TestValidator.equals("absent prop refused", absent.erased, false);
    TestValidator.predicate(
      "absent violation at the node",
      hasViolation(absent.validation, "type", "$input.node"),
    );
    const blank = app.eraseProp({ node: "door", reason: " " });
    TestValidator.equals("blank reason refused", blank.erased, false);
    TestValidator.predicate(
      "blank-reason violation at the reason",
      hasViolation(blank.validation, "type", "$input.reason"),
    );

    const scriptWrite = makeScriptWrite();
    const script: IAutoMovieScript = {
      logline: scriptWrite.logline,
      theme: scriptWrite.theme,
      cast: scriptWrite.cast,
      beats: scriptWrite.beats,
    };
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
        { ...staged.scene.nodes[0]!, id: "door", model: "door" },
      ],
    };
    const models = [...new Set(scene.nodes.map((node) => node.model))].map(
      (id) => ({ id, skeleton: null }),
    );
    const sceneCommit = app.commitScene({ scene, models });
    TestValidator.equals(
      "scene with the placed prop commits",
      sceneCommit.committed,
      true,
    );
    const placed = app.eraseProp({ node: "door", reason: "remodeling" });
    TestValidator.equals("placed prop refused", placed.erased, false);
    TestValidator.predicate(
      "placed violation blames the committed scene",
      hasViolation(placed.validation, "type", "$slate.scene"),
    );
    TestValidator.equals(
      "refused erase leaves the file",
      fs.existsSync(doorFile),
      true,
    );

    const pure = new AutoMovieApplication().forgeProp({ spec: mcpDoorSpec() });
    TestValidator.equals(
      "pure forge output carries no stored key",
      "stored" in pure,
      false,
    );
    TestValidator.predicate(
      "no active project throws the openProject prompt",
      throwsError(
        () =>
          new AutoMovieApplication().eraseProp({ node: "door", reason: "x" }),
        "openProject",
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
