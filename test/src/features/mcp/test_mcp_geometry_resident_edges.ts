import {
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieVector3,
} from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { IDENTITY_TRANSFORM, createSkeleton } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";
import { mcpDoorSpec } from "./test_mcp_forge_prop";

const skeleton = createSkeleton();

const transform = (translation: IAutoMovieVector3) => ({
  ...IDENTITY_TRANSFORM,
  translation,
});

const sceneWith = (actorMotion: string | null): IAutoMovieScene => ({
  id: "scene-1",
  name: null,
  nodes: [
    {
      id: "actor",
      model: "actor-model",
      transform: transform({ x: 1, y: 0, z: 2 }),
      motion: actorMotion,
      pose: null,
    },
  ],
  cameras: [
    {
      id: "camera",
      transform: transform({ x: 0, y: 1.5, z: 5 }),
      fovY: 45,
      near: 0.1,
      far: 100,
    },
  ],
  lights: [],
});

const script: IAutoMovieScript = {
  logline: "a resident actor with no shot committed",
  theme: "read before performing",
  cast: [{ node: "actor", character: "the resident actor", modelRef: null }],
  beats: [
    {
      id: "beat-1",
      name: "the beat",
      summary: "the actor waits",
      durationHint: 1,
    },
  ],
};

const models = [
  { id: "actor-model", skeleton },
  { id: "prop-model", skeleton: null },
];

const withProject = (run: (root: string) => void): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-geo-res-"));
  try {
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

/**
 * GeometryService resident-source branches: the resident geometry tools read
 * the project's stored scene plus session rig/motion memory, and each
 * unsatisfied precondition surfaces as an actionable throw or a
 * null-with-reason (#1040 coverage) rather than a raw dereference across the
 * MCP boundary.
 *
 * Scenarios:
 *
 * 1. `measureDistance` on a project with no committed scene throws the "commit a
 *    scene first" guidance (the scene source).
 * 2. `getReach` on a project with no committed scene throws the same guidance from
 *    the geometry-context source.
 * 3. A resident `getResolvedPose` for a beat with no committed shot resolves the
 *    actor's ambient node motion (the shot slice is absent, so the beat's shot
 *    resolves to null).
 * 4. A resident `getResolvedPose` whose actor references a motion never compiled
 *    in this session throws the "call commitShot with motions" guidance —
 *    project files persist shot motion ids, not compiled clips.
 * 5. A resident query after a `forgeProp` merges the stored prop's model into the
 *    geometry model registry.
 */
export const test_mcp_geometry_resident_edges = (): void => {
  // 1. measureDistance with no committed scene
  withProject((root) => {
    const app = new AutoMovieApplication();
    app.openProject({ root });
    TestValidator.predicate(
      "resident measureDistance without a scene throws scene guidance",
      throwsError(
        () =>
          app.measureDistance({
            from: { kind: "node", node: "actor" },
            to: { kind: "node", node: "actor" },
          }),
        ["no committed scene", "Commit a scene first"],
      ),
    );
  });

  // 2. getReach with no committed scene
  withProject((root) => {
    const app = new AutoMovieApplication();
    app.openProject({ root });
    TestValidator.predicate(
      "resident getReach without a scene throws context guidance",
      throwsError(
        () =>
          app.getReach({
            actor: "actor",
            target: { kind: "point", point: { x: 1, y: 1, z: 1 } },
          }),
        ["without a context", "no committed scene"],
      ),
    );
  });

  // 3. a beat with no committed shot resolves the ambient node motion
  withProject((root) => {
    const app = new AutoMovieApplication();
    app.openProject({ root });
    app.commitScript({ script });
    app.commitScene({ scene: sceneWith(null), models });
    const resolved = app.getResolvedPose({
      actor: "actor",
      beat: "beat-1",
    }).resolvedPose;
    TestValidator.predicate(
      "a shotless resident beat returns the actor rest pose",
      resolved !== null &&
        resolved.motion === null &&
        resolved.bones.length > 0,
    );
  });

  // 4. a dangling ambient motion id explains that clips are not persisted
  withProject((root) => {
    const app = new AutoMovieApplication();
    app.openProject({ root });
    app.commitScript({ script });
    app.commitScene({ scene: sceneWith("ambient-motion"), models });
    TestValidator.predicate(
      "a resident motion id with no compiled clip throws commitShot guidance",
      throwsError(
        () => app.getResolvedPose({ actor: "actor", beat: "beat-1" }),
        ["cannot sample resident motion", "commitShot with motions"],
      ),
    );
  });

  // 5. a stored prop's model merges into the geometry model registry
  withProject((root) => {
    const app = new AutoMovieApplication();
    app.openProject({ root });
    app.commitScript({ script });
    app.commitScene({ scene: sceneWith(null), models });
    const stored = app.forgeProp({ spec: mcpDoorSpec() }).stored;
    TestValidator.equals("the prop spec is stored", stored, true);
    const resolved = app.getResolvedPose({
      actor: "actor",
      beat: "beat-1",
    }).resolvedPose;
    TestValidator.predicate(
      "a resident query after forgeProp still resolves the actor pose",
      resolved !== null && resolved.node === "actor",
    );
  });
};
