import {
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieValidation,
} from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  IDENTITY_TRANSFORM,
  createModel,
  createSkeleton,
} from "../internal/fixtures";

const app = new AutoMovieApplication();
const skeleton = createSkeleton();
const model = createModel(skeleton);

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [
    {
      id: "actor",
      model: model.id,
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
  lights: [
    {
      id: "sun",
      type: "directional",
      transform: IDENTITY_TRANSFORM,
      color: { r: 1, g: 1, b: 1, a: 1, hex: null },
      intensity: 1,
    },
  ],
};

const shot: IAutoMovieShot = {
  id: "shot-1",
  name: null,
  scene: scene.id,
  camera: "camera",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 2,
};

const clip = (id: string) => ({
  id,
  name: null,
  duration: 1,
  loop: false,
  tracks: [
    {
      channel: { kind: "pointer", pointer: "/x", valueType: "scalar" },
      times: [0, 1],
      values: [0, 1],
      interpolation: "linear",
    },
  ],
});

const bad = <T>(value: unknown): T => value as T;

const hasExpected = (
  validation: IAutoMovieValidation,
  path: string,
  expected: string,
): boolean =>
  validation.success === false &&
  validation.violations.some(
    (violation) =>
      violation.path.includes(path) && violation.expected.includes(expected),
  );

/**
 * Edge sweep of the shared MCP artifact validators (`validateScene` /
 * `validateShot` / `validateSequence`) — every malformed-shape and boundary
 * branch the happy-path fixtures never touch, exercised through the public
 * tools so a commit can never accept what validation would reject (#1040). The
 * probes are direct in-process calls (`as`-cast payloads): the stdio transport
 * adds typia's structural gate on top, but the validators must be total on
 * their own.
 *
 * Scenarios:
 *
 * 1. Scene: non-array node/camera/light/model collections, non-object entries,
 *    non-object and non-unit transforms, non-positive artifact scale, a point
 *    light's range and a spot light's coneAngle bounds, camera fovY above its
 *    exclusive maximum, and a non-object models registry entry — all report at
 *    their exact `$input.scene...` / `$input.models...` paths.
 * 2. Shot: a non-object scene argument, non-array performances, non-object
 *    performance entries, a performance node missing from the scene, an
 *    UNDEFINED cameraMotion (distinct from null), malformed embedded clips
 *    (duplicate object-motion ids, duplicate track channels, non-object
 *    tracks/channels, non-array times/values, non-finite values, out-of-range
 *    and non-increasing times).
 * 3. Sequence: non-array registries and entries, non-object entries feeding the
 *    adjacent-transition accumulator, UNDEFINED trim/transition keys, malformed
 *    trim shapes and overruns, a transition wider than its adjacent entries,
 *    and a transition after a garbage entry (the previous-duration lookup
 *    yields null and judges nothing).
 */
export const test_mcp_artifact_validator_edges = (): void => {
  // ── 1. scene edges ──
  const sceneEdges = app.validateScene({
    scene: bad({
      ...scene,
      nodes: [
        5,
        {
          ...scene.nodes[0]!,
          id: "flat",
          transform: {
            translation: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 0, y: 1, z: 1 },
          },
        },
        { ...scene.nodes[0]!, id: "vague", transform: 7 },
        {
          ...scene.nodes[0]!,
          id: "askew",
          transform: {
            translation: { x: 0, y: 0, z: 0 },
            rotation: 9,
            scale: 11,
          },
        },
        {
          ...scene.nodes[0]!,
          id: "warped",
          transform: {
            translation: { x: 0, y: 0, z: 0 },
            rotation: { x: "sideways", y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
        },
        {
          ...scene.nodes[0]!,
          id: "twisted",
          transform: {
            translation: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: "up", z: "left", w: "much" },
            scale: { x: 1, y: 1, z: 1 },
          },
        },
      ],
      cameras: [
        3,
        { ...scene.cameras[0]!, fovY: 200 },
        { ...scene.cameras[0]!, id: "haze", near: "soon", far: "later" },
      ],
      lights: [
        4,
        {
          id: "lamp",
          type: "point",
          transform: IDENTITY_TRANSFORM,
          color: { r: 1, g: 1, b: 1, a: null, hex: null },
          intensity: 1,
          range: -1,
        },
        {
          id: "beam",
          type: "spot",
          transform: IDENTITY_TRANSFORM,
          color: { r: 2, g: 1, b: 1, a: 1, hex: null },
          intensity: 1,
          range: 5,
          coneAngle: 91,
        },
      ],
    }),
    models: bad([6, { name: "anonymous" }, { id: model.id, skeleton }]),
  }).validation;
  TestValidator.predicate(
    "scene edges report at their exact paths",
    hasExpected(sceneEdges, "$input.scene.nodes[0]", "JSON object") &&
      hasExpected(
        sceneEdges,
        "$input.scene.nodes[1].transform.scale.x",
        "> 0",
      ) &&
      hasExpected(
        sceneEdges,
        "$input.scene.nodes[2].transform",
        "JSON object",
      ) &&
      hasExpected(
        sceneEdges,
        "$input.scene.nodes[3].transform.rotation",
        "JSON object",
      ) &&
      hasExpected(
        sceneEdges,
        "$input.scene.nodes[3].transform.scale",
        "JSON object",
      ) &&
      hasExpected(
        sceneEdges,
        "$input.scene.nodes[4].transform.rotation.x",
        "finite",
      ) &&
      hasExpected(
        sceneEdges,
        "$input.scene.nodes[5].transform.rotation.w",
        "finite",
      ) &&
      hasExpected(sceneEdges, "$input.scene.cameras[0]", "JSON object") &&
      hasExpected(sceneEdges, "$input.scene.cameras[1].fovY", "within") &&
      hasExpected(sceneEdges, "$input.scene.cameras[2].near", "finite") &&
      hasExpected(sceneEdges, "$input.scene.cameras[2].far", "finite") &&
      hasExpected(sceneEdges, "$input.scene.lights[0]", "JSON object") &&
      hasExpected(sceneEdges, "$input.scene.lights[1].range", ">= 0") &&
      hasExpected(sceneEdges, "$input.scene.lights[2].coneAngle", "within") &&
      hasExpected(sceneEdges, "$input.scene.lights[2].color.r", "within") &&
      hasExpected(sceneEdges, "$input.models[0]", "JSON object") &&
      hasExpected(sceneEdges, "$input.models[1].id", "string"),
  );
  TestValidator.predicate(
    "a non-object scene root reports before any collection is touched",
    hasExpected(
      app.validateScene({ scene: bad("flat"), models: [] }).validation,
      "$input.scene",
      "JSON object",
    ),
  );
  const sceneNonArrays = app.validateScene({
    scene: bad({ ...scene, nodes: "x", cameras: "y", lights: "z" }),
    models: bad("w"),
  }).validation;
  TestValidator.predicate(
    "non-array scene collections report as arrays",
    hasExpected(sceneNonArrays, "$input.scene.nodes", "array") &&
      hasExpected(sceneNonArrays, "$input.scene.cameras", "array") &&
      hasExpected(sceneNonArrays, "$input.scene.lights", "array") &&
      hasExpected(sceneNonArrays, "$input.models", "array"),
  );

  // ── 2. shot edges ──
  const { cameraMotion: _omitted, ...shotWithoutCameraMotion } = shot;
  const shotEdges = app.validateShot({
    shot: bad({
      ...shotWithoutCameraMotion,
      camera: 7,
      performances: [
        5,
        { node: "ghost", motion: null, startOffset: 0 },
        { node: 11, motion: "registered", startOffset: 0 },
      ],
      objectMotions: [clip("dup"), clip("dup"), 12],
    }),
    scene: bad(5),
    motions: bad({ broken: { id: 5 }, ok: { id: "registered" } }),
  }).validation;
  TestValidator.predicate(
    "shot edges report at their exact paths",
    hasExpected(shotEdges, "$input.shot.scene", "must match scene") &&
      hasExpected(shotEdges, "$input.shot.camera", "string") &&
      hasExpected(shotEdges, "$input.shot.performances[0]", "JSON object") &&
      hasExpected(
        shotEdges,
        "$input.shot.performances[1].node",
        "scene node",
      ) &&
      hasExpected(shotEdges, "$input.shot.performances[2].node", "string") &&
      hasExpected(shotEdges, "$input.motions.broken.id", "string") &&
      hasExpected(shotEdges, "$input.shot.cameraMotion", "null or a clip") &&
      hasExpected(shotEdges, "$input.shot.objectMotions[1].id", "unique") &&
      hasExpected(shotEdges, "$input.shot.objectMotions[2]", "JSON object"),
  );
  const clipEdges = app.validateShot({
    shot: bad({
      ...shot,
      cameraMotion: {
        id: "cam-clip",
        name: null,
        duration: 1,
        loop: false,
        tracks: [
          9,
          { channel: 3, times: "a", values: "b", interpolation: "linear" },
          {
            channel: { kind: "pointer", pointer: "/x", valueType: "scalar" },
            times: [0.2, 0.2, 5, "late"],
            values: [0, Infinity, 1, 0],
            interpolation: "linear",
          },
          {
            channel: { kind: "pointer", pointer: "/x", valueType: "scalar" },
            times: [0, 1],
            values: [0, 1],
            interpolation: "linear",
          },
        ],
      },
      performances: "flat",
    }),
    scene,
    motions: undefined,
  }).validation;
  TestValidator.predicate(
    "embedded clip edges report at their exact paths",
    hasExpected(clipEdges, "$input.shot.performances", "array") &&
      hasExpected(
        clipEdges,
        "$input.shot.cameraMotion.tracks[0]",
        "JSON object",
      ) &&
      hasExpected(
        clipEdges,
        "$input.shot.cameraMotion.tracks[1].channel",
        "JSON object",
      ) &&
      hasExpected(
        clipEdges,
        "$input.shot.cameraMotion.tracks[1].times",
        "array",
      ) &&
      hasExpected(
        clipEdges,
        "$input.shot.cameraMotion.tracks[1].values",
        "array",
      ) &&
      hasExpected(
        clipEdges,
        "$input.shot.cameraMotion.tracks[2].times[1]",
        "strictly increase",
      ) &&
      hasExpected(
        clipEdges,
        "$input.shot.cameraMotion.tracks[2].times[2]",
        "within",
      ) &&
      hasExpected(
        clipEdges,
        "$input.shot.cameraMotion.tracks[2].values[1]",
        "finite",
      ) &&
      hasExpected(
        clipEdges,
        "$input.shot.cameraMotion.tracks[3].channel",
        "unique",
      ),
  );

  // ── 3. sequence edges ──
  const seqNonArrays = app.validateSequence({
    sequence: bad({ id: "seq", name: null, fps: 24, shots: "x" }),
    shots: bad("y"),
  }).validation;
  TestValidator.predicate(
    "non-array sequence registries report as arrays",
    hasExpected(seqNonArrays, "$input.sequence.shots", "array") &&
      hasExpected(seqNonArrays, "$input.shots", "array"),
  );
  const seqEdges = app.validateSequence({
    sequence: bad({
      id: "seq",
      name: null,
      fps: 24,
      shots: [
        5,
        {
          shot: shot.id,
          trim: undefined,
          transition: { kind: "crossDissolve", duration: 0.5 },
        },
        { shot: 8, trim: 3, transition: null },
        {
          shot: shot.id,
          trim: { start: 1.5, duration: 1 },
          transition: undefined,
        },
        {
          shot: shot.id,
          trim: { start: 0, duration: 0.25 },
          transition: { kind: "crossDissolve", duration: 0.5 },
        },
        {
          shot: shot.id,
          trim: { start: "early", duration: "brief" },
          transition: 9,
        },
        {
          shot: shot.id,
          trim: null,
          transition: { kind: "crossDissolve", duration: "long" },
        },
        {
          shot: "unknown-shot",
          trim: null,
          transition: { kind: "crossDissolve", duration: 0.1 },
        },
      ],
    }),
    shots: bad([7, shot, { duration: 1 }]),
  }).validation;
  TestValidator.predicate(
    "sequence edges report at their exact paths",
    hasExpected(seqEdges, "$input.shots[0]", "JSON object") &&
      hasExpected(seqEdges, "$input.sequence.shots[0]", "JSON object") &&
      hasExpected(
        seqEdges,
        "$input.sequence.shots[1].trim",
        "null or an object",
      ) &&
      hasExpected(seqEdges, "$input.sequence.shots[2].shot", "string") &&
      hasExpected(seqEdges, "$input.sequence.shots[2].trim", "JSON object") &&
      hasExpected(
        seqEdges,
        "$input.sequence.shots[3].trim",
        "fit within shot duration",
      ) &&
      hasExpected(
        seqEdges,
        "$input.sequence.shots[3].transition",
        "null or an object",
      ) &&
      hasExpected(
        seqEdges,
        "$input.sequence.shots[4].transition.duration",
        "fit adjacent entries",
      ) &&
      hasExpected(seqEdges, "$input.sequence.shots[5].trim.start", "finite") &&
      hasExpected(
        seqEdges,
        "$input.sequence.shots[5].transition",
        "JSON object",
      ) &&
      hasExpected(
        seqEdges,
        "$input.sequence.shots[6].transition.duration",
        "finite",
      ) &&
      hasExpected(seqEdges, "$input.shots[2].id", "string") &&
      hasExpected(
        seqEdges,
        "$input.sequence.shots[7].shot",
        "available shot",
      ) &&
      // an unknown shot leaves the entry's own duration unknowable, so the
      // transition-vs-entries judgement is skipped (no false positive there)
      seqEdges.success === false &&
      !seqEdges.violations.some(
        (violation) =>
          violation.path.includes("shots[7].transition.duration") &&
          violation.expected.includes("fit"),
      ),
  );
  // a transition after a garbage entry: the previous entry's duration is
  // unknowable, so the accumulator judges nothing (no false overlap)
  const afterGarbage = app.validateSequence({
    sequence: bad({
      id: "seq",
      name: null,
      fps: 24,
      shots: [
        6,
        {
          shot: shot.id,
          trim: null,
          transition: { kind: "crossDissolve", duration: 0.5 },
        },
      ],
    }),
    shots: [shot],
  }).validation;
  TestValidator.predicate(
    "a transition after a garbage entry does not report a false overlap",
    hasExpected(afterGarbage, "$input.sequence.shots[0]", "JSON object") &&
      afterGarbage.success === false &&
      !afterGarbage.violations.some((violation) =>
        violation.path.includes("shots[1].transition.duration"),
      ),
  );
};
