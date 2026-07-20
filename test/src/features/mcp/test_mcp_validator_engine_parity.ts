import {
  IAutoMovieScene,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieSkeleton,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpGeometryContext,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { IDENTITY_TRANSFORM, createSkeleton } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const app = new AutoMovieApplication();

const shot: IAutoMovieShot = {
  id: "shot:beat-1",
  name: null,
  scene: "scene-1",
  camera: "camera",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 1,
};

const sequenceOf = (
  entries: IAutoMovieSequence["shots"],
): IAutoMovieSequence => ({
  id: "seq-1",
  name: null,
  fps: 24,
  shots: entries,
});

/** A rig with a torso but no arm chain on either side. */
const ARMLESS: IAutoMovieSkeleton = {
  id: "armless",
  bones: [
    { bone: "hips", parent: null, rest: IDENTITY_TRANSFORM, constraint: null },
    {
      bone: "head",
      parent: "hips",
      rest: IDENTITY_TRANSFORM,
      constraint: null,
    },
  ],
};

const sceneWith = (model: string): IAutoMovieScene => ({
  id: "scene-1",
  name: null,
  nodes: [
    {
      id: "actor",
      model,
      transform: IDENTITY_TRANSFORM,
      motion: null,
      pose: null,
    },
  ],
  cameras: [
    {
      id: "camera",
      transform: IDENTITY_TRANSFORM,
      fovY: 45,
      near: 0.1,
      far: 100,
    },
  ],
  lights: [],
});

/**
 * Three validator/engine parity gaps from one review sweep (#1097), the
 * artifacts header promises the MCP validators and the engine cannot drift, and
 * each of these answered a confident verdict the engine (or the manifest
 * doctrine) contradicts.
 *
 * Scenarios:
 *
 * 1. `validateSequence` refuses an EMPTY cut-list at `$input.shots`, the engine's
 *    `cutSequence` pins "a film must contain at least one shot", and this
 *    validator also gates the resident `film.json` slice on load. Negative
 *    twin: a one-entry sequence over its shot validates clean.
 * 2. `registerAsset` refuses a `.` path segment: `assets/./x.png` would alias
 *    `assets/x.png` under a second manifest key, bypassing the
 *    never-silently-replaced duplicate refusal. Negative twin: the plain
 *    spelling registers, and a dotted FILENAME (`x.v2.png`) stays legal.
 * 3. `getReach` on a rig with no measurable arm chain answers `reach: null` with a
 *    diagnosing reason, unmeasurable is not "unreachable". Negative twin: a
 *    rig with one usable arm still measures (`reason: null`).
 */
export const test_mcp_validator_engine_parity = (): void => {
  // 1. an empty film refuses like the engine's cut
  const empty = app.validateSequence({ sequence: sequenceOf([]), shots: [] });
  TestValidator.predicate(
    "an empty cut-list is refused at the entries",
    hasViolation(empty.validation, "type", "$input.sequence.shots"),
  );
  const one = app.validateSequence({
    sequence: sequenceOf([{ shot: shot.id, trim: null, transition: null }]),
    shots: [shot],
  });
  TestValidator.equals("a one-entry film validates clean", one.validation, {
    success: true,
  });

  // 2. a "." segment cannot alias an existing manifest entry
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-dotseg-"));
  try {
    const resident = new AutoMovieApplication();
    resident.openProject({ root });
    const plain = resident.registerAsset({ path: "assets/x.png" });
    TestValidator.equals("the plain path registers", plain.registered, true);
    const dotted = resident.registerAsset({ path: "assets/./x.png" });
    TestValidator.equals("a . segment is refused", dotted.registered, false);
    TestValidator.predicate(
      "the . segment is located at the path",
      hasViolation(dotted.validation, "type", "$input.path"),
    );
    TestValidator.equals(
      "the index still holds exactly the plain entry",
      dotted.assets,
      ["assets/x.png"],
    );
    const dottedName = resident.registerAsset({ path: "assets/x.v2.png" });
    TestValidator.equals(
      "a dotted filename stays legal",
      dottedName.registered,
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  // 3. no measurable arm chain → null reach with a diagnosing reason
  const armlessContext: IAutoMovieMcpGeometryContext = {
    scene: sceneWith("armless-model"),
    models: [{ id: "armless-model", skeleton: ARMLESS }],
    motions: {},
    shot: null,
  };
  const unmeasurable = app.getReach({
    context: armlessContext,
    actor: "actor",
    target: { kind: "point", point: { x: 1, y: 1, z: 0 } },
  });
  TestValidator.predicate(
    "an armless rig answers null reach with a diagnosing reason",
    unmeasurable.reach === null &&
      (unmeasurable.reason ?? "").includes("no measurable arm chain"),
  );
  const armedContext: IAutoMovieMcpGeometryContext = {
    scene: sceneWith("armed-model"),
    models: [{ id: "armed-model", skeleton: createSkeleton() }],
    motions: {},
    shot: null,
  };
  const measured = app.getReach({
    context: armedContext,
    actor: "actor",
    target: { kind: "point", point: { x: 1, y: 1, z: 0 } },
  });
  TestValidator.predicate(
    "a rig with one usable arm still measures",
    measured.reach !== null && measured.reason === null,
  );
};
