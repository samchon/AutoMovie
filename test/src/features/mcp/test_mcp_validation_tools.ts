import {
  IAutoMovieModel,
  IAutoMovieMotion,
  IAutoMoviePose,
  IAutoMovieScene,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieValidation,
} from "@automovie/interface";
import { AutoMovieApplication, IAutoMovieMcpMotion } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  IDENTITY_TRANSFORM,
  createModel,
  createSkeleton,
  createValidMotion,
  makePose,
} from "../internal/fixtures";

const app = new AutoMovieApplication();
const skeleton = createSkeleton();
const model = createModel(skeleton);

const toMcpMotion = (motion: IAutoMovieMotion): IAutoMovieMcpMotion => ({
  ...motion,
  keyframes: motion.keyframes.map((keyframe) => ({
    ...keyframe,
    bezier: null,
  })),
});

const motion = toMcpMotion(createValidMotion());

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
  performances: [{ node: "actor", motion: motion.id, startOffset: 0 }],
  objectMotions: [],
  duration: 1,
};

const sequence: IAutoMovieSequence = {
  id: "seq-1",
  name: null,
  fps: 24,
  shots: [{ shot: shot.id, trim: null, transition: null }],
};

const hasPath = (validation: IAutoMovieValidation, path: string): boolean =>
  validation.success === false &&
  validation.violations.some((violation) => violation.path.includes(path));

/**
 * MCP validation tools expose field-located diagnostics before commit tools
 * persist any slate change.
 *
 * Scenarios:
 *
 * 1. Pose, motion, model, scene, shot, and sequence validators all accept a valid
 *    fixture.
 * 2. Each validator returns the standard validation envelope with a path on a
 *    representative invalid artifact.
 * 3. Structurally malformed pose/motion/model/scene/shot/sequence payloads return
 *    validation failures instead of leaking raw JavaScript shape errors.
 */
