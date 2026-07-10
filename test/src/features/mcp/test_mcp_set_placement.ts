import { IAutoMovieScript, IAutoMovieShot } from "@automovie/interface";
import { AutoMovieApplication, IAutoMovieMcpTransform } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation, qclose, throwsError } from "../internal/predicates";

const scriptWrite = makeScriptWrite();
const script: IAutoMovieScript = {
  logline: scriptWrite.logline,
  theme: scriptWrite.theme,
  cast: scriptWrite.cast,
  beats: scriptWrite.beats,
};

const makeShot = (beat: string, scene: string): IAutoMovieShot => ({
  id: `shot:${beat}`,
  name: null,
  scene,
  camera: "cam-main",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 1,
});

const unitScale = { x: 1, y: 1, z: 1 };

/**
 * SetPlacement (#654): move ONE placement in the resident scene without
 * re-staging — sibling placements stay byte-unchanged. The cascade mirrors
 * `commitScene` deliberately: a moved placement changes the world coordinates
 * every committed shot was performed against, so keeping those shots would be
 * silently stale geometry; the gain is staging precision, not a shortcut around
 * re-performing.
 *
 * Scenarios:
 *
 * 1. Moving knightB swaps exactly that node's transform: the LLM authors the
 *    rotation as semantic Euler degrees (yaw 90 about +Y) and the engine lowers
 *    it to the quaternion (#723) — the model never emits one. knightA's node is
 *    deep-equal to before, `scene.json` carries the new transform
 *    (write-through), and the commitScene-mirror cascade runs — the committed
 *    shot and its file clear, beat-ends and notes clear, the film nulls.
 * 2. The ladder reflects the cascade: nextSteps flips `shots` back into the
 *    missing list and names commitShot as the re-do (the #615 interplay).
 * 3. A ghost placement violates at `$input.node` — a set names a thing that
 *    exists.
 * 4. An empty reason violates (evidence discipline); malformed and non-finite
 *    transforms violate at `$input.transform`; a project with no committed
 *    scene violates at `$slate.scene`. Nothing is written in any refused case.
 * 5. Without an active project the tool throws the actionable openProject guidance
 *    (set is resident-only).
 */
