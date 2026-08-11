import {
  type AutoMovieExternalMotionAdoptionDecision,
  type IAutoMovieExternalMotionRetargetDecision,
  adoptAutoMovieExternalMotion,
  inspectAutoMovieExternalModelBytes,
} from "@automovie/ingest";
import type { IAutoMovieSkeleton } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";

/**
 * External motion bytes normalize deterministically, and adoption preserves the
 * author's native or retarget choice without provider access or rig guessing.
 *
 * Scenarios:
 *
 * 1. A motion-only glTF exposes named node tracks for LINEAR, STEP, and
 *    CUBICSPLINE samplers without requiring a render mesh.
 * 2. Repeated native adoption returns equal, defensively copied takes bound to the
 *    same source path, digest, and byte length.
 * 3. Retarget adoption accepts only an explicit source rig, node-to-bone map, and
 *    target identity, then canonicalizes the map without mutating inputs.
 * 4. Malformed sampler facts and every ambiguous adoption input fail with a
 *    specific diagnostic instead of a fallback take, rig, or mode.
 */
export const test_ingest_external_motion_adoption = (): void => {
  const fixture = motionFixture();
  const inspection = inspect(fixture);
  const motion = inspection.motion;
  TestValidator.predicate("motion inspection is present", motion !== undefined);
  if (motion === undefined) return;
  TestValidator.equals("normalized motion inventory", motion, {
    path: "public/motion/walk.gltf",
    byteLength: fixture.bytes.byteLength,
    nodeIds: ["node_0", "node_1"],
    takes: [
      {
        id: "clip_0",
        name: "Walk",
        duration: 1,
        loop: false,
        tracks: [
          {
            channel: { kind: "node", node: "node_0", path: "rotation" },
            times: [0, 1],
            values: fixture.cubicRotation,
            interpolation: "cubicspline",
          },
          {
            channel: {
              kind: "node",
              node: "node_0",
              path: "translation",
            },
            times: [0, 1],
            values: [0, 0, 0, 1, 0, 0],
            interpolation: "step",
          },
          {
            channel: { kind: "node", node: "node_1", path: "rotation" },
            times: [0, 1],
            values: [0, 0, 0, 1, 0, 0, 0, 1],
            interpolation: "linear",
          },
        ],
      },
    ],
  });
  const weightsDocument = motionDocument();
  weightsDocument.animations[0]!.channels = [
    { sampler: 2, target: { node: 1, path: "weights" } },
  ];
  weightsDocument.accessors[3]!.type = "SCALAR";
  TestValidator.equals(
    "weight tracks use scalar source samples",
    inspect(motionFixture(weightsDocument)).motion?.takes[0]?.tracks[0]
      ?.channel,
    { kind: "node", node: "node_1", path: "weights" },
  );
  const unnamedDocument = motionDocument();
  unnamedDocument.animations[0]!.name = "";
  TestValidator.equals(
    "empty animation names normalize to null",
    inspect(motionFixture(unnamedDocument)).motion?.takes[0]?.name,
    null,
  );
  const absentNameDocument = motionDocument();
  delete (absentNameDocument.animations[0]! as { name?: string }).name;
  TestValidator.equals(
    "absent animation names normalize to null",
    inspect(motionFixture(absentNameDocument)).motion?.takes[0]?.name,
    null,
  );

  const source = {
    path: "public/motion/walk.gltf",
    digest: `sha256:${"a".repeat(64)}` as const,
    byteLength: fixture.bytes.byteLength,
  };
  const sourceRig = skeleton();
  const mapping = [
    { node: "node_1", bone: "chest" as const },
    { node: "node_0", bone: "hips" as const },
  ];
  const nativeDecision = {
    mode: "native" as const,
    take: "clip_0",
    sourceRig,
    mapping,
  };
  const native = adoptAutoMovieExternalMotion({
    inspection,
    source,
    decision: nativeDecision,
  });
  native.take.tracks[0]!.times[0] = 99;
  const nativeAgain = adoptAutoMovieExternalMotion({
    inspection,
    source,
    decision: nativeDecision,
  });
  TestValidator.equals("native adoption is stable and defensive", nativeAgain, {
    source,
    mode: "native",
    take: motion.takes[0],
    handoff: {
      mode: "native",
      sourceRig,
      mapping: [
        { node: "node_0", bone: "hips" },
        { node: "node_1", bone: "chest" },
      ],
    },
  });
  TestValidator.equals(
    "an already canonical native map stays canonical",
    adoptAutoMovieExternalMotion({
      inspection,
      source,
      decision: {
        ...nativeDecision,
        mapping: [...mapping].reverse(),
      },
    }).handoff.mapping,
    [
      { node: "node_0", bone: "hips" },
      { node: "node_1", bone: "chest" },
    ],
  );

  const retargetDecision: IAutoMovieExternalMotionRetargetDecision = {
    mode: "retarget",
    take: "clip_0",
    sourceRig,
    mapping,
    translationScale: 1.25,
    target: "actor/main",
  };
  const retargeted = adoptAutoMovieExternalMotion({
    inspection,
    source,
    decision: retargetDecision,
  });
  retargeted.handoff.sourceRig.bones[1]!.rest.translation.y = 99;
  retargeted.handoff.sourceRig.bones[1]!.constraint!.flexion!.max = 99;
  retargeted.handoff.mapping[0]!.node = "mutated";
  const retargetedAgain = adoptAutoMovieExternalMotion({
    inspection,
    source,
    decision: retargetDecision,
  });
  TestValidator.predicate(
    "retarget handoff remains discriminated",
    retargetedAgain.handoff.mode === "retarget",
  );
  if (retargetedAgain.handoff.mode !== "retarget") return;
  TestValidator.equals(
    "retarget handoff is canonical and defensive",
    {
      mode: retargetedAgain.mode,
      mapping: retargetedAgain.handoff.mapping,
      translationScale: retargetedAgain.handoff.translationScale,
      target: retargetedAgain.handoff.target,
      chestRestY:
        retargetedAgain.handoff.sourceRig.bones[1]?.rest.translation.y,
      chestFlexionMax:
        retargetedAgain.handoff.sourceRig.bones[1]?.constraint?.flexion?.max,
    },
    {
      mode: "retarget",
      mapping: [
        { node: "node_0", bone: "hips" },
        { node: "node_1", bone: "chest" },
      ],
      target: "actor/main",
      translationScale: 1.25,
      chestRestY: 1,
      chestFlexionMax: 45,
    },
  );

  TestValidator.equals(
    "malformed motion and adoption decisions are refused",
    namedFacts([
      [
        "motionProfileNeedsAnimation",
        () =>
          rejectsDocument(
            withoutAnimation(),
            "requires at least one animation",
          ),
      ],
      [
        "animationNeedsSampler",
        () =>
          rejectsMutation(
            (document) => (document.animations![0]!.samplers = []),
            "needs at least one sampler",
          ),
      ],
      [
        "animationNeedsChannel",
        () =>
          rejectsMutation(
            (document) => (document.animations![0]!.channels = []),
            "needs at least one sampler and channel",
          ),
      ],
      [
        "samplerIndexMustResolve",
        () =>
          rejectsMutation(
            (document) => (document.animations![0]!.channels[0]!.sampler = 9),
            ".sampler does not resolve",
          ),
      ],
      [
        "targetMustBeObject",
        () =>
          rejectsMutation(
            (document) =>
              (document.animations![0]!.channels[0]!.target =
                null as unknown as { node: number; path: string }),
            ".target must be an object",
          ),
      ],
      [
        "targetNodeMustResolve",
        () =>
          rejectsMutation(
            (document) =>
              (document.animations![0]!.channels[0]!.target.node = 9),
            ".target.node does not resolve",
          ),
      ],
      [
        "targetPathMustBeSupported",
        () =>
          rejectsMutation(
            (document) =>
              (document.animations![0]!.channels[0]!.target.path = "pointer"),
            ".target.path must be",
          ),
      ],
      [
        "targetMustBeUnique",
        () =>
          rejectsMutation(
            (document) =>
              (document.animations![0]!.channels[1]!.target.path = "rotation"),
            "duplicates the rotation channel",
          ),
      ],
      [
        "samplerInputMustResolve",
        () =>
          rejectsMutation(
            (document) => (document.animations![0]!.samplers[0]!.input = 99),
            ".input does not resolve",
          ),
      ],
      [
        "samplerOutputMustResolve",
        () =>
          rejectsMutation(
            (document) => (document.animations![0]!.samplers[0]!.output = 99),
            ".output does not resolve",
          ),
      ],
      [
        "interpolationMustBeSupported",
        () =>
          rejectsMutation(
            (document) =>
              (document.animations![0]!.samplers[0]!.interpolation = "BEZIER"),
            "must be LINEAR, STEP, or CUBICSPLINE",
          ),
      ],
      [
        "inputMustBeFloatScalar",
        () =>
          rejectsMutation(
            (document) => (document.accessors![0]!.componentType = 5123),
            "FLOAT SCALAR",
          ),
      ],
      [
        "outputMustBeExpectedShape",
        () =>
          rejectsMutation(
            (document) => (document.accessors![1]!.type = "VEC3"),
            "FLOAT VEC4",
          ),
      ],
      [
        "sparseMotionIsRefused",
        () =>
          rejectsMutation((document) => {
            (document.accessors![0]! as Record<string, unknown>).sparse = {
              count: 1,
              indices: { bufferView: 0, componentType: 5121 },
              values: { bufferView: 0 },
            };
          }, "non-sparse FLOAT"),
      ],
      [
        "nonFiniteSampleIsRefused",
        () =>
          rejectsPayloadMutation(
            (payload) => payload.writeFloatLE(Number.NaN, 0),
            "non-finite value",
          ),
      ],
      [
        "negativeTimeIsRefused",
        () =>
          rejectsPayloadMutation(
            (payload) => payload.writeFloatLE(-1, 0),
            "non-negative and strictly increasing",
          ),
      ],
      [
        "repeatedTimeIsRefused",
        () =>
          rejectsPayloadMutation(
            (payload) => payload.writeFloatLE(0, 4),
            "non-negative and strictly increasing",
          ),
      ],
      [
        "outputArityIsChecked",
        () =>
          rejectsMutation(
            (document) => (document.accessors![2]!.count = 1),
            "does not match the translation keyframe arity",
          ),
      ],
      [
        "weightOutputArityIsChecked",
        () =>
          rejectsMutation((document) => {
            document.animations![0]!.channels = [
              { sampler: 2, target: { node: 1, path: "weights" } },
            ];
            document.accessors![3]!.type = "SCALAR";
            document.accessors![3]!.count = 3;
          }, "does not match the weights keyframe arity"),
      ],
      [
        "unitRotationIsRequired",
        () =>
          rejectsPayloadMutation(
            (payload) => payload.writeFloatLE(2, 28),
            "non-unit rotation",
          ),
      ],
      [
        "animationNameMustBeString",
        () =>
          rejectsMutation(
            (document) =>
              (document.animations![0]!.name = 1 as unknown as string),
            ".name must be a string",
          ),
      ],
      [
        "missingMotion",
        () =>
          throwsError(
            () =>
              adoptAutoMovieExternalMotion({
                inspection: { ...inspection, motion: undefined },
                source,
                decision: nativeDecision,
              }),
            "no inspected motion",
          ),
      ],
      [
        "motionProfileIsRequired",
        () =>
          throwsError(
            () =>
              adoptAutoMovieExternalMotion({
                inspection: { ...inspection, profile: "gltf-static-v1" },
                source,
                decision: nativeDecision,
              }),
            'requires the "gltf-motion-v1" inspection profile',
          ),
      ],
      [
        "blankSourcePath",
        () =>
          rejectsAdoption(
            { ...source, path: " " },
            nativeDecision,
            "path must be non-blank",
          ),
      ],
      [
        "sourcePathMismatch",
        () =>
          rejectsAdoption(
            { ...source, path: "other.gltf" },
            nativeDecision,
            "does not match inspected path",
          ),
      ],
      [
        "nonIntegerByteLength",
        () =>
          rejectsAdoption(
            { ...source, byteLength: 1.5 },
            nativeDecision,
            "does not match inspected byteLength",
          ),
      ],
      [
        "nonPositiveByteLength",
        () =>
          rejectsAdoption(
            { ...source, byteLength: 0 },
            nativeDecision,
            "does not match inspected byteLength",
          ),
      ],
      [
        "mismatchedByteLength",
        () =>
          rejectsAdoption(
            { ...source, byteLength: source.byteLength + 1 },
            nativeDecision,
            "does not match inspected byteLength",
          ),
      ],
      [
        "digestMustBeSha256",
        () =>
          rejectsAdoption(
            { ...source, digest: "sha256:BAD" as typeof source.digest },
            nativeDecision,
            "lowercase SHA-256",
          ),
      ],
      [
        "takeMustExist",
        () =>
          rejectsAdoption(
            source,
            { ...nativeDecision, take: "missing" },
            "is not present",
          ),
      ],
      [
        "modeMustBeSupported",
        () =>
          rejectsAdoption(
            source,
            {
              mode: "automatic",
              take: "clip_0",
            } as unknown as AutoMovieExternalMotionAdoptionDecision,
            "Unsupported external motion adoption mode",
          ),
      ],
      [
        "sourceRigIdMustExist",
        () =>
          rejectsRetarget(
            { ...retargetDecision, sourceRig: { ...sourceRig, id: " " } },
            "source rig id must be non-blank",
          ),
      ],
      [
        "targetMustExist",
        () =>
          rejectsRetarget(
            { ...retargetDecision, target: " " },
            "target identity must be non-blank",
          ),
      ],
      [
        "sourceRigNeedsBones",
        () =>
          rejectsRetarget(
            { ...retargetDecision, sourceRig: { ...sourceRig, bones: [] } },
            "source rig has no bones",
          ),
      ],
      [
        "sourceRigBonesMustBeUnique",
        () =>
          rejectsRetarget(
            {
              ...retargetDecision,
              sourceRig: {
                ...sourceRig,
                bones: [...sourceRig.bones, sourceRig.bones[0]!],
              },
            },
            "duplicates bone",
          ),
      ],
      [
        "sourceRigNeedsHips",
        () =>
          rejectsRetarget(
            {
              ...retargetDecision,
              sourceRig: { ...sourceRig, bones: sourceRig.bones.slice(1) },
            },
            "missing required bone",
          ),
      ],
      [
        "mappingMustNotBeEmpty",
        () =>
          rejectsRetarget(
            { ...retargetDecision, mapping: [] },
            "semantic mapping must not be empty",
          ),
      ],
      [
        "translationScaleMustBeFinite",
        () =>
          rejectsRetarget(
            { ...retargetDecision, translationScale: Number.NaN },
            "translationScale must be finite and positive",
          ),
      ],
      [
        "translationScaleMustBePositive",
        () =>
          rejectsRetarget(
            { ...retargetDecision, translationScale: 0 },
            "translationScale must be finite and positive",
          ),
      ],
      [
        "mappingNodeMustExist",
        () =>
          rejectsRetarget(
            {
              ...retargetDecision,
              mapping: [
                { node: "node_9", bone: "hips" },
                { node: "node_1", bone: "chest" },
              ],
            },
            "not present in the inspected source",
          ),
      ],
      [
        "mappingBoneMustExist",
        () =>
          rejectsRetarget(
            {
              ...retargetDecision,
              mapping: [
                { node: "node_0", bone: "hips" },
                { node: "node_1", bone: "leftHand" },
              ],
            },
            "absent from source rig",
          ),
      ],
      [
        "mappingNodesMustBeUnique",
        () =>
          rejectsRetarget(
            {
              ...retargetDecision,
              mapping: [
                { node: "node_0", bone: "hips" },
                { node: "node_0", bone: "chest" },
              ],
            },
            "duplicates node",
          ),
      ],
      [
        "mappingBonesMustBeUnique",
        () =>
          rejectsRetarget(
            {
              ...retargetDecision,
              mapping: [
                { node: "node_0", bone: "hips" },
                { node: "node_1", bone: "hips" },
              ],
            },
            "duplicates bone",
          ),
      ],
      [
        "everyTrackNeedsMapping",
        () =>
          rejectsRetarget(
            {
              ...retargetDecision,
              mapping: [{ node: "node_0", bone: "hips" }],
            },
            "has no explicit semantic mapping",
          ),
      ],
      [
        "translationMustMapToHips",
        () =>
          rejectsRetarget(
            {
              ...retargetDecision,
              mapping: [
                { node: "node_0", bone: "chest" },
                { node: "node_1", bone: "hips" },
              ],
            },
            "must map to hips",
          ),
      ],
      [
        "pointerTracksAreRefused",
        () =>
          throwsError(
            () =>
              adoptAutoMovieExternalMotion({
                inspection: withTrack(inspection, {
                  channel: {
                    kind: "pointer",
                    pointer: "/x",
                    valueType: "scalar",
                  },
                  times: [0, 1],
                  values: [0, 1],
                  interpolation: "linear",
                }),
                source,
                decision: retargetDecision,
              }),
            "semantic conversion supports only node tracks",
          ),
      ],
      [
        "scaleTracksAreRefused",
        () =>
          throwsError(
            () =>
              adoptAutoMovieExternalMotion({
                inspection: withTrack(inspection, {
                  channel: { kind: "node", node: "node_0", path: "scale" },
                  times: [0, 1],
                  values: [1, 1, 1, 1, 1, 1],
                  interpolation: "linear",
                }),
                source,
                decision: retargetDecision,
              }),
            "scale channel",
          ),
      ],
      [
        "weightTracksAreRefused",
        () =>
          throwsError(
            () =>
              adoptAutoMovieExternalMotion({
                inspection: withTrack(inspection, {
                  channel: { kind: "node", node: "node_0", path: "weights" },
                  times: [0, 1],
                  values: [0, 1],
                  interpolation: "linear",
                }),
                source,
                decision: retargetDecision,
              }),
            "weights channel",
          ),
      ],
    ]),
    Object.fromEntries(
      [
        "motionProfileNeedsAnimation",
        "animationNeedsSampler",
        "animationNeedsChannel",
        "samplerIndexMustResolve",
        "targetMustBeObject",
        "targetNodeMustResolve",
        "targetPathMustBeSupported",
        "targetMustBeUnique",
        "samplerInputMustResolve",
        "samplerOutputMustResolve",
        "interpolationMustBeSupported",
        "inputMustBeFloatScalar",
        "outputMustBeExpectedShape",
        "sparseMotionIsRefused",
        "nonFiniteSampleIsRefused",
        "negativeTimeIsRefused",
        "repeatedTimeIsRefused",
        "outputArityIsChecked",
        "weightOutputArityIsChecked",
        "unitRotationIsRequired",
        "animationNameMustBeString",
        "missingMotion",
        "motionProfileIsRequired",
        "blankSourcePath",
        "sourcePathMismatch",
        "nonIntegerByteLength",
        "nonPositiveByteLength",
        "mismatchedByteLength",
        "digestMustBeSha256",
        "takeMustExist",
        "modeMustBeSupported",
        "sourceRigIdMustExist",
        "targetMustExist",
        "sourceRigNeedsBones",
        "sourceRigBonesMustBeUnique",
        "sourceRigNeedsHips",
        "mappingMustNotBeEmpty",
        "translationScaleMustBeFinite",
        "translationScaleMustBePositive",
        "mappingNodeMustExist",
        "mappingBoneMustExist",
        "mappingNodesMustBeUnique",
        "mappingBonesMustBeUnique",
        "everyTrackNeedsMapping",
        "translationMustMapToHips",
        "pointerTracksAreRefused",
        "scaleTracksAreRefused",
        "weightTracksAreRefused",
      ].map((name) => [name, true]),
    ),
  );

  function rejectsAdoption(
    candidateSource: typeof source,
    decision: AutoMovieExternalMotionAdoptionDecision,
    message: string,
  ): boolean {
    return throwsError(
      () =>
        adoptAutoMovieExternalMotion({
          inspection,
          source: candidateSource,
          decision,
        }),
      message,
    );
  }

  function rejectsRetarget(
    decision: IAutoMovieExternalMotionRetargetDecision,
    message: string,
  ): boolean {
    return rejectsAdoption(source, decision, message);
  }
};

