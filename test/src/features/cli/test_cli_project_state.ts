import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "@automovie/cli";
import {
  Vector3,
  formationSlot,
  reachPose,
  sampleFormationMotion,
  transformFormationPoint,
} from "@automovie/engine";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  formationDesign,
  productionFixture,
  shotContract,
} from "../mcp/productionFixtures";

/**
 * The transport-free project reader authenticates one compiled snapshot, feeds
 * its typed values directly to pure engine geometry, and refuses stale bytes.
 */
export const test_cli_project_state = (): void => {
  const fixture = productionFixture();
  const sourcePath = path.join(fixture.root, "src/shots/opening.ts");
  const originalSource = fs.readFileSync(sourcePath, "utf8");
  const formation = {
    ...formationDesign(),
    id: "army",
    anchor: { x: 3, y: 0, z: -4 },
  };
  fs.writeFileSync(
    path.join(fixture.root, ".automovie/design/formations/army.json"),
    `${JSON.stringify(formation, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(fixture.root, ".automovie/design/shots/opening.json"),
    `${JSON.stringify(
      {
        ...shotContract(),
        participants: [
          ...shotContract().participants,
          { kind: "formation", id: "army" },
        ],
      },
      null,
      2,
    )}\n`,
  );
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const missing = loadAutoMovieProjectState({ root: fixture.root });
    TestValidator.predicate(
      "uncompiled project state is explicit",
      missing.productionId === "fixture-film" &&
        missing.freshness.status === "missing" &&
        missing.freshness.compileFingerprint === null &&
        missing.generated.registry === null,
    );
    TestValidator.predicate(
      "missing project state cannot be narrowed",
      refusesCurrent(missing),
    );

    const compiled = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    TestValidator.predicate("state-reader fixture compiles", compiled.success);
    const loaded = loadAutoMovieProjectState({ root: fixture.root });
    const current = requireCurrentAutoMovieProjectState(loaded);
    const shot = current.generated.shots.get("opening")!;
    const loadedFormation = current.generated.design.formations.get("army")!;
    const runtime = shot.formations.find(
      (candidate) => candidate.id === loadedFormation.id,
    )!;
    const base = formationSlot(loadedFormation, 1).position;
    const motion = sampleFormationMotion(
      shot.formationMotions,
      loadedFormation.id,
      3,
    );
    const moved = transformFormationPoint(
      base,
      runtime.anchor,
      motion,
      runtime.facingDeg,
    );
    const landmark = current.generated.design.world.landmarks.find(
      (candidate) => candidate.id === "signal-ground",
    )!.position;
    const meters = Vector3.length(Vector3.subtract(moved, landmark));
    const actor = shot.scene.nodes.find(
      (candidate) => candidate.id === "sentinel",
    )!;
    const model = shot.models.find(
      (candidate) => candidate.id === actor.model,
    )!;
    const left =
      model.skeleton === null
        ? null
        : reachPose(model.skeleton, "left", landmark);
    const repeatedLeft =
      model.skeleton === null
        ? null
        : reachPose(model.skeleton, "left", landmark);
    TestValidator.predicate(
      "loaded state feeds deterministic engine reach distance and formation queries",
      current.revision === compiled.revision &&
        current.freshness.compileFingerprint ===
          compiled.compiler.inputFingerprint &&
        current.freshness.currentFingerprint ===
          compiled.compiler.inputFingerprint &&
        current.freshness.problems.length === 0 &&
        current.generated.registry.inputFingerprint ===
          compiled.compiler.inputFingerprint &&
        current.generated.registry.shots.some(
          (candidate) => candidate.id === "opening",
        ) &&
        current.generated.film?.id === "fixture-film" &&
        moved.x === 3 &&
        moved.z === -5 &&
        Math.abs(meters - Math.sqrt(34)) < 1e-12 &&
        left !== null &&
        JSON.stringify(left) === JSON.stringify(repeatedLeft),
    );

    fs.appendFileSync(sourcePath, "\n// stale reader fixture\n");
    const stale = loadAutoMovieProjectState({ root: fixture.root });
    TestValidator.predicate(
      "source drift preserves the identified old snapshot but marks it stale",
      stale.freshness.status === "stale" &&
        stale.freshness.compileFingerprint ===
          compiled.compiler.inputFingerprint &&
        stale.freshness.currentFingerprint !==
          stale.freshness.compileFingerprint &&
        stale.generated.shots.has("opening") &&
        refusesCurrent(stale),
    );

    fs.writeFileSync(sourcePath, originalSource);
    const generatedShot = path.join(
      project.generatedRoot(),
      "shots/opening.json",
    );
    fs.appendFileSync(generatedShot, "\n");
    const modified = loadAutoMovieProjectState({ root: fixture.root });
    TestValidator.predicate(
      "modified compiler bytes are excluded and reported stale",
      modified.freshness.status === "stale" &&
        modified.freshness.problems.some(
          (problem) =>
            problem.code === "generated-file-modified" &&
            problem.path === "shots/opening.json",
        ) &&
        modified.generated.shots.has("opening") === false &&
        refusesCurrent(modified),
    );
  } finally {
    fixture.dispose();
  }
};

const refusesCurrent = (
  state: ReturnType<typeof loadAutoMovieProjectState>,
): boolean => {
  try {
    requireCurrentAutoMovieProjectState(state);
    return false;
  } catch {
    return true;
  }
};
