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
const perf = () =>
  makePerformanceWrite({
    draft: [
      {
        verb: "locomote",
        actor: ["knightA", "knightB"],
        start: 0,
        duration: 2,
        gait: "walk",
        to: { kind: "point", point: { x: 0, y: 0, z: 0.35 } },
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
 *    actors only) compiles the same shot the explicit form does: shot id,
 *    scene reference, and motion ids match.
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

    // 1. the resident shot matches the explicit one.
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
      "the resident shot matches the explicit one",
      [
        residentShot.shot.id,
        residentShot.shot.scene,
        Object.keys(residentShot.motions).sort((a, b) => a.localeCompare(b)),
      ],
      [
        explicitShot.shot.id,
        explicitShot.shot.scene,
        Object.keys(explicitShot.motions).sort((a, b) => a.localeCompare(b)),
      ],
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