type MotionDocument = ReturnType<typeof motionDocument>;

const inspect = (fixture: ReturnType<typeof motionFixture>) =>
  inspectAutoMovieExternalModelBytes({
    path: "public/motion/walk.gltf",
    bytes: fixture.bytes,
    profile: "gltf-motion-v1",
    resolveResource: (uri) => (uri === "walk.bin" ? fixture.payload : null),
  });

const rejectsDocument = (
  document: MotionDocument,
  message: string,
): boolean => {
  const fixture = motionFixture(document);
  return throwsError(() => inspect(fixture), message);
};

const rejectsMutation = (
  mutate: (document: MotionDocument) => void,
  message: string,
): boolean => {
  const document = motionDocument();
  mutate(document);
  return rejectsDocument(document, message);
};

const rejectsPayloadMutation = (
  mutate: (payload: Buffer) => void,
  message: string,
): boolean => {
  const fixture = motionFixture();
  mutate(fixture.payload);
  return throwsError(() => inspect(fixture), message);
};

const withoutAnimation = (): MotionDocument => {
  const document = motionDocument();
  document.animations = [];
  return document;
};

const motionFixture = (document = motionDocument()) => {
  const cubicRotation = [
    0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0,
  ];
  const arrays = [
    [0, 1],
    cubicRotation,
    [0, 0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 1],
  ];
  const payload = Buffer.concat(
    arrays.map((values) => Buffer.from(new Float32Array(values).buffer)),
  );
  document.buffers![0]!.byteLength = payload.byteLength;
  return {
    document,
    bytes: Buffer.from(JSON.stringify(document), "utf8"),
    payload,
    cubicRotation,
  };
};