export const test_mcp_set_placement = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-setplace-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });
    app.commitScript({ script });

    const staged = app.stage({
      script: scriptWrite,
      staging: makeStagingWrite(),
    }).staged;
    if (staged.success !== true)
      throw new Error("staging fixture must succeed");
    const models = [
      ...new Set(staged.scene.nodes.map((node) => node.model)),
    ].map((id) => ({ id, skeleton: null }));
    app.commitScene({ scene: staged.scene, models });
    app.commitShot({ shot: makeShot("beat-1", staged.scene.id) });
    app.commitBeatEnd({
      beatEnd: { beat: "beat-1", shot: "shot:beat-1", actors: [] },
    });
    app.commitNotes({
      notes: [
        {
          beat: "beat-1",
          tier: "visual",
          issue: "the champion crowds the frame",
          suggestion: "move knightB back",
        },
      ],
    });

    const knightABefore = app
      .getScene({})
      .scene?.nodes.find((node) => node.id === "knightA");

    const malformedRequest = app.setPlacement(null as never);
    TestValidator.equals(
      "malformed request root refused",
      malformedRequest.updated,
      false,
    );
    TestValidator.predicate(
      "malformed request root located",
      hasViolation(malformedRequest.validation, "type", "$input"),
    );
    TestValidator.equals(
      "malformed request keeps the shot",
      malformedRequest.state.shots,
      ["shot:beat-1"],
    );

    // 1. The surgical move + the deliberate commitScene-mirror cascade.
    const moved = app.setPlacement({
      node: "knightB",
      transform: {
        translation: { x: 0, y: 0, z: 1.4 },
        rotation: { x: 0, y: 90, z: 0, order: "XYZ" },
        scale: unitScale,
      },
      reason: "give the challenger room to charge",
    });
    TestValidator.equals("set applies", moved.updated, true);
    const scene = app.getScene({}).scene!;
    TestValidator.equals(
      "knightB moved",
      scene.nodes.find((node) => node.id === "knightB")?.transform.translation,
      { x: 0, y: 0, z: 1.4 },
    );
    // The semantic yaw 90 about +Y lowered to the exact quaternion — the LLM
    // authored a degree, the engine stored the quaternion (hand oracle:
    // sin 45 = cos 45 = 0.70710678).
    TestValidator.predicate(
      "semantic yaw lowered to the +Y 90 quaternion",
      qclose(
        scene.nodes.find((node) => node.id === "knightB")!.transform.rotation,
        { x: 0, y: 0.7071067811865476, z: 0, w: 0.7071067811865476 },
      ),
    );
    TestValidator.equals(
      "knightA untouched",
      scene.nodes.find((node) => node.id === "knightA"),
      knightABefore,
    );
    TestValidator.equals(
      "scene.json carries the move (write-through)",
      fs
        .readFileSync(path.join(root, "scene.json"), "utf8")
        .includes('"z": 1.4'),
      true,
    );
    TestValidator.equals("shots cleared", moved.state.shots, []);
    TestValidator.equals(
      "the shot file cleared with them",
      fs.existsSync(path.join(root, "shots", "beat-1.json")),
      false,
    );
    TestValidator.equals("beat-ends cleared", moved.state.beatEnds, []);
    TestValidator.equals("notes cleared", moved.state.notes, 0);
    TestValidator.equals("film cleared", moved.state.film, false);

    // 2. The ladder re-locks and names the re-do.
    const steps = app.nextSteps();
    TestValidator.predicate(
      "shots rung re-locked",
      steps.missing.some((line) => line.startsWith("shots:")),
    );
    TestValidator.predicate(
      "nextSteps names the re-do",
      steps.nextActions.some((line) => line.includes("commitShot")),
    );

    // 3. A ghost placement.
    const ghost = app.setPlacement({
      node: "knightC",
      transform: {
        translation: { x: 0, y: 0, z: 0 },
        scale: unitScale,
      },
      reason: "move a knight that was never staged",
    });
    TestValidator.equals("ghost placement refuses", ghost.updated, false);
    TestValidator.predicate(
      "ghost located at the node",
      hasViolation(ghost.validation, "type", "$input.node"),
    );
    const malformedNode = app.setPlacement({
      node: null as unknown as string,
      transform: {
        translation: { x: 0, y: 0, z: 0 },
        scale: unitScale,
      },
      reason: "reject malformed placement node",
    });
    TestValidator.equals(
      "malformed placement node refuses",
      malformedNode.updated,
      false,
    );
    TestValidator.predicate(
      "malformed placement node located",
      hasViolation(malformedNode.validation, "type", "$input.node"),
    );

    // 4. Evidence + artifact twins.
    const noReason = app.setPlacement({
      node: "knightB",
      transform: {
        translation: { x: 0, y: 0, z: 0.7 },
        scale: unitScale,
      },
      reason: "",
    });
    TestValidator.equals("empty reason refuses", noReason.updated, false);
    TestValidator.predicate(
      "reason located",
      hasViolation(noReason.validation, "type", "$input.reason"),
    );
    const badTransform = app.setPlacement({
      node: "knightB",
      transform: {
        translation: { x: Number.NaN, y: 0, z: 0 },
        scale: unitScale,
      },
      reason: "place the champion at NaN",
    });
    TestValidator.equals("bad transform refuses", badTransform.updated, false);
    TestValidator.predicate(
      "transform located",
      hasViolation(badTransform.validation, "range", "$input.transform"),
    );
    const malformedTransformRoot = app.setPlacement({
      node: "knightB",
      transform: null as unknown as IAutoMovieMcpTransform,
      reason: "reject a malformed transform root",
    });
    TestValidator.equals(
      "malformed transform root refuses",
      malformedTransformRoot.updated,
      false,
    );
    TestValidator.predicate(
      "malformed transform root located",
      hasViolation(
        malformedTransformRoot.validation,
        "type",
        "$input.transform",
      ),
    );
    const badEuler = app.setPlacement({
      node: "knightB",
      transform: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 90, z: 0 },
        scale: unitScale,
      } as unknown as IAutoMovieMcpTransform,
      reason: "place the champion with malformed euler",
    });
    TestValidator.equals("bad euler refuses", badEuler.updated, false);
    TestValidator.predicate(
      "euler rotation located",
      hasViolation(badEuler.validation, "type", "$input.transform.rotation"),
    );

    const bare = new AutoMovieApplication();
    const bareRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-setplace-bare-"),
    );
    try {
      bare.openProject({ root: bareRoot });
      bare.commitScript({ script });
      const noScene = bare.setPlacement({
        node: "knightB",
        transform: {
          translation: { x: 0, y: 0, z: 0 },
          scale: unitScale,
        },
        reason: "move before any staging exists",
      });
      TestValidator.equals("no scene refuses", noScene.updated, false);
      TestValidator.predicate(
        "scene precondition located",
        hasViolation(noScene.validation, "type", "$slate.scene"),
      );
    } finally {
      fs.rmSync(bareRoot, { recursive: true, force: true });
    }

    // 5. Resident-only.
    TestValidator.predicate(
      "no project throws the openProject guidance",
      throwsError(
        () =>
          new AutoMovieApplication().setPlacement({
            node: "knightB",
            transform: {
              translation: { x: 0, y: 0, z: 0 },
              scale: unitScale,
            },
            reason: "no project is active",
          }),
        "openProject",
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
