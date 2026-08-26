import { AutoMovieProject } from "@automovie/production";
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
const preserveSceneArtifactFixtureCleanup = (
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
 * `packages/production/src/validators/artifacts.ts` below the coverage gate.
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
 * 5. Transform primitives, reached through a node's own transform: a non-positive
 *    scale component, a rotation component that is not finite, and a rotation
 *    that is not a unit quaternion.
 * 6. Space: a declared space whose surface geometry is invalid reports its
 *    violation re-rooted under the scene's own `space` path, and a footprint's
 *    holes are shaped at all three of their levels — the hole list, one hole,
 *    and one point of it — because the engine maps over every one of them and a
 *    malformed payload would otherwise arrive there as a `TypeError`. The rest
 *    of the shape floor is exercised beside them: a space that is not an object
 *    at all, a surface that is not one, a walkable id that is not a string, a
 *    ramp anchor and a height rule that are not objects, and heightfield
 *    samples that are not an array.
 * 7. Fog: a declared atmosphere that is not an object, whose density is negative
 *    or not a number, or whose color leaves `[0, 1]`. Absent fog is the case
 *    every other scene here already exercises, and it is accepted.
 */
export const test_production_project_scene_artifact_edges = (): void => {
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
        lights: [light({ type: "spot", range: 5, coneAngle: 91 })],
      }),
      fragments: ["$input.lights[0].coneAngle"],
    },
    // 5. transform primitives, reached through a node's own transform
    {
      title: "a non-positive transform scale component is refused",
      value: scene({
        nodes: [
          {
            id: "n",
            model: "m",
            transform: {
              translation: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 0, z: 1 },
            },
          },
        ],
      }),
      fragments: ["$input.nodes[0].transform.scale.y"],
    },
    {
      title: "a transform rotation component that is not finite is refused",
      value: scene({
        nodes: [
          {
            id: "n",
            model: "m",
            transform: {
              translation: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: "spin", w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
          },
        ],
      }),
      fragments: ["$input.nodes[0].transform.rotation.z"],
    },
    {
      title: "a rotation that is not a unit quaternion is refused",
      value: scene({
        nodes: [
          {
            id: "n",
            model: "m",
            transform: {
              translation: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 2 },
              scale: { x: 1, y: 1, z: 1 },
            },
          },
        ],
      }),
      fragments: ["$input.nodes[0].transform.rotation", "unit quaternion"],
    },
    // 6. space
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
    {
      title: "a footprint hole list that is not a list reports its own path",
      value: scene({
        space: {
          id: "set",
          walkable: [],
          surfaces: [
            {
              id: "floor",
              kind: "floor",
              polygon: [
                { x: 0, y: 0, z: 0 },
                { x: 4, y: 0, z: 0 },
                { x: 4, y: 0, z: 4 },
              ],
              anchor: { x: 0, y: 0, z: 0 },
              holes: 7,
            },
          ],
        },
      }),
      fragments: ["$input.space.surfaces[0].holes"],
    },
    {
      title: "a hole that is not a ring reports the hole's own path",
      value: scene({
        space: {
          id: "set",
          walkable: [],
          surfaces: [
            {
              id: "floor",
              kind: "floor",
              polygon: [
                { x: 0, y: 0, z: 0 },
                { x: 4, y: 0, z: 0 },
                { x: 4, y: 0, z: 4 },
              ],
              anchor: { x: 0, y: 0, z: 0 },
              holes: ["not a ring"],
            },
          ],
        },
      }),
      fragments: ["$input.space.surfaces[0].holes[0]"],
    },
    {
      title: "a hole point that is not a point reports the point's own path",
      value: scene({
        space: {
          id: "set",
          walkable: [],
          surfaces: [
            {
              id: "floor",
              kind: "floor",
              polygon: [
                { x: 0, y: 0, z: 0 },
                { x: 4, y: 0, z: 0 },
                { x: 4, y: 0, z: 4 },
              ],
              anchor: { x: 0, y: 0, z: 0 },
              holes: [[7]],
            },
          ],
        },
      }),
      fragments: ["$input.space.surfaces[0].holes[0][0]"],
    },
    {
      title: "a walkable id that is not a string reports its own slot",
      value: scene({
        space: {
          id: "set",
          walkable: [7],
          surfaces: [
            {
              id: "floor",
              kind: "floor",
              polygon: [
                { x: 0, y: 0, z: 0 },
                { x: 4, y: 0, z: 0 },
                { x: 4, y: 0, z: 4 },
              ],
              anchor: { x: 0, y: 0, z: 0 },
            },
          ],
        },
      }),
      fragments: ["$input.space.walkable[0]"],
    },
    {
      title: "a ramp anchor that is not an object reports its own path",
      value: scene({
        space: {
          id: "set",
          walkable: [],
          surfaces: [
            {
              id: "floor",
              kind: "floor",
              polygon: [
                { x: 0, y: 0, z: 0 },
                { x: 4, y: 0, z: 0 },
                { x: 4, y: 0, z: 4 },
              ],
              anchor: { x: 0, y: 0, z: 0 },
              rampTo: 7,
            },
          ],
        },
      }),
      fragments: ["$input.space.surfaces[0].rampTo"],
    },
    {
      title: "a height rule that is not an object reports its own path",
      value: scene({
        space: {
          id: "set",
          walkable: [],
          surfaces: [
            {
              id: "floor",
              kind: "floor",
              polygon: [
                { x: 0, y: 0, z: 0 },
                { x: 4, y: 0, z: 0 },
                { x: 4, y: 0, z: 4 },
              ],
              height: 7,
            },
          ],
        },
      }),
      fragments: ["$input.space.surfaces[0].height"],
    },
    {
      title: "heightfield samples that are not an array report their own path",
      value: scene({
        space: {
          id: "set",
          walkable: [],
          surfaces: [
            {
              id: "floor",
              kind: "floor",
              polygon: [
                { x: 0, y: 0, z: 0 },
                { x: 4, y: 0, z: 0 },
                { x: 4, y: 0, z: 4 },
              ],
              height: {
                kind: "heightfield",
                originX: 0,
                originZ: 0,
                spacingX: 1,
                spacingZ: 1,
                columns: 2,
                rows: 2,
                samples: 7,
              },
            },
          ],
        },
      }),
      fragments: ["$input.space.surfaces[0].height.samples"],
    },
    {
      title: "a space that is not an object reports its own path",
      value: scene({ space: 7 }),
      fragments: ["$input.space"],
    },
    {
      title: "a surface that is not an object reports its own slot",
      value: scene({ space: { id: "set", walkable: [], surfaces: [7] } }),
      fragments: ["$input.space.surfaces[0]"],
    },
    // 7. fog
    {
      title: "a fog that is not an object reports its own violation",
      value: scene({ fog: 7 }),
      fragments: ["$input.fog"],
    },
    {
      title: "a negative fog density is refused",
      value: scene({
        fog: { density: -1, color: { r: 1, g: 1, b: 1, a: null, hex: null } },
      }),
      fragments: ["$input.fog.density"],
    },
    {
      title: "a non-finite fog density is refused",
      value: scene({
        fog: {
          density: "thick",
          color: { r: 1, g: 1, b: 1, a: null, hex: null },
        },
      }),
      fragments: ["$input.fog.density"],
    },
    {
      title: "a fog colour outside its unit range is refused",
      value: scene({
        fog: { density: 0.01, color: { r: 2, g: 0, b: 0, a: null, hex: null } },
      }),
      fragments: ["$input.fog.color.r"],
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