const motionDocument = () => ({
  asset: { version: "2.0" },
  buffers: [{ byteLength: 168, uri: "walk.bin" }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: 8 },
    { buffer: 0, byteOffset: 8, byteLength: 96 },
    { buffer: 0, byteOffset: 104, byteLength: 24 },
    { buffer: 0, byteOffset: 128, byteLength: 32 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 2, type: "SCALAR" },
    { bufferView: 1, componentType: 5126, count: 6, type: "VEC4" },
    { bufferView: 2, componentType: 5126, count: 2, type: "VEC3" },
    { bufferView: 3, componentType: 5126, count: 2, type: "VEC4" },
  ],
  nodes: [{ name: "Root" }, { name: "Chest" }],
  scenes: [{ nodes: [0, 1] }],
  animations: [
    {
      name: "Walk",
      samplers: [
        { input: 0, output: 1, interpolation: "CUBICSPLINE" },
        { input: 0, output: 2, interpolation: "STEP" },
        { input: 0, output: 3 },
      ],
      channels: [
        { sampler: 0, target: { node: 0, path: "rotation" } },
        { sampler: 1, target: { node: 0, path: "translation" } },
        { sampler: 2, target: { node: 1, path: "rotation" } },
      ],
    },
  ],
});

const skeleton = (): IAutoMovieSkeleton => ({
  id: "source-rig",
  bones: [
    {
      bone: "hips",
      parent: null,
      rest: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      constraint: null,
    },
    {
      bone: "chest",
      parent: "hips",
      rest: {
        translation: { x: 0, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      constraint: {
        flexion: { min: -10, max: 45 },
        abduction: null,
        twist: { min: -20, max: 20 },
        swingDeg: 60,
      },
    },
    {
      bone: "head",
      parent: "chest",
      rest: {
        translation: { x: 0, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      constraint: {
        flexion: null,
        abduction: { min: -20, max: 20 },
        twist: null,
        swingDeg: 30,
      },
    },
  ],
});

const withTrack = (
  inspection: ReturnType<typeof inspect>,
  track: NonNullable<
    ReturnType<typeof inspect>["motion"]
  >["takes"][number]["tracks"][number],
): ReturnType<typeof inspect> => ({
  ...inspection,
  motion: {
    ...inspection.motion!,
    takes: [{ ...inspection.motion!.takes[0]!, tracks: [track] }],
  },
});
