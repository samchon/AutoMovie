import { evaluateCameraClearance } from "@automovie/engine";
import {
  IAutoMovieCameraClearanceEnvelope,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

const identity = (x = 0, y = 0, z = 0): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const box = (center: IAutoMovieVector3, half = 0.1) => ({
  min: { x: center.x - half, y: center.y - half, z: center.z - half },
  max: { x: center.x + half, y: center.y + half, z: center.z + half },
});

const envelope = (
  body: { center: IAutoMovieVector3; radius: number } = {
    center: { x: 0, y: 0, z: 0 },
    radius: 0.1,
  },
  parentRig: IAutoMovieCameraClearanceEnvelope["parentRig"] = null,
): IAutoMovieCameraClearanceEnvelope => ({ body, parentRig });

const evaluate = (over: {
  envelope?: IAutoMovieCameraClearanceEnvelope;
  revision?: string;
  currentRevision?: string;
  sampleRate?: number;
  duration?: number;
  samples?: Array<{
    time: number;
    camera: IAutoMovieTransform;
    obstacles: Array<{
      node: string;
      bounds: ReturnType<typeof box>;
    }>;
  }>;
} = {}) =>
  evaluateCameraClearance({
    camera: "camera-main",
    envelope: over.envelope ?? envelope(),
    revision: over.revision ?? "revision-7",
    currentRevision: over.currentRevision ?? "revision-7",
    sampleRate: over.sampleRate ?? 1,
    duration: over.duration ?? 1,
    samples:
      over.samples ??
      [0, 1].map((time) => ({
        time,
        camera: identity(),
        obstacles: [{ node: "wall", bounds: box({ x: 5, y: 0, z: 0 }) }],
      })),
  });

const throws = (closure: () => unknown, text: string): boolean => {
  try {
    closure();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(text);
  }
};

/**
 * Camera body and parent-rig clearance are continuous, current-revision gates.
 *
 * Scenarios:
 *
 * 1. Exact sphere/box boundary contact blocks a static camera.
 * 2. Clear endpoints do not hide a midpoint wall penetration.
 * 3. A parent rig can collide while the camera body remains clear.
 * 4. A moving subject crossing a fixed camera is compared at the same samples.
 * 5. Rotation of an offset envelope carries the conservative arc, not merely
 *    its endpoint chord.
 * 6. A current clear result is publishable while a stale revision is not.
 * 7. Malformed clocks, boxes, duplicate obstacles, and changing identity sets
 *    are refused at the evaluator boundary.
 */
export const test_film_camera_clearance = (): void => {
  const boundary = evaluate({
    samples: [0, 1].map((time) => ({
      time,
      camera: identity(),
      obstacles: [
        { node: "wall", bounds: box({ x: 0.2, y: 0, z: 0 }, 0.1) },
      ],
    })),
  });
  TestValidator.equals("inclusive static boundary contact", boundary.status, "blocked");
  TestValidator.equals("boundary finding is addressed", boundary.findings, [
    { part: "body", obstacle: "wall", start: 0, end: 1 },
  ]);

  const midpoint = evaluate({
    samples: [
      {
        time: 0,
        camera: identity(-2),
        obstacles: [{ node: "wall", bounds: box({ x: 0, y: 0, z: 0 }) }],
      },
      {
        time: 1,
        camera: identity(2),
        obstacles: [{ node: "wall", bounds: box({ x: 0, y: 0, z: 0 }) }],
      },
    ],
  });
  TestValidator.equals("clear endpoints still catch midpoint penetration", midpoint.status, "blocked");

  const rigOnly = evaluate({
    envelope: envelope(
      { center: { x: 0, y: 3, z: 0 }, radius: 0.1 },
      { center: { x: 0, y: 0, z: 0 }, radius: 0.1 },
    ),
    samples: [0, 1].map((time) => ({
      time,
      camera: identity(),
      obstacles: [
        { node: "support", bounds: box({ x: 0, y: 0, z: 0 }) },
      ],
    })),
  });
  TestValidator.equals("rig-only collision is distinct", rigOnly.findings, [
    { part: "parent-rig", obstacle: "support", start: 0, end: 1 },
  ]);

  const moving = evaluate({
    samples: [
      {
        time: 0,
        camera: identity(),
        obstacles: [{ node: "actor", bounds: box({ x: -2, y: 0, z: 0 }) }],
      },
      {
        time: 1,
        camera: identity(),
        obstacles: [{ node: "actor", bounds: box({ x: 2, y: 0, z: 0 }) }],
      },
    ],
  });
  TestValidator.equals("moving subject same-sample crossing", moving.status, "blocked");

  const rotating = evaluate({
    envelope: envelope({ center: { x: 1, y: 0, z: 0 }, radius: 0.01 }),
    samples: [
      {
        time: 0,
        camera: identity(),
        obstacles: [{ node: "ceiling", bounds: box({ x: 0, y: 1, z: 0 }, 0.01) }],
      },
      {
        time: 1,
        camera: {
          ...identity(),
          rotation: { x: 0, y: 0, z: 1, w: 0 },
        },
        obstacles: [{ node: "ceiling", bounds: box({ x: 0, y: 1, z: 0 }, 0.01) }],
      },
    ],
  });
  TestValidator.equals("offset rotation arc is conservatively covered", rotating.status, "blocked");

  const clear = evaluate();
  const stale = evaluate({ currentRevision: "revision-8" });
  const instant = evaluate({
    duration: 0,
    samples: [
      {
        time: 0,
        camera: { ...identity(), scale: { x: 2, y: 1, z: 1 } },
        obstacles: [{ node: "wall", bounds: box({ x: 5, y: 0, z: 0 }) }],
      },
    ],
  });
  TestValidator.equals(
    "current clear, stale, and zero-duration reports stay distinct",
    [
      [clear.status, clear.intervals, clear.findings.length],
      [stale.status, stale.intervals, stale.findings.length],
      [instant.status, instant.intervals, instant.findings.length],
    ],
    [
      ["clear", 1, 0],
      ["stale", 0, 0],
      ["clear", 0, 0],
    ],
  );

  TestValidator.equals(
    "malformed evaluation inputs are refused",
    [
      throws(() => evaluate({ sampleRate: 0 }), "sampleRate"),
      throws(() => evaluate({ duration: -1 }), "duration"),
      throws(() => evaluate({ samples: [] }), "fixed-clock"),
      throws(
        () =>
          evaluate({
            samples: [0, 1].map((time) => ({
              time,
              camera: identity(),
              obstacles: [
                {
                  node: "wall",
                  bounds: {
                    min: { x: Number.NaN, y: 0, z: 0 },
                    max: { x: 1, y: 1, z: 1 },
                  },
                },
              ],
            })),
          }),
        "finite coordinates",
      ),
      throws(
        () =>
          evaluate({
            samples: [0, 1].map((time) => ({
              time,
              camera: identity(),
              obstacles: [
                {
                  node: "wall",
                  bounds: {
                    min: { x: 2, y: 0, z: 0 },
                    max: { x: 1, y: 1, z: 1 },
                  },
                },
              ],
            })),
          }),
        "minimum",
      ),
      throws(
        () =>
          evaluate({
            samples: [0, 1].map((time) => ({
              time,
              camera: identity(),
              obstacles: [
                { node: "wall", bounds: box({ x: 5, y: 0, z: 0 }) },
                { node: "wall", bounds: box({ x: 6, y: 0, z: 0 }) },
              ],
            })),
          }),
        "duplicates",
      ),
      throws(
        () =>
          evaluate({
            samples: [
              {
                time: 0,
                camera: identity(),
                obstacles: [
                  { node: "wall", bounds: box({ x: 5, y: 0, z: 0 }) },
                ],
              },
              {
                time: 1,
                camera: identity(),
                obstacles: [
                  { node: "floor", bounds: box({ x: 5, y: 0, z: 0 }) },
                ],
              },
            ],
          }),
        "identity set",
      ),
    ],
    [true, true, true, true, true, true, true],
  );
};
