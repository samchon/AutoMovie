import { forgeCast, stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  forgeEntry,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";

/**
 * Pins the happy path of the FORGE consumer and its join with staging: the one
 * cast member without a `modelRef` gets exactly one validated stand-in, keyed
 * by its node ??and the staged scene's `modelRef ?? node` fallback resolves to
 * that forged model's id.
 *
 * Scenarios:
 *
 * 1. The duel cast (knightA imports "stickman", knightB has no modelRef) with one
 *    forge entry for knightB ??success; `models` holds exactly knightB's rig
 *    with a skeleton.
 * 2. Chained into `stageScene`, knightB's scene node carries model "knightB" ??the
 *    exact key `forgeCast` validated, closing the loop from forge to stage.
 */
export const test_film_forge_cast_valid = (): void => {
  const script = makeScriptWrite();
  const forged = forgeCast(script, {
    type: "write",
    entries: [forgeEntry("knightB")],
  });
  TestValidator.equals("success", forged.success, true);
  if (forged.success !== true) return;
  TestValidator.equals("forged keys", Object.keys(forged.models), ["knightB"]);
  TestValidator.predicate(
    "stand-in is rigged",
    forged.models["knightB"]!.skeleton !== null,
  );

  const staged = stageScene(script, makeStagingWrite());
  TestValidator.equals("staging", staged.success, true);
  if (staged.success !== true) return;
  const nodeB = staged.scene.nodes.find((n) => n.id === "knightB")!;
  TestValidator.equals(
    "scene joins the forged model by id",
    nodeB.model,
    forged.models["knightB"]!.id,
  );
};
