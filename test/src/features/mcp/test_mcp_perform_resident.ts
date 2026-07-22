import { IAutoMovieGait, IAutoMovieVector3 } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, makePose } from "../internal/fixtures";
import { hasViolation, throwsError } from "../internal/predicates";

const scriptWrite = makeScriptWrite();

const walk: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

/** A solvable performance: one walk both knights share (no IK rest frames). */
const perf = (destinationZ = 0.35) =>
  makePerformanceWrite({
    draft: [
      {
        verb: "locomote",
        actor: ["knightA", "knightB"],
        start: 0,
        duration: 2,
        gait: "walk",
        to: { kind: "point", point: { x: 0, y: 0, z: destinationZ } },
      },
    ],
  });

const actorContext = (
  position: IAutoMovieVector3,
  facingDeg: number,
): IAutoMovieMcpActorContext => {
  const skeleton = createSkeleton();
  return {
    skeleton: skeleton.id,
    gaits: [walk],
    position,
    speed: 1,
    facingDeg,
    eyeHeight: 1.6,
    restPose: makePose([]),
    rig: skeleton,
  };
};

/**
 * Resident `perform` (#1176): omit `script` AND `staged` together and the shot
 * performs against the committed slate, with staging mounts as the one explicit
 * resident parameter (mounts are not a committed slice, the `getShotEndState`
 * precedent). The token-heaviest recurring payload, the whole staged scene,
 * stops travelling per beat.
 *
 * Scenarios:
 *
 * 1. After resident commitScript/commitScene, a resident perform (performance +
 *    actors only) returns compact motion identities, and its following
 *    commitShot resolves the hidden same-session registry.
 * 2. Performing before the scene is committed refuses at `$slate.scene`.
 * 3. A mixed call (script without staged) is refused at `$input`; `mounts` on an
 *    explicit call is refused at `$input.mounts`; a malformed resident mount
 *    entry is a shape violation at `$input.mounts[i]`.
 * 4. Without a project, the resident form throws the actionable openProject
 *    prompt.
 */