export const test_mcp_validation_tools = (): void => {
  TestValidator.equals(
    "valid pose",
    app.validatePose({ pose: makePose([]), skeleton }).validation,
    { success: true },
  );
  TestValidator.equals(
    "valid motion",
    app.validateMotion({ motion, skeleton }).validation,
    { success: true },
  );
  TestValidator.equals("valid model", app.validateModel({ model }).validation, {
    success: true,
  });
  TestValidator.equals(
    "valid scene",
    app.validateScene({
      scene,
      models: [{ id: model.id, skeleton }],
    }).validation,
    { success: true },
  );
  TestValidator.equals(
    "valid shot",
    app.validateShot({
      shot,
      scene,
      motions: { actor: motion },
    }).validation,
    { success: true },
  );
  TestValidator.equals(
    "valid sequence",
    app.validateSequence({ sequence, shots: [shot] }).validation,
    { success: true },
  );

  TestValidator.predicate(
    "invalid pose path",
    hasPath(
      app.validatePose({
        pose: { ...makePose([]), skeleton: "wrong" },
        skeleton,
      }).validation,
      "$input.skeleton",
    ),
  );
  TestValidator.predicate(
    "invalid motion path",
    hasPath(
      app.validateMotion({
        motion: { ...motion, keyframes: [motion.keyframes[0]!] },
        skeleton,
      }).validation,
      "$input.keyframes",
    ),
  );
  TestValidator.predicate(
    "invalid model path",
    hasPath(
      app.validateModel({ model: { ...model, parts: [] } }).validation,
      "$input.parts",
    ),
  );
  TestValidator.predicate(
    "invalid scene paths",
    (() => {
      const validation = app.validateScene({
        scene: {
          ...scene,
          nodes: [
            {
              ...scene.nodes[0]!,
              transform: {
                ...scene.nodes[0]!.transform,
                rotation: { ...scene.nodes[0]!.transform.rotation, w: 2 },
              },
            },
            ...scene.nodes,
            { ...scene.nodes[0]!, id: "ghost", model: "missing" },
          ],
          cameras: [{ ...scene.cameras[0]!, far: 0.05 }],
        },
        models: [{ id: model.id, skeleton }],
      }).validation;
      return (
        hasPath(validation, "$input.nodes[0].transform.rotation") &&
        hasPath(validation, "$input.nodes[2].model") &&
        hasPath(validation, "$input.cameras[0].far")
      );
    })(),
  );
  TestValidator.predicate(
    "invalid shot paths",
    (() => {
      const validation = app.validateShot({
        shot: {
          ...shot,
          camera: "missing",
          performances: [
            { node: "actor", motion: "missing-motion", startOffset: 2 },
          ],
        },
        scene,
        motions: {},
      }).validation;
      return (
        hasPath(validation, "$input.camera") &&
        hasPath(validation, "$input.performances[0].motion") &&
        hasPath(validation, "$input.performances[0].startOffset")
      );
    })(),
  );
  TestValidator.predicate(
    "malformed shot motion registry returns validation",
    (() => {
      const validation = app.validateShot({
        shot,
        scene,
        motions: null as unknown as Record<string, IAutoMovieMcpMotion>,
      }).validation;
      return hasPath(validation, "$motions");
    })(),
  );
  TestValidator.predicate(
    "malformed shot motion registry entry returns validation",
    (() => {
      const validation = app.validateShot({
        shot,
        scene,
        motions: {
          [motion.id]: undefined,
        } as unknown as Record<string, IAutoMovieMcpMotion>,
      }).validation;
      return hasPath(validation, `$motions.${motion.id}`);
    })(),
  );
  TestValidator.predicate(
    "invalid sequence paths",
    (() => {
      const validation = app.validateSequence({
        sequence: {
          ...sequence,
          fps: 0,
          shots: [
            {
              shot: "missing-shot",
              trim: { start: 0, duration: 2 },
              transition: { kind: "fade", duration: 1 },
            },
          ],
        },
        shots: [shot],
      }).validation;
      return (
        hasPath(validation, "$input.fps") &&
        hasPath(validation, "$input.shots[0].shot") &&
        hasPath(validation, "$input.shots[0].transition")
      );
    })(),
  );
  TestValidator.predicate(
    "malformed pose shape returns validation",
    (() => {
      const validation = app.validatePose({
        pose: {
          skeleton: skeleton.id,
          root: null,
        } as unknown as IAutoMoviePose,
        skeleton,
      }).validation;
      return hasPath(validation, "$input.joints");
    })(),
  );
  TestValidator.predicate(
    "malformed pose root returns validation",
    (() => {
      const validation = app.validatePose({
        pose: {
          skeleton: skeleton.id,
          joints: [],
        } as unknown as IAutoMoviePose,
        skeleton,
      }).validation;
      return hasPath(validation, "$input.root");
    })(),
  );
  TestValidator.predicate(
    "malformed motion shape returns validation",
    (() => {
      const validation = app.validateMotion({
        motion: {
          id: "motion-1",
          skeleton: skeleton.id,
          duration: 1,
          loop: false,
        } as unknown as IAutoMovieMcpMotion,
        skeleton,
      }).validation;
      return hasPath(validation, "$input.keyframes");
    })(),
  );
  TestValidator.predicate(
    "malformed motion id returns validation",
    (() => {
      const validation = app.validateMotion({
        motion: {
          skeleton: skeleton.id,
          duration: 1,
          loop: false,
          keyframes: [],
        } as unknown as IAutoMovieMcpMotion,
        skeleton,
      }).validation;
      return hasPath(validation, "$input.id");
    })(),
  );
  TestValidator.predicate(
    "malformed motion keyframe pose returns validation",
    (() => {
      const validation = app.validateMotion({
        motion: {
          ...motion,
          keyframes: motion.keyframes.map((keyframe, index) =>
            index === 0
              ? keyframe
              : {
                  ...keyframe,
                  pose: {
                    skeleton: skeleton.id,
                    root: null,
                  } as unknown as IAutoMoviePose,
                },
          ),
        },
        skeleton,
      }).validation;
      return hasPath(validation, "$input.keyframes[1].pose.joints");
    })(),
  );
  TestValidator.predicate(
    "malformed motion keyframe expression returns validation",
    (() => {
      const validation = app.validateMotion({
        motion: {
          ...motion,
          keyframes: motion.keyframes.map((keyframe, index) => {
            if (index === 0) return keyframe;
            const { expression, ...rest } = keyframe;
            void expression;
            return rest;
          }),
        } as unknown as IAutoMovieMcpMotion,
        skeleton,
      }).validation;
      return hasPath(validation, "$input.keyframes[1].expression");
    })(),
  );
  TestValidator.predicate(
    "malformed model shape returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          id: "model-1",
          name: null,
          origin: "generated",
          skeleton: null,
          body: null,
          asset: null,
        } as unknown as IAutoMovieModel,
      }).validation;
      return (
        hasPath(validation, "$input.materials") &&
        hasPath(validation, "$input.parts")
      );
    })(),
  );
  TestValidator.predicate(
    "malformed model id returns validation",
    (() => {
      const validation = app.validateModel({
        model: { ...model, id: undefined } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.id");
    })(),
  );
  TestValidator.predicate(
    "malformed model asset returns validation",
    (() => {
      const validation = app.validateModel({
        model: { ...model, asset: undefined } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.asset");
    })(),
  );
  TestValidator.predicate(
    "malformed model body returns validation",
    (() => {
      const validation = app.validateModel({
        model: { ...model, body: undefined } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.body");
    })(),
  );
  TestValidator.predicate(
    "malformed model body center of mass returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          body: {
            mass: 1,
            centerOfMass: undefined,
            friction: 0.5,
            restitution: 0.2,
          },
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.body.centerOfMass");
    })(),
  );
  TestValidator.predicate(
    "malformed model affordance entry returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          affordances: [undefined],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.affordances[0]");
    })(),
  );
  TestValidator.predicate(
    "malformed model affordance id returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          affordances: [
            {
              id: undefined,
              kind: "handle",
              frame: IDENTITY_TRANSFORM,
              extent: null,
            },
          ],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.affordances[0].id");
    })(),
  );
  TestValidator.predicate(
    "malformed model affordance frame returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          affordances: [
            {
              id: "handle-1",
              kind: "handle",
              frame: undefined,
              extent: null,
            },
          ],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.affordances[0].frame");
    })(),
  );
  TestValidator.predicate(
    "malformed model stack affordance extent returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          affordances: [
            {
              id: "top-1",
              kind: "stack-top",
              frame: IDENTITY_TRANSFORM,
              extent: undefined,
            },
          ],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.affordances[0].extent");
    })(),
  );
  TestValidator.predicate(
    "malformed model stack affordance extent point returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          affordances: [
            {
              id: "top-1",
              kind: "stack-top",
              frame: IDENTITY_TRANSFORM,
              extent: [
                undefined,
                { x: 0.5, y: 0, z: -0.5 },
                { x: 0, y: 0, z: 0.5 },
              ],
            },
          ],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.affordances[0].extent[0]");
    })(),
  );
  TestValidator.predicate(
    "malformed model skeleton object returns validation",
    (() => {
      const validation = app.validateModel({
        model: { ...model, skeleton: undefined } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.skeleton");
    })(),
  );
  TestValidator.predicate(
    "malformed model skeleton id returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          skeleton: { ...skeleton, id: undefined },
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.skeleton.id");
    })(),
  );
  TestValidator.predicate(
    "malformed model skeleton bone entry returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          skeleton: { ...skeleton, bones: [undefined] },
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.skeleton.bones[0]");
    })(),
  );
  TestValidator.predicate(
    "malformed model skeleton bone id returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          skeleton: {
            ...skeleton,
            bones: [{ ...skeleton.bones[0]!, bone: undefined }],
          },
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.skeleton.bones[0].bone");
    })(),
  );
  TestValidator.predicate(
    "malformed model skeleton bone rest returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          skeleton: {
            ...skeleton,
            bones: [{ ...skeleton.bones[0]!, rest: undefined }],
          },
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.skeleton.bones[0].rest");
    })(),
  );
  TestValidator.predicate(
    "malformed model skeleton bone constraint returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          skeleton: {
            ...skeleton,
            bones: [{ ...skeleton.bones[0]!, constraint: undefined }],
          },
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.skeleton.bones[0].constraint");
    })(),
  );
  TestValidator.predicate(
    "malformed model skeleton constraint angle range returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          skeleton: {
            ...skeleton,
            bones: [
              {
                ...skeleton.bones[0]!,
                constraint: {
                  flexion: undefined,
                  abduction: null,
                  twist: null,
                },
              },
            ],
          },
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.skeleton.bones[0].constraint.flexion");
    })(),
  );
  TestValidator.predicate(
    "malformed model part id returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          parts: [{ ...model.parts[0]!, id: undefined }],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.parts[0].id");
    })(),
  );
  TestValidator.predicate(
    "malformed model part material returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          parts: [{ ...model.parts[0]!, material: undefined }],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.parts[0].material");
    })(),
  );
  TestValidator.predicate(
    "malformed model part geometry returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          parts: [
            {
              ...model.parts[0]!,
              geometry: undefined,
            },
          ],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.parts[0].geometry");
    })(),
  );
  TestValidator.predicate(
    "malformed model primitive shape returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          parts: [
            {
              ...model.parts[0]!,
              geometry: { type: "primitive", shape: undefined },
            },
          ],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.parts[0].geometry.shape");
    })(),
  );
  TestValidator.predicate(
    "malformed model mesh payload returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          parts: [
            {
              ...model.parts[0]!,
              geometry: { type: "mesh", mesh: undefined },
            },
          ],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.parts[0].geometry.mesh");
    })(),
  );
  TestValidator.predicate(
    "malformed model mesh positions returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          parts: [
            {
              ...model.parts[0]!,
              geometry: {
                type: "mesh",
                mesh: {
                  positions: undefined,
                  normals: null,
                  uvs: null,
                  indices: null,
                  skin: null,
                },
              },
            },
          ],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.parts[0].geometry.mesh.positions");
    })(),
  );
  TestValidator.predicate(
    "malformed model mesh optional buffer returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          parts: [
            {
              ...model.parts[0]!,
              geometry: {
                type: "mesh",
                mesh: {
                  positions: [0, 0, 0],
                  normals: undefined,
                  uvs: null,
                  indices: null,
                  skin: null,
                },
              },
            },
          ],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.parts[0].geometry.mesh.normals");
    })(),
  );
  TestValidator.predicate(
    "malformed model mesh skin returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          parts: [
            {
              ...model.parts[0]!,
              geometry: {
                type: "mesh",
                mesh: {
                  positions: [0, 0, 0],
                  normals: null,
                  uvs: null,
                  indices: null,
                  skin: undefined,
                },
              },
            },
          ],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.parts[0].geometry.mesh.skin");
    })(),
  );
  TestValidator.predicate(
    "malformed model mesh skin buffer returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          parts: [
            {
              ...model.parts[0]!,
              geometry: {
                type: "mesh",
                mesh: {
                  positions: [0, 0, 0],
                  normals: null,
                  uvs: null,
                  indices: null,
                  skin: {
                    joints: ["hips"],
                    boneIndices: undefined,
                    weights: [1, 0, 0, 0],
                  },
                },
              },
            },
          ],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(
        validation,
        "$input.parts[0].geometry.mesh.skin.boneIndices",
      );
    })(),
  );
  TestValidator.predicate(
    "malformed model part transform returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          parts: [{ ...model.parts[0]!, transform: undefined }],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.parts[0].transform");
    })(),
  );
  TestValidator.predicate(
    "malformed model material id returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          materials: [{ ...model.materials[0]!, id: undefined }],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.materials[0].id");
    })(),
  );
  TestValidator.predicate(
    "malformed model material texture id returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          materials: [{ ...model.materials[0]!, baseColorTexture: undefined }],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.materials[0].baseColorTexture");
    })(),
  );
  TestValidator.predicate(
    "malformed model material base color returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          materials: [{ ...model.materials[0]!, baseColor: undefined }],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.materials[0].baseColor");
    })(),
  );
  TestValidator.predicate(
    "malformed model material emissive returns validation",
    (() => {
      const validation = app.validateModel({
        model: {
          ...model,
          materials: [{ ...model.materials[0]!, emissive: undefined }],
        } as unknown as IAutoMovieModel,
      }).validation;
      return hasPath(validation, "$input.materials[0].emissive");
    })(),
  );
  TestValidator.predicate(
    "malformed scene shape returns validation",
    (() => {
      const validation = app.validateScene({
        scene: { id: "scene-1" } as unknown as IAutoMovieScene,
        models: [{ id: model.id, skeleton }],
      }).validation;
      return (
        hasPath(validation, "$input.nodes") &&
        hasPath(validation, "$input.cameras") &&
        hasPath(validation, "$input.lights")
      );
    })(),
  );
  TestValidator.predicate(
    "malformed scene model registry entry returns validation",
    (() => {
      const validation = app.validateScene({
        scene: { ...scene, nodes: [] },
        models: [null as unknown as IAutoMovieModel],
      }).validation;
      return hasPath(validation, "$models[0]");
    })(),
  );
  TestValidator.predicate(
    "malformed shot shape returns validation",
    (() => {
      const validation = app.validateShot({
        shot: {
          id: "shot-1",
          scene: scene.id,
          camera: "camera",
          duration: 1,
        } as unknown as IAutoMovieShot,
        scene,
        motions: {},
      }).validation;
      return (
        hasPath(validation, "$input.performances") &&
        hasPath(validation, "$input.objectMotions")
      );
    })(),
  );
  TestValidator.predicate(
    "malformed sequence shape returns validation",
    (() => {
      const validation = app.validateSequence({
        sequence: {
          id: "seq-1",
          fps: 24,
        } as unknown as IAutoMovieSequence,
        shots: [shot],
      }).validation;
      return hasPath(validation, "$input.shots");
    })(),
  );
  TestValidator.predicate(
    "malformed sequence shot registry entry returns validation",
    (() => {
      const validation = app.validateSequence({
        sequence: { ...sequence, shots: [] },
        shots: [null as unknown as IAutoMovieShot],
      }).validation;
      return hasPath(validation, "$shots[0]");
    })(),
  );
};
