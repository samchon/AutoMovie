import {
  AutoMovieHumanoidBone,
  IAutoMovieModel,
  IAutoMovieModelPart,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import { DEFAULT_STICKMAN, buildStickman } from "./stickman";

/**
 * A **knight** rider, the stick figure dressed for the saddle: the same rig
 * and proportions as {@link buildStickman}, recoloured to steel, with a helmet
 * and plume on the head, a couched **lance** in the right hand, and a
 * **shield** on the left forearm.
 *
 * It is a plain {@link IAutoMovieModel} like any other; the mounted scene fixes
 * its root to the horse's saddle bone each frame via the engine's
 * `resolveAttachment`, while a riding clip articulates the body (legs gripping
 * the barrel, lance couched). Reuses the stick figure so a rider clip and a
 * foot-soldier clip share the exact same skeleton.
 *
 * @author Samchon
 */
const v = (x: number, y: number, z: number): IAutoMovieVector3 => ({ x, y, z });

const mat = (
  id: string,
  r: number,
  g: number,
  b: number,
  roughness = 0.5,
  metallic = 0,
) => ({
  id,
  name: id,
  baseColor: { r, g, b, a: 1, hex: null },
  metallic,
  roughness,
  emissive: null,
  opacity: 1,
  baseColorTexture: null,
});

export const buildKnight = (
  opts: { lance?: boolean } = {},
): {
  skeleton: IAutoMovieSkeleton;
  model: IAutoMovieModel;
} => {
  const withLance = opts.lance !== false;
  const { skeleton, model } = buildStickman(DEFAULT_STICKMAN);
  const hr = DEFAULT_STICKMAN.headRadius;
  const lower = DEFAULT_STICKMAN.lowerArm;

  const knob = (
    id: string,
    boneName: AutoMovieHumanoidBone,
    radius: number,
    material: string,
    offset: IAutoMovieVector3,
  ): IAutoMovieModelPart => ({
    id,
    name: id,
    geometry: { type: "primitive", shape: { type: "sphere", radius } },
    material,
    attachedBone: boneName,
    transform: at(offset),
  });
  const at = (
    t: IAutoMovieVector3,
    rot?: IAutoMovieModelPart["transform"],
  ) => ({
    translation: t,
    rotation: rot?.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  });

  const extras: IAutoMovieModelPart[] = [
    // helmet: a steel dome capping the crown (eyes stay visible below it)
    knob("helmet", "head", hr * 1.04, "steel", v(0, hr * 0.42, -0.01)),
    // nose guard: a thin steel bar down the front of the face
    {
      id: "noseGuard",
      name: "noseGuard",
      geometry: {
        type: "primitive",
        shape: {
          type: "box",
          width: hr * 0.16,
          height: hr * 1.1,
          depth: hr * 0.16,
        },
      },
      material: "steel",
      attachedBone: "head",
      transform: at(v(0, hr * 0.95, hr * 1.02)),
    },
    // plume: a red crest on top of the helmet
    knob("plume1", "head", hr * 0.34, "plume", v(0, hr * 1.7, -0.04)),
    knob("plume2", "head", hr * 0.28, "plume", v(0, hr * 1.78, -0.18)),
    knob("plume3", "head", hr * 0.22, "plume", v(0, hr * 1.7, -0.3)),
    // lance: a long shaft couched along the right hand, pointing forward (+Z)
    {
      id: "lance",
      name: "lance",
      geometry: {
        type: "primitive",
        shape: { type: "capsule", radius: 0.022, height: 1.5 },
      },
      material: "lance",
      attachedBone: "rightHand",
      transform: at(v(0, 0, 0.55 + lower)),
    },
    {
      id: "lanceTip",
      name: "lanceTip",
      geometry: {
        type: "primitive",
        shape: { type: "cone", radius: 0.05, height: 0.16 },
      },
      material: "steel",
      attachedBone: "rightHand",
      transform: at(v(0, 0, 1.33 + lower)),
    },
    {
      id: "lanceGrip",
      name: "lanceGrip",
      geometry: { type: "primitive", shape: { type: "sphere", radius: 0.06 } },
      material: "lance",
      attachedBone: "rightHand",
      transform: at(v(0, 0, -0.14 + lower)),
    },
    // shield: a rounded plate on the left forearm, facing out (−X / forward)
    {
      id: "shield",
      name: "shield",
      geometry: {
        type: "primitive",
        shape: { type: "cylinder", radius: 0.18, height: 0.04 },
      },
      material: "shield",
      attachedBone: "leftLowerArm",
      transform: {
        translation: v(lower * 0.5, 0, 0.06),
        // lay the disc flat against the forearm, facing forward
        rotation: { x: 0.7071, y: 0, z: 0, w: 0.7071 },
        scale: { x: 1, y: 1, z: 1 },
      },
    },
    knob("shieldBoss", "leftLowerArm", 0.045, "steel", v(lower * 0.5, 0, 0.12)),
  ];

  // recolour the figure: ink (rods/joints) → steel-blue; keep eye/pupil; add
  // the plume / lance / shield palette
  const materials = [
    mat("ink", 0.46, 0.5, 0.56, 0.45, 0.2), // armoured steel-blue body
    ...model.materials.filter((m) => m.id === "eye" || m.id === "pupil"),
    mat("steel", 0.62, 0.66, 0.72, 0.35, 0.4),
    mat("plume", 0.74, 0.12, 0.12, 0.5),
    mat("lance", 0.4, 0.26, 0.13, 0.6),
    mat("shield", 0.2, 0.28, 0.5, 0.4),
  ];

  return {
    skeleton: { ...skeleton, id: "knight" },
    model: {
      ...model,
      id: "knight",
      name: "knight",
      parts: [
        ...model.parts,
        ...extras.filter(
          (p) =>
            withLance || !["lance", "lanceTip", "lanceGrip"].includes(p.id),
        ),
      ],
      materials,
    },
  };
};
