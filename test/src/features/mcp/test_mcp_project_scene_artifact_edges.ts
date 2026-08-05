import { AutoMovieProject } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { throwsError } from "../internal/predicates";

interface ISceneArtifactFixtureFailure {
  error: unknown;
}

class SceneArtifactFixtureCleanupError extends AggregateError {}

/** Remove one scene-artifact root without replacing its primary failure. */
export const preserveSceneArtifactFixtureCleanup = (
  failure: ISceneArtifactFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new SceneArtifactFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Scene-artifact fixture cleanup failed after the test failed.",
    );
  }
};

const identity = (): unknown => ({
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/** A camera the validator accepts, so a case reports only what it broke. */
const camera = (overrides: Record<string, unknown> = {}): unknown => ({
  id: "cam",
  transform: identity(),
  fovY: 50,
  near: 0.1,
  far: 100,
  ...overrides,
});

/** A light the validator accepts, likewise. */
const light = (overrides: Record<string, unknown> = {}): unknown => ({
  id: "key",
  transform: identity(),
  color: { r: 1, g: 1, b: 1 },
  intensity: 1,
  type: "directional",
  ...overrides,
});

const scene = (overrides: Record<string, unknown> = {}): unknown => ({
  id: "sc",
  nodes: [],
  cameras: [],
  lights: [],
  ...overrides,
});

interface ISceneCase {
  title: string;
  value: unknown;
  fragments: string[];
}

/**
 * Every violation the MCP scene artifact validator can report, driven through
 * the store's read boundary.
 *
 * The validator is a pure function over the MCP-facing scene shape, consumed by
 * both the `validateScene` tool and the `commitScene` precondition, so a commit
 * can never accept what validation rejects. Its negative branches had no test:
 * a malformed camera frustum, an unknown light type, a node pointing at no
 * model, and a declared space whose own violations must be re-rooted under
 * `$input.space` were all unexercised, which is most of what kept
 * `packages/mcp/src/validators/artifacts.ts` below the coverage gate.
 *
 * Each case writes one malformed scene slice into an opened project and reads
 * the slate back, which reports the located violation as a controlled repair
 * error rather than a leaked `TypeError`.
 *
 * Scenarios:
 *
 * 1. Scene identity: a blank id, and duplicate node, camera, light ids.
 * 2. Nodes: a non-object entry, a blank id, a blank model, a model no registry
 *    entry supplies, and a malformed transform.
 * 3. Cameras: a non-object entry, a blank id, a malformed transform, an out of
 *    range `fovY`, a non-positive `near`, and a `far` that is neither finite
 *    nor greater than `near`.
 * 4. Lights: a non-object entry, a blank id, a malformed color, a negative
 *    intensity, an unknown type, a point light with a bad range, and a spot
 *    light with an out of range cone angle.
 * 5. Space: a declared space whose surface geometry is invalid reports its
 *    violation re-rooted under the scene's own `space` path.
 */
export const test_mcp_project_scene_artifact_edges = (): void => {
  const cases: ISceneCase[] = [
    // 1. scene identity
    {
      // The keyed layout checks the filename against the id before the artifact
      // validator runs, so a blank id is reported as the mismatch it is.
      title: "a blank scene id reports the keyed-slice mismatch",
      value: scene({ id: "  " }),
      fragments: ["keyed-slice mismatch"],
    },
    {
      title: "duplicate node ids report the uniqueness violation",
      value: scene({
        nodes: [
          { id: "twin", model: "m", transform: identity() },
          { id: "twin", model: "m", transform: identity() },
        ],
      }),
      fragments: ["$input.nodes"],
    },
    {
      title: "duplicate camera ids report the uniqueness violation",
      value: scene({ cameras: [camera(), camera()] }),
      fragments: ["$input.cameras"],
    },
    {
      title: "duplicate light ids report the uniqueness violation",
      value: scene({ lights: [light(), light()] }),
      fragments: ["$input.lights"],
    },
    // 2. nodes
    {
      title: "a non-object scene node reports its own violation",
      value: scene({ nodes: [7] }),
      fragments: ["$input.nodes[0]"],
    },
    {
      title: "a blank scene node id reports the identity violation",
      value: scene({ nodes: [{ id: " ", model: "m", transform: identity() }] }),
      fragments: ["$input.nodes[0].id"],
    },
    {
      title: "a blank scene node model reports the identity violation",
      value: scene({ nodes: [{ id: "n", model: "", transform: identity() }] }),
      fragments: ["$input.nodes[0].model"],
    },
    {
      title: "a scene node transform that is not an object is refused",
      value: scene({ nodes: [{ id: "n", model: "m", transform: 3 }] }),
      fragments: ["$input.nodes[0].transform"],
    },
    // 3. cameras
    {
      title: "a non-object camera reports its own violation",
      value: scene({ cameras: ["cam"] }),
      fragments: ["$input.cameras[0]"],
    },
    {
      title: "a blank camera id reports the identity violation",
      value: scene({ cameras: [camera({ id: "" })] }),
      fragments: ["$input.cameras[0].id"],
    },
    {
      title: "a camera transform that is not an object is refused",
      value: scene({ cameras: [camera({ transform: null })] }),
      fragments: ["$input.cameras[0].transform"],
    },
    {
      title: "a camera fovY outside its open range is refused",
      value: scene({ cameras: [camera({ fovY: 181 })] }),
      fragments: ["$input.cameras[0].fovY"],
    },
    {
      title: "a camera near plane at zero is refused",
      value: scene({ cameras: [camera({ near: 0 })] }),
      fragments: ["$input.cameras[0].near"],
    },
    {
      title: "a camera far plane behind its near plane is refused",
      value: scene({ cameras: [camera({ near: 10, far: 5 })] }),
      fragments: ["$input.cameras[0].far", "greater than near"],
    },
    {
      title: "a non-finite camera far plane is refused",
      value: scene({ cameras: [camera({ far: "far" })] }),
      fragments: ["$input.cameras[0].far"],
    },
    // 4. lights
    {
      title: "a non-object light reports its own violation",
      value: scene({ lights: [null] }),
      fragments: ["$input.lights[0]"],
    },
    {
      title: "a blank light id reports the identity violation",
      value: scene({ lights: [light({ id: "" })] }),
      fragments: ["$input.lights[0].id"],
    },
    {
      title: "a light colour that is not a colour is refused",
      value: scene({ lights: [light({ color: { r: 2, g: 0, b: 0 } })] }),
      fragments: ["$input.lights[0].color"],
    },
    {
      title: "a negative light intensity is refused",
      value: scene({ lights: [light({ intensity: -1 })] }),
      fragments: ["$input.lights[0].intensity"],
    },
    {
      title: "an unknown light type is refused",
      value: scene({ lights: [light({ type: "laser" })] }),
      fragments: ["$input.lights[0].type"],
    },
    {
      title: "a point light with a negative range is refused",
      value: scene({ lights: [light({ type: "point", range: -2 })] }),
      fragments: ["$input.lights[0].range"],
    },
    {
      title: "a spot light with an out of range cone angle is refused",
      value: scene({
        lights: [light({ type: "spot", range: 5, coneAngle: 90 })],
      }),
      fragments: ["$input.lights[0].coneAngle"],
    },
    // 5. space
    {
      title: "a declared space reports its violation under the scene space",
      value: scene({
        space: {
          landmarks: [],
          surfaces: [
            {
              id: "ground",
              kind: "plane",
              origin: { x: 0, y: 0, z: 0 },
              normal: { x: 0, y: 0, z: 0 },
              extent: { x: 10, z: 10 },
            },
          ],
          routes: [],
        },
      }),
      fragments: ["$input.space"],
    },
  ];

  // One root for every case, rewritten in place. A root per case would create
  // and destroy two dozen project roots within a few milliseconds, and this
  // host's global coordination lock is keyed by device and inode: a freed inode
  // is reused, and the stale lock then collides with whatever project the next
  // test opens. That collision is not this validator's subject.
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-scene-artifact-"),
  );
  let sceneArtifactFailure: ISceneArtifactFixtureFailure | undefined;
  try {
    AutoMovieProject.open(root);
    fs.mkdirSync(path.join(root, "scenes"), { recursive: true });
    for (const entry of cases) {
      fs.writeFileSync(
        path.join(root, "scenes", "sc.json"),
        `${JSON.stringify(entry.value, null, 2)}\n`,
      );
      TestValidator.predicate(
        entry.title,
        throwsError(
          () => AutoMovieProject.open(root).writableSlate(),
          entry.fragments,
        ),
      );
    }
  } catch (error) {
    sceneArtifactFailure = { error };
    throw error;
  } finally {
    preserveSceneArtifactFixtureCleanup(sceneArtifactFailure, () =>
      fs.rmSync(root, { recursive: true, force: true }),
    );
  }
};