export const test_mcp_perform_resident = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-perfres-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });

    // 2a. a fresh project refuses at BOTH missing slices in one round.
    const bare = app.perform({
      performance: perf(),
      actors: {},
    }).performed;
    TestValidator.predicate(
      "a fresh project refuses at the slate script and scene together",
      bare.success === false &&
        hasViolation(bare, "type", "$slate.script") &&
        hasViolation(bare, "type", "$slate.scene"),
    );

    app.commitScript({
      script: {
        logline: scriptWrite.logline,
        theme: scriptWrite.theme,
        cast: scriptWrite.cast,
        beats: scriptWrite.beats,
      },
    });

    // 2. scene not committed yet → $slate.scene refusal.
    const early = app.perform({
      performance: perf(),
      actors: {},
    }).performed;
    TestValidator.predicate(
      "a resident perform before commitScene refuses at the slate scene",
      early.success === false && hasViolation(early, "type", "$slate.scene"),
    );

    const staged = app.stage({
      script: scriptWrite,
      staging: makeStagingWrite(),
    }).staged;
    if (staged.success !== true)
      throw new Error("staging fixture must succeed");
    app.commitScene({
      scene: staged.scene,
      models: [...new Set(staged.scene.nodes.map((node) => node.model))].map(
        (id) => ({ id, skeleton: null }),
      ),
    });

    const positionOf = (id: string): IAutoMovieVector3 => {
      const node = staged.scene.nodes.find((entry) => entry.id === id);
      if (node === undefined) throw new Error(`missing node ${id}`);
      return node.transform.translation;
    };
    const actors = () => ({
      knightA: actorContext(positionOf("knightA"), 0),
      knightB: actorContext(positionOf("knightB"), 180),
    });

    // 1. a resident result is compact but commits through its session registry.
    const residentShot = app.perform({
      performance: perf(),
      actors: actors(),
    }).performed;
    if (residentShot.success !== true)
      throw new Error(
        `resident perform must succeed: ${JSON.stringify(residentShot)}`,
      );
    const explicitShot = app.perform({
      script: scriptWrite,
      staged,
      performance: perf(),
      actors: actors(),
    }).performed;
    if (explicitShot.success !== true)
      throw new Error("explicit perform must succeed");
    TestValidator.equals(
      "the compact resident shot matches the explicit one",
      [
        residentShot.shot.id,
        residentShot.shot.scene,
        residentShot.motionSummary
          .map((motion) => motion.id)
          .sort((a, b) => a.localeCompare(b)),
      ],
      [
        explicitShot.shot.id,
        explicitShot.shot.scene,
        Object.values(explicitShot.motions)
          .map((motion) => motion.id)
          .sort((a, b) => a.localeCompare(b)),
      ],
    );
    TestValidator.equals(
      "a resident perform omits dense clips by default",
      residentShot.motions,
      {},
    );
    TestValidator.equals(
      "a compact resident perform hands motions to commitShot",
      app.commitShot({ shot: residentShot.shot }).committed,
      true,
    );
    const consumedCompact = app.commitShot({ shot: residentShot.shot });
    TestValidator.predicate(
      "a compact handoff is consumed by its successful commit",
      consumedCompact.committed === false &&
        consumedCompact.validation.success === false &&
        consumedCompact.validation.violations.some(
          (violation) => violation.path === "$input.motions",
        ),
    );

    const compactBeforeFull = app.perform({
      performance: perf(0.35),
    }).performed;
    if (compactBeforeFull.success !== true)
      throw new Error("second compact resident perform must succeed");
    const fullResident = app.perform({
      performance: perf(1.1),
      response: "full",
    }).performed;
    TestValidator.predicate(
      "a resident caller can request dense clips",
      fullResident.success === true &&
        Object.keys(fullResident.motions).length ===
          fullResident.motionSummary.length,
    );
    if (fullResident.success !== true)
      throw new Error("full resident perform must succeed");
    const staleAfterFull = app.commitShot({ shot: fullResident.shot });
    TestValidator.predicate(
      "a successful full response clears an older compact handoff for the same shot",
      staleAfterFull.committed === false &&
        staleAfterFull.validation.success === false &&
        staleAfterFull.validation.violations.some(
          (violation) => violation.path === "$input.motions",
        ),
    );
    TestValidator.equals(
      "the full response commits only with its own returned registry",
      app.commitShot({
        shot: fullResident.shot,
        motions: fullResident.motions,
      }).committed,
      true,
    );
    const fullEnd = app.getShotEndState({ beat: "beat-1" });
    TestValidator.predicate(
      "geometry memory follows the full response rather than the cleared compact one",
      fullEnd.reason === null &&
        fullEnd.beatEnd?.actors.every(
          (actor) => Math.abs(actor.transform.translation.z - 1.1) < 1e-6,
        ) === true,
    );

    const compactBeforeFailure = app.perform({
      performance: perf(),
    }).performed;
    if (compactBeforeFailure.success !== true)
      throw new Error("compact perform before failed retry must succeed");
    const invalidRetry = perf();
    if (invalidRetry.draft[0]?.verb === "locomote")
      invalidRetry.draft[0].gait = "missing";
    TestValidator.equals(
      "a failed retry is reported",
      app.perform({ performance: invalidRetry }).performed.success,
      false,
    );
    TestValidator.equals(
      "a failed retry preserves the last successful compact handoff",
      app.commitShot({ shot: compactBeforeFailure.shot }).committed,
      true,
    );

    const compactBeforeScene = app.perform({
      performance: perf(),
    }).performed;
    if (compactBeforeScene.success !== true)
      throw new Error("compact perform before scene replacement must succeed");
    app.commitScene({
      scene: staged.scene,
      models: [...new Set(staged.scene.nodes.map((node) => node.model))].map(
        (id) => ({ id, skeleton: null }),
      ),
    });
    const staleCompact = app.commitShot({ shot: compactBeforeScene.shot });
    TestValidator.predicate(
      "a scene replacement clears the compact motion handoff",
      staleCompact.committed === false &&
        staleCompact.validation.success === false &&
        staleCompact.validation.violations.some(
          (violation) => violation.path === "$input.motions",
        ),
    );

    // 3. pairing and mounts gates.
    const mixed = app.perform({
      script: scriptWrite,
      performance: perf(),
      actors: actors(),
    }).performed;
    TestValidator.predicate(
      "script without staged is refused",
      mixed.success === false && hasViolation(mixed, "type", "$input"),
    );
    const explicitMounts = app.perform({
      script: scriptWrite,
      staged,
      performance: perf(),
      actors: actors(),
      mounts: [],
    }).performed;
    TestValidator.predicate(
      "mounts on an explicit call is refused",
      explicitMounts.success === false &&
        hasViolation(explicitMounts, "type", "$input.mounts"),
    );
    const explicitCompact = app.perform({
      script: scriptWrite,
      staged,
      performance: perf(),
      actors: actors(),
      response: "compact",
    }).performed;
    TestValidator.predicate(
      "an explicit perform refuses a compact response with no state handoff",
      explicitCompact.success === false &&
        hasViolation(explicitCompact, "type", "$input.response"),
    );
    const malformedResponse = app.perform({
      script: scriptWrite,
      staged,
      performance: perf(),
      actors: actors(),
      response: "brief" as never,
    }).performed;
    TestValidator.predicate(
      "an unknown response mode is a located shape violation",
      malformedResponse.success === false &&
        hasViolation(malformedResponse, "type", "$input.response"),
    );
    const badMount = app.perform({
      performance: perf(),
      actors: actors(),
      mounts: [
        { node: 5, binding: { parent: "horse", bone: "spine" } },
      ] as never,
    }).performed;
    const nonArrayMounts = app.perform({
      performance: perf(),
      actors: actors(),
      mounts: 5 as never,
    }).performed;
    TestValidator.predicate(
      "a non-array mounts is a shape violation",
      nonArrayMounts.success === false &&
        hasViolation(nonArrayMounts, "type", "$input.mounts"),
    );
    const nonObjectMount = app.perform({
      performance: perf(),
      actors: actors(),
      mounts: [null] as never,
    }).performed;
    TestValidator.predicate(
      "a non-object mount entry is a shape violation",
      nonObjectMount.success === false &&
        hasViolation(nonObjectMount, "type", "$input.mounts[0]"),
    );
    const nonObjectBinding = app.perform({
      performance: perf(),
      actors: actors(),
      mounts: [{ node: "rider", binding: 5 }] as never,
    }).performed;
    TestValidator.predicate(
      "a non-object mount binding is a shape violation",
      nonObjectBinding.success === false &&
        hasViolation(nonObjectBinding, "type", "$input.mounts[0].binding"),
    );
    TestValidator.predicate(
      "a malformed resident mount is a shape violation",
      badMount.success === false &&
        hasViolation(badMount, "type", "$input.mounts[0].node"),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  // 4. resident form without a project throws the actionable prompt.
  TestValidator.predicate(
    "a resident perform without a project throws the openProject prompt",
    throwsError(
      () =>
        new AutoMovieApplication().perform({
          performance: perf(),
          actors: {},
        }),
      ["openProject"],
    ),
  );
};
